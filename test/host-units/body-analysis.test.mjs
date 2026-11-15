import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { Session } from "node:inspector";
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { checkCoverage } from "../architecture/host/coverage.mjs";
import { parseSources } from "../architecture/host/import-graph.mjs";
import { add, plus, shaped } from "./fixtures/lower-mir/programs/first.mjs";
import { T, TABLE, bodyId, builders, declareType, def, native, seal, signature, typedBody, verificationContext } from "./fixtures/lower-mir/typed.mjs";
import { executionKey, sameInstance } from "../../packages/host/dist/ir-types/index.js";
import { factBindingInputs, summaryBindingInputs } from "../../packages/host/dist/ir-facts/binding-inputs.js";
import { lowerToMir } from "../../packages/host/dist/lower-mir/index.js";
import { verifyMir } from "../../packages/host/dist/ir-mir/index.js";
import { analyzeStorageUse } from "../../packages/host/dist/analyses/liveness/index.js";
import { accountFailure, createAccount, refuseAccount } from "../../packages/host/dist/dataflow/index.js";
import { iterateChildrenOfSyntax } from "../../packages/host/dist/ir-hir/index.js";
import { verifyFacts, verifySummary, printFacts, parseFacts, printSummary, parseSummary } from "../../packages/host/dist/ir-facts/index.js";
import { resourceLimitDiagnostic } from "../../packages/host/dist/diag/index.js";

const limits = { maximumWork: 1000000, maximumResultEntries: 1000000 };
const analysisLimits = { maximumProjectionDepth: 64, maximumOriginAlternatives: 128, maximumConditionAlternatives: 128,
  maximumRelationalRecordsPerBody: 100000, maximumRelationalReferencesPerBody: 100000 };
const scope = { classParameters: [], methodParameters: [], capturedParameters: [], selfOwners: [] };
const repository = fileURLToPath(new URL("../../", import.meta.url));
const runtimeFiles = ["index", "round", "storage", "source", "proof", "calls"].map(name => resolve(repository, `packages/host/dist/analyses/body/${name}.js`));
const session = new Session();
const post = (method, parameters = {}) => new Promise((done, reject) =>
  session.post(method, parameters, (error, value) => error === null ? done(value) : reject(error)));
let analyzeBodyRound;
let proveInitialization;
let solveAssigned;
let sourceOccurrences;
let orderedRows;
let transferAssigned;
let statementOperands;
let terminatorOperands;
let readLocal;
let assignedLattice;
let assignedEntry;
let bodyNodes;
let callSummary;
let applyScalarCall;

before(async () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true, "the aggregate owner guard admitted this process");
  session.connect();
  await post("Debugger.enable");
  await post("Profiler.enable");
  await post("Profiler.startPreciseCoverage", { callCount: true, detailed: true });
  ({ analyzeBodyRound, proveInitialization } = await import("../../packages/host/dist/analyses/body/index.js"));
  ({ solveAssigned, transferAssigned, statementOperands, terminatorOperands, readLocal, assignedLattice, assignedEntry } =
    await import("../../packages/host/dist/analyses/body/storage.js"));
  ({ sourceOccurrences, orderedRows } = await import("../../packages/host/dist/analyses/body/source.js"));
  ({ bodyNodes } = await import("../../packages/host/dist/ir-facts/verify-body-nodes.js"));
  ({ callSummary, applyScalarCall } = await import("../../packages/host/dist/analyses/body/calls.js"));
});

after(async () => {
  try {
    const capture = await post("Profiler.takePreciseCoverage");
    const urls = new Set(runtimeFiles.map(file => pathToFileURL(file).href));
    const result = capture.result.filter(script => urls.has(script.url));
    const sources = [];
    for (const script of result) {
      const source = await post("Debugger.getScriptSource", { scriptId: script.scriptId });
      sources.push({ scriptId: script.scriptId, url: script.url, text: source.scriptSource });
    }
    const report = checkCoverage({ canonical: realpathSync, readText: path => readFileSync(path, "utf8"), parse: parseSources,
      project: (url, text) => ({ path: fileURLToPath(url), text }) }, runtimeFiles, [{ ...capture, result, sources }]);
    mkdirSync(resolve(repository, ".temp/body-analysis-coverage"), { recursive: true });
    writeFileSync(resolve(repository, ".temp/body-analysis-coverage/report.json"), JSON.stringify(report, null, 2));
    assert.equal(report.status, "passed", JSON.stringify(report.findings));
  } finally {
    await post("Profiler.stopPreciseCoverage");
    session.disconnect();
  }
});

function fixture(program, internal = [], provided = TABLE.signatures[program.tir.signature].parameters.length) {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true, "the real aggregate guard admitted this test");
  const typeOf = type => TABLE.terms[type];
  const signatureOf = selected => TABLE.signatures[selected];
  const execution = { instance: { body: program.tir.body, bindings: program.tir.bindings }, provided };
  const unit = { query: "bodyRound", key: executionKey(execution) };
  const lowered = lowerToMir({ typeOf, signatureOf, limits: { maximumRecords: 10000 },
    defs: { completionSelector: T.int32, exceptionStorage: T.unknown }, unit: { request: unit, position: { kind: "result" } } }, program.tir, internal);
  assert.equal(lowered.kind, "ok", "the real LowerMir producer completes");
  assert.deepEqual(verifyMir(lowered.value, verificationContext(program)), { kind: "complete", violations: [] });
  const account = createAccount(limits);
  const storage = analyzeStorageUse({ account }, { execution, body: lowered.value });
  assert.equal(storage.kind, "ok", "the actual MIR-only Liveness producer completes");
  const input = { execution, mir: lowered.value, tir: program.tir, liveness: storage.value };
  const deps = { types: TABLE, typeOf, signatureOf, summaryOf: () => { throw new Error("A call-free actual body has no Summary demand"); },
    account, limits: analysisLimits, unit };
  return { program, execution, input, deps };
}

function checkedPair(current, result) {
  assert.equal(result.kind, "complete");
  assert.equal(result.value.kind, "ok");
  const pair = result.value.value;
  assert.equal("facts" in pair, true, "a successful round has its genuine projection pair");
  const nodes = new Map();
  const pending = [current.program.tir.root, ...current.program.tir.params];
  for (let node = pending.pop(); node !== undefined; node = pending.pop()) {
    nodes.set(node.id, node);
    for (const child of iterateChildrenOfSyntax(node)) pending.push(child);
  }
  const ready = [current, ...(current.related ?? [])];
  const readyBody = instance => ready.find(row => sameInstance(row.execution.instance, instance));
  const readyOwner = definition => ready.find(row => row.program.tir.owner === definition);
  const context = { types: TABLE, limits: current.deps.limits, diagnostics: [],
    tirBody: instance => readyBody(instance)?.program.tir ?? null,
    mirBody: instance => readyBody(instance)?.input.mir ?? null,
    bodyOwner: body => ready.find(row => row.program.tir.body === body)?.program.tir.owner ?? null,
    definitionExists: definition => readyOwner(definition) !== undefined,
    declarationSourceOf: definition => definition === current.program.tir.owner ? { kind: "body", value: current.program.nodeRef(0) } : null,
    bindingScopeOf: definition => readyOwner(definition) === undefined ? null : scope,
    bindingScopesOf: target => [...(target.kind === "body" ? factBindingInputs(pair.facts, context)
      : summaryBindingInputs(pair.summary, context))].filter(row => row !== null).map(row => {
      assert.equal(readyOwner(row.definition) !== undefined, true, "each actual binding occurrence has its checked owner");
      return scope;
    }), nominalOf: () => null,
    nodeExists: selected => selected.kind === "body" ? selected.value.body === current.program.tir.body && nodes.has(selected.value.node)
      : current.program.tir.params.some(header => header.tsonic.declaration === selected.value.owner && nodes.has(selected.value.node)),
    localExists: local => local.body === current.program.tir.body && current.program.tir.locals[local.local]?.id === local.local,
    signatureIdOf: () => null, bindingDependentOf: definition => readyOwner(definition)?.program.tir.dependence === "binding-dependent",
    captureCount: key => key.kind === "body" ? readyBody(key.execution.instance)?.program.tir.captures.length ?? null : null,
    callbackSignaturesOf: () => null, metadataOf: () => null, libraryExportExists: () => false, declaredSiteCount: () => null,
    arenaOf: () => pair.facts.arena, summaryOf: () => pair.summary };
  const account = createAccount(limits);
  assert.deepEqual(verifyFacts(pair.facts, current.input.mir, context, account), { kind: "complete", violations: [] }, "the real Facts barrier accepts producer output");
  const conditionRefusal = { kind: "refused", diagnostics: [resourceLimitDiagnostic({ owner: "analyses/initialization",
    limit: "analysis.maximumConditionAlternatives", maximum: current.deps.limits.maximumConditionAlternatives,
    site: { kind: "source", origin: current.program.tir.root.origin }, unit: { request: current.deps.unit, position: { kind: "result" } } })] };
  assert.deepEqual(verifySummary(pair.summary, context, { account, conditionRefusal }),
    { kind: "complete", violations: [] }, "the real complete Summary barrier accepts the same projection");
  const factsText = parseFacts(printFacts(pair.facts));
  const summaryText = parseSummary(printSummary(pair.summary));
  assert.equal(factsText.kind, "parsed", factsText.kind === "parsed" ? "canonical Facts text" : JSON.stringify(factsText));
  assert.equal(summaryText.kind, "parsed", summaryText.kind === "parsed" ? "canonical Summary text" : JSON.stringify(summaryText));
  return pair;
}

