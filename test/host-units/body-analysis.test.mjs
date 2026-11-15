import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { Session } from "node:inspector";
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { checkCoverage } from "../architecture/host/coverage.mjs";
import { parseSources } from "../architecture/host/import-graph.mjs";
import { add, plus, shaped } from "./fixtures/lower-mir/programs/first.mjs";
import { T, TABLE, builders, declareType, native, signature, typedBody, verificationContext } from "./fixtures/lower-mir/typed.mjs";
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
const runtimeFiles = ["index", "round", "storage", "source", "proof"].map(name => resolve(repository, `packages/host/dist/analyses/body/${name}.js`));
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

function fixture(program) {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true, "the real aggregate guard admitted this test");
  const typeOf = type => TABLE.terms[type];
  const signatureOf = selected => TABLE.signatures[selected];
  const unit = { query: "bodyRound", key: [program.tir.body] };
  const lowered = lowerToMir({ typeOf, signatureOf, limits: { maximumRecords: 10000 },
    defs: { completionSelector: T.int32, exceptionStorage: T.unknown }, unit: { request: unit, position: { kind: "result" } } }, program.tir, []);
  assert.equal(lowered.kind, "ok", "the real LowerMir producer completes");
  assert.deepEqual(verifyMir(lowered.value, verificationContext(program)), { kind: "complete", violations: [] });
  const execution = { instance: { body: program.tir.body, bindings: program.tir.bindings },
    provided: program.tir.params.filter(header => header.tsonic.role !== "this").length };
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
  const context = { types: TABLE, limits: analysisLimits, diagnostics: [],
    tirBody: instance => instance.body === current.program.tir.body ? current.program.tir : null,
    mirBody: instance => instance.body === current.input.mir.body ? current.input.mir : null,
    bodyOwner: body => body === current.program.tir.body ? current.program.tir.owner : null,
    definitionExists: definition => definition === current.program.tir.owner,
    declarationSourceOf: definition => definition === current.program.tir.owner ? { kind: "body", value: current.program.nodeRef(0) } : null,
    bindingScopeOf: definition => definition === current.program.tir.owner ? scope : null,
    bindingScopesOf: () => [scope], nominalOf: () => null,
    nodeExists: selected => selected.kind === "body" ? selected.value.body === current.program.tir.body && nodes.has(selected.value.node)
      : current.program.tir.params.some(header => header.tsonic.declaration === selected.value.owner && nodes.has(selected.value.node)),
    localExists: local => local.body === current.program.tir.body && current.program.tir.locals[local.local]?.id === local.local,
    signatureIdOf: () => null, bindingDependentOf: definition => definition === current.program.tir.owner ? current.program.tir.dependence === "binding-dependent" : null,
    captureCount: key => key.kind === "body" && key.execution.instance.body === current.program.tir.body ? current.program.tir.captures.length : null,
    callbackSignaturesOf: () => null, metadataOf: () => null, libraryExportExists: () => false, declaredSiteCount: () => null,
    arenaOf: () => pair.facts.arena, summaryOf: () => pair.summary };
  const account = createAccount(limits);
  assert.deepEqual(verifyFacts(pair.facts, current.input.mir, context, account), { kind: "complete", violations: [] }, "the real Facts barrier accepts producer output");
  const conditionRefusal = { kind: "refused", diagnostics: [resourceLimitDiagnostic({ owner: "analyses/initialization",
    limit: "analysis.maximumConditionAlternatives", maximum: analysisLimits.maximumConditionAlternatives,
    site: { kind: "source", origin: current.program.tir.root.origin }, unit: { request: current.deps.unit, position: { kind: "result" } } })] };
  assert.deepEqual(verifySummary(pair.summary, context, { account, conditionRefusal }),
    { kind: "complete", violations: [] }, "the real complete Summary barrier accepts the same projection");
  assert.equal(parseFacts(printFacts(pair.facts)).kind, "parsed");
  assert.equal(parseSummary(printSummary(pair.summary)).kind, "parsed");
  return pair;
}

test("a real selected float64 add produces complete BodyFacts and its whole stable Summary projection", () => {
  const current = fixture(add("body-round.float-add", T.float64, plus("float64", T.float64)));
  const pair = checkedPair(current, analyzeBodyRound(current.deps, current.input));
  assert.equal(pair.facts.liveness, current.input.liveness, "the round borrows the once-produced actual Liveness family");
  assert.equal(pair.summary.arena, pair.facts.arena);
  assert.equal(pair.summary.parameters.length, 2);
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
    const result = solveAssigned(current.input.mir, provided, createAccount(limits));
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
      const result = solveAssigned(current.input.mir, current.execution.provided, account);
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
  const repeated = sourceOccurrences({ ...current.program.tir, params: [header, header] }, createAccount(limits));
  assert.equal(repeated.kind, "complete");
  assert.equal(repeated.value.get(header.id), header);
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
      ...statement.value.operation.decision, operation: { kind: "core", declaration: current.program.tir.owner, bindings: {} } } } } }
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
  const result = analyzeBodyRound({ ...current.deps, account: createAccount(limits),
    limits: { ...analysisLimits, maximumRelationalReferencesPerBody: 0 } }, current.input);
  assert.equal(result.kind, "refused");
});

test("explicit MIR reachability and finite exits, not all syntax, decide the scalar projection", () => {
  const current = fixture(add("body-round.reached", T.float64, plus("float64", T.float64)));
  const block = current.input.mir.blocks[0];
  const unreachable = { ...block, id: current.input.mir.blocks.length, statements: [], terminator: { ...block.terminator,
    kind: "unreachable" } };
  const input = { ...current.input, mir: { ...current.input.mir, blocks: [...current.input.mir.blocks, unreachable] } };
  const solution = solveAssigned(input.mir, current.execution.provided, createAccount(limits));
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