const TRUE_LITERAL = declareType("body-round.true", { kind: "literal", value: { kind: "boolean", value: true }, base: T.bool });
const DEFAULT_BODY = bodyId("body-round.default.argument", "default-argument");
const DEFAULT_SIGNATURE = signature("body-round.default.argument", [], T.bool);
const CALLER_SIGNATURE = signature("body-round.default", [["argument", T.bool, "default", DEFAULT_BODY]], T.bool);

function defaultProgram() {
  const builder = builders("body-round.default");
  const program = typedBody("body-round.default", { signature: CALLER_SIGNATURE, completion: T.bool,
    locals: [["argument", "parameter", T.bool]], params: [[0, "default", T.bool, DEFAULT_BODY]], nestedBodies: [DEFAULT_BODY],
    root: builder.block(builder.returns(builder.id("argument", 0, T.bool))) });
  const childBuilder = builders("body-round.default.argument", "default-argument");
  const literal = childBuilder.keyword("TrueKeyword", TRUE_LITERAL);
  const child = typedBody("body-round.default.argument", { role: "default-argument", signature: DEFAULT_SIGNATURE, completion: T.bool, root: literal });
  child.tir.root = seal("body-round.default.argument", literal, "default-argument", program.nodeCount).root;
  const header = program.tir.params[0];
  child.tir.root.parent = header.id;
  const embedding = { kind: "conversion", conversion: "literal-fit", check: { kind: "none" }, proof: {
    steps: [{ from: { root: { kind: "body", value: { body: child.tir.body, node: child.tir.root.id } }, path: [] },
      to: { root: { kind: "item", value: { owner: header.tsonic.declaration, node: header.id } }, path: [] },
      rule: "literal-fit", premises: [] }], conclusion: 0 } };
  child.tir.root.tsonic.convertedType = T.bool;
  child.tir.root.tsonic.conversion = { kind: "convert", role: "initialization", operation: { permissionScope: null, decision: {
    kind: "selected", operation: { kind: "conversion", from: TRUE_LITERAL, to: T.bool, embedding },
    operands: [TRUE_LITERAL], result: T.bool, execution: { kind: "pure" } } } };
  header.initializer = child.tir.root;
  const internal = [{ instance: { body: child.tir.body, bindings: child.tir.bindings }, signature: child.tir.signature, captures: [] }];
  program.bodyOf = instance => sameInstance(instance, internal[0].instance) ? child.tir : null;
  return { program, child, internal };
}

function defaultRound() {
  const { program, child, internal } = defaultProgram();
  const initializer = fixture(child);
  const completed = analyzeBodyRound(initializer.deps, initializer.input);
  const childPair = checkedPair(initializer, completed);
  const current = fixture(program, internal, 0);
  current.related = [initializer];
  const unit = { request: initializer.deps.unit, position: { kind: "result" } };
  current.deps.summaryOf = key => {
    assert.equal(executionKey(key.execution), executionKey(initializer.execution));
    return { value: childPair.summary, unit };
  };
  const block = current.input.mir.blocks.find(row => row.terminator.kind === "call");
  return { current, initializer, childPair, unit, operation: block.terminator, point: { block: block.id, statement: null } };
}

test("an omitted actual boolean default calls its separately analyzed scalar initializer at the exact MIR occurrence", () => {
  const { program, child, internal } = defaultProgram();
  const initializer = fixture(child);
  const completed = analyzeBodyRound(initializer.deps, initializer.input);
  const childPair = checkedPair(initializer, completed);
  assert.equal(initializer.input.mir.blocks.some(block => block.statements.some(row => row.kind === "assign" && row.value.kind === "convert")), true);
  const current = fixture(program, internal, 0);
  current.related = [initializer];
  let demands = 0;
  current.deps.summaryOf = key => {
    demands += 1;
    assert.equal(executionKey(key.execution), executionKey(initializer.execution));
    return { value: childPair.summary, unit: { request: initializer.deps.unit, position: { kind: "result" } } };
  };
  const pair = checkedPair(current, analyzeBodyRound(current.deps, current.input));
  assert.equal(demands > 0, true);
  const calls = current.input.mir.blocks.filter(block => block.terminator.kind === "call");
  assert.equal(calls.length, 1);
  assert.deepEqual(pair.facts.origins.activations[0].point, { block: calls[0].id, statement: null });
  assert.equal(sameInstance(pair.facts.origins.activations[0].activation, initializer.execution.instance), true);
  assert.equal(pair.facts.origins.invocations.length, 0, "a placed body call fabricates no surface invocation alternative");
  assert.equal(pair.facts.initialization.reads.every(row => row.assigned), true);
  const supplied = fixture(program, internal, 1);
  checkedPair(supplied, analyzeBodyRound(supplied.deps, supplied.input));
});

test("every call-round allowance prefix preserves the original stop, and exact admission initializes only its actual destination", () => {
  const { current } = defaultRound();
  for (const dimension of ["maximumWork", "maximumResultEntries"]) {
    let required = null;
    for (let maximum = 0; maximum < 10000; maximum += 1) {
      const account = createAccount({ ...limits, [dimension]: maximum });
      const result = analyzeBodyRound({ ...current.deps, account }, current.input);
      if (result.kind === "complete") {
        assert.equal(result.value.value.facts.initialization.reads.every(row => row.assigned), true);
        required = maximum;
        break;
      }
      assert.equal(result, accountFailure(account));
      assert.equal(analyzeBodyRound({ ...current.deps, account }, new Proxy({}, { get() { throw new Error("no input read after stop"); } })), result);
    }
    assert.equal(required !== null && required > 0, true, "the complete same traversal has a finite exact allowance");
  }
});

test("a called semantic error keeps its actual completed UnitRef through the solved lattice and result position", () => {
  const { current, unit, operation } = defaultRound();
  const error = { kind: "error", causes: [] };
  const read = () => ({ value: error, unit });
  const deps = { ...current.deps, account: createAccount(limits), summaryOf: read };
  const result = analyzeBodyRound(deps, current.input);
  assert.equal(result.kind, "complete");
  assert.deepEqual(result.value.value.causes, [{ kind: "unit", unit }]);
  assert.equal(result.value.value.causes[0].unit, unit);
  assert.equal(result.value.positions[0].error, result.value.value);
  assert.deepEqual(result.value.emissions, []);
  assert.deepEqual(result.value.diagnostics, []);
  for (const dimension of ["maximumWork", "maximumResultEntries"]) {
    let complete = false;
    for (let maximum = 0; maximum < 10000; maximum += 1) {
      const account = createAccount({ ...limits, [dimension]: maximum });
      const response = analyzeBodyRound({ ...deps, account }, current.input);
      if (response.kind === "complete") { complete = true; break; }
      assert.equal(response, accountFailure(account));
    }
    assert.equal(complete, true);
  }
  const stopped = createAccount(limits);
  const refused = { kind: "refused", diagnostics: [resourceLimitDiagnostic({ owner: "analyses/origins", limit: "analysis.maximumOriginAlternatives",
    maximum: 0, site: { kind: "source", origin: operation.origin }, unit })] };
  const response = callSummary({ ...deps, account: stopped, summaryOf: () => {
    refuseAccount(stopped, refused);
    return new Proxy({}, { get() { throw new Error("a stopped callback answer is never read"); } });
  } }, current.input.mir, operation);
  assert.equal(response, refused);
});

test("call identity, selected storage and missing effect relations are checked before any invented success", () => {
  const { current, childPair, unit, operation, point } = defaultRound();
  const summary = childPair.summary;
  const run = (selected = operation, answer = summary, overrides = {}) => callSummary({ ...current.deps,
    account: createAccount(limits), summaryOf: () => ({ value: answer, unit }), ...overrides }, current.input.mir, selected);
  for (const callee of [{ kind: "direct" }, { ...operation.callee, captures: [0] }])
    assert.throws(() => run({ ...operation, callee }), /actual selected argument, receiver and capture transport/);
  assert.throws(() => run({ ...operation, receiver: { kind: "constant", constant: 0 } }), /actual selected argument/);
  assert.throws(() => run({ ...operation, arguments: [{}] }), /actual selected argument/);
  assert.throws(() => run(operation, { ...summary, key: { ...summary.key,
    execution: { ...summary.key.execution, provided: 1 } } }), /exact complete selected execution/);
  for (const selected of [{ ...TABLE.signatures[summary.signature], receiver: T.bool },
    { ...TABLE.signatures[summary.signature], parameters: TABLE.signatures[CALLER_SIGNATURE].parameters }])
    assert.throws(() => run(operation, summary, { signatureOf: () => selected }), /actual selected argument mapping/);
  assert.throws(() => run({ ...operation, destination: 9999 }), /actual selected destination storage/);
  assert.equal(run({ ...operation, destination: null }).kind, "complete");
  for (const flag of ["unwinds", "suspends"])
    assert.throws(() => run(operation, { ...summary, [flag]: true }), /actual unwind or suspension/);
  const arena = analyzeBodyRound({ ...current.deps, account: createAccount(limits) }, current.input).value.value.facts.arena;
  const apply = (answer, overrides = {}) => applyScalarCall({ ...current.deps, account: createAccount(limits), ...overrides },
    current.input, operation, point, answer, arena, 1);
  assert.throws(() => apply({ ...summary, arena: { ...summary.arena, cells: [{}] } }), /actual caller-cell bindings/);
  const absent = { ...summary.arena.origins[0], id: 1, includesAbsence: true };
  const absentArena = { ...summary.arena, origins: [...summary.arena.origins, absent] };
  for (const field of ["result", "thrown"])
    assert.throws(() => apply({ ...summary, arena: absentArena, [field]: 1 }), /actual Origins result and thrown-value binding/);
  assert.throws(() => apply({ ...summary, parameters: [{ slot: { kind: "parameter", index: 0 },
    reads: { kind: "complete", paths: [] }, writes: { kind: "complete", paths: [] } }] }), /actual caller cell, event, callback or backing producer/);
  const pending = { ...summary, initialization: { ...summary.initialization,
    points: [{ kind: "unwind" }], rows: [{ point: 0, cell: null, condition: 0 }] } };
  assert.throws(() => apply(pending), /actual supplied cell and completion-event bindings/);
  for (const dimension of ["maximumWork", "maximumResultEntries"]) {
    for (const operationOf of [account => run(operation, summary, { account }), account => apply(summary, { account })]) {
      let complete = false;
      for (let maximum = 0; maximum < 10000; maximum += 1) {
        const account = createAccount({ ...limits, [dimension]: maximum });
        const response = operationOf(account);
        if (response.kind === "complete") { complete = true; break; }
        assert.equal(response, accountFailure(account));
        assert.equal(operationOf(account), response);
      }
      assert.equal(complete, true);
    }
  }
});

test("called errors are monotone definite-state lattice members, not copied diagnostics or resource stops", () => {
  const { current, unit, operation } = defaultRound();
  const first = { kind: "error", key: "a", unit };
  const later = { kind: "error", key: "z", unit: { request: current.deps.unit, position: { kind: "result" } } };
  const assigned = new Set([0]);
  const lattice = assignedLattice(4);
  assert.equal(lattice.join(first, assigned, createAccount(limits)), first);
  assert.equal(lattice.join(assigned, first, createAccount(limits)), first);
  assert.equal(lattice.join(first, later, createAccount(limits)), first);
  assert.equal(lattice.join(later, first, createAccount(limits)), first);
  assert.equal(lattice.equals(first, later, createAccount(limits)), false);
  assert.equal(lattice.equals(first, assigned, createAccount(limits)), false);
  assert.equal(lattice.equals(assigned, first, createAccount(limits)), false);
  assert.equal(lattice.equals(first, { ...first }, createAccount(limits)), true);
  for (const maximumWork of [0, 1]) {
    const account = createAccount({ ...limits, maximumWork });
    assert.equal(lattice.join(later, first, account), later);
    assert.equal(lattice.equals(first, { ...first }, account), true);
    assert.equal(accountFailure(account).kind, "resource-limit");
  }
  assert.throws(() => assignedEntry([first], 0), /actual solved initialization entry/);
  assert.equal(transferAssigned(current.input.mir, { kind: "storage-live", local: 0 }, first, createAccount(limits)), first);
  const callBlock = current.input.mir.blocks.find(block => block.terminator === operation);
  const next = current.input.mir.blocks[operation.next];
  const blocks = current.input.mir.blocks.map(block => block === next ? { ...block, statements: [], terminator: operation } : block);
  const response = solveAssigned({ ...current.deps, account: createAccount(limits),
    summaryOf: () => ({ value: { kind: "error", causes: [] }, unit }) }, { ...current.input, mir: { ...current.input.mir, blocks } });
  assert.equal(response.kind, "complete");
  assert.equal(response.value.error.unit, unit);
  assert.equal(response.value.entry[callBlock.id] instanceof Set, true);
});

test("actual call continuations honor no-return, existing local writes and relational growth refusal", () => {
  const { current, childPair, operation, unit } = defaultRound();
  const summary = childPair.summary;
  const noReturn = { ...current.deps, account: createAccount(limits),
    summaryOf: () => ({ value: { ...summary, returns: false, initialization: { ...summary.initialization, points: [], rows: [] } }, unit }) };
  const result = analyzeBodyRound(noReturn, current.input);
  assert.equal(result.kind, "complete");
  assert.equal(result.value.value.summary.returns, false, "a structurally reachable continuation is not reached after a non-returning selected callee");
  assert.equal(result.value.value.facts.origins.subjects.length, 0);
  const next = current.input.mir.blocks[operation.next];
  const blocks = current.input.mir.blocks.map(block => block === next ? { ...block, statements: [], terminator: operation } : block);
  const stopped = solveAssigned({ ...noReturn, account: createAccount(limits) }, { ...current.input, mir: { ...current.input.mir, blocks } });
  assert.equal(stopped.kind, "complete");
  assert.equal(stopped.value.entry[next.id], null);
  const callBlock = current.input.mir.blocks.find(block => block.terminator === operation);
  const constant = { id: current.input.mir.constants.length, type: T.bool, value: { kind: "literal", value: { kind: "boolean", value: true } } };
  const assign = { kind: "assign", origin: operation.origin, tir: operation.tir, step: null, place: operation.destination,
    value: { kind: "use", operand: { kind: "constant", constant: constant.id } } };
  const initialized = { ...current.input, mir: { ...current.input.mir, constants: [...current.input.mir.constants, constant],
    blocks: current.input.mir.blocks.map(block => block === callBlock ? { ...block, statements: [...block.statements, assign] } : block) } };
  assert.deepEqual(verifyMir(initialized.mir, verificationContext(current.program)), { kind: "complete", violations: [] });
  const mutated = analyzeBodyRound({ ...current.deps, account: createAccount(limits) }, initialized);
  assert.equal(mutated.kind, "complete");
  assert.equal(mutated.value.value.facts.origins.writes.some(row => row.point.block === callBlock.id
    && row.point.statement === null && row.operation === "mutation"), true);
  const badDestination = { ...current.input, mir: { ...current.input.mir,
    places: current.input.mir.places.map(place => place.id === operation.destination ? { ...place,
      base: { kind: "static", definition: current.program.tir.owner, bindings: current.program.tir.bindings } } : place) } };
  assert.throws(() => solveAssigned({ ...current.deps, account: createAccount(limits) }, badDestination), /actual selected logical-cell binding/);
  const capAccount = createAccount(limits);
  const capped = analyzeBodyRound({ ...current.deps, account: capAccount,
    limits: { ...analysisLimits, maximumRelationalRecordsPerBody: 3 } }, current.input);
  assert.equal(capped.kind, "refused");
  assert.equal(capped, accountFailure(capAccount));
  assert.equal(capped.diagnostics.length, 1);
  let reads = 0;
  const solved = solveAssigned({ ...current.deps, account: createAccount(limits), summaryOf: key => {
    reads += 1;
    return current.deps.summaryOf(key);
  } }, current.input);
  assert.equal(solved.kind, "complete");
  let rereads = 0;
  const late = analyzeBodyRound({ ...current.deps, account: createAccount(limits), summaryOf: key => {
    rereads += 1;
    return rereads <= reads ? current.deps.summaryOf(key) : { value: { kind: "error", causes: [] }, unit };
  } }, current.input);
  assert.equal(late.kind, "complete");
  assert.equal(late.value.value.causes[0].unit, unit, "a reread error cannot become a partial successful projection");
});

test("a real selected float64 add produces complete BodyFacts and its whole stable Summary projection", () => {
  const current = fixture(add("body-round.float-add", T.float64, plus("float64", T.float64)));
  const pair = checkedPair(current, analyzeBodyRound(current.deps, current.input));
  assert.equal(pair.facts.liveness, current.input.liveness, "the round borrows the once-produced actual Liveness family");
  assert.equal(pair.summary.arena, pair.facts.arena);
  assert.equal(pair.summary.parameters.length, 2);
  assert.deepEqual(pair.summary.arena.producers, [
    { id: 0, path: null, kind: "parameter", index: 0 }, { id: 1, path: null, kind: "parameter", index: 1 }]);
  assert.deepEqual(pair.summary.arena.boundProducers, [], "a scalar formal symbol alone supplies no reference or alias proof");
  assert.deepEqual(pair.summary.arena.origins[0].producers, [], "actual scalar reference provenance remains empty");
  assert.equal(pair.summary.returns, true);
  assert.equal(pair.summary.unwinds, false);
  assert.equal(pair.facts.origins.writes.length > 0, true, "actual lowered assignments produce write observations");
  assert.equal(pair.facts.initialization.reads.length > 0, true, "actual parameter and result reads are analyzed");
  assert.equal(pair.facts.refinements.integers.length > 0, true, "every selected value occurrence retains an explicit integer-proof disposition");
  const proof = proveInitialization({ account: createAccount(limits), unit: current.deps.unit,
    summaryOf: () => ({ value: pair.summary, unit: { request: current.deps.unit, position: { kind: "result" } } }) },
    { modules: [], entries: [current.execution], storage: [] });
  assert.equal(proof.kind, "complete");
  assert.equal(proof.value.value.entries[0], current.execution);
});

test("an actual empty module traverses its MIR return and proves no storage or callable obligations", () => {
  const name = "body-round.empty-module";
  const program = typedBody(name, { role: "module", signature: signature(name, [], T.void), completion: T.void,
    root: { kind: "SourceFile", statements: { $list: true, nodes: [] }, endOfFileToken: { kind: "EndOfFile", tsonic: null },
      languageVariant: "Standard", scriptKind: "TS", commentDirectives: [], pragmas: [], checkJsDirective: null,
      tsonic: { module: "M[P[p];m]", template: null } } });
  const current = fixture(program);
  const pair = checkedPair(current, analyzeBodyRound(current.deps, current.input));
  assert.equal(pair.summary.returns, true);
  assert.equal(pair.facts.origins.writes.length, 0);
  const proof = proveInitialization({ account: createAccount(limits), unit: current.deps.unit,
    summaryOf: () => ({ value: pair.summary, unit: { request: current.deps.unit, position: { kind: "result" } } }) },
    { modules: [current.execution], entries: [], storage: [] });
  assert.equal(proof.kind, "complete");
  assert.equal(proof.value.positions[0].error, null);
});

test("zero and every smaller supplied account refuse without partial successful facts or a second allowance", () => {
  const unread = new Proxy({}, { get() { throw new Error("no source input read without entry admission"); } });
  const sourceAccount = createAccount({ ...limits, maximumWork: 0 });
  const sourceStop = sourceOccurrences(unread, sourceAccount);
  assert.equal(sourceStop.kind, "resource-limit");
  assert.equal(sourceOccurrences(unread, sourceAccount), sourceStop);
  const factsAccount = createAccount({ ...limits, maximumWork: 0 });
  const factsStop = bodyNodes(unread, factsAccount);
  assert.equal(factsStop.kind, "resource-limit");
  assert.equal(bodyNodes(unread, factsAccount), factsStop);
  const current = fixture(add("body-round.shared-account", T.float64, plus("float64", T.float64)));
  for (const maximumWork of [0, 1, 5, 30, 100]) {
    const account = createAccount({ ...limits, maximumWork });
    const result = analyzeBodyRound({ ...current.deps, account }, current.input);
    assert.equal(result.kind, "resource-limit");
    const stopped = analyzeBodyRound({ ...current.deps, account }, new Proxy({}, { get() { throw new Error("no input read after original stop"); } }));
    assert.equal(stopped, result, "sticky first stop is the same original object");
  }
});

test("a genuine different selected body is a caller defect, never empty facts", () => {
  const current = fixture(add("body-round.identity", T.float64, plus("float64", T.float64)));
  const other = fixture(add("body-round.identity.other", T.float64, plus("float64", T.float64)));
  assert.throws(() => analyzeBodyRound(current.deps, { ...current.input, tir: other.input.tir }), /same complete selected execution/);
});

test("selected provided entries initialize only supplied formals and actual omission prologue writes", () => {
  const optional = declareType("bodyRoundOptionalBool", { kind: "optional", value: T.bool });
  const current = fixture(shaped("body-round.optional", [["flag", "optional", optional]], T.void, builder => builder.block()));
  for (const provided of [0, 1]) {
    const entry = current.input.mir.entries.find(row => row.provided === provided);
    assert.equal(entry !== undefined, true, "the actual LowerMir producer offers this selected entry");
    const result = solveAssigned({ ...current.deps, account: createAccount(limits) },
      { ...current.input, execution: { ...current.execution, provided } });
    assert.equal(result.kind, "complete");
    assert.equal(result.value.entry[entry.block].has(0), provided === 1, "omitted storage is not prematurely initialized at entry");
    assert.equal(result.value.entry[0].has(0), true, "the actual omission prologue assignment establishes initialization before the full body");
  }
});

test("a real unwritten local produces one original initialization error and no fabricated Summary", () => {
  const name = "body-round.unwritten";
  const builder = builders(name);
  const declaration = builder.variable(builder.declName("slot", 0), 0, T.int32);
  declaration.$ = "slot";
  const program = typedBody(name, { signature: signature(name, [], T.int32), completion: T.int32,
    locals: [["slot", "binding", T.int32, true]],
    root: builder.block(builder.declare([declaration]), builder.returns(builder.id("slot", 0, T.int32))) });
  program.tir.locals[0].declaration = { kind: "body", value: program.nodeRef("slot") };
  const current = fixture(program);
  const result = analyzeBodyRound(current.deps, current.input);
  assert.equal(result.kind, "complete");
  assert.equal(result.value.kind, "ok");
  assert.equal(result.value.value.kind, "error");
  assert.equal(result.value.positions[0].error, result.value.value, "the identical ErrorValue occupies the actual result position");
  assert.equal(result.value.diagnostics[0].code.rendered, "TSONIC_READ_BEFORE_INITIALIZATION");
  assert.equal(result.value.emissions[0].diagnostic, result.value.diagnostics[0]);
  assert.equal("summary" in result.value.value, false);
  const origin = { request: current.deps.unit, position: { kind: "result" } };
  const proof = proveInitialization({ account: createAccount(limits), unit: { query: "initializationProof", key: [name] },
    summaryOf: () => ({ value: result.value.value, unit: origin }) }, { modules: [], entries: [current.execution], storage: [] });
  assert.equal(proof.kind, "complete");
  assert.equal(proof.value.value.kind, "error");
  assert.deepEqual(proof.value.value.causes, [{ kind: "unit", unit: origin }]);
  assert.equal(proof.value.value.causes[0].unit, origin, "absorption retains the actual completed semantic position");
  assert.equal(proof.value.positions[0].error, proof.value.value);
  assert.deepEqual(proof.value.diagnostics, []);
  assert.deepEqual(proof.value.emissions, []);
});

test("returning actual string or enum storage requires Origins evidence, never empty backing facts", () => {
  const enumeration = declareType("bodyRoundReferenceEnum", { kind: "enum", definition: "D[M[P[p];m];bodyRoundEnum]" });
  for (const [name, type] of [["body-round.string", T.string], ["body-round.enum", enumeration]]) {
    const current = fixture(shaped(name, [["input", "required", type]], type,
      builder => builder.block(builder.returns(builder.id("input", 0, type)))));
    assert.throws(() => analyzeBodyRound(current.deps, current.input), /actual Origins reference\/cell producer/);
  }
});

test("every prefix of the actual round allowance keeps the same original stop and no partial publication", () => {
  const current = fixture(add("body-round.all-admissions", T.float64, plus("float64", T.float64)));
  for (const dimension of ["maximumWork", "maximumResultEntries"]) {
    let completed = false;
    for (let maximum = 0; maximum <= 2048; maximum += 1) {
      const account = createAccount({ ...limits, [dimension]: maximum });
      const result = analyzeBodyRound({ ...current.deps, account }, current.input);
      if (result.kind === "complete") {
        assert.equal(completed || maximum > 0, true);
        assert.equal(result.value.value.summary.returns, true);
        completed = true;
      } else {
        assert.equal(completed, false, "increasing one allowance cannot reverse an admitted identical traversal");
        assert.equal(result.kind, "resource-limit");
        assert.equal(accountFailure(account), result);
        const unread = new Proxy({}, { get() { throw new Error("no later input reads after first stop"); } });
        assert.equal(analyzeBodyRound({ ...current.deps, account }, unread), result);
      }
    }
    assert.equal(completed, true, "the finite scalar traversal completes within the supplied generous control");
  }
});

test("a caller refusal is propagated identically before any round or proof input is read", () => {
  const current = fixture(add("body-round.prior-refusal", T.float64, plus("float64", T.float64)));
  const account = createAccount(limits);
  const refusal = { kind: "refused", diagnostics: [resourceLimitDiagnostic({ owner: "analyses/origins",
    limit: "analysis.maximumRelationalRecordsPerBody", maximum: 0, site: { kind: "source", origin: current.program.tir.root.origin },
    unit: { request: current.deps.unit, position: { kind: "result" } } })] };
  assert.equal(refuseAccount(account, refusal), refusal);
  const unread = new Proxy({}, { get() { throw new Error("stopped input is not inspected"); } });
  assert.equal(analyzeBodyRound({ ...current.deps, account }, unread), refusal);
  assert.equal(proveInitialization({ account, unit: current.deps.unit, summaryOf: current.deps.summaryOf }, unread), refusal);
});

test("initialization proof pays each read and identity and rejects a genuinely different ready summary", () => {
  const current = fixture(add("body-round.proof-admissions", T.float64, plus("float64", T.float64)));
  const pair = checkedPair(current, analyzeBodyRound(current.deps, current.input));
  const input = { modules: [], entries: [current.execution], storage: [] };
  const origin = { request: current.deps.unit, position: { kind: "result" } };
  const summaryOf = () => ({ value: pair.summary, unit: origin });
  let completed = false;
  for (let maximumWork = 0; maximumWork <= 1024; maximumWork += 1) {
    const account = createAccount({ ...limits, maximumWork });
    const result = proveInitialization({ account, unit: current.deps.unit, summaryOf }, input);
    if (result.kind === "complete") completed = true;
    else {
      assert.equal(completed, false);
      assert.equal(result, accountFailure(account));
    }
  }
  assert.equal(completed, true);
  const other = fixture(add("body-round.proof-admissions.other", T.float64, plus("float64", T.float64)));
  assert.throws(() => proveInitialization({ account: createAccount(limits), unit: current.deps.unit, summaryOf },
    { ...input, entries: [other.execution] }), /exact selected execution/);
  assert.throws(() => proveInitialization({ account: createAccount(limits), unit: current.deps.unit, summaryOf },
    { ...input, storage: [{ owner: { kind: "body", execution: current.execution }, cell: 0 }] }), /exposed-storage cell binding/);
});

test("actual conditional MIR intersects initialized locals at its real join", () => {
  const current = fixture(shaped("body-round.branch", [["choose", "required", T.bool], ["input", "required", T.int32]], T.int32,
    builder => builder.block(builder.ifElse(builder.id("choose", 0, T.bool),
      builder.returns(builder.id("input", 1, T.int32))), builder.returns(builder.num("1", T.int32)))));
  const pair = checkedPair(current, analyzeBodyRound(current.deps, current.input));
  assert.equal(pair.summary.returns, true);
  assert.equal(pair.facts.origins.subjects.length, 2);
  for (const maximumWork of [0, 1, 30, 100, 200]) {
    const result = analyzeBodyRound({ ...current.deps, account: createAccount({ ...limits, maximumWork }) }, current.input);
    assert.equal(result.kind, "resource-limit");
  }
});

test("real branch joins and loop backedges retain only definite initialization", () => {
  for (const loop of [false, true]) {
    const name = `body-round.join.${loop}`;
    const builder = builders(name);
    const declaration = { $: "slot", ...builder.variable(builder.declName("slot", 2), 2, T.int32) };
    const write = expression => builder.expressionStatement(builder.assign(builder.target("slot", 2, T.int32),
      "EqualsToken", expression, T.int32, T.int32));
    const root = builder.block(builder.declare([declaration]),
      builder.ifElse(builder.id("choose", 0, T.bool), builder.block(write(builder.id("input", 1, T.int32))),
        builder.block(write(builder.num("0", T.int32)))),
      ...(loop ? [builder.whileLoop(builder.id("choose", 0, T.bool), builder.block(write(builder.id("input", 1, T.int32))))] : []),
      builder.returns(builder.id("slot", 2, T.int32)));
    const program = typedBody(name, { signature: signature(name, [["choose", T.bool], ["input", T.int32]], T.int32),
      completion: T.int32, locals: [["choose", "parameter", T.bool], ["input", "parameter", T.int32], ["slot", "binding", T.int32, true]],
      params: [[0, "required", T.bool], [1, "required", T.int32]], root });
    program.tir.locals[2].declaration = { kind: "body", value: program.nodeRef("slot") };
    const current = fixture(program);
    const pair = checkedPair(current, analyzeBodyRound(current.deps, current.input));
    assert.equal(pair.facts.initialization.reads.every(row => row.assigned), true);
    assert.equal(pair.facts.origins.writes.some(row => row.operation === "mutation"), loop);
    for (let maximumWork = 0; maximumWork <= 1024; maximumWork += 1) {
      const account = createAccount({ ...limits, maximumWork });
      const result = solveAssigned({ ...current.deps, account }, current.input);
      assert.equal(result.kind === "complete" || result === accountFailure(account), true);
    }
  }
});

test("actual body-owned reads stay separate from selected by-place external storage", () => {
  const current = fixture(add("body-round.external", T.float64, plus("float64", T.float64),
    { passing: ["byref-readwrite", "by-value"] }));
  assert.throws(() => analyzeBodyRound(current.deps, current.input), /actual caller-cell binding/);
});

test("private replay preserves actual operands and refuses unsupported applicable transport", () => {
  const current = fixture(add("body-round.replay", T.float64, plus("float64", T.float64)));
  const body = current.input.mir;
  const assignment = body.blocks.flatMap(block => block.statements).find(statement => statement.kind === "assign");
  assert.equal(assignment !== undefined, true);
  const local = body.places[assignment.place].base.local;
  const state = new Set([local]);
  assert.equal(transferAssigned(body, assignment, null, createAccount(limits)), null);
  const stopped = createAccount({ ...limits, maximumWork: 0 });
  assert.equal(transferAssigned(body, assignment, state, stopped), state);
  assert.equal(transferAssigned(body, assignment, state, stopped), state);
  const dead = { ...assignment, kind: "storage-dead", local };
  assert.deepEqual([...transferAssigned(body, dead, state, createAccount(limits))], []);
  assert.deepEqual(statementOperands(dead), []);
  const operand = { kind: "place", place: assignment.place };
  for (const kind of ["use", "unary", "convert"]) assert.deepEqual(statementOperands({ ...assignment,
    value: { kind, operand } }), [operand]);
  assert.throws(() => statementOperands({ ...assignment, value: { kind: "aggregate" } }), /aggregate, capture or backing/);
  assert.deepEqual(terminatorOperands({ kind: "unreachable" }), []);
  assert.throws(() => terminatorOperands({ kind: "call" }), /call, failure or suspension/);
  assert.equal(readLocal(body, { kind: "constant", constant: 0 }), null);
  assert.equal(readLocal(body, operand), local);
  assert.throws(() => readLocal({ ...body, places: [] }, operand), /actual place/);
  const external = { ...body, places: [{ id: 0, base: { kind: "static", definition: current.program.tir.owner } }] };
  assert.throws(() => readLocal(external, { kind: "place", place: 0 }), /logical-cell relation/);
  assert.throws(() => transferAssigned(external, { ...assignment, place: 0 }, state, createAccount(limits)), /logical-cell binding/);
});

test("canonical source ordering and separated initializer boundaries borrow actual syntax", () => {
  for (const values of [[], [1], [3, 1], [3, 1, 2, 1, 5], [1, 2, 3, 4, 5]]) {
    const result = orderedRows(values, (left, right) => left - right, createAccount(limits));
    assert.equal(result.kind, "complete");
    assert.deepEqual(result.value, [...values].sort((left, right) => left - right));
    assert.notEqual(result.value, values);
  }
  assert.throws(() => orderedRows(new Array(2), () => 0, createAccount(limits)), /every admitted row/);
  const current = fixture(add("body-round.source-boundary", T.float64, plus("float64", T.float64)));
  const initializer = shaped("body-round.source-boundary.default", [], T.int32,
    builder => builder.num("0", T.int32)).tir;
  const header = current.program.tir.params[0];
  const selected = { ...header, initializer: initializer.root,
    tsonic: { ...header.tsonic, initializer: initializer.body } };
  const result = sourceOccurrences({ ...current.program.tir, params: [selected], nestedBodies: [initializer.body] }, createAccount(limits));
  assert.equal(result.kind, "complete");
  assert.equal(result.value.get(header.id), selected);
  assert.equal([...result.value.values()].includes(initializer.root), false, "default execution is not callable semantic traversal");
  const syntax = bodyNodes({ ...current.program.tir, params: [selected], nestedBodies: [initializer.body] }, createAccount(limits));
  assert.equal(syntax.kind, "complete");
  assert.equal(syntax.value.nodes.get(header.id), selected, "the canonical Facts domain retains actual owning selected headers");
  assert.equal(syntax.value.nodes.get(selected.name.id), selected.name);
  assert.equal([...syntax.value.nodes.values()].includes(initializer.root), false);
  const repeated = sourceOccurrences({ ...current.program.tir, params: [header, header] }, createAccount(limits));
  assert.equal(repeated.kind, "complete");
  assert.equal(repeated.value.get(header.id), header);
  assert.throws(() => sourceOccurrences({ ...current.program.tir, params: new Array(1) }, createAccount(limits)),
    /every actual selected parameter header/, "a sparse header cannot silently end the pending walk before its execution root");
});

test("proof preserves original error origins and names genuine supplied cell-event obligations", () => {
  const current = fixture(add("body-round.proof-obligations", T.float64, plus("float64", T.float64)));
  const pair = checkedPair(current, analyzeBodyRound(current.deps, current.input));
  const origin = { request: current.deps.unit, position: { kind: "result" } };
  const error = { kind: "error", causes: [{ kind: "unit", unit: origin }] };
  for (const maximumWork of [0, 1, 2, 3]) {
    const account = createAccount({ ...limits, maximumWork });
    const result = proveInitialization({ account, unit: current.deps.unit, summaryOf: () => ({ value: error, unit: origin }) },
      { modules: [], entries: [current.execution], storage: [] });
    assert.equal(result.kind, maximumWork === 3 ? "complete" : "resource-limit");
  }
  const input = { modules: [], entries: [current.execution], storage: [] };
  for (const field of ["cells", "events"]) {
    const summary = { ...pair.summary, initialization: { ...pair.summary.initialization, [field]: [0] } };
    assert.throws(() => proveInitialization({ account: createAccount(limits), unit: current.deps.unit,
      summaryOf: () => ({ value: summary, unit: origin }) }, input), /actual callback\/event\/caller-cell application/);
  }
  for (const kind of ["need", "before", "completed"]) {
    const summary = { ...pair.summary, initialization: { ...pair.summary.initialization, points: [{ kind }] } };
    assert.throws(() => proveInitialization({ account: createAccount(limits), unit: current.deps.unit,
      summaryOf: () => ({ value: summary, unit: origin }) }, input), /genuine supplied cell\/event bindings/);
  }
});

test("actual scalar literals and unary operations retain real read sites and original budget stops", () => {
  const current = fixture(shaped("body-round.literal-unary", [], T.int32,
    builder => builder.block(builder.returns(builder.prefix(builder.num("1", T.int32), "MinusToken", T.int32,
      native("-", "int32", [T.int32], T.int32))))));
  const pair = checkedPair(current, analyzeBodyRound(current.deps, current.input));
  assert.equal(pair.summary.returns, true);
  for (let maximumWork = 0; maximumWork <= 1024; maximumWork += 1) {
    const account = createAccount({ ...limits, maximumWork });
    const result = analyzeBodyRound({ ...current.deps, account }, current.input);
    assert.equal(result.kind === "complete" || result === accountFailure(account), true);
  }
});

test("unwritten statement operands emit only their genuine initialization error after all admitted prefixes", () => {
  const name = "body-round.unwritten-statement";
  const builder = builders(name);
  const declaration = { $: "slot", ...builder.variable(builder.declName("slot", 0), 0, T.int32) };
  const program = typedBody(name, { signature: signature(name, [], T.int32), completion: T.int32,
    locals: [["slot", "binding", T.int32, true]], root: builder.block(builder.declare([declaration]),
      builder.returns(builder.arithmetic(builder.id("slot", 0, T.int32), "PlusToken", builder.num("1", T.int32),
        T.int32, plus("int32", T.int32)))) });
  program.tir.locals[0].declaration = { kind: "body", value: program.nodeRef("slot") };
  const current = fixture(program);
  const result = analyzeBodyRound(current.deps, current.input);
  assert.equal(result.kind, "complete");
  assert.equal(result.value.value.kind, "error");
  assert.equal(result.value.diagnostics[0].code.rendered, "TSONIC_READ_BEFORE_INITIALIZATION");
  for (const dimension of ["maximumWork", "maximumResultEntries"]) {
    for (let maximum = 0; maximum <= 1024; maximum += 1) {
      const account = createAccount({ ...limits, [dimension]: maximum });
      const partial = analyzeBodyRound({ ...current.deps, account }, current.input);
      if (partial.kind === "complete") assert.equal(partial.value.value.kind, "error");
      else assert.equal(partial, accountFailure(account));
    }
  }
});

test("ready relation frontiers never fabricate projection, capture, absence or guard evidence", () => {
  const current = fixture(add("body-round.ready-frontiers", T.float64, plus("float64", T.float64)));
  const run = input => analyzeBodyRound({ ...current.deps, account: createAccount(limits) }, input);
  const capture = { local: { body: current.program.tir.body, local: 0 }, capture: "captured-location" };
  assert.throws(() => run({ ...current.input, tir: { ...current.input.tir, captures: [capture] } }), /capture-to-cell association/);
  const place = current.input.mir.places[0];
  assert.throws(() => run({ ...current.input, mir: { ...current.input.mir,
    places: [{ ...place, base: { kind: "static", definition: current.program.tir.owner } }, ...current.input.mir.places.slice(1)] } }),
    /projection or static-cell producer/);
  for (const value of [{ kind: "literal", value: { kind: "absence" } }, { kind: "reference" }]) {
    assert.throws(() => run({ ...current.input, mir: { ...current.input.mir,
      constants: [{ id: 0, type: T.float64, value }] } }), /non-scalar constant relation/);
  }
  const selected = current.input.mir.blocks.flatMap(block => block.statements).find(statement => statement.kind === "assign");
  const blocks = current.input.mir.blocks.map(block => ({ ...block, statements: block.statements.map(statement =>
    statement === selected ? { ...statement, value: { ...statement.value, operation: { decision: {
      ...statement.value.operation.decision, execution: { kind: "invocation", writesStorage: true, failure: "none" } } } } }
      : statement) }));
  assert.throws(() => run({ ...current.input, mir: { ...current.input.mir, blocks } }), /selected operation effect and Origins transport/);
  const converting = current.input.mir.blocks.map(block => ({ ...block, statements: block.statements.map(statement =>
    statement === selected ? { ...statement, value: { kind: "convert", operand: statement.value.left,
      operation: { decision: { kind: "deferred" } } } } : statement) }));
  assert.throws(() => run({ ...current.input, mir: { ...current.input.mir, blocks: converting } }),
    /selected operation effect and Origins transport/);
  const root = current.input.tir.root;
  const returned = root.statements.nodes[0];
  const expression = returned.expression;
  const tir = { ...current.input.tir, root: { ...root, statements: { ...root.statements, nodes: [{ ...returned,
    expression: { ...expression, tsonic: { ...expression.tsonic, narrowing: { kind: "unproved" } } } }] } } };
  assert.throws(() => run({ ...current.input, tir }), /guard proof\/invalidation relation/);
});

test("the actual initialization lattice obeys intersection and equality with one original account", () => {
  const lattice = assignedLattice(4);
  const variants = [null, new Set(), new Set([0]), new Set([1]), new Set([0, 1]), new Set([1, 0])];
  assert.equal(lattice.isOverflow(null), false);
  for (const left of variants) for (const right of variants) {
    const account = createAccount(limits);
    const expected = left === null || right === null ? left === right
      : left.size === right.size && [...left].every(local => right.has(local));
    assert.equal(lattice.equals(left, right, account), expected);
    const joined = lattice.join(left, right, account);
    const common = left === null ? right : right === null ? left : new Set([...left].filter(local => right.has(local)));
    assert.deepEqual(joined === null ? null : [...joined].sort(), common === null ? null : [...common].sort());
  }
  const first = new Set([0, 1]);
  const second = new Set([1, 0]);
  const work = createAccount({ ...limits, maximumWork: 0 });
  assert.equal(lattice.equals(first, second, work), true);
  assert.equal(accountFailure(work).dimension, "work", "a stopped comparison cannot be mistaken for a complete solver answer");
  for (const dimension of ["maximumWork", "maximumResultEntries"]) {
    const account = createAccount({ ...limits, [dimension]: 0 });
    assert.equal(lattice.join(first, second, account), first);
    assert.equal(accountFailure(account).dimension, dimension === "maximumWork" ? "work" : "result-entries");
  }
});

test("actual scalar receiver storage keeps receiver context distinct from the formal provided count", () => {
  const current = fixture(shaped("body-round.receiver", [["this", "this", T.int32]], T.int32,
    builder => builder.block(builder.returns(builder.id("this", 0, T.int32))), { receiver: T.int32 }));
  assert.equal(current.execution.provided, 0);
  const pair = checkedPair(current, analyzeBodyRound(current.deps, current.input));
  assert.equal(pair.facts.arena.contexts[0].receiver, 0);
  assert.equal(pair.facts.arena.contexts[0].arguments.length, 0);
  assert.equal(pair.summary.parameters[0].slot.kind, "receiver");
  assert.deepEqual(pair.summary.arena.producers, [{ id: 0, path: null, kind: "receiver" }]);
  const result = analyzeBodyRound({ ...current.deps, account: createAccount(limits),
    limits: { ...analysisLimits, maximumRelationalReferencesPerBody: 0 } }, current.input);
  assert.equal(result.kind, "refused");
  for (const dimension of ["maximumWork", "maximumResultEntries"]) {
    for (let maximum = 0; maximum <= 1024; maximum += 1) {
      const account = createAccount({ ...limits, [dimension]: maximum });
      const bounded = analyzeBodyRound({ ...current.deps, account }, current.input);
      assert.equal(bounded.kind === "complete" || bounded === accountFailure(account), true);
    }
  }
});

test("explicit MIR reachability and finite exits, not all syntax, decide the scalar projection", () => {
  const current = fixture(add("body-round.reached", T.float64, plus("float64", T.float64)));
  const block = current.input.mir.blocks[0];
  const unreachable = { ...block, id: current.input.mir.blocks.length, statements: [], terminator: { ...block.terminator,
    kind: "unreachable" } };
  const input = { ...current.input, mir: { ...current.input.mir, blocks: [...current.input.mir.blocks, unreachable] } };
  const solution = solveAssigned({ ...current.deps, account: createAccount(limits) }, input);
  assert.equal(solution.kind, "complete");
  assert.equal(assignedEntry(solution.value.entry, 0).has(0), true);
  assert.throws(() => assignedEntry(solution.value.entry, unreachable.id), /actual solved initialization entry/);
  assert.throws(() => assignedEntry(solution.value.entry, unreachable.id + 1), /actual solved initialization entry/);
  const reached = analyzeBodyRound({ ...current.deps, account: createAccount(limits) }, input);
  assert.equal(reached.kind, "complete");
  assert.equal(reached.value.value.summary.returns, true);
  const noExit = { ...current.input, mir: { ...current.input.mir, blocks: current.input.mir.blocks.map(selected => ({ ...selected,
    terminator: { ...selected.terminator, kind: "unreachable" } })) } };
  const result = analyzeBodyRound({ ...current.deps, account: createAccount(limits) }, noExit);
  assert.equal(result.kind, "complete");
  assert.equal(result.value.value.summary.returns, false);
  assert.deepEqual(result.value.value.summary.initialization.points, []);
});

test("separate source occurrence identity is required before merging different actual places", () => {
  const current = fixture(add("body-round.source-identity", T.float64, plus("float64", T.float64)));
  const blocks = current.input.mir.blocks.map(block => ({ ...block, statements: block.statements.map(statement =>
    statement.kind !== "assign" ? statement : { ...statement, tir: { ...statement.tir, node: current.input.tir.root.id } }) }));
  assert.throws(() => analyzeBodyRound({ ...current.deps, account: createAccount(limits) },
    { ...current.input, mir: { ...current.input.mir, blocks } }), /separate occurrence relation/);
  const repeated = current.input.mir.blocks.map(block => ({ ...block, statements: block.statements.flatMap(statement =>
    statement.kind === "assign" ? [statement, statement] : [statement]) }));
  const result = analyzeBodyRound({ ...current.deps, account: createAccount(limits) },
    { ...current.input, mir: { ...current.input.mir, blocks: repeated } });
  assert.equal(result.kind, "complete");
  assert.equal(result.value.value.facts.initialization.reads.every(row => row.assigned), true);
});

test("actual nested callable source roots never traverse a separately owned body", async () => {
  const { wt8 } = await import("./fixtures/lower-mir/programs/more.mjs");
  const { program } = wt8();
  const result = sourceOccurrences(program.tir, createAccount(limits));
  assert.equal(result.kind, "complete");
  const arrow = [...result.value.values()].find(node => node.kind === "ArrowFunction");
  assert.equal(arrow !== undefined, true);
  const child = shaped("body-round.source-child", [], T.int32, builder => builder.num("1", T.int32)).tir;
  const selected = { ...arrow, body: child.root,
    tsonic: { ...arrow.tsonic, callable: { ...arrow.tsonic.callable, template: { ...arrow.tsonic.callable.template, body: child.body } } } };
  const input = { ...program.tir, root: selected, nestedBodies: [child.body] };
  const separate = sourceOccurrences(input, createAccount(limits));
  assert.equal(separate.kind, "complete");
  assert.equal([...separate.value.values()].includes(child.root), false);
  const open = sourceOccurrences({ ...input, nestedBodies: [] }, createAccount(limits));
  assert.equal(open.kind, "complete");
  assert.equal([...open.value.values()].includes(child.root), true, "only an actual separate-body boundary excludes child syntax");
});

test("a module owns neither its nested callable headers nor their separately executing defaults", () => {
  const name = "body-round.nested-header";
  const childName = `${name}.function`;
  const child = builders(childName);
  const declaration = def(`${childName}.flag`);
  const initializer = bodyId(`${childName}.flag`, "default");
  const parameter = { kind: "Parameter", modifiers: null, dotDotDotToken: null,
    name: child.declName("flag", 0), questionToken: null, type: null,
    initializer: child.keyword("TrueKeyword", T.bool),
    tsonic: { declaration, local: child.localRef(0), storage: T.bool, passing: "by-value", initializer, role: "default" } };
  const callable = { kind: "FunctionDeclaration", modifiers: null, typeParameters: null,
    parameters: { $list: true, nodes: [parameter] }, type: null, fullSignature: null, asteriskToken: null,
    name: null, body: child.block(child.returns(child.id("flag", 0, T.bool))),
    tsonic: { definition: def(childName), parameters: [], signatures: [], attributes: [],
      template: { body: child.body, lexicalBindings: { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] },
        dependence: "parametric" } } };
  const program = typedBody(name, { role: "module", signature: signature(name, [], T.void), completion: T.void,
    nestedBodies: [child.body],
    root: { kind: "SourceFile", statements: { $list: true, nodes: [callable] },
      endOfFileToken: { kind: "EndOfFile", tsonic: null }, languageVariant: "Standard", scriptKind: "TS",
      commentDirectives: [], pragmas: [], checkJsDirective: null, tsonic: { module: "M[P[p];m]", template: null } } });
  const selected = program.tir.root.statements.nodes[0];
  const header = selected.parameters.nodes[0];
  const current = fixture(program);
  const pair = checkedPair(current, analyzeBodyRound(current.deps, current.input));
  assert.deepEqual(pair.facts.refinements.integers, [], "only the callee's unexecuted subtree contains values");
  assert.equal(pair.summary.returns, true, "the actual module returns without running a nested function/default");
  Object.defineProperty(header, "initializer", { get() { throw new Error("the outer module cannot read a child's default syntax"); } });
  const result = sourceOccurrences(program.tir, createAccount(limits));
  assert.equal(result.kind, "complete");
  assert.equal(result.value.get(selected.id), selected);
  assert.equal(result.value.has(header.id), false);
  assert.equal(result.value.has(header.name.id), false);
  assert.equal(result.value.has(selected.body.id), false);
  const syntax = bodyNodes(program.tir, createAccount(limits));
  assert.equal(syntax.kind, "complete");
  assert.equal(syntax.value.nodes.has(header.id), false);
  assert.equal(syntax.value.valueNodes.size, 0);
});

test("complete binding identity is paid before canonical serialization and no huge binding row follows refusal", () => {
  const current = fixture(add("body-round.binding-budget", T.float64, plus("float64", T.float64)));
  const vector = { ...current.execution.instance.bindings.bindings, classBindings: new Array(10000) };
  Object.defineProperty(vector.classBindings, 0, { get() { throw new Error("binding rows must not be read after refusal"); } });
  const execution = { ...current.execution, instance: { ...current.execution.instance, bindings: { kind: "instantiated", bindings: vector } } };
  const result = analyzeBodyRound({ ...current.deps, account: createAccount({ ...limits, maximumWork: 0 }) },
    { ...current.input, execution });
  assert.equal(result.kind, "resource-limit");
});

test("actual arena and condition dimensions refuse rather than publishing an over-limit relation", () => {
  const current = fixture(add("body-round.relational-bounds", T.float64, plus("float64", T.float64)));
  for (const [field, maximum] of [["maximumRelationalRecordsPerBody", 1], ["maximumRelationalReferencesPerBody", 1], ["maximumConditionAlternatives", 0]]) {
    const result = analyzeBodyRound({ ...current.deps, account: createAccount(limits), limits: { ...analysisLimits, [field]: maximum } }, current.input);
    assert.equal(result.kind, "refused");
    assert.equal(result.diagnostics[0].code.rendered, "TSONIC_COMPILER_RESOURCE_LIMIT");
  }
});

test("scalar formal inventory reserves actual producer rows before growth without manufacturing cell identity", () => {
  const current = fixture(add("body-round.formal-inventory", T.float64, plus("float64", T.float64)));
  for (const maximumRelationalRecordsPerBody of [0, 1, 2, 3, 4]) {
    const deps = { ...current.deps, account: createAccount(limits), limits: { ...analysisLimits,
      maximumRelationalRecordsPerBody, maximumRelationalReferencesPerBody: 2, maximumOriginAlternatives: 0 } };
    const result = analyzeBodyRound(deps, current.input);
    assert.equal(result.kind, maximumRelationalRecordsPerBody === 4 ? "complete" : "refused");
    if (result.kind === "complete") {
      const pair = checkedPair({ ...current, deps }, result);
      assert.equal(pair.summary.arena, pair.facts.arena);
      assert.equal(pair.facts.arena.cells.length, 0);
      assert.equal(pair.facts.arena.producers.length, 2);
      assert.equal(pair.facts.arena.boundProducers.length, 0);
      assert.deepEqual(pair.facts.arena.contexts[0].arguments, [0, 0]);
    }
  }
});
