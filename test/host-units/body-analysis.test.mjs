import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { Session } from "node:inspector";
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { checkCoverage } from "../architecture/host/coverage.mjs";
import { parseSources } from "../architecture/host/import-graph.mjs";
import { add, plus, shaped } from "./fixtures/lower-mir/programs/first.mjs";
import { wt1 } from "./fixtures/lower-mir/programs/wt1.mjs";
import { EMPTY_BINDINGS, T, TABLE, bodyId, builders, callee, declareType, def, mapped, native, seal, signature, typedBody, verificationContext } from "./fixtures/lower-mir/typed.mjs";
import { executionKey, sameInstance } from "../../packages/host/dist/ir-types/index.js";
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
const runtimeFiles = ["index", "round", "storage", "source", "proof", "calls", "values", "value-flow", "places", "captures", "initialization", "writes", "exits"].map(name => resolve(repository, `packages/host/dist/analyses/body/${name}.js`));
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
let localSlotLifetimes;
let solveStorageLive;
let storageLiveLattice;
let bodyNodes;
let callSummary;
let applyScalarCall;
let joinOrigins;
let appliedOrigins;
let valueOrigins;
let valueProblem;
let transferValue;
let referenceCallResult;
let prepareCallCaptures;
let captureMustAtExit;
let callReturnAssigned;
let sourceNeedAssigned;
let captureLocalAtCall;
let primitiveWrites;
let collectCellWrites;

before(async () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true, "the aggregate owner guard admitted this process");
  session.connect();
  await post("Debugger.enable");
  await post("Profiler.enable");
  await post("Profiler.startPreciseCoverage", { callCount: true, detailed: true });
  ({ analyzeBodyRound, proveInitialization } = await import("../../packages/host/dist/analyses/body/index.js"));
  ({ solveAssigned, transferAssigned, statementOperands, terminatorOperands, assignedLattice, assignedEntry,
    localSlotLifetimes, solveStorageLive, storageLiveLattice } =
    await import("../../packages/host/dist/analyses/body/storage.js"));
  ({ readLocal } = await import("../../packages/host/dist/analyses/body/places.js"));
  ({ sourceOccurrences, orderedRows } = await import("../../packages/host/dist/analyses/body/source.js"));
  ({ bodyNodes } = await import("../../packages/host/dist/ir-facts/verify-body-nodes.js"));
  ({ callSummary, applyScalarCall, referenceCallResult } = await import("../../packages/host/dist/analyses/body/calls.js"));
  ({ joinOrigins, appliedOrigins, valueOrigins } = await import("../../packages/host/dist/analyses/body/values.js"));
  ({ valueProblem, transferValue } = await import("../../packages/host/dist/analyses/body/value-flow.js"));
  ({ prepareCallCaptures } = await import("../../packages/host/dist/analyses/body/captures.js"));
  ({ captureMustAtExit, callReturnAssigned, sourceNeedAssigned, captureLocalAtCall } =
    await import("../../packages/host/dist/analyses/body/initialization.js"));
  ({ primitiveWrites, collectCellWrites } = await import("../../packages/host/dist/analyses/body/writes.js"));
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
  const canonical = verificationContext(program);
  const mirContext = program.bindingScope === undefined ? canonical : { ...canonical, declarationOf: definition => {
    const declaration = canonical.declarationOf(definition);
    return declaration !== null && definition === program.tir.owner ? { ...declaration, scope: program.bindingScope } : declaration;
  } };
  assert.deepEqual(verifyMir(lowered.value, mirContext), { kind: "complete", violations: [] });
  const account = createAccount(limits);
  const storage = analyzeStorageUse({ account }, { execution, body: lowered.value });
  assert.equal(storage.kind, "ok", "the actual MIR-only Liveness producer completes");
  const input = { execution, mir: lowered.value, tir: program.tir, liveness: storage.value };
  const deps = { types: TABLE, typeOf, signatureOf, summaryOf: () => { throw new Error("A call-free actual body has no Summary demand"); },
    account, limits: analysisLimits, unit };
  return { program, execution, input, deps, bindingScope: program.bindingScope };
}

function checkedPair(current, result) {
  assert.equal(result.kind, "complete");
  assert.equal(result.value.kind, "ok");
  const pair = result.value.value;
  assert.equal("facts" in pair, true, "a successful round has its genuine projection pair");
  const ready = [current, ...(current.related ?? [])];
  const nodes = new Map(ready.map(row => {
    const source = sourceOccurrences(row.program.tir, createAccount(limits));
    assert.equal(source.kind, "complete");
    return [row.program.tir.body, source.value];
  }));
  current.pair = pair;
  const readyBody = instance => ready.find(row => sameInstance(row.execution.instance, instance));
  const readyOwner = definition => ready.find(row => row.program.tir.owner === definition);
  const context = { types: TABLE, limits: current.deps.limits, diagnostics: [],
    tirBody: instance => readyBody(instance)?.program.tir ?? null,
    mirBody: instance => readyBody(instance)?.input.mir ?? null,
    bodyOwner: body => ready.find(row => row.program.tir.body === body)?.program.tir.owner ?? null,
    definitionExists: definition => readyOwner(definition) !== undefined || ready.some(row =>
      row.program.tir.params.some(header => header.tsonic.declaration === definition)),
    declarationSourceOf: definition => definition === current.program.tir.owner ? { kind: "body", value: current.program.nodeRef(0) } : null,
    bindingScopeOf: definition => readyOwner(definition) === undefined ? null : readyOwner(definition).bindingScope ?? scope,
    sourceBindingScopesOf: () => { assert.fail("These actual scalar rounds have no definition-null source binding vectors."); }, nominalOf: () => null,
    nodeExists: selected => selected.kind === "body" ? nodes.get(selected.value.body)?.has(selected.value.node) === true
      : ready.some(row => row.program.tir.params.some(header => header.tsonic.declaration === selected.value.owner
        && nodes.get(row.program.tir.body)?.has(selected.value.node) === true)),
    localExists: local => ready.some(row => local.body === row.program.tir.body && row.program.tir.locals[local.local]?.id === local.local),
    signatureIdOf: () => null, bindingDependentOf: definition => readyOwner(definition)?.program.tir.dependence === "binding-dependent",
    captureCount: key => key.kind === "body" ? readyBody(key.execution.instance)?.program.tir.captures.length ?? null : null,
    callbackSignaturesOf: () => null, metadataOf: () => null, libraryExportExists: () => false, declaredSiteCount: () => null,
    arenaOf: owner => owner.kind === "body" ? readyBody(owner.execution.instance)?.pair?.facts.arena ?? null
      : owner.key.kind === "body" ? readyBody(owner.key.execution.instance)?.pair?.summary.arena ?? null : null,
    summaryOf: key => key.kind === "body" ? readyBody(key.execution.instance)?.pair?.summary ?? null : null };
  current.factsContext = context;
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

function checkSignatureStops(current) {
  const operation = current.input.mir.blocks.find(block => block.terminator.kind === "call").terminator;
  for (const run of [deps => callSummary(deps, current.input.mir, operation), deps => analyzeBodyRound(deps, current.input)]) {
    let reads = 0;
    const baseline = run({ ...current.deps, account: createAccount(limits), signatureOf: selected => {
      reads += 1;
      return current.deps.signatureOf(selected);
    } });
    assert.equal(baseline.kind, "complete");
    assert.equal(reads > 0, true);
    for (let stopAt = 1; stopAt <= reads; stopAt += 1) {
      const account = createAccount(limits);
      const refused = { kind: "refused", diagnostics: [resourceLimitDiagnostic({ owner: "analyses/origins",
        limit: "analysis.maximumOriginAlternatives", maximum: 0, site: { kind: "source", origin: operation.origin },
        unit: { request: current.deps.unit, position: { kind: "result" } } })] };
      let count = 0;
      const result = run({ ...current.deps, account, signatureOf: selected => {
        assert.equal(accountFailure(account), null, "no signature reader is called after the original stop");
        count += 1;
        if (count !== stopAt) return current.deps.signatureOf(selected);
        assert.equal(refuseAccount(account, refused), refused);
        return new Proxy({}, { get() { assert.fail("No signature answer or header is read after its original refusal."); } });
      } });
      assert.equal(count, stopAt);
      assert.equal(result, refused);
      assert.equal(accountFailure(account), refused);
      assert.equal(analyzeBodyRound({ ...current.deps, account }, new Proxy({}, {
        get() { assert.fail("No round context is read after a signature reader refusal."); },
      })), refused);
    }
  }
}

function indexedOrigins(current, rows) {
  const result = valueOrigins({ ...current.deps, account: createAccount(limits) }, rows);
  assert.equal(result.kind, "complete");
  return result.value;
}

const TRUE_LITERAL = declareType("body-round.true", { kind: "literal", value: { kind: "boolean", value: true }, base: T.bool });
const DEFAULT_BODY = bodyId("body-round.default.argument", "default-argument");
const DEFAULT_SIGNATURE = signature("body-round.default.argument", [], T.bool);
const CALLER_SIGNATURE = signature("body-round.default", [["argument", T.bool, "default", DEFAULT_BODY]], T.bool);

function defaultProgram() {
  const builder = builders("body-round.default");
  const program = typedBody("body-round.default", { signature: CALLER_SIGNATURE, completion: T.bool,
    locals: [["argument", "parameter", T.bool]], params: [[0, "default", T.bool, DEFAULT_BODY]],
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

function locationDefaultProgram(name, { incoming = false, count = 1, receiver = false, withReceiver = false, repeatedRead = false, selfRead = false, type = T.bool, write = false, returnSource = false } = {}) {
  const defaults = Array.from({ length: count }, (_, index) => ({ name: count === 1 ? "b" : `b${index}`,
    body: bodyId(`${name}.${count === 1 ? "b" : `b${index}`}`, "default-argument") }));
  const owner = incoming ? shaped(`${name}.outer`, [["a", "required", type]], type,
    builder => builder.block(builder.returns(builder.id("a", 0, type)))) : null;
  const source = { body: owner === null ? bodyId(name) : owner.tir.body, local: selfRead ? 1 : 0 };
  const builder = builders(name);
  const program = typedBody(name, { signature: signature(name,
    [...(incoming || receiver ? [] : [["a", type]]), ...defaults.map(row => [row.name, type, "default", row.body])],
    type, receiver || withReceiver ? type : null), completion: type,
    params: [...(withReceiver ? [[count + 1, "this", type]] : []), ...(incoming ? [] : [[0, receiver ? "this" : "required", type]]),
      ...defaults.map((row, index) => [index + 1, "default", type, row.body])],
    locals: [["a", incoming ? "capture" : "parameter", type, write, incoming ? source : null],
      ...defaults.map(row => [row.name, "parameter", type]), ...(withReceiver ? [["this", "parameter", type]] : [])],
    captures: incoming ? [{ local: source, capture: "captured-location" }] : [],
    root: builder.block(builder.returns(returnSource ? builder.id("a", 0, type) : builder.id(defaults[count - 1].name, count, type))) });
  let next = program.nodeCount;
  const children = defaults.map((row, index) => {
    const childName = `${name}.${row.name}`;
    const childBuilder = builders(childName, "default-argument");
    const capturedName = selfRead ? "b" : "a";
    const root = () => write ? childBuilder.assign(childBuilder.target(capturedName, 0, type), "EqualsToken",
      childBuilder.keyword("TrueKeyword", type), type, type) : repeatedRead ? childBuilder.comparison(childBuilder.id(capturedName, 0, type), "EqualsEqualsEqualsToken",
      childBuilder.id(capturedName, 0, type), native("===", "bool", [type, type], type)) : childBuilder.id(capturedName, 0, type);
    const child = typedBody(childName, { role: "default-argument", signature: signature(childName, [], type), completion: type,
      locals: [[capturedName, "capture", type, write, source]], captures: [{ local: source, capture: "captured-location" }], root: root() });
    const sealed = seal(childName, root(), "default-argument", next);
    child.tir.root = sealed.root;
    next = sealed.count;
    const header = program.tir.params[index + (incoming ? 0 : withReceiver ? 2 : 1)];
    child.tir.root.parent = header.id;
    header.initializer = child.tir.root;
    return child;
  });
  const bodies = [program.tir, ...children.map(row => row.tir), ...(owner === null ? [] : [owner.tir])];
  const bodyOf = instance => bodies.find(tir => sameInstance(instance, { body: tir.body, bindings: tir.bindings })) ?? null;
  program.bodyOf = bodyOf;
  for (const child of children) child.bodyOf = bodyOf;
  return { program, child: children[0], children, owner, internal: children.map(child => ({ instance: { body: child.tir.body, bindings: child.tir.bindings },
    captures: child.tir.captures, signature: child.tir.signature })) };
}

test("a real placed captured-location initializer discharges its root read against the caller's actual provided slot", async () => {
  const { program, child, internal } = locationDefaultProgram("body-round.located-default");
  const initializer = fixture(child);
  const caller = fixture(program, internal, 1);
  initializer.related = [caller];
  const childPair = checkedPair(initializer, analyzeBodyRound(initializer.deps, initializer.input));
  caller.related = [initializer];
  caller.deps.summaryOf = key => {
    assert.equal(executionKey(key.execution), executionKey(initializer.execution));
    return { value: childPair.summary, unit: { request: initializer.deps.unit, position: { kind: "result" } } };
  };
  const pair = checkedPair(caller, analyzeBodyRound(caller.deps, caller.input));
  const call = caller.input.mir.blocks.find(row => row.terminator.kind === "call");
  const source = caller.input.mir.places[call.terminator.callee.captures[0].place].base.local;
  assert.deepEqual(pair.facts.arena.cells, [{ id: 0, role: { kind: "local", local: source },
    occurrence: { kind: "entry", execution: caller.execution, local: source }, lifetimes: [] }]);
  assert.deepEqual(pair.facts.arena.contexts[1].captures, [{ index: 0, location: 0, cell: 0 }]);
  const location = pair.facts.arena.producers[pair.facts.arena.boundProducers[0].producer];
  assert.deepEqual(location, { id: 2, path: null, kind: "local", local: caller.input.mir.locals[source].source });
  assert.notEqual(location.id, pair.facts.arena.producers.find(row => row.kind === "parameter" && row.index === 0).id,
    "the captured mutable slot is not the scalar parameter value");
  assert.equal(pair.facts.arena.origins.every(row => row.producers.every(bound =>
    pair.facts.arena.producers[pair.facts.arena.boundProducers[bound].producer].kind !== "local")), true);
  assert.equal(pair.facts.arena === pair.summary.arena, false, "distinct qualified owners need not retain the same projection domain");
  assert.deepEqual(pair.summary.arena.cells, []);
  assert.deepEqual(pair.summary.arena.boundProducers, []);
  assert.equal(pair.summary.arena.producers.some(row => row.kind === "local"), false,
    "discharged internal slot subjects do not escape into the boundary Summary");
  assert.equal(pair.summary.arena.contexts.length, 1, "the internal call context is not an external captured environment");
  assert.deepEqual(pair.summary.initialization.points, [{ kind: "return" }]);
  assert.equal(childPair.summary.initialization.points[0].kind, "need", "application does not mutate away the child's original read");
  const invalidOrigins = { ...pair.facts, arena: { ...pair.facts.arena, origins: pair.facts.arena.origins.map((row, index) =>
    index === 0 ? { ...row, producers: [0] } : row) } };
  const checked = verifyFacts(invalidOrigins, caller.input.mir, caller.factsContext, createAccount(limits));
  assert.equal(checked.kind, "complete");
  assert.equal(checked.violations.some(row => row.rule === "local-producer-location-only"), true);
  const { rewriteBodyFacts } = await import("../../packages/host/dist/ir-program/canonical-facts.js");
  const { inventoryBodyFacts } = await import("../../packages/host/dist/ir-program/instantiate-facts.js");
  const { createProjectionInventory, drainProjectionInventory } = await import("../../packages/host/dist/ir-program/program-values.js");
  const { createInstantiationMeter } = await import("../../packages/host/dist/ir-program/work.js");
  const { remainingWork } = await import("../../packages/host/dist/dataflow/index.js");
  const binding = { parameterBinding: () => assert.fail("No selected local transport substitution."),
    selfBinding: () => assert.fail("No selected local transport self substitution.") };
  const canonical = rewriteBodyFacts({ ...binding, type: type => type, signature: signature => signature }, pair.facts, caller.execution);
  assert.deepEqual(canonical.arena.producers, pair.facts.arena.producers);
  assert.notEqual(canonical.arena.producers[location.id], location);
  assert.notEqual(canonical.arena.producers[location.id].local, location.local);
  assert.deepEqual(canonical.arena.contexts, pair.facts.arena.contexts, "location transport does not infer a different cell association");
  const projectionLimits = { maximumWork: 1000000, maximumCreatedRecords: 1000000, maximumBindingVectorsPerArtifact: 1000,
    typeExpansion: { maximumDepth: 100, maximumVisits: 1000, maximumUnionMembers: 100, maximumIntersectionMembers: 100 } };
  const inventory = (facts, meter) => {
    const scan = createProjectionInventory(meter, binding);
    return inventoryBodyFacts(scan, facts) ?? drainProjectionInventory(scan);
  };
  const baseline = createInstantiationMeter(projectionLimits);
  const measured = createInstantiationMeter(projectionLimits);
  assert.equal(inventory({ ...pair.facts, arena: { ...pair.facts.arena, producers: pair.facts.arena.producers.filter(row => row.kind !== "local") } }, baseline), null);
  assert.equal(inventory(pair.facts, measured), null);
  const work = projectionLimits.maximumWork - remainingWork(measured.account);
  assert.equal(work - (projectionLimits.maximumWork - remainingWork(baseline.account)), 9);
  assert.equal(measured.created - baseline.created, 2);
  for (const [field, needed] of [["maximumWork", work], ["maximumCreatedRecords", measured.created]]) {
    for (let maximum = 0; maximum <= needed; maximum += 1) {
      const meter = createInstantiationMeter({ ...projectionLimits, [field]: maximum });
      const stop = inventory(pair.facts, meter);
      if (maximum === needed) assert.equal(stop, null);
      else assert.equal(stop, meter.failure ?? accountFailure(meter.account));
    }
  }
  for (const qualified of [null, { body: child.tir.body, local: 0 }, { body: caller.program.tir.body, local: 999 }]) {
    const mir = { ...caller.input.mir, locals: caller.input.mir.locals.map(row => row.id === source ? { ...row, source: qualified } : row) };
    assert.throws(() => analyzeBodyRound({ ...caller.deps, account: createAccount(limits) }, { ...caller.input, mir }), /actual qualified source local/);
  }
  const proof = proveInitialization({ account: createAccount(limits), unit: caller.deps.unit,
    summaryOf: () => ({ value: pair.summary, unit: { request: caller.deps.unit, position: { kind: "result" } } }) },
  { modules: [], entries: [caller.execution], storage: [] });
  assert.equal(proof.kind, "complete");
  assert.equal(proof.value.positions[0].error, null);
  const supplied = fixture(program, internal, 2);
  const suppliedPair = checkedPair(supplied, analyzeBodyRound(supplied.deps, supplied.input));
  assert.deepEqual(suppliedPair.facts.origins.activations, []);
  assert.deepEqual(suppliedPair.facts.arena.cells, []);
  for (const dimension of ["maximumWork", "maximumResultEntries"]) {
    let complete = false;
    for (let maximum = 0; maximum < 10000; maximum += 1) {
      const account = createAccount({ ...limits, [dimension]: maximum });
      const bounded = analyzeBodyRound({ ...caller.deps, account }, caller.input);
      if (bounded.kind === "complete") { complete = true; break; }
      assert.equal(bounded, accountFailure(account));
      const unread = new Proxy({}, { get() { throw new Error("no captured caller input read after original stop"); } });
      assert.equal(analyzeBodyRound({ ...caller.deps, account }, unread), bounded);
    }
    assert.equal(complete, true);
  }
});

test("a forwarded external captured cell preserves the original unmet read and exact child-summary witness", () => {
  const { program, child, owner, internal } = locationDefaultProgram("body-round.forwarded-default", { incoming: true, repeatedRead: true });
  const outer = fixture(owner);
  const initializer = fixture(child);
  const caller = fixture(program, internal, 0);
  initializer.related = [caller, outer];
  const childPair = checkedPair(initializer, analyzeBodyRound(initializer.deps, initializer.input));
  caller.related = [initializer, outer];
  caller.deps.summaryOf = () => ({ value: childPair.summary, unit: { request: initializer.deps.unit, position: { kind: "result" } } });
  const pair = checkedPair(caller, analyzeBodyRound(caller.deps, caller.input));
  assert.equal(pair.facts.arena.cells.length, 1, "the actual incoming MIR capture is reused, not aliased by role or copied into a new cell");
  assert.equal(pair.summary.arena.cells[0], pair.facts.arena.cells[0]);
  assert.equal(pair.summary.arena.contexts.length, 1);
  const need = pair.summary.initialization.points[0];
  assert.equal(need.kind, "need");
  assert.equal(need.cell, 0);
  assert.deepEqual(need.witness.read, childPair.summary.initialization.points[0].witness.read);
  assert.deepEqual(need.witness.via, [{ key: childPair.summary.key, row: 0 }]);
  assert.equal(need.at.execution, caller.execution);
  assert.deepEqual(pair.summary.initialization.rows[0], { point: 0, cell: null, condition: 0 });
  assert.equal(pair.summary.initialization.points.filter(row => row.kind === "need").length, 2,
    "different actual reads do not collapse because their own required cell and false condition agree");
  for (const dimension of ["maximumWork", "maximumResultEntries"]) {
    let complete = false;
    for (let maximum = 0; maximum < 10000; maximum += 1) {
      const account = createAccount({ ...limits, [dimension]: maximum });
      const bounded = analyzeBodyRound({ ...caller.deps, account }, caller.input);
      if (bounded.kind === "complete") { complete = true; break; }
      assert.equal(bounded, accountFailure(account));
      assert.equal(analyzeBodyRound({ ...caller.deps, account }, new Proxy({}, { get() { throw new Error("no forwarding read after stop"); } })), bounded);
    }
    assert.equal(complete, true);
  }
});

test("a located capture passed by value preserves its root read before the actual scalar call", () => {
  const name = "body-round.capture-argument";
  const owner = shaped(`${name}.owner`, [["input", "required", T.bool]], T.bool,
    builder => builder.block(builder.returns(builder.id("input", 0, T.bool))));
  const targetName = `${name}.target`;
  const targetProgram = shaped(targetName, [["value", "required", T.bool]], T.bool,
    builder => builder.block(builder.returns(builder.id("value", 0, T.bool))));
  const target = fixture(targetProgram);
  const targetPair = checkedPair(target, analyzeBodyRound(target.deps, target.input));
  const selected = callee(targetName, targetProgram.tir.signature, [mapped(0, 0)], T.bool);
  const source = { body: owner.tir.body, local: 0 };
  const builder = builders(name);
  const program = typedBody(name, { signature: signature(name, [], T.bool), completion: T.bool,
    locals: [["input", "capture", T.bool, false, source]], captures: [{ local: source, capture: "captured-location" }],
    root: builder.block(builder.returns(builder.call(builder.global("target", targetName, T.unknown),
      [{ $: "capture-argument", ...builder.id("input", 0, T.bool) }], T.bool,
      at => ({ callee: selected, receiver: null, arguments: [{ kind: "provided", parameter: 0, expression: at("capture-argument") }] })))) });
  program.bodyOf = instance => [owner.tir, targetProgram.tir].find(body =>
    sameInstance(instance, { body: body.body, bindings: body.bindings })) ?? null;
  const current = fixture(program);
  current.related = [fixture(owner), target];
  current.deps.summaryOf = key => {
    assert.equal(executionKey(key.execution), executionKey(target.execution));
    return { value: targetPair.summary, unit: { request: target.deps.unit, position: { kind: "result" } } };
  };
  const pair = checkedPair(current, analyzeBodyRound(current.deps, current.input));
  const invocation = pair.facts.origins.invocations[0];
  const need = pair.summary.initialization.points.find(point => point.kind === "need");
  assert.equal(need !== undefined, true, "passing scalar content does not erase the incoming cell's read obligation");
  assert.equal(need.cell, 0);
  assert.deepEqual(need.at.point, invocation.point);
  assert.deepEqual(need.witness.read, { kind: "body", value: program.nodeRef("capture-argument") });
  assert.deepEqual(need.witness.via, [], "this body's actual argument read is not invented as a callee read");
  const argument = invocation.alternatives[0].arguments[0];
  assert.equal(pair.facts.arena.origins[argument.actual].kind, "complete");
  assert.deepEqual(pair.facts.arena.origins[argument.actual].producers, [], "scalar value origins do not contain its location subject");
  assert.deepEqual(pair.facts.arena.contexts[invocation.alternatives[0].context].captures, [],
    "a by-value formal is not a capture or a caller-cell alias");
  assert.equal(pair.summary.arena.cells.length, 1);
  assert.equal(pair.summary.arena.boundProducers.length, 1);
  assert.equal(pair.summary.arena.contexts.length, 1);
  assert.equal(pair.summary.captures[0].reads.kind, "complete");
  assert.deepEqual(pair.summary.captures[0].reads.paths, []);
  for (const dimension of ["maximumWork", "maximumResultEntries"]) {
    let complete = false;
    for (let maximum = 0; maximum < 10000; maximum += 1) {
      const account = createAccount({ ...limits, [dimension]: maximum });
      const result = analyzeBodyRound({ ...current.deps, account }, current.input);
      if (result.kind === "complete") { complete = true; break; }
      assert.equal(result, accountFailure(account));
      assert.equal(analyzeBodyRound({ ...current.deps, account }, new Proxy({}, {
        get() { assert.fail("No capture argument read after the original stop."); },
      })), result);
    }
    assert.equal(complete, true);
  }
});

test("actual receiver and repeated provided-slot capture calls keep one proven local cell and no external local-cell obligation", () => {
  for (const options of [{ receiver: true }, { count: 2 }, { withReceiver: true }]) {
    const { program, children, internal } = locationDefaultProgram(`body-round.capture-reuse.${options.receiver ? "receiver" : options.withReceiver ? "receiver-formal" : "parameter"}`, options);
    const caller = fixture(program, internal, options.receiver ? 0 : 1);
    const initializers = children.map(child => fixture(child));
    for (const initializer of initializers) {
      initializer.related = [caller];
      checkedPair(initializer, analyzeBodyRound(initializer.deps, initializer.input));
    }
    caller.related = initializers;
    caller.deps.summaryOf = key => {
      const selected = initializers.find(row => executionKey(row.execution) === executionKey(key.execution));
      assert.equal(selected !== undefined, true);
      return { value: selected.pair.summary, unit: { request: selected.deps.unit, position: { kind: "result" } } };
    };
    const pair = checkedPair(caller, analyzeBodyRound(caller.deps, caller.input));
    assert.equal(pair.facts.arena.cells.length, 1);
    assert.equal(pair.facts.arena.boundProducers.length, 1);
    const capture = pair.facts.arena.contexts[1].captures[0];
    const subject = pair.facts.arena.producers[pair.facts.arena.boundProducers[capture.location].producer];
    const call = caller.input.mir.blocks.find(block => block.terminator.kind === "call").terminator;
    const captured = caller.input.mir.places[call.callee.captures[0].place].base.local;
    assert.deepEqual(subject, { id: pair.facts.arena.producers.length - 1, path: null, kind: "local", local: caller.input.mir.locals[captured].source });
    assert.equal(pair.summary.arena.producers.some(row => row.kind === "local"), false);
    assert.equal(pair.facts.origins.activations.length, children.length);
    assert.equal(pair.facts.arena.contexts.slice(1).every(row => row.captures[0].cell === 0 && row.captures[0].location === 0), true);
    assert.deepEqual(pair.summary.arena.cells, []);
    assert.deepEqual(pair.summary.initialization.points, [{ kind: "return" }]);
  }
});

test("actual captured call bindings refuse growth and retain every unsupported nonempty or mismatched ready relation", () => {
  const { program, child, internal } = locationDefaultProgram("body-round.capture-contract");
  const caller = fixture(program, internal, 1);
  const initializer = fixture(child);
  initializer.related = [caller];
  const pair = checkedPair(initializer, analyzeBodyRound(initializer.deps, initializer.input));
  const answer = value => ({ value, unit: { request: initializer.deps.unit, position: { kind: "result" } } });
  const run = (summary = pair.summary, input = caller.input, overrides = {}) => analyzeBodyRound({ ...caller.deps,
    account: createAccount(limits), summaryOf: () => answer(summary), ...overrides }, input);
  for (const changed of [{ maximumRelationalRecordsPerBody: 5 }, { maximumRelationalRecordsPerBody: 6 },
    { maximumRelationalReferencesPerBody: 4 }, { maximumRelationalReferencesPerBody: 5 },
    { maximumRelationalReferencesPerBody: 7 }, { maximumRelationalReferencesPerBody: 8 }])
    assert.equal(run(pair.summary, caller.input, { limits: { ...analysisLimits, ...changed } }).kind, "refused");
  assert.equal(run(pair.summary, caller.input, { limits: { ...analysisLimits, maximumRelationalReferencesPerBody: 9 } }).kind, "complete");
  const cell = pair.summary.arena.cells[0];
  for (const role of [{ kind: "local", local: cell.occurrence.local }, { kind: "capture", index: 1 }])
    assert.throws(() => run({ ...pair.summary, arena: { ...pair.summary.arena, cells: [{ ...cell, role }] } }), /actual capture or created-cell binding/);
  assert.throws(() => run({ ...pair.summary, arena: { ...pair.summary.arena, producers: [{ id: 0, path: 0, kind: "capture", index: 0 }] } }),
    /actual root argument or capture transport/);
  assert.equal(run({ ...pair.summary, writes: [{ target: 0, value: 0 }] }).kind, "complete",
    "a known primitive cell history is not an unsupported event or reference effect");
  assert.throws(() => run({ ...pair.summary, concurrentWrites: [{ target: 0, value: 0 }] }),
    /actual caller cell, event, callback or backing producer/);
  for (const [field, effect] of [["reads", { kind: "open", paths: [], boundaries: [0] }], ["reads", { kind: "complete", paths: [0] }],
    ["writes", { kind: "open", paths: [], boundaries: [0] }], ["writes", { kind: "complete", paths: [0] }]])
    assert.throws(() => run({ ...pair.summary, captures: [{ ...pair.summary.captures[0], [field]: effect }] }), /captured subobject read\/write transport/);
  const self = locationDefaultProgram("body-round.capture-self-read", { selfRead: true });
  const selfCaller = fixture(self.program, self.internal, 1);
  const selfInitializer = fixture(self.child);
  selfInitializer.related = [selfCaller];
  const selfPair = checkedPair(selfInitializer, analyzeBodyRound(selfInitializer.deps, selfInitializer.input));
  const runSelf = account => analyzeBodyRound({ ...selfCaller.deps, account,
    summaryOf: () => ({ value: selfPair.summary, unit: { request: selfInitializer.deps.unit, position: { kind: "result" } } }) }, selfCaller.input);
  const unwritten = runSelf(createAccount(limits));
  assert.equal(unwritten.kind, "complete");
  assert.equal(unwritten.value.value.kind, "error", "an unavailable actual entry value never becomes a successful empty Summary");
  assert.equal(unwritten.value.diagnostics[0].code.rendered, "TSONIC_READ_BEFORE_INITIALIZATION");
  for (const dimension of ["maximumWork", "maximumResultEntries"]) {
    let complete = false;
    for (let maximum = 0; maximum < 10000; maximum += 1) {
      const account = createAccount({ ...limits, [dimension]: maximum });
      const bounded = runSelf(account);
      if (bounded.kind === "complete") { assert.equal(bounded.value.value.kind, "error"); complete = true; break; }
      assert.equal(bounded, accountFailure(account));
    }
    assert.equal(complete, true);
  }
});

function localCaptureProgram(name, initialized, lexical = false, count = 1) {
  const names = ["b", "c"].slice(0, count);
  const builder = builders(name);
  const first = { $: "a", ...builder.variable(builder.declName("a", 0), 0, T.bool) };
  const statements = [builder.declare([first]), ...(initialized ? [builder.expressionStatement(builder.assign(builder.target("a", 0, T.bool),
    "EqualsToken", builder.keyword("TrueKeyword", T.bool), T.bool, T.bool))] : []), ...names.map((binding, index) => builder.declare([
      { $: binding, ...builder.variable(builder.declName(binding, index + 1), index + 1, T.bool, null, bodyId(`${name}.${binding}`, "initializer")) }]))];
  const program = typedBody(name, { signature: signature(name, [], T.bool), completion: T.bool,
    locals: [["a", "binding", T.bool, true], ...names.map(binding => [binding, "binding", T.bool])],
    root: builder.block(...(lexical ? [builder.block(...statements)] : statements), builder.returns(builder.id(names.at(-1), count, T.bool))) });
  const scope = lexical ? program.tir.root.statements.nodes[0] : program.tir.root;
  if (lexical) scope.statements.nodes[0].declarationList.flags = ["Let"];
  program.tir.locals[0].declaration = { kind: "item", value: { owner: def(`${name}.a`), node: program.nodeRef("a").node } };
  for (const [index, binding] of names.entries()) program.tir.locals[index + 1].declaration = { kind: "body", value: program.nodeRef(binding) };
  const source = { body: program.tir.body, local: 0 };
  let next = program.nodeCount;
  const children = names.map((binding, index) => {
    const childName = `${name}.${binding}`;
    const childBuilder = builders(childName, "initializer");
    const child = typedBody(childName, { role: "initializer", signature: signature(childName, [], T.bool), completion: T.bool,
      locals: [["a", "capture", T.bool, false, source]], captures: [{ local: source, capture: "captured-location" }],
      root: childBuilder.id("a", 0, T.bool) });
    const selected = seal(childName, childBuilder.id("a", 0, T.bool), "initializer", next);
    next = selected.count;
    child.tir.root = selected.root;
    const declaration = scope.statements.nodes[(initialized ? 2 : 1) + index].declarationList.declarations.nodes[0];
    child.tir.root.parent = declaration.id;
    declaration.initializer = child.tir.root;
    return child;
  });
  const bodies = [program.tir, ...children.map(child => child.tir)];
  const bodyOf = instance => bodies.find(tir => sameInstance(instance, { body: tir.body, bindings: tir.bindings })) ?? null;
  program.bodyOf = bodyOf;
  for (const child of children) child.bodyOf = bodyOf;
  const caller = fixture(program, children.map(child => ({ instance: { body: child.tir.body, bindings: child.tir.bindings },
    signature: child.tir.signature, captures: child.tir.captures })));
  const initializers = children.map(child => fixture(child));
  for (const initializer of initializers) {
    initializer.related = [caller];
    checkedPair(initializer, analyzeBodyRound(initializer.deps, initializer.input));
  }
  caller.related = initializers;
  caller.deps.summaryOf = key => {
    const initializer = initializers.find(row => executionKey(row.execution) === executionKey(key.execution));
    assert.equal(initializer !== undefined, true);
    return { value: initializer.pair.summary, unit: { request: initializer.deps.unit, position: { kind: "result" } } };
  };
  return { caller };
}

test("actual ITEM declarations project only their genuine executing occurrence and local association", () => {
  const { caller } = localCaptureProgram("body-round.local-item-source", true);
  const tir = caller.program.tir;
  const source = tir.locals[0];
  assert.equal(source.declaration.kind, "item");
  const run = reference => analyzeBodyRound({ ...caller.deps, account: createAccount(limits) }, { ...caller.input,
    tir: { ...tir, locals: tir.locals.map(row => row === source ? { ...row, declaration: reference } : row) } });
  const body = { kind: "body", value: caller.program.nodeRef("a") };
  const pair = checkedPair(caller, run(source.declaration));
  assert.deepEqual(pair.facts.arena.cells[0].occurrence, { kind: "declared", at: { kind: "node", node: body } });
  assert.equal(pair.facts.arena.cells[0].occurrence.at.node.value.node, source.declaration.value.node);
  checkedPair(caller, run(body));
  for (const reference of [
    { kind: "body", value: { ...body.value, body: caller.related[0].program.tir.body } },
    { kind: "item", value: { ...source.declaration.value, node: caller.related[0].program.tir.root.id } },
    { kind: "item", value: { ...source.declaration.value, node: tir.root.id } },
    { kind: "item", value: { ...source.declaration.value, node: tir.root.statements.nodes.at(-1).expression.id } },
    tir.locals[1].declaration,
  ]) assert.throws(() => run(reference), /actual executing occurrence and qualified local association/);
  const variable = tir.root.statements.nodes[0].declarationList.declarations.nodes[0];
  const original = variable.tsonic;
  try {
    for (const target of [def("another-variable"), {}, { kind: "definition", definition: def("another-variable") },
      { kind: "local", local: { body: caller.related[0].program.tir.body, local: 0 } },
      { kind: "local", local: { body: tir.body, local: -0 } }]) {
      variable.tsonic = { ...original, declaration: target };
      assert.throws(() => run(source.declaration), /actual executing occurrence and qualified local association/);
    }
  } finally { variable.tsonic = original; }
});

test("body-local capture cells retain actual storage markers and discharge only initialized read-time content", () => {
  for (const lexical of [false, true]) for (const initialized of [false, true]) {
    const { caller } = localCaptureProgram(`body-round.local-capture.${lexical}.${initialized}`, initialized, lexical);
    const result = analyzeBodyRound(caller.deps, caller.input);
    assert.equal(result.kind, "complete");
    if (initialized) {
      const pair = checkedPair(caller, result);
      const cell = pair.facts.arena.cells[0];
      assert.equal(caller.program.tir.locals[0].declaration.kind, "item");
      assert.deepEqual(cell.occurrence, { kind: "declared", at: { kind: "node", node: { kind: "body", value: caller.program.nodeRef("a") } } });
      assert.deepEqual(cell.lifetimes.map(marker => marker.kind), lexical ? ["live", "dead"] : ["live"]);
      for (const marker of cell.lifetimes) {
        const actual = caller.input.mir.blocks[marker.point.block].statements[marker.point.statement];
        assert.equal(actual.kind, marker.kind === "live" ? "storage-live" : "storage-dead");
        assert.equal(actual.local, cell.role.local);
      }
      assert.equal(pair.facts.arena.producers[pair.facts.arena.boundProducers[0].producer].kind, "local");
      assert.deepEqual(pair.summary.arena.cells, []);
      assert.deepEqual(pair.summary.arena.producers, []);
      assert.deepEqual(pair.summary.initialization.points, [{ kind: "return" }]);
      for (const [dimension, needed] of [["maximumRelationalRecordsPerBody", lexical ? 8 : 7],
        ["maximumRelationalReferencesPerBody", lexical ? 11 : 9]]) {
        for (let maximum = 0; maximum <= needed; maximum += 1) {
          const account = createAccount(limits);
          const deps = { ...caller.deps, account, limits: { ...analysisLimits, [dimension]: maximum } };
          const bounded = analyzeBodyRound(deps, caller.input);
          if (maximum === needed) checkedPair({ ...caller, deps }, bounded);
          else {
            assert.equal(bounded.kind, "refused");
            assert.equal(bounded, accountFailure(account));
            assert.deepEqual(bounded.diagnostics[0].arguments[0], { kind: "text", value: `analysis.${dimension}` });
          }
        }
      }
    } else {
      assert.equal(result.value.value.kind, "error");
      assert.equal(result.value.diagnostics[0].code.rendered, "TSONIC_READ_BEFORE_INITIALIZATION");
      assert.equal(result.value.value, result.value.positions[0].error);
    }
    for (const dimension of ["maximumWork", "maximumResultEntries"]) {
      let complete = false;
      for (let maximum = 0; maximum < 10000; maximum += 1) {
        const account = createAccount({ ...limits, [dimension]: maximum });
        const partial = analyzeBodyRound({ ...caller.deps, account }, caller.input);
        if (partial.kind === "complete") { complete = true; break; }
        assert.equal(partial, accountFailure(account));
        assert.equal(analyzeBodyRound({ ...caller.deps, account }, new Proxy({}, {
          get() { assert.fail("No local-lifetime input after the original stop."); },
        })), partial);
      }
      assert.equal(complete, true);
    }
  }
});

test("actual storage-marker evidence has hand-counted bounds and skips genuine unreached blocks", () => {
  const { caller } = localCaptureProgram("body-round.local-marker-budget", false);
  assert.deepEqual(caller.input.mir.blocks.map(block => block.statements.map(statement => statement.kind)),
    [["storage-live", "storage-live"], []]);
  for (const [dimension, needed] of [["maximumWork", 9], ["maximumResultEntries", 11]]) {
    for (let maximum = 0; maximum <= needed; maximum += 1) {
      const account = createAccount({ ...limits, [dimension]: maximum });
      const result = localSlotLifetimes(caller.input, [new Set(), new Set()], account);
      if (maximum === needed) assert.equal(result.kind, "complete");
      else {
        assert.equal(result, accountFailure(account));
        assert.equal(localSlotLifetimes(new Proxy({}, { get() { assert.fail("No marker input after stop."); } }), [], account), result);
      }
    }
  }
  const hidden = { ...caller.input, mir: { ...caller.input.mir, blocks: new Proxy(caller.input.mir.blocks, {
    get(target, key, receiver) {
      if (key === "0" || key === "1") assert.fail("Unreached marker payload is not read.");
      return Reflect.get(target, key, receiver);
    },
  }) } };
  const unused = localSlotLifetimes(hidden, [null, null], createAccount(limits));
  assert.equal(unused.kind, "complete");
  assert.equal(unused.value.size, 0);
});

test("an immediate body capture selects its current live local even when repeated markers share one object", () => {
  const { caller } = localCaptureProgram("body-round.local-marker-boundary", true);
  const mir = caller.input.mir;
  const slot = mir.locals.find(local => local.source?.local === 0);
  const first = mir.blocks[0];
  const marker = first.statements.find(statement => statement.kind === "storage-live" && statement.local === slot.id);
  const repeat = { ...mir, blocks: [{ ...first, statements: [marker, ...first.statements] }, ...mir.blocks.slice(1)] };
  assert.deepEqual(verifyMir(repeat, verificationContext(caller.program)), { kind: "complete", violations: [] });
  assert.equal(repeat.blocks[0].statements[0], repeat.blocks[0].statements[1]);
  const selected = { ...caller, input: { ...caller.input, mir: repeat } };
  const pair = checkedPair(selected, analyzeBodyRound({ ...caller.deps, account: createAccount(limits) }, selected.input));
  assert.deepEqual(pair.facts.arena.cells[0].occurrence, { kind: "declared", at: { kind: "node", node: { kind: "body", value: caller.program.nodeRef("a") } } });
  assert.deepEqual(pair.facts.arena.cells[0].lifetimes.map(row => row.point), [{ block: 0, statement: 0 }, { block: 0, statement: 1 }]);
  const temporary = { ...mir, locals: mir.locals.map(local => local === slot ? { ...local, role: { kind: "temporary" } } : local) };
  assert.deepEqual(verifyMir(temporary, verificationContext(caller.program)), { kind: "complete", violations: [] });
  assert.throws(() => analyzeBodyRound({ ...caller.deps, account: createAccount(limits) }, { ...caller.input, mir: temporary }),
    /actual local lifetime and value-subject binding/);
  const missing = { ...mir, blocks: [{ ...first, statements: first.statements.filter(statement => statement !== marker) }, ...mir.blocks.slice(1)] };
  const malformed = verifyMir(missing, verificationContext(caller.program));
  assert.equal(malformed.kind, "complete");
  assert.equal(malformed.violations.some(finding => finding.rule === "storage-live-before-use"), true);
  assert.throws(() => analyzeBodyRound({ ...caller.deps, account: createAccount(limits) }, { ...caller.input, mir: missing }),
    /actual must-live-at-call relation/);
});

test("current live-slot must joins intersect actual locals and pay before each retained row", () => {
  const lattice = storageLiveLattice(3);
  const first = new Set([0]);
  const same = new Set([0]);
  const alternatives = [new Set(), new Set([1])];
  assert.equal(lattice.isOverflow(first, createAccount(limits)), false);
  assert.equal(lattice.equals(first, first, createAccount(limits)), true);
  assert.equal(lattice.equals(first, null, createAccount(limits)), false);
  assert.equal(lattice.equals(null, first, createAccount(limits)), false);
  assert.equal(lattice.equals(first, same, createAccount(limits)), true);
  assert.equal(lattice.join(null, first, createAccount(limits)), first);
  assert.equal(lattice.join(first, null, createAccount(limits)), first);
  assert.equal(lattice.join(first, first, createAccount(limits)), first);
  for (const other of alternatives) {
    assert.equal(lattice.equals(first, other, createAccount(limits)), false);
    assert.deepEqual([...lattice.join(first, other, createAccount(limits))], []);
  }
  for (const [dimension, needed] of [["maximumWork", 2], ["maximumResultEntries", 2]])
    for (let maximum = 0; maximum <= needed; maximum += 1) {
      const account = createAccount({ ...limits, [dimension]: maximum });
      const result = lattice.join(first, same, account);
      if (maximum === needed) assert.deepEqual([...result], [...first]);
      else assert.notEqual(accountFailure(account), null);
    }
  const stopped = createAccount({ ...limits, maximumWork: 0 });
  assert.equal(lattice.equals(first, same, stopped), true);
  assert.notEqual(accountFailure(stopped), null);
});

test("immediate body captures reuse the symbolic current slot without carrying assignment credit across resets", () => {
  for (const restart of [false, true]) {
    const { caller } = localCaptureProgram(`body-round.reaching-storage-cache.${restart}`, true, false, 2);
    const original = caller.input.mir;
    const first = original.blocks[0];
    const local = original.locals.find(row => row.source?.local === 0).id;
    const live = first.statements.find(row => row.kind === "storage-live" && row.local === local);
    const assigned = first.statements.find(row => row.kind === "assign");
    const second = original.blocks[1];
    const mir = { ...original, blocks: [first, { ...second, statements: restart
      ? [{ ...live, kind: "storage-dead" }, live, assigned, ...second.statements] : second.statements }, original.blocks[2]] };
    assert.deepEqual(verifyMir(mir, verificationContext(caller.program)), { kind: "complete", violations: [] });
    const selected = { ...caller, input: { ...caller.input, mir } };
    const pair = checkedPair(selected, analyzeBodyRound({ ...caller.deps, account: createAccount(limits) }, selected.input));
    assert.equal(pair.facts.arena.cells.length, 1);
    assert.deepEqual(pair.facts.arena.cells[0].occurrence, { kind: "declared", at: { kind: "node", node: { kind: "body", value: caller.program.nodeRef("a") } } });
    assert.deepEqual(pair.facts.arena.contexts.slice(1).map(row => row.captures[0].cell), [0, 0]);
    assert.deepEqual(pair.facts.arena.cells[0].lifetimes.map(row => row.kind), restart ? ["live", "dead", "live"] : ["live"]);
    assert.equal(pair.facts.arena.producers.filter(producer => producer.kind === "local").length, 1);
    assert.equal(pair.facts.arena.boundProducers.length, 1);
    assert.deepEqual(pair.facts.arena.contexts.slice(1).map(row => row.captures[0].location), [0, 0]);
    assert.deepEqual(pair.summary.arena.cells, []);
    if (restart) {
      const reset = { ...mir, blocks: [first, { ...mir.blocks[1], statements: mir.blocks[1].statements.filter(row => row !== assigned) }, mir.blocks[2]] };
      const result = analyzeBodyRound({ ...caller.deps, account: createAccount(limits) }, { ...caller.input, mir: reset });
      assert.equal(result.kind, "complete");
      assert.equal(result.value.value.kind, "error");
      assert.equal(result.value.diagnostics[0].code.rendered, "TSONIC_READ_BEFORE_INITIALIZATION");
    }
  }
});

test("different branch starts select one current live slot only when every path retains live initialized storage", () => {
  const { caller } = localCaptureProgram("body-round.current-slot-branch", true);
  const original = caller.input.mir;
  const first = original.blocks[0];
  const local = original.locals.find(row => row.source?.local === 0).id;
  const marker = first.statements.find(row => row.kind === "storage-live" && row.local === local);
  const assigned = first.statements.find(row => row.kind === "assign");
  const branch = { ...first.terminator, kind: "switch", operand: assigned.value.operand,
    targets: [{ constant: assigned.value.operand.constant, target: 1 }], otherwise: 2, step: null };
  const jump = { ...first.terminator, kind: "goto", target: 3 };
  const selected = right => ({ ...original, blocks: [
    { ...first, statements: first.statements.filter(row => row !== marker && row !== assigned), terminator: branch },
    { ...first, id: 1, statements: [marker], terminator: jump },
    { ...first, id: 2, statements: right, terminator: jump },
    { ...first, id: 3, statements: [assigned], terminator: { ...first.terminator, next: 4 } },
    { ...original.blocks[1], id: 4 },
  ] });
  const mir = selected([marker]);
  assert.deepEqual(verifyMir(mir, verificationContext(caller.program)), { kind: "complete", violations: [] });
  const account = createAccount(limits);
  const storage = analyzeStorageUse({ account }, { execution: caller.execution, body: mir });
  assert.equal(storage.kind, "ok");
  const current = { ...caller, deps: { ...caller.deps, account }, input: { ...caller.input, mir, liveness: storage.value } };
  const pair = checkedPair(current, analyzeBodyRound(current.deps, current.input));
  assert.equal(pair.facts.arena.cells.length, 1);
  assert.deepEqual(pair.facts.arena.cells[0].lifetimes.map(row => row.point), [{ block: 1, statement: 0 }, { block: 2, statement: 0 }]);
  assert.deepEqual(pair.facts.arena.contexts[1].captures.map(row => row.cell), [0]);
  for (const right of [[], [marker, { ...marker, kind: "storage-dead" }]]) {
    const invalid = selected(right);
    const checked = verifyMir(invalid, verificationContext(caller.program));
    assert.equal(checked.kind, "complete");
    assert.equal(checked.violations.some(row => row.rule === "storage-live-before-use"), true);
    assert.throws(() => analyzeBodyRound({ ...caller.deps, account: createAccount(limits) }, { ...caller.input, mir: invalid }),
      /actual must-live-at-call relation/);
  }
  const unwritten = { ...mir, blocks: mir.blocks.map(block => block.id === 3 ? { ...block, statements: [] } : block) };
  assert.deepEqual(verifyMir(unwritten, verificationContext(caller.program)), { kind: "complete", violations: [] });
  const result = analyzeBodyRound({ ...caller.deps, account: createAccount(limits) }, { ...caller.input, mir: unwritten });
  assert.equal(result.kind, "complete");
  assert.equal(result.value.value.kind, "error");
  assert.equal(result.value.diagnostics[0].code.rendered, "TSONIC_READ_BEFORE_INITIALIZATION");
});

test("different executing locals with the same source declaration retain different symbolic cells", () => {
  const { caller } = localCaptureProgram("body-round.current-slot-qualified-symbol", true, false, 2);
  const original = caller.input.mir;
  const first = original.blocks[0];
  const source = original.locals.find(row => row.source?.local === 0);
  const marker = first.statements.find(row => row.kind === "storage-live" && row.local === source.id);
  const assigned = first.statements.find(row => row.kind === "assign");
  const local = { ...source, id: original.locals.length };
  const place = { ...original.places[assigned.place], id: original.places.length, base: { kind: "local", local: local.id } };
  const second = original.blocks[1];
  const mir = { ...original, locals: [...original.locals, local], places: [...original.places, place], blocks: [first,
    { ...second, statements: [{ ...marker, local: local.id }, { ...assigned, place: place.id }, ...second.statements],
      terminator: { ...second.terminator, callee: { ...second.terminator.callee,
        captures: second.terminator.callee.captures.map(row => ({ ...row, place: place.id })) } } }, original.blocks[2]] };
  assert.deepEqual(verifyMir(mir, verificationContext(caller.program)), { kind: "complete", violations: [] });
  const account = createAccount(limits);
  const storage = analyzeStorageUse({ account }, { execution: caller.execution, body: mir });
  assert.equal(storage.kind, "ok");
  const current = { ...caller, input: { ...caller.input, mir, liveness: storage.value } };
  const run = account => analyzeBodyRound({ ...caller.deps, account }, current.input);
  const pair = checkedPair(current, run(createAccount(limits)));
  assert.deepEqual(pair.facts.arena.cells.map(row => row.role.local), [source.id, local.id]);
  assert.deepEqual(pair.facts.arena.contexts.slice(1).map(row => row.captures[0].cell), [0, 1]);
  assert.deepEqual(pair.facts.arena.cells[0].occurrence.at.node, pair.facts.arena.cells[1].occurrence.at.node);
  assert.equal(pair.facts.arena.boundProducers.length, 1, "a common symbolic source subject is not common storage identity");
  for (const dimension of ["maximumWork", "maximumResultEntries"]) {
    let complete = false;
    for (let maximum = 0; maximum < 10000; maximum += 1) {
      const account = createAccount({ ...limits, [dimension]: maximum });
      const result = run(account);
      if (result.kind === "complete") { complete = true; break; }
      assert.equal(result, accountFailure(account));
    }
    assert.equal(complete, true);
  }
});

test("the actual must-live solve retains original stops at every work and row allowance", () => {
  const { caller } = localCaptureProgram("body-round.reaching-storage-budget", true, true);
  const assigned = solveAssigned({ ...caller.deps, account: createAccount(limits) }, caller.input);
  assert.equal(assigned.kind, "complete");
  const full = solveStorageLive(caller.input, assigned.value.entry, createAccount(limits));
  assert.equal(full.kind, "complete");
  assert.equal(full.value[1].has(caller.input.mir.locals.find(local => local.source?.local === 0).id), false,
    "a real lexical storage-dead removes its current start before return");
  for (const dimension of ["maximumWork", "maximumResultEntries"]) {
    let complete = false;
    for (let maximum = 0; maximum < 1000; maximum += 1) {
      const account = createAccount({ ...limits, [dimension]: maximum });
      const result = solveStorageLive(caller.input, assigned.value.entry, account);
      if (result.kind === "complete") { complete = true; break; }
      assert.equal(result, accountFailure(account));
      assert.equal(solveStorageLive(new Proxy({}, { get() { assert.fail("No current-slot input after the original stop."); } }), [], account), result);
    }
    assert.equal(complete, true);
  }
});

test("real branch joins and a loop retain the current live local without using source-node identity", () => {
  const name = "body-round.reaching-storage-control";
  const builder = builders(name);
  const program = typedBody(name, { signature: signature(name, [["flag", T.bool]], T.bool), completion: T.bool,
    params: [[0, "required", T.bool]], locals: [["flag", "parameter", T.bool], ["a", "binding", T.bool, true]],
    root: builder.block(builder.declare([builder.variable(builder.declName("a", 1), 1, T.bool)]),
      builder.ifElse(builder.id("flag", 0, T.bool),
        builder.expressionStatement(builder.assign(builder.target("a", 1, T.bool), "EqualsToken", builder.keyword("TrueKeyword", T.bool), T.bool, T.bool)),
        builder.expressionStatement(builder.assign(builder.target("a", 1, T.bool), "EqualsToken", builder.keyword("FalseKeyword", T.bool), T.bool, T.bool))),
      builder.whileLoop(builder.id("flag", 0, T.bool), builder.block(builder.expressionStatement(builder.id("flag", 0, T.bool)))),
      builder.returns(builder.id("flag", 0, T.bool))) });
  const current = fixture(program);
  const assigned = solveAssigned({ ...current.deps, account: createAccount(limits) }, current.input);
  assert.equal(assigned.kind, "complete");
  const starts = solveStorageLive(current.input, assigned.value.entry, createAccount(limits));
  assert.equal(starts.kind, "complete");
  const local = current.input.mir.locals.find(row => row.source?.local === 1).id;
  assert.equal(current.input.mir.blocks.some(block => block.terminator.kind === "switch"), true);
  assert.equal(current.input.mir.blocks.some(block => block.terminator.kind === "goto"), true);
  for (const state of starts.value) if (state !== null) assert.equal(state.has(local), true);
  for (const dimension of ["maximumWork", "maximumResultEntries"]) {
    let complete = false;
    for (let maximum = 0; maximum < 10000; maximum += 1) {
      const account = createAccount({ ...limits, [dimension]: maximum });
      const result = solveStorageLive(current.input, assigned.value.entry, account);
      if (result.kind === "complete") { complete = true; break; }
      assert.equal(result, accountFailure(account));
    }
    assert.equal(complete, true);
  }
});

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
  assert.equal(pair.facts.refinements.integers.some(row => row.node === child.tir.root.id), false,
    "a separate default's value occurrence belongs only to its own executing body");
  assert.equal(childPair.facts.refinements.integers.some(row => row.node === child.tir.root.id), true);
  const supplied = fixture(program, internal, 1);
  checkedPair(supplied, analyzeBodyRound(supplied.deps, supplied.input));
});

test("an actual placed header initializer outside the physical nested-callable inventory is not traversed", () => {
  const { program, child } = defaultProgram();
  assert.deepEqual(program.tir.nestedBodies, []);
  Object.defineProperty(child.tir.root, "tsonic", { get() { throw new Error("a caller cannot read its separately executed initializer payload"); } });
  const result = sourceOccurrences(program.tir, createAccount(limits));
  assert.equal(result.kind, "complete");
  assert.equal(result.value.has(program.tir.params[0].id), true);
  assert.equal(result.value.has(child.tir.root.id), false);
  assert.equal(result.value.has(program.tir.root.statements.nodes[0].expression.id), true);
});

test("the sole native absence survives a genuine separately executing null default and a supplied absence", () => {
  const name = "body-round.absence-default";
  const childName = `${name}.argument`;
  const childBody = bodyId(childName, "default-argument");
  const selected = signature(name, [["argument", T.absence, "default", childBody]], T.absence);
  const builder = builders(name);
  const program = typedBody(name, { signature: selected, completion: T.absence,
    locals: [["argument", "parameter", T.absence]], params: [[0, "default", T.absence, childBody]],
    root: builder.block(builder.returns(builder.id("argument", 0, T.absence))) });
  const childBuilder = builders(childName, "default-argument");
  const literal = childBuilder.keyword("NullKeyword", T.absence);
  const child = typedBody(childName, { role: "default-argument", signature: signature(childName, [], T.absence),
    completion: T.absence, root: literal });
  child.tir.root = seal(childName, literal, "default-argument", program.nodeCount).root;
  child.tir.root.parent = program.tir.params[0].id;
  program.tir.params[0].initializer = child.tir.root;
  const internal = [{ instance: { body: child.tir.body, bindings: child.tir.bindings }, signature: child.tir.signature, captures: [] }];
  program.bodyOf = instance => sameInstance(instance, internal[0].instance) ? child.tir : null;
  const initializer = fixture(child);
  const childPair = checkedPair(initializer, analyzeBodyRound(initializer.deps, initializer.input));
  assert.equal(childPair.summary.arena.origins[childPair.summary.result].includesAbsence, true);
  assert.equal(childPair.summary.arena.origins[childPair.summary.thrown].includesAbsence, false);
  for (const provided of [0, 1]) {
    const current = fixture(program, internal, provided);
    current.related = [initializer];
    let demands = 0;
    current.deps.summaryOf = key => {
      assert.equal(provided, 0, "supplied absence stays supplied and never runs its default");
      assert.equal(executionKey(key.execution), executionKey(initializer.execution));
      demands += 1;
      return { value: childPair.summary, unit: { request: initializer.deps.unit, position: { kind: "result" } } };
    };
    const pair = checkedPair(current, analyzeBodyRound(current.deps, current.input));
    assert.equal(demands > 0, provided === 0);
    assert.equal(pair.facts.origins.activations.length, provided === 0 ? 1 : 0);
    assert.equal(pair.summary.arena.origins[pair.summary.result].includesAbsence, true);
    assert.equal(pair.summary.arena.origins[pair.summary.arena.contexts[0].arguments[0]].includesAbsence, true);
    assert.equal(pair.facts.origins.reads.every(row => pair.facts.arena.origins[row.origins].includesAbsence), true);
    assert.equal(pair.facts.origins.writes.every(row => row.values.every(value => pair.facts.arena.origins[value.origins].includesAbsence)), true);
    assert.equal(pair.facts.origins.subjects.every(row => pair.facts.arena.origins[row.origins].includesAbsence), true);
    assert.equal(pair.facts.arena.origins.every(row => row.producers.length === 0), true,
      "native absence contributes no reference/cell/singleton proof");
    for (const dimension of ["maximumWork", "maximumResultEntries"]) {
      let complete = false;
      for (let maximum = 0; maximum < 10000; maximum += 1) {
        const account = createAccount({ ...limits, [dimension]: maximum });
        const result = analyzeBodyRound({ ...current.deps, account }, current.input);
        if (result.kind === "complete") { complete = true; break; }
        assert.equal(result, accountFailure(account));
        assert.equal(analyzeBodyRound({ ...current.deps, account }, new Proxy({}, { get() { assert.fail("No input after the original absence-round stop."); } })), result);
      }
      assert.equal(complete, true);
    }
    const proof = proveInitialization({ account: createAccount(limits), unit: current.deps.unit,
      summaryOf: () => ({ value: pair.summary, unit: { request: current.deps.unit, position: { kind: "result" } } }) },
    { modules: [], entries: [current.execution], storage: [] });
    assert.equal(proof.kind, "complete");
    assert.equal(proof.value.value.entries[0], current.execution);
  }
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

test("a literal-typed initialized local and its pure return conversion retain both real places at one source occurrence", () => {
  const name = "body-round.inferred-local";
  const childName = `${name}.value`;
  const childBody = bodyId(childName, "initializer");
  const builder = builders(name);
  const declaration = { $: "value-declaration", ...builder.variable(builder.declName("value", 0), 0, TRUE_LITERAL, null, childBody) };
  const statement = builder.declare([declaration]);
  statement.declarationList.flags = ["Const"];
  const program = typedBody(name, { signature: signature(name, [], T.bool), completion: T.bool,
    locals: [["value", "binding", TRUE_LITERAL]], root: builder.block(statement,
      builder.returns({ $: "value-read", ...builder.id("value", 0, TRUE_LITERAL) })) });
  program.tir.locals[0].declaration = { kind: "body", value: program.nodeRef("value-declaration") };
  const childBuilder = builders(childName, "initializer");
  const literal = childBuilder.keyword("TrueKeyword", TRUE_LITERAL);
  const child = typedBody(childName, { role: "initializer", signature: signature(childName, [], TRUE_LITERAL),
    completion: TRUE_LITERAL, root: literal });
  child.tir.root = seal(childName, literal, "initializer", program.nodeCount).root;
  const selectedDeclaration = program.tir.root.statements.nodes[0].declarationList.declarations.nodes[0];
  child.tir.root.parent = selectedDeclaration.id;
  selectedDeclaration.initializer = child.tir.root;
  const expression = program.tir.root.statements.nodes[1].expression;
  const occurrence = { kind: "body", value: program.nodeRef("value-read") };
  const embedding = { kind: "conversion", conversion: "literal-fit", check: { kind: "none" }, proof: {
    steps: [{ from: { root: occurrence, path: [] }, to: { root: occurrence, path: [] }, rule: "literal-fit", premises: [] }], conclusion: 0 } };
  expression.tsonic.convertedType = T.bool;
  expression.tsonic.conversion = { kind: "convert", role: "return", operation: { permissionScope: null, decision: {
    kind: "selected", operation: { kind: "conversion", from: TRUE_LITERAL, to: T.bool, embedding },
    operands: [TRUE_LITERAL], result: T.bool, execution: { kind: "pure" } } } };
  const internal = [{ instance: { body: child.tir.body, bindings: child.tir.bindings }, signature: child.tir.signature, captures: [] }];
  program.bodyOf = instance => sameInstance(instance, internal[0].instance) ? child.tir : null;
  const initializer = fixture(child);
  const childPair = checkedPair(initializer, analyzeBodyRound(initializer.deps, initializer.input));
  const current = fixture(program, internal);
  current.related = [initializer];
  current.deps.summaryOf = key => {
    assert.equal(executionKey(key.execution), executionKey(initializer.execution));
    return { value: childPair.summary, unit: { request: initializer.deps.unit, position: { kind: "result" } } };
  };
  const pair = checkedPair(current, analyzeBodyRound(current.deps, current.input));
  const rows = pair.facts.initialization.reads.filter(row => row.node === expression.id);
  assert.equal(rows.length, 2, "the local storage and converted temporary are actual distinct MIR reads");
  assert.notEqual(rows[0].place, rows[1].place);
  assert.equal(rows.every(row => row.assigned), true);
  assert.deepEqual(rows.map(row => current.input.mir.places[row.place].storage), [TRUE_LITERAL, T.bool]);
  assert.equal(pair.facts.origins.reads.filter(row => row.node === expression.id).length, 2);
  for (const reads of [[...pair.facts.initialization.reads].reverse(), [...pair.facts.initialization.reads, rows[1]]]) {
    const checked = verifyFacts({ ...pair.facts, initialization: { reads } }, current.input.mir, current.factsContext, createAccount(limits));
    assert.equal(checked.kind, "complete");
    assert.equal(checked.violations.some(row => row.rule === "initialization-order"), true,
      "reversed or repeated exact (node,place) pairs remain invalid canonical facts");
  }
  for (const dimension of ["maximumWork", "maximumResultEntries"]) {
    let complete = false;
    for (let maximum = 0; maximum < 10000; maximum += 1) {
      const account = createAccount({ ...limits, [dimension]: maximum });
      const result = analyzeBodyRound({ ...current.deps, account }, current.input);
      if (result.kind === "complete") { complete = true; break; }
      assert.equal(result, accountFailure(account));
      assert.equal(analyzeBodyRound({ ...current.deps, account }, new Proxy({}, { get() { assert.fail("No initialized-place input after stop."); } })), result);
    }
    assert.equal(complete, true);
  }
});

test("a real selected zero-argument direct call retains its surface invocation and exact activation context", () => {
  const childName = "body-round.direct.target";
  const child = shaped(childName, [], T.bool, builder => builder.block(builder.returns(builder.keyword("TrueKeyword", T.bool))));
  const target = fixture(child);
  const childPair = checkedPair(target, analyzeBodyRound(target.deps, target.input));
  const selected = callee(childName, child.tir.signature, [], T.bool);
  const program = shaped("body-round.direct.caller", [], T.bool, builder => builder.block(builder.returns(
    builder.call(builder.global("target", childName, T.unknown), [], T.bool,
      () => ({ callee: selected, receiver: null, arguments: [] })))));
  const current = fixture(program);
  current.related = [target];
  const completed = { request: target.deps.unit, position: { kind: "result" } };
  current.deps.summaryOf = key => {
    assert.equal(executionKey(key.execution), executionKey(target.execution));
    return { value: childPair.summary, unit: completed };
  };
  const pair = checkedPair(current, analyzeBodyRound(current.deps, current.input));
  assert.equal(pair.facts.origins.invocations.length, 1);
  checkSignatureStops(current);
  assert.equal(pair.facts.origins.activations.length, 1);
  const invocation = pair.facts.origins.invocations[0];
  const activation = pair.facts.origins.activations[0];
  const operation = current.input.mir.blocks[invocation.point.block].terminator;
  assert.equal(operation.kind, "call");
  assert.equal(operation.callee.kind, "direct");
  assert.equal(invocation.alternatives[0].resolution, operation.callee.resolution);
  assert.equal(invocation.alternatives[0].context, activation.context);
  assert.deepEqual(invocation.point, activation.point);
  assert.equal(sameInstance(activation.activation, target.execution.instance), true);
  assert.deepEqual(invocation.alternatives[0].arguments, []);
  assert.deepEqual(pair.summary.callbacks, []);
  assert.deepEqual(verifyFacts(pair.facts, current.input.mir, { ...current.factsContext,
    bindingDependentOf: () => { assert.fail("An actual selected activation never substitutes a template dependence decision."); } }, createAccount(limits)),
  { kind: "complete", violations: [] });
  const template = { ...target.execution.instance, bindings: { kind: "parametric" } };
  const wrongTemplate = verifyFacts({ ...pair.facts, origins: { ...pair.facts.origins,
    invocations: [{ ...invocation, alternatives: [{ ...invocation.alternatives[0], resolution: { ...selected, activation: template } }] }] } },
  current.input.mir, current.factsContext, createAccount(limits));
  assert.equal(wrongTemplate.kind, "complete");
  assert.equal(wrongTemplate.violations.some(row => row.rule === "summary-reference-exact"), true,
    "a parametric template is not the genuine empty-binding selected body activation");
  for (const invocations of [[], [{ ...invocation, alternatives: [{ ...invocation.alternatives[0], context: 0 }] }]]) {
    const result = verifyFacts({ ...pair.facts, origins: { ...pair.facts.origins, invocations } }, current.input.mir,
      current.factsContext, createAccount(limits));
    assert.equal(result.kind, "complete");
    assert.equal(result.violations.some(row => row.rule === "cross-owner-qualified"), true,
      "a real direct operation cannot borrow a node-only or different-context alternative");
  }
  for (const activation of ["at-creation", "when-first-driven"]) {
    const altered = { ...operation, callee: { ...operation.callee, resolution: { ...selected,
      decision: { ...selected.decision, activation } } } };
    assert.throws(() => callSummary(current.deps, current.input.mir, altered), /actual selected argument, receiver and capture transport/);
  }
  for (const completion of [{ ...selected.decision.completion, signature: CALLER_SIGNATURE }]) {
    assert.throws(() => callSummary(current.deps, current.input.mir, { ...operation, callee: { ...operation.callee,
      resolution: { ...selected, decision: { ...selected.decision, completion } } } }), /selected completion/);
  }
  for (const decision of [{ ...selected.decision, parameters: [{ kind: "omitted", parameter: 0, type: T.bool }] },
    { ...selected.decision, result: T.float64 }]) {
    assert.throws(() => callSummary(current.deps, current.input.mir, { ...operation, callee: { ...operation.callee,
      resolution: { ...selected, decision } } }), /selected completion/);
  }
  const discardProgram = shaped("body-round.direct.discard", [], T.void, builder => builder.block(builder.expressionStatement(
    builder.call(builder.global("target", childName, T.unknown), [], T.bool,
      () => ({ callee: selected, receiver: null, arguments: [] }))), builder.returns(null)));
  const discarded = fixture(discardProgram);
  discarded.related = [target];
  discarded.deps.summaryOf = current.deps.summaryOf;
  const discardedMir = { ...discarded.input.mir, blocks: discarded.input.mir.blocks.map(block => block.terminator.kind !== "call"
    ? block : { ...block, terminator: { ...block.terminator, destination: null } }) };
  assert.deepEqual(verifyMir(discardedMir, verificationContext(discardProgram)), { kind: "complete", violations: [] },
    "the canonical MIR call may genuinely discard a selected scalar result");
  const discardedAccount = createAccount(limits);
  const discardedStorage = analyzeStorageUse({ account: discardedAccount }, { execution: discarded.execution, body: discardedMir });
  assert.equal(discardedStorage.kind, "ok");
  discarded.deps.account = discardedAccount;
  discarded.input = { ...discarded.input, mir: discardedMir, liveness: discardedStorage.value };
  const discardPair = checkedPair(discarded, analyzeBodyRound(discarded.deps, discarded.input));
  assert.equal(discardPair.facts.origins.invocations.length, 1);
  assert.equal(discardPair.facts.origins.writes.length, 0);
  for (const dimension of ["maximumWork", "maximumResultEntries"]) {
    let complete = false;
    for (let maximum = 0; maximum < 10000; maximum += 1) {
      const account = createAccount({ ...limits, [dimension]: maximum });
      const result = analyzeBodyRound({ ...current.deps, account }, current.input);
      if (result.kind === "complete") { complete = true; break; }
      assert.equal(result, accountFailure(account));
      assert.equal(analyzeBodyRound({ ...current.deps, account }, new Proxy({}, { get() { assert.fail("No direct-call input after stop."); } })), result);
    }
    assert.equal(complete, true);
  }
});

test("real fixed by-value scalar arguments retain selected formals, source reads and actual empty applied effects", () => {
  const childName = "body-round.direct.argument.target";
  const child = shaped(childName, [["argument", "required", T.bool]], T.bool,
    builder => builder.block(builder.returns(builder.id("argument", 0, T.bool))));
  const target = fixture(child);
  const childPair = checkedPair(target, analyzeBodyRound(target.deps, target.input));
  const selected = callee(childName, child.tir.signature, [mapped(0, 0)], T.bool);
  const program = shaped("body-round.direct.argument.caller", [["input", "required", T.bool]], T.bool,
    builder => builder.block(builder.returns(builder.call(builder.global("target", childName, T.unknown),
      [{ $: "actual-input", ...builder.id("input", 0, T.bool) }], T.bool,
      at => ({ callee: selected, receiver: null, arguments: [{ kind: "provided", parameter: 0, expression: at("actual-input") }] })))));
  const current = fixture(program);
  current.related = [target];
  const completed = { request: target.deps.unit, position: { kind: "result" } };
  current.deps.summaryOf = key => {
    assert.equal(executionKey(key.execution), executionKey(target.execution));
    return { value: childPair.summary, unit: completed };
  };
  const pair = checkedPair(current, analyzeBodyRound(current.deps, current.input));
  const invocation = pair.facts.origins.invocations[0];
  checkSignatureStops(current);
  const alternative = invocation.alternatives[0];
  const transport = alternative.arguments[0];
  assert.equal(transport.parameter, TABLE.signatures[child.tir.signature].parameters[0].declaration);
  assert.equal(transport.parameterIndex, 0);
  assert.equal(transport.authoredIndex, 0);
  assert.equal(transport.passing, "by-value");
  assert.equal(transport.repeated, false);
  assert.equal(transport.projection, null);
  assert.equal(pair.facts.arena.contexts[alternative.context].arguments[0], transport.actual);
  assert.equal(transport.formal.owner.kind, "summary");
  assert.equal(executionKey(transport.formal.owner.key.execution), executionKey(target.execution));
  const formal = childPair.summary.arena.producers[transport.formal.producer];
  assert.equal(formal.kind, "parameter");
  assert.equal(formal.index, 0);
  const argumentNode = program.at("actual-input");
  assert.equal(pair.facts.initialization.reads.some(row => row.node === argumentNode && row.assigned), true);
  assert.equal(pair.facts.origins.reads.some(row => row.node === argumentNode && row.origins === transport.actual), true);
  assert.equal(pair.summary.parameters[0].reads.kind, "complete");
  assert.deepEqual(pair.summary.parameters[0].reads.paths, []);
  for (const maximum of [1, 2]) {
    const account = createAccount(limits);
    const result = analyzeBodyRound({ ...current.deps, account,
      limits: { ...analysisLimits, maximumRelationalReferencesPerBody: maximum } }, current.input);
    assert.equal(result.kind, maximum === 1 ? "refused" : "complete");
    if (result.kind !== "complete") assert.equal(result, accountFailure(account));
  }
  const operation = current.input.mir.blocks[invocation.point.block].terminator;
  for (const argument of [{ kind: "omitted" }, { ...operation.arguments[0], passing: "move" }])
    assert.throws(() => callSummary(current.deps, current.input.mir, { ...operation, arguments: [argument] }), /actual selected argument/);
  for (const mapping of [{ ...selected.decision.parameters[0], parameter: 1 },
    { ...selected.decision.parameters[0], argument: 1 }, { ...selected.decision.parameters[0], component: 0 },
    { ...selected.decision.parameters[0], passing: "move" }, { kind: "default", parameter: 0, initializer: DEFAULT_BODY }])
    assert.throws(() => callSummary(current.deps, current.input.mir, { ...operation, callee: { ...operation.callee,
      resolution: { ...selected, decision: { ...selected.decision, parameters: [mapping] } } } }), /actual fixed by-value mapping/);
  assert.throws(() => callSummary({ ...current.deps, signatureOf: () => ({ ...TABLE.signatures[child.tir.signature],
    parameters: [{ ...TABLE.signatures[child.tir.signature].parameters[0], passing: "move" }] }) }, current.input.mir, operation),
  /actual fixed by-value mapping/);
  assert.throws(() => callSummary({ ...current.deps, signatureOf: () => ({ ...TABLE.signatures[child.tir.signature],
    parameters: new Array(1) }) }, current.input.mir, operation), /actual fixed by-value mapping/);
  const syntax = sourceOccurrences(current.input.tir, createAccount(limits)).value.get(operation.tir.node);
  const annotation = syntax.tsonic;
  for (const actual of [null, {}, { ...annotation, application: { kind: "deferred" } },
    { ...annotation, application: { ...annotation.application, decision: { ...annotation.application.decision, arguments: [] } } },
    { ...annotation, application: { ...annotation.application, decision: { ...annotation.application.decision,
      arguments: [{ ...annotation.application.decision.arguments[0], parameter: 1 }] } } }]) {
    syntax.tsonic = actual;
    try {
      assert.throws(() => analyzeBodyRound({ ...current.deps, account: createAccount(limits) }, current.input),
        /actual source application|actual provided occurrence/);
    } finally { syntax.tsonic = annotation; }
  }
  for (const node of [9999, program.tir.root.id]) assert.throws(() => analyzeBodyRound({ ...current.deps, account: createAccount(limits) }, { ...current.input,
    mir: { ...current.input.mir, blocks: current.input.mir.blocks.map(block => block.id !== invocation.point.block ? block
      : { ...block, terminator: { ...block.terminator, tir: { ...block.terminator.tir, node } } }) } }), /actual source application/);
  for (const kind of ["NewExpression"]) {
    syntax.kind = kind;
    syntax.tsonic = { ...annotation, application: { kind: "deferred" } };
    try {
      assert.throws(() => analyzeBodyRound({ ...current.deps, account: createAccount(limits) }, current.input), /actual source application/);
    } finally { syntax.kind = "CallExpression"; syntax.tsonic = annotation; }
  }
  const unrelatedProducer = { id: childPair.summary.arena.producers.length, path: null, kind: "call-result",
    at: operation.tir, callee: { kind: "indirect" } };
  const extra = analyzeBodyRound({ ...current.deps, account: createAccount(limits), summaryOf: () => ({
    unit: completed, value: { ...childPair.summary, arena: { ...childPair.summary.arena,
      producers: [...childPair.summary.arena.producers, unrelatedProducer] } } }) }, current.input);
  assert.equal(extra.kind, "complete");
  assert.equal(extra.value.value.facts.origins.invocations[0].alternatives[0].arguments[0].formal.producer, formal.id,
    "an unused producer row does not become a formal or change the selected parameter relation");
  const unwrittenName = "body-round.direct.argument.unwritten";
  const builder = builders(unwrittenName);
  const uninitializedProgram = typedBody(unwrittenName, { signature: signature(unwrittenName, [], T.bool), completion: T.bool,
    locals: [["unwritten", "binding", T.bool, true]], root: builder.block(
      builder.declare([builder.variable(builder.declName("unwritten", 0), 0, T.bool)]),
      builder.returns(builder.call(builder.global("target", childName, T.unknown),
        [{ $: "unwritten-actual", ...builder.id("unwritten", 0, T.bool) }], T.bool,
        at => ({ callee: selected, receiver: null, arguments: [{ kind: "provided", parameter: 0, expression: at("unwritten-actual") }] })))) });
  const unwritten = fixture(uninitializedProgram);
  unwritten.deps.summaryOf = current.deps.summaryOf;
  const failed = analyzeBodyRound(unwritten.deps, unwritten.input);
  assert.equal(failed.kind, "complete");
  assert.equal(failed.value.value.kind, "error");
  assert.equal(failed.value.diagnostics[0].code.rendered, "TSONIC_READ_BEFORE_INITIALIZATION");
  for (const dimension of ["maximumWork", "maximumResultEntries"]) {
    for (const entry of [current, unwritten]) {
      let complete = false;
      for (let maximum = 0; maximum < 10000; maximum += 1) {
        const account = createAccount({ ...limits, [dimension]: maximum });
        const result = analyzeBodyRound({ ...entry.deps, account }, entry.input);
        if (result.kind === "complete") { complete = true; break; }
        assert.equal(result, accountFailure(account));
        assert.equal(analyzeBodyRound({ ...entry.deps, account }, new Proxy({}, { get() { assert.fail("No actual argument input after stop."); } })), result);
      }
      assert.equal(complete, true);
    }
  }
});

test("WT1's real two-argument add call keeps both actual selected formal identities in authored order", () => {
  const programs = wt1();
  const target = fixture(programs.add);
  const child = checkedPair(target, analyzeBodyRound(target.deps, target.input));
  const current = fixture(programs.total);
  current.related = [target];
  current.deps.summaryOf = key => {
    assert.equal(executionKey(key.execution), executionKey(target.execution));
    return { value: child.summary, unit: { request: target.deps.unit, position: { kind: "result" } } };
  };
  const pair = checkedPair(current, analyzeBodyRound(current.deps, current.input));
  const alternative = pair.facts.origins.invocations[0].alternatives[0];
  assert.deepEqual(alternative.arguments.map(row => [row.authoredIndex, row.parameterIndex, row.formal.producer]), [[0, 0, 0], [1, 1, 1]]);
  assert.deepEqual(alternative.arguments.map(row => row.parameter), TABLE.signatures[programs.add.tir.signature].parameters.map(row => row.declaration));
  assert.deepEqual(pair.facts.arena.contexts[alternative.context].arguments, alternative.arguments.map(row => row.actual));
  assert.deepEqual(child.summary.parameters.map(row => [row.reads, row.writes]), [0, 1].map(() => [
    { kind: "complete", paths: [] }, { kind: "complete", paths: [] }]));
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
  for (const selected of [{ kind: "indirect" }, { kind: "direct", resolution: { ...callee("body-round.unresolved", DEFAULT_SIGNATURE, [], T.bool), activation: null } },
    { ...operation.callee, captures: [0] }])
    assert.throws(() => run({ ...operation, callee: selected }), /actual selected argument, receiver and capture transport/);
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
    current.input, operation, point, answer, arena, 1, [], []);
  assert.throws(() => apply({ ...summary, arena: { ...summary.arena, cells: [{}] } }), /actual caller-cell bindings/);
  const absent = { ...summary.arena.origins[0], id: 1, includesAbsence: true };
  const absentArena = { ...summary.arena, origins: [...summary.arena.origins, absent] };
  assert.throws(() => apply({ ...summary, arena: absentArena, thrown: 1 }), /actual Origins result and thrown-value binding/);
  assert.throws(() => apply({ ...summary, arena: { ...summary.arena,
    producers: [{ id: 0, path: null, kind: "call-result", at: operation.tir, callee: { kind: "indirect" } }],
    boundProducers: [{ id: 0, producer: 0, bindings: EMPTY_BINDINGS, context: 0 }] } }),
  /actual caller cell, event, callback or backing producer/);
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
  const noReturnAssigned = solveAssigned({ ...noReturn, account: createAccount(limits) }, current.input);
  assert.equal(noReturnAssigned.kind, "complete");
  const noReturnStarts = solveStorageLive(current.input, noReturnAssigned.value.entry, createAccount(limits));
  assert.equal(noReturnStarts.kind, "complete");
  assert.equal(noReturnStarts.value[operation.next], null, "the actual non-returning summary never revives its continuation");
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

test("actual selected capture entries distinguish a copied scalar value from an external cell's unknown contents", () => {
  const owner = shaped("body-round.capture-entry.owner", [["value", "required", T.bool]], T.bool,
    builder => builder.block(builder.returns(builder.id("value", 0, T.bool))));
  for (const capture of ["captured-value", "captured-location"]) {
    const name = `body-round.capture-entry.${capture}`;
    const builder = builders(name, "default-argument");
    const local = { body: owner.tir.body, local: 0 };
    const program = typedBody(name, { role: "default-argument", signature: signature(name, [], T.bool), completion: T.bool,
      locals: [["value", "capture", T.bool, false, local]], captures: [{ local, capture }],
      root: builder.id("value", 0, T.bool) });
    program.bodyOf = instance => sameInstance(instance, { body: owner.tir.body, bindings: owner.tir.bindings }) ? owner.tir : null;
    const current = fixture(program);
    const captured = current.input.mir.locals.find(row => row.role.kind === "capture");
    assert.equal(captured !== undefined, true, "the real LowerMir producer retains the selected incoming capture slot");
    assert.equal(captured.mode, capture);
    assert.equal(captured.source.body, local.body);
    assert.equal(captured.source.local, local.local);
    const selected = current.input.mir.entries.find(row => row.provided === 0);
    const solved = solveAssigned({ ...current.deps, account: createAccount(limits) }, current.input);
    assert.equal(solved.kind, "complete");
    assert.equal(assignedEntry(solved.value.entry, selected.block).has(captured.id), capture === "captured-value",
      "a location's availability does not initialize the actual external cell's content");
    if (capture === "captured-location") {
      current.related = [fixture(owner)];
      const pair = checkedPair(current, analyzeBodyRound({ ...current.deps, account: createAccount(limits) }, current.input));
      assert.equal(pair.facts.arena, pair.summary.arena, "the projection borrows the same actual dense cell inventory");
      assert.deepEqual(pair.facts.arena.cells, [{ id: 0, role: { kind: "capture", index: 0 },
        occurrence: { kind: "entry", execution: current.execution, local: captured.id }, lifetimes: [] }]);
      assert.deepEqual(pair.summary.arena.contexts[0].captures, [{ index: 0, location: 0, cell: 0 }]);
      assert.equal(pair.summary.arena.boundProducers[0].producer, pair.summary.arena.producers[0].id);
      assert.equal(pair.summary.arena.producers[0].path, null, "a root capture is not a fabricated dereference projection");
      assert.deepEqual(pair.summary.captures, [{ index: 0, reads: { kind: "complete", paths: [] }, writes: { kind: "complete", paths: [] } }]);
      assert.equal(pair.facts.initialization.reads[0].assigned, false, "the child retains an actual caller obligation instead of false initialized credit");
      assert.equal(pair.summary.initialization.points[0].kind, "need");
      assert.equal(pair.summary.initialization.points[0].cell, 0);
      assert.deepEqual(pair.summary.initialization.points[0].at, { kind: "body", execution: current.execution,
        point: { block: selected.block, statement: null }, edge: null });
      assert.deepEqual(pair.summary.initialization.points[0].witness, { read: { kind: "body", value: { body: program.tir.body, node: program.tir.root.id } }, via: [] });
      assert.deepEqual(pair.summary.initialization.rows, [{ point: 0, cell: null, condition: 0 }, { point: 1, cell: null, condition: 0 }]);
      assert.throws(() => proveInitialization({ account: createAccount(limits), unit: current.deps.unit,
        summaryOf: () => ({ value: pair.summary, unit: { request: current.deps.unit, position: { kind: "result" } } }) },
      { modules: [], entries: [current.execution], storage: [] }), /callback\/event\/caller-cell application/);
      for (const dimension of ["maximumWork", "maximumResultEntries"]) {
        let completed = false;
        for (let maximum = 0; maximum <= 1024; maximum += 1) {
          const account = createAccount({ ...limits, [dimension]: maximum });
          const bounded = analyzeBodyRound({ ...current.deps, account }, current.input);
          if (bounded.kind === "complete") { completed = true; break; }
          assert.equal(bounded, accountFailure(account));
          const unread = new Proxy({}, { get() { throw new Error("no captured read after original round stop"); } });
          assert.equal(analyzeBodyRound({ ...current.deps, account }, unread), bounded);
        }
        assert.equal(completed, true, "the captured-location root need fits the exact existing-account allowance");
      }
    } else {
      assert.throws(() => analyzeBodyRound({ ...current.deps, account: createAccount(limits) }, current.input), /distinct copied capture slot/);
    }
    for (const dimension of ["maximumWork", "maximumResultEntries"]) {
      let firstComplete = null;
      for (let maximum = 0; maximum <= 256; maximum += 1) {
        const account = createAccount({ ...limits, [dimension]: maximum });
        const bounded = solveAssigned({ ...current.deps, account }, current.input);
        if (bounded.kind === "complete") { firstComplete = maximum; break; }
        assert.equal(bounded, accountFailure(account));
        const unread = new Proxy({}, { get() { throw new Error("no capture input read after original stop"); } });
        assert.equal(solveAssigned({ ...current.deps, account }, unread), bounded);
      }
      assert.equal(firstComplete !== null, true, "the finite actual capture graph reaches its exact existing-account allowance");
    }
  }
});

test("captured primitive writes retain their actual root mutation, history, exit content and must state", () => {
  const owner = shaped("body-round.capture-write.owner", [["value", "required", T.bool]], T.bool,
    builder => builder.block(builder.returns(builder.id("value", 0, T.bool))));
  const name = "body-round.capture-write";
  const builder = builders(name, "default-argument");
  const source = { body: owner.tir.body, local: 0 };
  const program = typedBody(name, { role: "default-argument", signature: signature(name, [], T.bool), completion: T.bool,
    locals: [["value", "capture", T.bool, true, source]], captures: [{ local: source, capture: "captured-location" }],
    root: builder.assign(builder.target("value", 0, T.bool), "EqualsToken", builder.keyword("TrueKeyword", T.bool), T.bool, T.bool) });
  program.bodyOf = instance => sameInstance(instance, { body: owner.tir.body, bindings: owner.tir.bindings }) ? owner.tir : null;
  const current = fixture(program);
  current.related = [fixture(owner)];
  const pair = checkedPair(current, analyzeBodyRound(current.deps, current.input));
  assert.equal(pair.facts.origins.writes[0].operation, "mutation", "an incoming cell's prior initialized state is not guessed");
  assert.deepEqual(pair.facts.origins.writes[0].targets, [pair.facts.arena.contexts[0].captures[0].location]);
  assert.deepEqual(pair.summary.writes, [{ target: 0, value: 0 }]);
  assert.deepEqual(pair.summary.contentsOnReturn, pair.summary.writes);
  assert.deepEqual(pair.facts.origins.exitContents.onReturn, pair.summary.contentsOnReturn);
  const exit = pair.summary.initialization.points.findIndex(point => point.kind === "return");
  assert.deepEqual(pair.summary.initialization.rows.filter(row => row.point === exit),
    [{ point: exit, cell: null, condition: 0 }, { point: exit, cell: 0, condition: 1 }]);
  for (const dimension of ["maximumWork", "maximumResultEntries"]) {
    let complete = false;
    for (let maximum = 0; maximum < 10000; maximum += 1) {
      const account = createAccount({ ...limits, [dimension]: maximum });
      const result = analyzeBodyRound({ ...current.deps, account }, current.input);
      if (result.kind === "complete") { complete = true; break; }
      assert.equal(result, accountFailure(account));
      assert.equal(analyzeBodyRound({ ...current.deps, account }, new Proxy({}, {
        get() { assert.fail("No captured write input after the original stop."); },
      })), result);
    }
    assert.equal(complete, true);
  }
});

test("a captured write retains sibling-cell state at the actual later required read", () => {
  const owner = shaped("body-round.capture-siblings.owner", [["left", "required", T.bool], ["right", "required", T.bool]], T.bool,
    builder => builder.block(builder.returns(builder.id("right", 1, T.bool))));
  const name = "body-round.capture-siblings";
  const builder = builders(name, "default-argument");
  const captures = [0, 1].map(local => ({ local: { body: owner.tir.body, local }, capture: "captured-location" }));
  const program = typedBody(name, { role: "default-argument", signature: signature(name, [], T.bool), completion: T.bool,
    locals: [["left", "capture", T.bool, true, captures[0].local], ["right", "capture", T.bool, true, captures[1].local]], captures,
    root: builder.sequence(builder.assign(builder.target("left", 0, T.bool), "EqualsToken", builder.keyword("TrueKeyword", T.bool), T.bool, T.bool),
      builder.id("right", 1, T.bool), T.bool) });
  program.bodyOf = instance => sameInstance(instance, { body: owner.tir.body, bindings: owner.tir.bindings }) ? owner.tir : null;
  const current = fixture(program);
  current.related = [fixture(owner)];
  const pair = checkedPair(current, analyzeBodyRound(current.deps, current.input));
  const read = pair.summary.initialization.points.findIndex(point => point.kind === "need" && point.cell === 1);
  assert.equal(read >= 0, true);
  assert.deepEqual(pair.summary.initialization.rows.filter(row => row.point === read),
    [{ point: read, cell: null, condition: 0 }, { point: read, cell: 0, condition: 1 }],
    "required right remains false while the actual preceding left write survives for later canonical alias application");
});

test("captured primitive may-write history is separate from the intersection of actual return must states", () => {
  const owner = shaped("body-round.capture-returns.owner", [["value", "required", T.bool]], T.bool,
    builder => builder.block(builder.returns(builder.id("value", 0, T.bool))));
  for (const [thenWrites, elseWrites] of [[true, false], [false, true], [true, true]]) {
    const name = `body-round.capture-returns.${thenWrites}.${elseWrites}`;
    const builder = builders(name);
    const local = { body: owner.tir.body, local: 0 };
    const write = () => builder.expressionStatement(builder.assign(builder.target("value", 1, T.bool), "EqualsToken",
      builder.keyword("TrueKeyword", T.bool), T.bool, T.bool));
    const arm = writes => builder.block(...(writes ? [write(), write()] : []), builder.returns(builder.keyword("FalseKeyword", T.bool)));
    const program = typedBody(name, { signature: signature(name, [["flag", T.bool]], T.bool), completion: T.bool,
      params: [[0, "required", T.bool]], locals: [["flag", "parameter", T.bool], ["value", "capture", T.bool, true, local]],
      captures: [{ local, capture: "captured-location" }], root: builder.block(builder.ifElse(builder.id("flag", 0, T.bool),
        arm(thenWrites), arm(elseWrites))) });
    program.bodyOf = instance => sameInstance(instance, { body: owner.tir.body, bindings: owner.tir.bindings }) ? owner.tir : null;
    const current = fixture(program);
    current.related = [fixture(owner)];
    const pair = checkedPair(current, analyzeBodyRound(current.deps, current.input));
    assert.deepEqual(pair.summary.writes, [{ target: 0, value: 0 }], "repeated stores retain one canonical may-history row");
    const exit = pair.summary.initialization.points.findIndex(point => point.kind === "return");
    assert.deepEqual(pair.summary.initialization.rows.filter(row => row.point === exit && row.cell === 0),
      thenWrites && elseWrites ? [{ point: exit, cell: 0, condition: 1 }] : [], "only a write on every actual return establishes the external cell");
  }
  const account = createAccount(limits);
  const refusal = refuseAccount(account, { kind: "refused", diagnostics: [] });
  assert.equal(captureMustAtExit({ account }, new Proxy([], { get() { assert.fail("No return-state input after original stop."); } }),
    new Set(), null), refusal);
});

test("captured reference writes remain an explicit value and exit-content producer frontier", () => {
  const owner = shaped("body-round.capture-reference-write.owner", [["left", "required", T.string], ["right", "required", T.string]], T.string,
    builder => builder.block(builder.returns(builder.id("right", 1, T.string))));
  const name = "body-round.capture-reference-write";
  const builder = builders(name, "default-argument");
  const captures = [0, 1].map(local => ({ local: { body: owner.tir.body, local }, capture: "captured-location" }));
  const program = typedBody(name, { role: "default-argument", signature: signature(name, [], T.string), completion: T.string,
    locals: [["left", "capture", T.string, true, captures[0].local], ["right", "capture", T.string, false, captures[1].local]], captures,
    root: builder.assign(builder.target("left", 0, T.string), "EqualsToken", builder.id("right", 1, T.string), T.string, T.string) });
  program.bodyOf = instance => sameInstance(instance, { body: owner.tir.body, bindings: owner.tir.bindings }) ? owner.tir : null;
  const current = fixture(program);
  assert.throws(() => analyzeBodyRound(current.deps, current.input), /actual captured reference content and exit-write transport/);
});

test("an actual authored throw retains its entry reference and a separate finite unwind outcome", () => {
  const program = shaped("body-round.authored-throw", [["value", "required", T.string]], T.bool,
    builder => builder.block(builder.throws(builder.id("value", 0, T.string))));
  const current = fixture(program);
  const pair = checkedPair(current, analyzeBodyRound(current.deps, current.input));
  assert.equal(pair.summary.returns, false);
  assert.equal(pair.summary.unwinds, true);
  assert.deepEqual(pair.summary.arena.origins[pair.summary.result].producers, []);
  assert.deepEqual(pair.summary.arena.origins[pair.summary.thrown].producers, [0]);
  assert.deepEqual(pair.summary.initialization.points, [{ kind: "unwind" }]);
  const block = current.input.mir.blocks.find(block => block.terminator.kind === "throw");
  assert.deepEqual(pair.facts.origins.escapes, [{ point: { block: block.id, statement: null },
    node: block.terminator.tir.node, producer: 0, target: { kind: "throw" } }]);
  assert.equal(pair.summary.retention.length, 1);
  assert.deepEqual(pair.summary.retention[0], { source: 0, at: { kind: "body", execution: current.execution,
    point: { block: block.id, statement: null }, edge: null }, into: { kind: "throw" } });
  for (const dimension of ["maximumWork", "maximumResultEntries"]) {
    let completed = false;
    for (let maximum = 0; maximum < 10000; maximum += 1) {
      const account = createAccount({ ...limits, [dimension]: maximum });
      const result = analyzeBodyRound({ ...current.deps, account }, current.input);
      if (result.kind === "complete") { checkedPair(current, result); completed = true; break; }
      assert.equal(result, accountFailure(account));
      assert.equal(analyzeBodyRound({ ...current.deps, account }, new Proxy({}, {
        get() { assert.fail("An escaping throw's original stop precedes every later input read."); },
      })), result);
    }
    assert.equal(completed, true);
  }
  for (const unwind of [{ kind: "abort" }, { kind: "none" }])
    assert.throws(() => terminatorOperands({ ...block.terminator, unwind }), /actual selected handler or process-ending throw transport/);
  const proof = proveInitialization({ account: createAccount(limits), unit: { query: "initializationProof", key: [] },
    summaryOf: () => ({ value: pair.summary, unit: { request: current.deps.unit, position: { kind: "result" } } }) },
  { modules: [], entries: [current.execution], storage: [] });
  assert.equal(proof.kind, "complete");
  assert.deepEqual(proof.value.value, { modules: [], entries: [current.execution] },
    "an authored throw is ordinary program control, not a compiler error or a fabricated native fault value");
});

test("actual return and throw arms retain distinct value Origins and finite exit states", () => {
  const program = shaped("body-round.mixed-exits", [["flag", "required", T.bool], ["left", "required", T.string],
    ["right", "required", T.string]], T.string, builder => builder.block(builder.ifElse(builder.id("flag", 0, T.bool),
      builder.block(builder.returns(builder.id("left", 1, T.string))), builder.block(builder.throws(builder.id("right", 2, T.string))))));
  const current = fixture(program);
  const pair = checkedPair(current, analyzeBodyRound(current.deps, current.input));
  assert.equal(pair.summary.returns, true);
  assert.equal(pair.summary.unwinds, true);
  assert.deepEqual(pair.summary.arena.origins[pair.summary.result].producers, [0]);
  assert.deepEqual(pair.summary.arena.origins[pair.summary.thrown].producers, [1]);
  assert.deepEqual(pair.summary.retention.map(row => row.into), [{ kind: "return" }, { kind: "throw" }]);
  assert.deepEqual(pair.summary.initialization.points, [{ kind: "return" }, { kind: "unwind" }]);
});

test("multiple actual throws union their value Origins without inventing a normal return", () => {
  const program = shaped("body-round.two-throws", [["flag", "required", T.bool], ["left", "required", T.string],
    ["right", "required", T.string]], T.string, builder => builder.block(builder.ifElse(builder.id("flag", 0, T.bool),
      builder.block(builder.throws(builder.id("left", 1, T.string))), builder.block(builder.throws(builder.id("right", 2, T.string))))));
  const current = fixture(program);
  const pair = checkedPair(current, analyzeBodyRound(current.deps, current.input));
  assert.equal(pair.summary.returns, false);
  assert.deepEqual(pair.summary.arena.origins[pair.summary.thrown].producers, [0, 1]);
  assert.deepEqual(pair.summary.initialization.points, [{ kind: "unwind" }]);
  assert.deepEqual(pair.summary.retention.map(row => row.into), [{ kind: "throw" }, { kind: "throw" }]);
});

test("an authored throw of an uninitialized own local retains the original read error instead of a Summary", () => {
  const name = "body-round.unwritten-throw";
  const builder = builders(name);
  const declaration = builder.variable(builder.declName("slot", 0), 0, T.bool);
  declaration.$ = "slot";
  const program = typedBody(name, { signature: signature(name, [], T.bool), completion: T.bool,
    locals: [["slot", "binding", T.bool, true]],
    root: builder.block(builder.declare([declaration]), builder.throws(builder.id("slot", 0, T.bool))) });
  program.tir.locals[0].declaration = { kind: "body", value: program.nodeRef("slot") };
  const current = fixture(program);
  const result = analyzeBodyRound(current.deps, current.input);
  assert.equal(result.kind, "complete");
  assert.equal(result.value.value.kind, "error");
  assert.equal(result.value.positions[0].error, result.value.value);
  assert.equal(result.value.diagnostics[0].code.rendered, "TSONIC_READ_BEFORE_INITIALIZATION");
  assert.equal("summary" in result.value.value, false);
});

test("an escaping primitive throw retains genuine capture writes and its own unwind initialization state", () => {
  const owner = shaped("body-round.throw-capture.owner", [["value", "required", T.bool]], T.bool,
    builder => builder.block(builder.returns(builder.id("value", 0, T.bool))));
  const name = "body-round.throw-capture";
  const builder = builders(name);
  const source = { body: owner.tir.body, local: 0 };
  const program = typedBody(name, { signature: signature(name, [], T.bool), completion: T.bool,
    locals: [["value", "capture", T.bool, true, source]], captures: [{ local: source, capture: "captured-location" }],
    root: builder.block(builder.expressionStatement(builder.assign(builder.target("value", 0, T.bool), "EqualsToken",
      builder.keyword("TrueKeyword", T.bool), T.bool, T.bool)), builder.throws(builder.id("value", 0, T.bool))) });
  program.bodyOf = instance => sameInstance(instance, { body: owner.tir.body, bindings: owner.tir.bindings }) ? owner.tir : null;
  const current = fixture(program);
  current.related = [fixture(owner)];
  const pair = checkedPair(current, analyzeBodyRound(current.deps, current.input));
  assert.equal(pair.summary.returns, false);
  assert.equal(pair.summary.unwinds, true);
  assert.deepEqual(pair.summary.contentsOnReturn, []);
  assert.deepEqual(pair.summary.contentsOnUnwind, [{ target: 0, value: 0 }]);
  assert.deepEqual(pair.facts.origins.exitContents.onUnwind, pair.summary.contentsOnUnwind);
  assert.deepEqual(pair.summary.initialization.rows, [{ point: 0, cell: null, condition: 0 }, { point: 0, cell: 0, condition: 1 }]);
  assert.deepEqual(pair.summary.retention, [], "the actual primitive throw has no invented reference producer");
});

test("an actual scalar call destination establishes its captured primitive cell", () => {
  const owner = shaped("body-round.capture-call.owner", [["value", "required", T.bool]], T.bool,
    builder => builder.block(builder.returns(builder.id("value", 0, T.bool))));
  const thunkName = "body-round.capture-call.thunk";
  const thunk = fixture(shaped(thunkName, [], T.bool, builder => builder.block(builder.returns(builder.keyword("TrueKeyword", T.bool)))));
  const thunkPair = checkedPair(thunk, analyzeBodyRound(thunk.deps, thunk.input));
  const name = "body-round.capture-call";
  const builder = builders(name, "default-argument");
  const source = { body: owner.tir.body, local: 0 };
  const program = typedBody(name, { role: "default-argument", signature: signature(name, [], T.bool), completion: T.bool,
    locals: [["value", "capture", T.bool, true, source]], captures: [{ local: source, capture: "captured-location" }],
    root: builder.sequence(builder.id("value", 0, T.bool), builder.call(builder.global("thunk", thunkName, T.unknown), [], T.bool,
      () => ({ callee: callee(thunkName, thunk.program.tir.signature, [], T.bool), receiver: null, arguments: [] })), T.bool) });
  program.bodyOf = instance => [owner.tir, thunk.program.tir].find(tir => sameInstance(instance, { body: tir.body, bindings: tir.bindings })) ?? null;
  const current = fixture(program);
  const captured = current.input.mir.locals.find(row => row.role.kind === "capture");
  const place = current.input.mir.places.find(row => row.base.kind === "local" && row.base.local === captured.id);
  const mir = { ...current.input.mir, blocks: current.input.mir.blocks.map(block => block.terminator.kind === "call"
    ? { ...block, terminator: { ...block.terminator, destination: place.id } } : block.terminator.kind === "return"
      ? { ...block, terminator: { ...block.terminator, value: { kind: "place", place: place.id } } } : block) };
  assert.deepEqual(verifyMir(mir, verificationContext(program)), { kind: "complete", violations: [] },
    "the actual selected call may name an available external storage destination in verified MIR");
  current.related = [fixture(owner), thunk];
  current.deps.summaryOf = () => ({ value: thunkPair.summary, unit: { request: thunk.deps.unit, position: { kind: "result" } } });
  const liveness = analyzeStorageUse({ account: createAccount(limits) }, { execution: current.execution, body: mir });
  assert.equal(liveness.kind, "ok");
  current.input = { ...current.input, mir, liveness: liveness.value };
  const pair = checkedPair(current, analyzeBodyRound(current.deps, current.input));
  assert.deepEqual(pair.summary.writes, [{ target: 0, value: 0 }]);
  assert.deepEqual(pair.summary.initialization.points, [{ kind: "return" }], "the actual MIR reads the captured call destination only after it is written");
  const exit = pair.summary.initialization.points.findIndex(point => point.kind === "return");
  assert.equal(pair.summary.initialization.rows.some(row => row.point === exit && row.cell === 0 && row.condition === 1), true);
  for (const dimension of ["maximumWork", "maximumResultEntries"]) {
    let complete = false;
    for (let maximum = 0; maximum < 10000; maximum += 1) {
      const account = createAccount({ ...limits, [dimension]: maximum });
      const result = analyzeBodyRound({ ...current.deps, account }, current.input);
      if (result.kind === "complete") { complete = true; break; }
      assert.equal(result, accountFailure(account));
    }
    assert.equal(complete, true);
  }
});

test("actual placed primitive writes update caller histories without inventing a second caller assignment", () => {
  for (const incoming of [false, true]) {
    const data = locationDefaultProgram(`body-round.applied-write.${incoming}`, { incoming, write: true, returnSource: true });
    const caller = fixture(data.program, data.internal, incoming ? 0 : 1);
    const child = fixture(data.child);
    child.related = [caller, ...(data.owner === null ? [] : [fixture(data.owner)])];
    const summary = checkedPair(child, analyzeBodyRound(child.deps, child.input)).summary;
    caller.related = [child, ...(data.owner === null ? [] : [fixture(data.owner)])];
    caller.deps.summaryOf = () => ({ value: summary, unit: { request: child.deps.unit, position: { kind: "result" } } });
    const pair = checkedPair(caller, analyzeBodyRound(caller.deps, caller.input));
    assert.deepEqual(pair.facts.origins.exitContents.onReturn, [{ target: 0, value: 0 }]);
    assert.deepEqual(pair.summary.writes, incoming ? [{ target: 0, value: 0 }] : []);
    assert.deepEqual(pair.summary.contentsOnReturn, pair.summary.writes);
    assert.deepEqual(pair.summary.initialization.points, [{ kind: "return" }]);
    assert.deepEqual(pair.summary.initialization.rows, incoming
      ? [{ point: 0, cell: null, condition: 0 }, { point: 0, cell: 0, condition: 1 }]
      : [{ point: 0, cell: null, condition: 0 }]);
    const call = caller.input.mir.blocks.find(row => row.terminator.kind === "call").terminator;
    const destinations = pair.facts.origins.writes.filter(row => row.node === call.tir.node);
    assert.equal(destinations.length, 1, "only the actual caller call-result destination is a caller WriteFact");
    assert.deepEqual(destinations[0].targets, [], "the actual callee mutation remains in callee Facts and caller cell history");
    assert.equal(child.pair.facts.origins.writes.some(row => row.operation === "mutation"), true);
    const supplied = fixture(data.program, data.internal, incoming ? 1 : 2);
    supplied.related = caller.related;
    supplied.deps.summaryOf = () => assert.fail("A supplied default does not execute its separate initializer.");
    const bypassed = checkedPair(supplied, analyzeBodyRound(supplied.deps, supplied.input));
    assert.deepEqual(bypassed.summary.writes, []);
    assert.equal(bypassed.summary.initialization.points.some(point => point.kind === "need"), incoming);
  }
  const data = locationDefaultProgram("body-round.applied-write.self", { selfRead: true, write: true });
  const caller = fixture(data.program, data.internal, 1);
  const child = fixture(data.child);
  child.related = [caller];
  const summary = checkedPair(child, analyzeBodyRound(child.deps, child.input)).summary;
  caller.related = [child];
  caller.deps.summaryOf = () => ({ value: summary, unit: { request: child.deps.unit, position: { kind: "result" } } });
  checkedPair(caller, analyzeBodyRound(caller.deps, caller.input));
  const twice = locationDefaultProgram("body-round.applied-write.twice", { count: 2, write: true });
  const repeated = fixture(twice.program, twice.internal, 1);
  const children = twice.children.map(child => fixture(child));
  const summaries = children.map(child => {
    child.related = [repeated];
    return checkedPair(child, analyzeBodyRound(child.deps, child.input)).summary;
  });
  repeated.related = children;
  repeated.deps.summaryOf = key => {
    const index = children.findIndex(child => executionKey(child.execution) === executionKey(key.execution));
    return { value: summaries[index], unit: { request: children[index].deps.unit, position: { kind: "result" } } };
  };
  const repeatedPair = checkedPair(repeated, analyzeBodyRound(repeated.deps, repeated.input));
  assert.deepEqual(repeatedPair.facts.origins.exitContents.onReturn, [{ target: 0, value: 0 }],
    "two actual calls mutating the same current slot retain one canonical cell history");
});

test("primitive applied-write admission retains precise value, location and original-account frontiers", () => {
  const data = locationDefaultProgram("body-round.primitive-write-frontiers", { write: true });
  const caller = fixture(data.program, data.internal, 1);
  const child = fixture(data.child);
  child.related = [caller];
  const summary = checkedPair(child, analyzeBodyRound(child.deps, child.input)).summary;
  const call = caller.input.mir.blocks.find(row => row.terminator.kind === "call").terminator;
  const owner = { kind: "body", execution: caller.execution };
  const cell = { owner, cell: 0 };
  const empty = { caller: [], callee: [], boundaries: [], includesAbsence: false };
  const target = { kind: "located", targets: [cell], same: cell };
  const write = { target, value: empty };
  const run = (rows = [write], input = caller.input, overrides = {}) => primitiveWrites({ ...caller.deps,
    account: createAccount(limits), ...overrides }, input, call, summary, summary.writes, rows);
  assert.equal(run(), null);
  for (const changed of [{ ...write, target: { ...target, same: null } }, { ...write, target: { ...target, targets: [cell, cell] } },
    ...["caller", "callee", "boundaries"].map(key => ({ ...write, value: { ...empty, [key]: [0] } })),
    { ...write, value: { ...empty, includesAbsence: true } }])
    assert.throws(() => run([changed]), /actual non-primitive or unresolved caller-cell write transport/);
  const local = caller.input.mir.places[call.callee.captures[0].place].base.local;
  assert.throws(() => run([write], { ...caller.input, mir: { ...caller.input.mir, locals: caller.input.mir.locals.map(row =>
    row.id === local ? { ...row, storage: T.string } : row) } }), /actual non-primitive caller-cell write transport/);
  for (const dimension of ["maximumWork", "maximumResultEntries"]) {
    let complete = false;
    for (let maximum = 0; maximum < 100; maximum += 1) {
      const account = createAccount({ ...limits, [dimension]: maximum });
      const result = run([write], caller.input, { account });
      if (result === null) { complete = true; break; }
      assert.equal(result, accountFailure(account));
      const unread = new Proxy([], { get() { assert.fail("No write-vector read after original stop."); } });
      assert.equal(primitiveWrites({ ...caller.deps, account }, unread, call, summary, unread, unread), result);
    }
    assert.equal(complete, true);
  }
});

test("constant call-point state uses original bindings and rejects unprovided event or nonconstant substitution", () => {
  const data = locationDefaultProgram("body-round.constant-call-state", { write: true });
  const caller = fixture(data.program, data.internal, 1);
  const child = fixture(data.child);
  child.related = [caller];
  const summary = checkedPair(child, analyzeBodyRound(child.deps, child.input)).summary;
  const call = caller.input.mir.blocks.find(row => row.terminator.kind === "call").terminator;
  const local = caller.input.mir.places[call.callee.captures[0].place].base.local;
  const run = (changed = summary, assigned = new Set()) => callReturnAssigned({ ...caller.deps, account: createAccount(limits) },
    caller.input.mir, call, changed, assigned);
  assert.deepEqual(run(), { kind: "complete", value: new Set([local]) });
  for (const table of [{ ...summary.initialization, events: [{}] },
    ...[0, 1].map(index => ({ ...summary.initialization, rows: summary.initialization.rows.map((row, at) =>
      at === index ? { ...row, condition: 2 } : row) })),
    { ...summary.initialization, rows: [{ ...summary.initialization.rows[0], cell: 0 }, ...summary.initialization.rows.slice(1)] }])
    assert.throws(() => sourceNeedAssigned({ ...caller.deps, account: createAccount(limits) }, { ...summary, initialization: table },
      0, [{ kind: "cell", index: 0 }], [local], new Set()), /actual (completion-event substitution|constant point-state condition and default)/);
  assert.throws(() => run({ ...summary, initialization: { ...summary.initialization, points: [], rows: [] } }), /actual finite-return point state/);
  for (const changed of [{ ...summary, arena: { ...summary.arena, cells: [] } },
    { ...summary, arena: { ...summary.arena, cells: [{ ...summary.arena.cells[0], role: { kind: "local", local } }] } }])
    assert.throws(() => run(changed), /actual immediate captured-slot binding/);
  assert.throws(() => captureLocalAtCall({ ...caller.deps, account: createAccount(limits) }, caller.input.mir,
    { ...call, callee: { kind: "direct" } }, summary, 0), /actual immediate captured-slot binding/);
  const failed = createAccount(limits);
  const original = refuseAccount(failed, { kind: "refused", diagnostics: [] });
  const unread = new Proxy({}, { get() { assert.fail("No point-state input after original refusal."); } });
  assert.equal(callReturnAssigned({ ...caller.deps, account: failed }, unread, unread, unread, unread), original);
  assert.equal(sourceNeedAssigned({ ...caller.deps, account: failed }, unread, 0, unread, unread, unread), original);
});

test("an applied child read retains the whole genuine sibling point state in the enclosing capture obligation", () => {
  const name = "body-round.applied-siblings";
  const owner = shaped(`${name}.owner`, [["left", "required", T.bool], ["right", "required", T.bool]], T.bool,
    builder => builder.block(builder.returns(builder.id("right", 1, T.bool))));
  const childName = `${name}.value`;
  const childBody = bodyId(childName, "default-argument");
  const builder = builders(name);
  const captures = [0, 1].map(local => ({ local: { body: owner.tir.body, local }, capture: "captured-location" }));
  const program = typedBody(name, { signature: signature(name, [["value", T.bool, "default", childBody]], T.bool), completion: T.bool,
    params: [[2, "default", T.bool, childBody]], locals: [["left", "capture", T.bool, true, captures[0].local],
      ["right", "capture", T.bool, false, captures[1].local], ["value", "parameter", T.bool]], captures,
    root: builder.block(builder.returns(builder.id("value", 2, T.bool))) });
  const childBuilder = builders(childName, "default-argument");
  const childCaptures = captures;
  const childRoot = () => childBuilder.sequence(childBuilder.assign(childBuilder.target("left", 0, T.bool), "EqualsToken",
    childBuilder.keyword("TrueKeyword", T.bool), T.bool, T.bool), childBuilder.id("right", 1, T.bool), T.bool);
  const childProgram = typedBody(childName, { role: "default-argument", signature: signature(childName, [], T.bool), completion: T.bool,
    locals: [["left", "capture", T.bool, true, childCaptures[0].local], ["right", "capture", T.bool, false, childCaptures[1].local]],
    captures: childCaptures, root: childRoot() });
  childProgram.tir.root = seal(childName, childRoot(), "default-argument", program.nodeCount).root;
  childProgram.tir.root.parent = program.tir.params[0].id;
  program.tir.params[0].initializer = childProgram.tir.root;
  const bodyOf = instance => [owner.tir, program.tir, childProgram.tir].find(tir =>
    sameInstance(instance, { body: tir.body, bindings: tir.bindings })) ?? null;
  program.bodyOf = bodyOf;
  childProgram.bodyOf = bodyOf;
  const caller = fixture(program, [{ instance: { body: childBody, bindings: childProgram.tir.bindings },
    signature: childProgram.tir.signature, captures: childCaptures }], 0);
  const child = fixture(childProgram);
  child.related = [caller, fixture(owner)];
  const summary = checkedPair(child, analyzeBodyRound(child.deps, child.input)).summary;
  caller.related = [child, fixture(owner)];
  caller.deps.summaryOf = () => ({ value: summary, unit: { request: child.deps.unit, position: { kind: "result" } } });
  const pair = checkedPair(caller, analyzeBodyRound(caller.deps, caller.input));
  assert.equal(pair.summary.initialization.points[0].cell, 1);
  assert.deepEqual(pair.summary.initialization.rows.filter(row => row.point === 0),
    [{ point: 0, cell: null, condition: 0 }, { point: 0, cell: 0, condition: 1 }],
    "the right need keeps the actual preceding left write, not just the required cell's false condition");
  assert.deepEqual(pair.summary.writes, [{ target: 0, value: 0 }]);
  assert.equal(pair.summary.initialization.points[0].witness.via.length, 1);
  const call = caller.input.mir.blocks.find(block => block.terminator.kind === "call").terminator;
  const locals = call.callee.captures.map(capture => caller.input.mir.places[capture.place].base.local);
  const alreadyWritten = new Set([locals[0]]);
  assert.equal(sourceNeedAssigned({ ...caller.deps, account: createAccount(limits) }, summary, 0,
    locals.map((_, index) => ({ kind: "cell", index })), locals, alreadyWritten).value, alreadyWritten,
    "an actual earlier caller write is retained without redundant copied state");
  for (const dimension of ["maximumWork", "maximumResultEntries"]) {
    let completed = false;
    for (let maximum = 0; maximum < 10000; maximum += 1) {
      const account = createAccount({ ...limits, [dimension]: maximum });
      const result = analyzeBodyRound({ ...caller.deps, account }, caller.input);
      if (result.kind === "complete") { checkedPair(caller, result); completed = true; break; }
      assert.equal(result.kind, "resource-limit");
      assert.equal(accountFailure(account), result);
    }
    assert.equal(completed, true, "the actual two-cell source graph reaches its first sufficient shared allowance");
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

test("actual string entries retain formal value Origins through reads, returns and the canonical handoff", () => {
  const literal = declareType("bodyRoundEntryString", { kind: "literal", base: T.string, value: { kind: "string", value: "entry" } });
  for (const [name, type] of [["body-round.string", T.string], ["body-round.literal-string", literal]]) {
    const current = fixture(shaped(name, [["input", "required", type]], type,
      builder => builder.block(builder.returns(builder.id("input", 0, type)))));
    const pair = checkedPair(current, analyzeBodyRound(current.deps, current.input));
    const arena = pair.summary.arena;
    const returned = arena.origins[pair.summary.result];
    assert.equal(returned.kind, "complete");
    assert.equal(returned.includesAbsence, false);
    assert.equal(returned.producers.length, 1, "a genuine reference entry never becomes empty Origins");
    const bound = arena.boundProducers[returned.producers[0]];
    assert.deepEqual(arena.producers[bound.producer], { id: 0, kind: "parameter", index: 0, path: null });
    assert.equal(bound.bindings, current.execution.instance.bindings.bindings);
    assert.equal(bound.context, arena.contexts[0].id);
    assert.equal(arena.contexts[0].arguments[0], pair.summary.result);
    assert.equal(pair.facts.origins.reads.every(row => row.origins === pair.summary.result), true);
    assert.equal(pair.facts.origins.subjects.every(row => row.origins === pair.summary.result), true);
    assert.deepEqual(arena.cells, [], "a formal value producer asserts no physical holding, logical cell or singleton");
    assert.deepEqual(pair.summary.resultCells, []);
    assert.equal(pair.facts.origins.escapes.length, 1);
    const returnedAt = current.input.mir.blocks.find(block => block.terminator.kind === "return");
    assert.deepEqual(pair.facts.origins.escapes[0], { point: { block: returnedAt.id, statement: null },
      node: returnedAt.terminator.tir.node, producer: bound.producer, target: { kind: "return" } });
    assert.deepEqual(pair.summary.retention, [{ source: bound.id, at: { kind: "body", execution: current.execution,
      point: { block: returnedAt.id, statement: null }, edge: null }, into: { kind: "return" } }]);
    const proof = proveInitialization({ ...current.deps, account: createAccount(limits),
      summaryOf: () => ({ value: pair.summary, unit: { request: current.deps.unit, position: { kind: "result" } } }) },
    { modules: [], entries: [current.execution], storage: [] });
    assert.equal(proof.kind, "complete");
    assert.equal(proof.value.value.kind, undefined);
  }
});

test("distinct string return alternatives preserve actual formal ordinals and canonical union", () => {
  for (const repeated of [false, true]) {
    const current = fixture(shaped(`body-round.reference-choose.${repeated}`, [["flag", "required", T.bool],
      ["left", "required", T.string], ["right", "required", T.string]], T.string, builder =>
      builder.block(builder.ifElse(builder.id("flag", 0, T.bool), builder.returns(builder.id("left", 1, T.string)),
        builder.returns(builder.id(repeated ? "left" : "right", repeated ? 1 : 2, T.string))))));
    const pair = checkedPair(current, analyzeBodyRound(current.deps, current.input));
    const arena = pair.summary.arena;
    assert.deepEqual(arena.origins[pair.summary.result].producers.map(id => arena.producers[arena.boundProducers[id].producer].index),
      repeated ? [1] : [1, 2], "the scalar formal is not a reference and does not shift authored parameter indices");
    assert.equal(pair.facts.origins.subjects.length, 2);
    assert.deepEqual(arena.origins[arena.contexts[0].arguments[0]].producers, []);
    assert.deepEqual(arena.cells, []);
    assert.deepEqual(arena.projections, []);
    assert.equal(pair.summary.retention.length, 2);
    assert.equal(pair.facts.origins.escapes.length, 2);
  }
});

test("an unmodified reference entry survives boundary projection after a genuine scalar call", () => {
  const targetName = "body-round.reference-projection.target";
  const target = fixture(shaped(targetName, [], T.bool, builder => builder.block(builder.returns(builder.keyword("TrueKeyword", T.bool)))));
  const targetPair = checkedPair(target, analyzeBodyRound(target.deps, target.input));
  const selected = callee(targetName, target.program.tir.signature, [], T.bool);
  const program = shaped("body-round.reference-projection.caller", [["input", "required", T.string]], T.string, builder =>
    builder.block(builder.expressionStatement(builder.call(builder.global("target", targetName, T.unknown), [], T.bool,
      () => ({ callee: selected, receiver: null, arguments: [] }))), builder.returns(builder.id("input", 0, T.string))));
  const current = fixture(program);
  current.related = [target];
  current.deps.summaryOf = () => ({ value: targetPair.summary,
    unit: { request: target.deps.unit, position: { kind: "result" } } });
  const pair = checkedPair(current, analyzeBodyRound(current.deps, current.input));
  assert.equal(pair.facts.arena.contexts.length, 2);
  assert.equal(pair.summary.arena.contexts.length, 1);
  assert.equal(pair.summary.arena.boundProducers.length, 1);
  const result = pair.summary.arena.origins[pair.summary.result];
  const entry = pair.summary.arena.boundProducers[result.producers[0]];
  assert.equal(result.producers.length, 1);
  assert.deepEqual(pair.summary.arena.producers[entry.producer], { id: 0, path: null, kind: "parameter", index: 0 });
  assert.equal(pair.summary.retention[0].source, entry.id);
  assert.equal(pair.facts.origins.activations.length, 1);
  assert.deepEqual(pair.summary.arena.cells, []);
});

test("a reference receiver is a value entry separate from formal ordinals and missing signature subjects", () => {
  const current = fixture(shaped("body-round.reference-receiver", [["this", "this", T.string], ["input", "required", T.string]], T.string,
    builder => builder.block(builder.returns(builder.id("this", 0, T.string))), { receiver: T.string }));
  const pair = checkedPair(current, analyzeBodyRound(current.deps, current.input));
  const arena = pair.summary.arena;
  assert.equal(pair.summary.result, arena.contexts[0].receiver);
  assert.equal(arena.contexts[0].receiver === arena.contexts[0].arguments[0], false);
  assert.deepEqual(arena.producers[arena.boundProducers[arena.origins[pair.summary.result].producers[0]].producer],
    { id: 0, path: null, kind: "receiver" });
  const parameter = arena.origins[arena.contexts[0].arguments[0]].producers[0];
  assert.deepEqual(arena.producers[arena.boundProducers[parameter].producer], { id: 1, path: null, kind: "parameter", index: 0 });
  const invalid = { ...current.input, mir: { ...current.input.mir, locals: current.input.mir.locals.map(local =>
    local.role.kind === "parameter" ? { ...local, role: { kind: "parameter", index: 7 } } : local) } };
  assert.throws(() => analyzeBodyRound({ ...current.deps, account: createAccount(limits) }, invalid), /actual signature formal or receiver producer/);
});

test("entry reference alternatives retain the complete selected execution vector, not only the creator environment", () => {
  const program = shaped("body-round.reference-selected", [["input", "required", T.string]], T.string,
    builder => builder.block(builder.returns(builder.id("input", 0, T.string))));
  const declaration = def("body-round.reference-selected.T");
  program.tir.bindings = { kind: "instantiated", bindings: { ...EMPTY_BINDINGS,
    methodBindings: [{ kind: "bound", parameter: declaration, type: T.string }] } };
  program.tir.dependence = "binding-dependent";
  program.bindingScope = { ...scope, methodParameters: [declaration] };
  const current = fixture(program);
  const pair = checkedPair(current, analyzeBodyRound(current.deps, current.input));
  const bound = pair.summary.arena.boundProducers[0];
  assert.equal(bound.bindings, current.execution.instance.bindings.bindings);
  assert.equal(bound.bindings === current.program.tir.lexicalBindings, false);
  assert.deepEqual(bound.bindings.methodBindings, [{ kind: "bound", parameter: declaration, type: T.string }]);
});

test("reference ready-type refusal is sticky before either canonical carrier or final-category payload read", () => {
  const current = fixture(shaped("body-round.reference-type-stop", [["input", "required", T.string]], T.string,
    builder => builder.block(builder.returns(builder.id("input", 0, T.string)))));
  for (const stopAt of [1, 2]) {
    const account = createAccount(limits);
    const refusal = { kind: "refused", diagnostics: [resourceLimitDiagnostic({ owner: "analyses/origins",
      limit: "analysis.maximumOriginAlternatives", maximum: 0, site: { kind: "source", origin: current.program.tir.root.origin },
      unit: { request: current.deps.unit, position: { kind: "result" } } })] };
    let count = 0;
    const result = analyzeBodyRound({ ...current.deps, account, typeOf: type => {
      assert.equal(accountFailure(account), null);
      count += 1;
      if (count !== stopAt) return current.deps.typeOf(type);
      refuseAccount(account, refusal);
      return new Proxy({}, { get() { assert.fail("No type payload after its original caller refusal"); } });
    } }, current.input);
    assert.equal(result, refusal);
    assert.equal(count, stopAt);
  }
});

test("actual reference copies preserve value origins without inventing storage and uninitialized slots remain errors", () => {
  const enumeration = declareType("bodyRoundReferenceEnum", { kind: "enum", definition: "D[M[P[p];m];bodyRoundEnum]" });
  for (const [name, type] of [["body-round.enum", enumeration]]) {
    const current = fixture(shaped(name, [["input", "required", type]], type,
      builder => builder.block(builder.returns(builder.id("input", 0, type)))));
    assert.throws(() => analyzeBodyRound(current.deps, current.input), /actual Origins reference\/cell producer/);
  }
  const current = fixture(shaped("body-round.reference-mutation", [["input", "required", T.string]], T.string,
    builder => builder.block(builder.expressionStatement(builder.assign(builder.target("input", 0, T.string), "EqualsToken",
      builder.id("input", 0, T.string), T.string, T.string)), builder.returns(builder.id("input", 0, T.string)))));
  const pair = checkedPair(current, analyzeBodyRound(current.deps, current.input));
  assert.deepEqual(pair.summary.arena.origins[pair.summary.result].producers, [0]);
  assert.deepEqual(pair.summary.arena.cells, []);
  const builder = builders("body-round.reference-slot");
  const declaration = { $: "slot", ...builder.variable(builder.declName("slot", 0), 0, T.string) };
  const slot = typedBody("body-round.reference-slot", { signature: signature("body-round.reference-slot", [], T.string),
    completion: T.string, locals: [["slot", "binding", T.string, true]], root: builder.block(builder.declare([declaration]),
      builder.returns(builder.id("slot", 0, T.string))) });
  slot.tir.locals[0].declaration = { kind: "body", value: slot.nodeRef("slot") };
  const local = fixture(slot);
  const failed = analyzeBodyRound(local.deps, local.input);
  assert.equal(failed.kind, "complete");
  assert.equal(failed.value.value.kind, "error");
  assert.equal(failed.value.diagnostics[0].code.rendered, "TSONIC_READ_BEFORE_INITIALIZATION");
});

test("returned Origins union preserves absence and shared alternatives without duplicate producers", () => {
  const current = fixture(shaped("body-round.reference-union", [["input", "required", T.string]], T.string,
    builder => builder.block(builder.returns(builder.id("input", 0, T.string)))));
  const pair = checkedPair(current, analyzeBodyRound(current.deps, current.input));
  const rows = pair.summary.arena.origins.map(row => ({ ...row }));
  const absent = rows.length;
  rows.push({ id: absent, kind: "complete", producers: [], includesAbsence: true });
  const values = indexedOrigins(current, rows);
  const combined = joinOrigins(current.deps, values, pair.summary.result, absent, () => null);
  assert.equal(typeof combined, "number");
  assert.equal(rows[combined].includesAbsence, true);
  const again = joinOrigins(current.deps, values, combined, pair.summary.result, () => null);
  assert.equal(typeof again, "number");
  assert.deepEqual(rows[again].producers, rows[pair.summary.result].producers);
  const reverse = joinOrigins(current.deps, values, absent, pair.summary.result, () => null);
  assert.equal(rows[reverse].includesAbsence, true);
  assert.deepEqual(rows[reverse].producers, rows[pair.summary.result].producers);
});

test("a genuine reference call transports its selected argument and result through actual Lower snapshots", () => {
  const targetName = "body-round.reference-call.target";
  const target = fixture(shaped(targetName, [["value", "required", T.string]], T.string,
    builder => builder.block(builder.returns(builder.id("value", 0, T.string)))));
  const targetPair = checkedPair(target, analyzeBodyRound(target.deps, target.input));
  const selected = callee(targetName, target.program.tir.signature, [mapped(0, 0)], T.string);
  const program = shaped("body-round.reference-call.caller", [["value", "required", T.string]], T.string, builder =>
    builder.block(builder.expressionStatement(builder.call(builder.global("target", targetName, T.unknown),
      [{ $: "argument", ...builder.id("value", 0, T.string) }], T.string,
      at => ({ callee: selected, receiver: null, arguments: [{ kind: "provided", parameter: 0, expression: at("argument") }] }))),
    builder.returns(builder.id("value", 0, T.string))));
  const current = fixture(program);
  const place = current.input.mir.places.find(row => row.base.kind === "local" && row.base.local === 0);
  assert.equal(place.id, 0);
  assert.equal(current.input.mir.locals[0].role.kind, "parameter");
  for (const block of current.input.mir.blocks) for (const statement of block.statements) {
    if (statement.kind === "storage-live" || statement.kind === "storage-dead") {
      assert.notEqual(statement.local, 0);
      continue;
    }
    assert.equal(statement.kind, "assign");
    assert.equal(statement.value.kind, "use");
    assert.deepEqual(statement.value.operand, { kind: "place", place: place.id });
  }
  const mir = { ...current.input.mir, locals: [current.input.mir.locals[0]], places: [place],
    blocks: current.input.mir.blocks.map(block => ({ ...block, statements: [], terminator: block.terminator.kind !== "call" ? block.terminator
      : { ...block.terminator, destination: place.id, arguments: block.terminator.arguments.map(argument => ({ ...argument,
        operand: { kind: "place", place: place.id } })) } })) };
  assert.deepEqual(verifyMir(mir, verificationContext(program)), { kind: "complete", violations: [] });
  current.related = [target];
  current.deps.summaryOf = () => ({ value: targetPair.summary, unit: { request: target.deps.unit, position: { kind: "result" } } });
  const copied = checkedPair(current, analyzeBodyRound(current.deps, current.input));
  const call = copied.facts.origins.invocations[0].alternatives[0];
  assert.deepEqual(copied.facts.arena.origins[call.arguments[0].actual].producers, [0]);
  assert.deepEqual(copied.facts.arena.origins[call.result].producers, [0]);
  assert.equal(copied.facts.arena.boundProducers.length, 1);
  assert.deepEqual(copied.facts.arena.cells, []);
  const storage = analyzeStorageUse({ account: createAccount(limits) }, { execution: current.execution, body: mir });
  assert.equal(storage.kind, "ok");
  const overwritten = { ...current, input: { ...current.input, mir, liveness: storage.value } };
  checkedPair(overwritten, analyzeBodyRound({ ...current.deps, account: createAccount(limits) }, overwritten.input));
});

test("actual reference call return and overwrite use callee formal bindings rather than destination entry identity", () => {
  const targetName = "body-round.reference-result.target";
  const target = fixture(shaped(targetName, [["left", "required", T.string], ["right", "required", T.string]], T.string,
    builder => builder.block(builder.returns(builder.id("right", 1, T.string)))));
  const targetPair = checkedPair(target, analyzeBodyRound(target.deps, target.input));
  const selected = callee(targetName, target.program.tir.signature, [mapped(0, 0), mapped(1, 1)], T.string);
  const program = shaped("body-round.reference-result.caller", [["left", "required", T.string], ["right", "required", T.string]], T.string,
    builder => builder.block(builder.returns(builder.call(builder.global("target", targetName, T.unknown),
      [{ $: "left", ...builder.id("left", 0, T.string) }, { $: "right", ...builder.id("right", 1, T.string) }], T.string,
      at => ({ callee: selected, receiver: null, arguments: [0, 1].map(index => ({ kind: "provided", parameter: index,
        expression: at(index === 0 ? "left" : "right") })) })))));
  const current = fixture(program);
  current.related = [target];
  current.deps.summaryOf = () => ({ value: targetPair.summary, unit: { request: target.deps.unit, position: { kind: "result" } } });
  const pair = checkedPair(current, analyzeBodyRound(current.deps, current.input));
  const origins = pair.summary.arena.origins[pair.summary.result];
  assert.deepEqual(origins.producers, [1], "the second actual argument, not the destination's old entry or first argument");
  const call = pair.facts.origins.invocations[0].alternatives[0];
  assert.deepEqual(call.arguments.map(row => pair.facts.arena.origins[row.actual].producers), [[0], [1]]);
  assert.deepEqual(pair.facts.arena.origins[call.result].producers, [1]);
  assert.deepEqual(pair.summary.retention.map(row => row.source), [1]);
  assert.deepEqual(pair.facts.arena.cells, []);
  checkSignatureStops(current);
  for (const dimension of ["maximumWork", "maximumResultEntries"]) {
    let complete = false;
    for (let maximum = 0; maximum < 20000; maximum += 1) {
      const account = createAccount({ ...limits, [dimension]: maximum });
      const result = analyzeBodyRound({ ...current.deps, account }, current.input);
      if (result.kind === "complete") { complete = true; break; }
      assert.equal(result, accountFailure(account));
      assert.equal(analyzeBodyRound({ ...current.deps, account }, new Proxy({}, {
        get() { assert.fail("No call or value input is read after its original account stop."); },
      })), result);
    }
    assert.equal(complete, true);
  }
});

test("actual reference copies replace content without making two independent local slots aliases", () => {
  const current = fixture(shaped("body-round.reference-copy-replace", [["first", "required", T.string],
    ["second", "required", T.string], ["third", "required", T.string]], T.string, builder => builder.block(
    builder.expressionStatement(builder.assign(builder.target("first", 0, T.string), "EqualsToken", builder.id("second", 1, T.string), T.string, T.string)),
    builder.expressionStatement(builder.assign(builder.target("second", 1, T.string), "EqualsToken", builder.id("third", 2, T.string), T.string, T.string)),
    builder.returns(builder.id("first", 0, T.string)))));
  const pair = checkedPair(current, analyzeBodyRound(current.deps, current.input));
  assert.deepEqual(pair.summary.arena.origins[pair.summary.result].producers, [1], "a later write to second does not rewrite the earlier copied value");
  assert.deepEqual(pair.facts.origins.writes.map(row => pair.facts.arena.origins[row.values[0].origins].producers), [[1], [2]]);
  assert.deepEqual(pair.summary.arena.cells, []);
});

test("an actual reference local reset drops its previous initialization and never resurrects copied entry content", () => {
  const name = "body-round.reference-copy-reset";
  const builder = builders(name);
  const declaration = { $: "slot", ...builder.variable(builder.declName("slot", 1), 1, T.string) };
  const program = typedBody(name, { signature: signature(name, [["input", T.string]], T.string), completion: T.string,
    params: [[0, "required", T.string]], locals: [["input", "parameter", T.string], ["slot", "binding", T.string, true]],
    root: builder.block(builder.declare([declaration]), builder.expressionStatement(builder.assign(builder.target("slot", 1, T.string),
      "EqualsToken", builder.id("input", 0, T.string), T.string, T.string)), builder.returns(builder.id("slot", 1, T.string))) });
  program.tir.locals[1].declaration = { kind: "body", value: program.nodeRef("slot") };
  const current = fixture(program);
  const pair = checkedPair(current, analyzeBodyRound(current.deps, current.input));
  assert.deepEqual(pair.summary.arena.origins[pair.summary.result].producers, [0]);
  const slot = current.input.mir.locals.find(local => local.source?.local === 1);
  const mir = { ...current.input.mir, blocks: current.input.mir.blocks.map(block => block.terminator.kind !== "return" ? block
    : { ...block, statements: [...block.statements, { kind: "storage-live", local: slot.id,
      tir: block.terminator.tir, origin: block.terminator.origin, step: null }] }) };
  assert.deepEqual(verifyMir(mir, verificationContext(program)), { kind: "complete", violations: [] });
  const storage = analyzeStorageUse({ account: createAccount(limits) }, { execution: current.execution, body: mir });
  assert.equal(storage.kind, "ok");
  const result = analyzeBodyRound({ ...current.deps, account: createAccount(limits) }, { ...current.input, mir, liveness: storage.value });
  assert.equal(result.kind, "complete");
  assert.equal(result.value.value.kind, "error");
  assert.equal(result.value.diagnostics[0].code.rendered, "TSONIC_READ_BEFORE_INITIALIZATION");
});

test("reference reassignment joins every actual predecessor and loop iteration without aliasing their storage", () => {
  for (const loop of [false, true]) {
    const current = fixture(shaped(`body-round.reference-flow.${loop}`, [["flag", "required", T.bool],
      ["left", "required", T.string], ["right", "required", T.string]], T.string, builder => {
      const write = builder.expressionStatement(builder.assign(builder.target("left", 1, T.string), "EqualsToken",
        builder.id("right", 2, T.string), T.string, T.string));
      return builder.block(loop ? builder.whileLoop(builder.id("flag", 0, T.bool), write)
        : builder.ifElse(builder.id("flag", 0, T.bool), write, builder.block()), builder.returns(builder.id("left", 1, T.string)));
    }));
    const pair = checkedPair(current, analyzeBodyRound(current.deps, current.input));
    const result = pair.summary.arena.origins[pair.summary.result];
    assert.deepEqual(result.producers, [0, 1]);
    assert.deepEqual(pair.summary.arena.cells, []);
    assert.equal(pair.facts.origins.reads.some(row => pair.facts.arena.origins[row.origins].producers.length === 2), true);
    for (const dimension of ["maximumWork", "maximumResultEntries"]) {
      for (let maximum = 0; maximum < 10000; maximum += 1) {
        const account = createAccount({ ...limits, [dimension]: maximum });
        const result = analyzeBodyRound({ ...current.deps, account }, current.input);
        if (result.kind === "complete") break;
        assert.equal(result, accountFailure(account));
        assert.equal(analyzeBodyRound({ ...current.deps, account }, new Proxy({}, {
          get() { assert.fail("No reference join input is read after stop."); },
        })), result);
        assert.notEqual(maximum, 9999, "the exact finite graph allowance is reached");
      }
    }
  }
});

function referenceRound(name) {
  const targetName = `${name}.target`;
  const target = fixture(shaped(targetName, [["value", "required", T.string]], T.string,
    builder => builder.block(builder.returns(builder.id("value", 0, T.string)))));
  const targetPair = checkedPair(target, analyzeBodyRound(target.deps, target.input));
  const selected = callee(targetName, target.program.tir.signature, [mapped(0, 0)], T.string);
  const current = fixture(shaped(`${name}.caller`, [["value", "required", T.string], ["other", "required", T.string],
    ["third", "required", T.string]], T.string, builder =>
    builder.block(builder.returns(builder.call(builder.global("target", targetName, T.unknown),
      [{ $: "argument", ...builder.id("value", 0, T.string) }], T.string,
      at => ({ callee: selected, receiver: null, arguments: [{ kind: "provided", parameter: 0, expression: at("argument") }] }))))));
  current.related = [target];
  const unit = { request: target.deps.unit, position: { kind: "result" } };
  current.deps.summaryOf = () => ({ value: targetPair.summary, unit });
  const pair = checkedPair(current, analyzeBodyRound(current.deps, current.input));
  const block = current.input.mir.blocks.find(row => row.terminator.kind === "call");
  const initial = current.input.mir.locals.map(() => 0);
  const state = current.input.mir.locals.map(local => pair.facts.arena.contexts[0].arguments[local.role.kind === "parameter" ? local.role.index : 0]);
  return { current, target, summary: targetPair.summary, unit, pair, operation: block.terminator,
    point: { block: block.id, statement: null }, initial, state };
}

test("the canonical reference lattice compares values, pays joins and treats unreachable state as bottom", () => {
  const { current, pair, initial, state, operation, point, summary, unit } = referenceRound("body-round.value-lattice");
  const rows = [...pair.facts.arena.origins];
  const reference = state[0];
  const absent = rows.length;
  rows.push({ id: absent, kind: "complete", producers: [], includesAbsence: true });
  const other = pair.facts.arena.contexts[0].arguments[1];
  const values = indexedOrigins(current, rows);
  const make = (account = createAccount(limits), overrides = {}, reachable = current.input.mir.blocks.map(() => true), admit = () => null) =>
    valueProblem({ ...current.deps, ...overrides, account }, current.input, pair.facts.arena, values, [], initial, state, reachable, admit, new Map());
  const problem = make();
  const lattice = problem.lattice;
  assert.equal(lattice.equals(state, state, createAccount(limits)), true);
  assert.equal(lattice.equals(null, state, createAccount(limits)), false);
  assert.equal(lattice.equals(state, null, createAccount(limits)), false);
  assert.equal(lattice.equals(state, [...state], createAccount(limits)), true);
  assert.equal(lattice.equals([reference], [other], createAccount(limits)), false);
  assert.equal(lattice.equals([reference], [0], createAccount(limits)), false);
  assert.equal(lattice.equals([0], [absent], createAccount(limits)), false);
  assert.equal(lattice.join(null, state, createAccount(limits)), state);
  assert.equal(lattice.join(state, null, createAccount(limits)), state);
  assert.equal(lattice.join(state, state, createAccount(limits)), state);
  assert.equal(problem.statement({}, null, createAccount(limits), 0, 0), null);
  assert.deepEqual(problem.terminator({}, null, createAccount(limits), 0), []);
  assert.deepEqual(make(createAccount(limits), {}, []).terminator({ kind: "goto", target: 0 }, state,
    createAccount(limits), point.block), []);
  assert.deepEqual(make(createAccount(limits), { summaryOf: () => ({ value: { ...summary, returns: false }, unit }) })
    .terminator(operation, state, createAccount(limits), point.block), []);
  assert.throws(() => make(createAccount(limits), { summaryOf: () => ({ value: { kind: "error", causes: [] }, unit }) })
    .terminator(operation, state, createAccount(limits), point.block), /already-completed semantic answer/);
  for (const dimension of ["maximumWork", "maximumResultEntries"]) for (const action of [
    (kernel, account) => kernel.lattice.join([reference], [other], account),
    (kernel, account) => kernel.lattice.equals(state, [...state], account),
    (kernel, account) => kernel.terminator({ ...operation, destination: null }, state, account, point.block),
  ]) {
    let complete = false;
    for (let maximum = 0; maximum < 10000; maximum += 1) {
      const account = createAccount({ ...limits, [dimension]: maximum });
      const kernel = make(account);
      action(kernel, account);
      const stop = accountFailure(account);
      if (stop === null) { complete = true; break; }
      const unread = new Proxy([], { get() { assert.fail("No local-vector read after the original stop."); } });
      assert.equal(kernel.lattice.equals(unread, [], account), true);
      assert.equal(kernel.lattice.join(unread, [], account), unread);
      assert.equal(transferValue({ ...current.deps, account }, new Proxy({}, {
        get() { assert.fail("No transfer input after stop."); },
      }), [], [], unread, {}), stop);
    }
    assert.equal(complete, true);
  }
  const account = createAccount(limits);
  const refusal = { kind: "refused", diagnostics: [] };
  const rejected = make(account, {}, [], () => refuseAccount(account, refusal));
  assert.deepEqual(rejected.lattice.join([reference], [pair.facts.arena.contexts[0].arguments[2]], account), [reference]);
  assert.equal(accountFailure(account), refusal);
});

test("applied reference results preserve sorted caller alternatives and refuse missing created or open transports", () => {
  const { current, pair } = referenceRound("body-round.applied-reference");
  const owner = { kind: "body", execution: current.execution };
  const value = { caller: [{ owner, producer: 2 }, { owner, producer: 0 }, { owner, producer: 1 }], callee: [],
    boundaries: [], includesAbsence: true };
  const rows = [...pair.facts.arena.origins];
  const values = indexedOrigins(current, rows);
  const result = appliedOrigins({ ...current.deps, account: createAccount(limits) }, values, value, () => null);
  assert.deepEqual(rows[result].producers, [0, 1, 2]);
  assert.equal(rows[result].includesAbsence, true);
  for (const field of ["callee", "boundaries"]) assert.throws(() => appliedOrigins(current.deps, values,
    { ...value, [field]: [{}] }, () => null), /created or open call-result Origins/);
  for (const dimension of ["maximumWork", "maximumResultEntries"]) {
    let complete = false;
    for (let maximum = 0; maximum < 200; maximum += 1) {
      const account = createAccount({ ...limits, [dimension]: maximum });
      const copy = [...rows];
      const table = indexedOrigins(current, copy);
      const result = appliedOrigins({ ...current.deps, account }, table, value, () => null);
      if (typeof result === "number") { complete = true; break; }
      assert.equal(result, accountFailure(account));
      assert.equal(copy.length, rows.length, "a refused output row is never appended");
    }
    assert.equal(complete, true);
  }
  const account = createAccount(limits);
  const refusal = { kind: "refused", diagnostics: [] };
  assert.equal(appliedOrigins({ ...current.deps, account }, values, { ...value, includesAbsence: false },
    () => refuseAccount(account, refusal)), refusal);
});

test("nonempty parameter footprints and external retention remain genuine unimplemented call effects", () => {
  const { current, pair, operation, point, summary } = referenceRound("body-round.reference-effects");
  const arena = pair.facts.arena;
  const context = pair.facts.origins.activations[0].context;
  const entries = [{ formal: 0, actual: arena.contexts[context].arguments[0] }];
  const apply = value => applyScalarCall({ ...current.deps, account: createAccount(limits) }, current.input,
    operation, point, value, arena, context, entries, []);
  for (const field of ["reads", "writes"]) assert.throws(() => apply({ ...summary,
    arena: { ...summary.arena, projections: [{ id: 0, parent: null, projection: { kind: "element" } }] },
    parameters: summary.parameters.map(row => ({ ...row, [field]: { kind: "complete", paths: [0] } })),
  }), /parameter subobject read\/write transport/);
  assert.throws(() => apply({ ...summary, retention: summary.retention.map(row => ({ ...row, into: { kind: "throw" } })) }),
    /external retention transport/);
});

test("selected reference-call helpers keep genuine unsupported inputs explicit and stop before reader payloads", () => {
  const { current, pair, operation, point, summary, state, initial } = referenceRound("body-round.reference-boundaries");
  const invoke = (changed = operation, answer = summary, overrides = {}) => referenceCallResult({ ...current.deps,
    account: createAccount(limits), ...overrides }, current.input, changed, point, answer, pair.facts.arena, state, [],
  indexedOrigins(current, [...pair.facts.arena.origins]), () => null, 0, []);
  assert.throws(() => invoke({ ...operation, callee: { kind: "body", instance: current.execution.instance, captures: [] } }),
    /non-formal reference binding/);
  assert.throws(() => invoke({ ...operation, arguments: [{ kind: "place", place: 0 }] }), /actual operand/);
  assert.throws(() => invoke(operation, { ...summary, arena: { ...summary.arena,
    producers: [{ id: 0, kind: "capture", path: null, index: 0 }] } }), /non-formal reference binding/);
  for (const role of [{ kind: "capture", index: 0 }, { kind: "parameter", index: 0 }])
    assert.throws(() => invoke(operation, { ...summary, arena: { ...summary.arena,
      cells: [{ id: 0, role, occurrence: { kind: "entry", execution: summary.key.execution, local: 0 }, lifetimes: [] }] } }),
    /actual capture or created-cell binding/);
  const enumeration = declareType("bodyRoundCallReferenceEnum", { kind: "enum", definition: def("bodyRoundCallReferenceEnum") });
  assert.throws(() => invoke(operation, summary, { signatureOf: () => ({ ...TABLE.signatures[summary.signature], result: enumeration }) }),
    /selected call-result representation/);
  assert.throws(() => transferValue(current.deps, current.input, [], initial, state,
    { kind: "assign", place: operation.destination, tir: operation.tir, origin: operation.origin,
      value: { kind: "convert", operand: operation.arguments[0].operand } }), /reference operation value producer/);
});

test("canonical Origins unions retain strict supersets and deduplicate genuine overlapping alternatives", () => {
  const { current, pair } = referenceRound("body-round.reference-overlap");
  const rows = [...pair.facts.arena.origins];
  const values = indexedOrigins(current, rows);
  const [first, second, third] = pair.facts.arena.contexts[0].arguments;
  const left = joinOrigins(current.deps, values, first, second, () => null);
  const right = joinOrigins(current.deps, values, second, third, () => null);
  assert.equal(joinOrigins(current.deps, values, first, left, () => null), left);
  const all = joinOrigins(current.deps, values, left, right, () => null);
  assert.deepEqual(rows[all].producers, [0, 1, 2]);
});

test("Origins rows are interned by complete payload within their actual arena, never by row ID or source occurrence", () => {
  const { current, pair, operation, point, summary, state } = referenceRound("body-round.reference-interning");
  const rows = pair.facts.arena.origins;
  const keys = rows.map(row => JSON.stringify([row.kind, row.producers, row.includesAbsence,
    row.kind === "open" ? row.boundaries : []]));
  assert.equal(new Set(keys).size, rows.length, "solve iterations and final call replay publish each Origins payload once");
  const alternative = pair.facts.origins.invocations[0].alternatives[0];
  assert.equal(alternative.result, alternative.arguments[0].actual, "actual entry passthrough reuses its original Origins ID");
  const source = [{ id: 0, kind: "complete", producers: [0], includesAbsence: false },
    { id: 1, kind: "open", producers: [0], includesAbsence: false, boundaries: [0] },
    { id: 2, kind: "open", producers: [0], includesAbsence: false, boundaries: [1] },
    { id: 3, kind: "complete", producers: [0], includesAbsence: true }];
  const values = indexedOrigins(current, source);
  assert.equal(values.index.size, 4, "kind, each actual boundary and absence distinguish otherwise equal producer sets");
  assert.throws(() => valueOrigins(current.deps, [...source, { ...source[0], id: 4 }]), /distinct actual entry Origins rows/);
  assert.throws(() => joinOrigins(current.deps, values, 0, 1, () => null), /actual open Origins boundary transport/);
  for (const dimension of ["maximumWork", "maximumResultEntries"]) {
    let complete = false;
    for (let maximum = 0; maximum < 200; maximum += 1) {
      const account = createAccount({ ...limits, [dimension]: maximum });
      const result = valueOrigins({ ...current.deps, account }, source);
      if (result.kind === "complete") { complete = true; break; }
      assert.equal(result, accountFailure(account));
      assert.equal(valueOrigins({ ...current.deps, account }, new Proxy([], {
        get() { assert.fail("No seed row or payload after the original interning stop."); },
      })), result);
    }
    assert.equal(complete, true);
  }
  const actual = indexedOrigins(current, [...rows]);
  const count = actual.rows.length;
  const repeated = referenceCallResult({ ...current.deps, account: createAccount(limits) }, current.input, operation,
    point, summary, pair.facts.arena, state, [], actual, (_count, retain) => {
      assert.equal(retain, false, "an existing payload admits alternatives without reserving a new relational row");
      return null;
    }, 0, []);
  assert.equal(repeated.kind, "complete");
  assert.equal(repeated.value, alternative.result);
  assert.equal(actual.rows.length, count);
});

test("Origins key construction prepays canonical safe-ID decimal width, not an array-index or native carrier width", () => {
  const current = fixture(shaped("body-round.reference-key-count", [["input", "required", T.string]], T.string,
    builder => builder.block(builder.returns(builder.id("input", 0, T.string)))));
  const high = Number.MAX_SAFE_INTEGER;
  const rows = [{ id: 0, kind: "complete", producers: [high], includesAbsence: false },
    { id: 1, kind: "complete", producers: [high - 1], includesAbsence: false },
    { id: 2, kind: "open", producers: [], includesAbsence: true, boundaries: [high] }];
  const expectedWork = 1 + (1 + 8 + 4 + 17) * 2 + (1 + 4 + 4 + 17);
  const expectedRows = 1 + 2 * rows.length;
  assert.equal(high.toString().length, 16);
  for (const [dimension, required] of [["maximumWork", expectedWork], ["maximumResultEntries", expectedRows]]) {
    for (let maximum = 0; maximum <= required; maximum += 1) {
      const account = createAccount({ ...limits, [dimension]: maximum });
      const result = valueOrigins({ ...current.deps, account }, rows);
      assert.equal(result.kind === "complete", maximum === required, `${dimension}:${maximum}`);
      if (maximum === required) {
        assert.equal(result.value.index.size, rows.length, "all sixteen decimal digits and the open boundary remain distinct");
      } else {
        assert.equal(result, accountFailure(account));
        assert.equal(valueOrigins({ ...current.deps, account }, new Proxy([], {
          get() { assert.fail("No safe-ID payload or decimal conversion after original stop."); },
        })), result);
      }
    }
  }
});

test("actual constant arguments coexist with reference transport and genuine unreached blocks", () => {
  const name = "body-round.reference-constant.target";
  const target = fixture(shaped(name, [["flag", "required", T.bool], ["value", "required", T.string]], T.string,
    builder => builder.block(builder.returns(builder.id("value", 1, T.string)))));
  const summary = checkedPair(target, analyzeBodyRound(target.deps, target.input)).summary;
  const selected = callee(name, target.program.tir.signature, [mapped(0, 0), mapped(1, 1)], T.string);
  const current = fixture(shaped("body-round.reference-constant.caller", [["value", "required", T.string]], T.string,
    builder => builder.block(builder.returns(builder.call(builder.global("target", name, T.unknown),
      [{ $: "flag", ...builder.keyword("TrueKeyword", T.bool) }, { $: "value", ...builder.id("value", 0, T.string) }], T.string,
      at => ({ callee: selected, receiver: null, arguments: [0, 1].map(parameter => ({ kind: "provided", parameter,
        expression: at(parameter === 0 ? "flag" : "value") })) }))))));
  current.related = [target];
  current.deps.summaryOf = () => ({ value: summary, unit: { request: target.deps.unit, position: { kind: "result" } } });
  const block = current.input.mir.blocks[0];
  const mir = { ...current.input.mir, blocks: [...current.input.mir.blocks, { ...block, id: current.input.mir.blocks.length,
    statements: [], terminator: { ...block.terminator, kind: "unreachable" } }] };
  assert.deepEqual(verifyMir(mir, verificationContext(current.program)), { kind: "complete", violations: [] });
  const storage = analyzeStorageUse({ account: createAccount(limits) }, { execution: current.execution, body: mir });
  assert.equal(storage.kind, "ok");
  current.input = { ...current.input, mir, liveness: storage.value };
  const pair = checkedPair(current, analyzeBodyRound(current.deps, current.input));
  assert.deepEqual(pair.summary.arena.origins[pair.summary.result].producers, [0]);
  assert.equal(pair.facts.origins.invocations.length, 1);
});

test("reference captured contents remain a distinct incoming producer from formal reference values", () => {
  const owner = shaped("body-round.reference-capture.owner", [["value", "required", T.string]], T.string,
    builder => builder.block(builder.returns(builder.id("value", 0, T.string))));
  const name = "body-round.reference-capture.child";
  const builder = builders(name, "default-argument");
  const local = { body: owner.tir.body, local: 0 };
  const program = typedBody(name, { role: "default-argument", signature: signature(name, [], T.string), completion: T.string,
    locals: [["value", "capture", T.string, false, local]], captures: [{ local, capture: "captured-location" }],
    root: builder.id("value", 0, T.string) });
  program.bodyOf = instance => sameInstance(instance, { body: owner.tir.body, bindings: owner.tir.bindings }) ? owner.tir : null;
  const current = fixture(program);
  current.related = [fixture(owner)];
  const pair = checkedPair(current, analyzeBodyRound(current.deps, current.input));
  const result = pair.summary.arena.origins[pair.summary.result];
  assert.deepEqual(result.producers, [pair.summary.arena.contexts[0].captures[0].location]);
  assert.equal(pair.summary.arena.producers[pair.summary.arena.boundProducers[result.producers[0]].producer].kind, "capture");
  assert.equal(pair.summary.initialization.points[0].kind, "need");
  assert.equal(pair.summary.initialization.points[0].cell, 0);
  assert.equal(pair.facts.initialization.reads[0].assigned, false, "captured content Origins is not initialization credit");
  const originBound = analyzeBodyRound({ ...current.deps, account: createAccount(limits),
    limits: { ...analysisLimits, maximumOriginAlternatives: 0 } }, current.input);
  assert.equal(originBound.kind, "refused");
  for (const dimension of ["maximumWork", "maximumResultEntries"]) {
    let complete = false;
    for (let maximum = 0; maximum < 10000; maximum += 1) {
      const account = createAccount({ ...limits, [dimension]: maximum });
      const result = analyzeBodyRound({ ...current.deps, account }, current.input);
      if (result.kind === "complete") { complete = true; break; }
      assert.equal(result, accountFailure(account));
      assert.equal(analyzeBodyRound({ ...current.deps, account }, new Proxy({}, {
        get() { assert.fail("No captured entry input after the original stop."); },
      })), result);
    }
    assert.equal(complete, true);
  }
});

test("placed reference captures bind actual caller contents separately from their live storage location", () => {
  for (const count of [1, 2]) {
    const data = locationDefaultProgram(`body-round.reference-default.${count}`, { count, type: T.string });
    const children = data.children.map(child => fixture(child));
    const caller = fixture(data.program, data.internal, 1);
    const summaries = children.map(child => {
      child.related = [caller];
      return checkedPair(child, analyzeBodyRound(child.deps, child.input)).summary;
    });
    caller.related = children;
    caller.deps.summaryOf = key => {
      const index = children.findIndex(child => executionKey(key.execution) === executionKey(child.execution));
      assert.equal(index >= 0, true, "the actual default execution has its completed summary");
      return { value: summaries[index], unit: { request: children[index].deps.unit, position: { kind: "result" } } };
    };
    const pair = checkedPair(caller, analyzeBodyRound(caller.deps, caller.input));
    const entry = pair.facts.arena.contexts[0].arguments[0];
    assert.equal(pair.summary.result, entry, "the result is the exact caller entry VALUE, not its local location subject");
    assert.equal(pair.summary.arena.producers[pair.summary.arena.boundProducers[pair.summary.arena.origins[entry].producers[0]].producer].kind, "parameter");
    assert.equal(pair.facts.arena.cells.length, 1, "two immediate operations capture the actual same current slot");
    for (const activation of pair.facts.origins.activations) {
      const captured = pair.facts.arena.contexts[activation.context].captures[0];
      assert.equal(pair.facts.arena.producers[pair.facts.arena.boundProducers[captured.location].producer].kind, "local");
      assert.equal(captured.cell, 0);
    }
    assert.equal(pair.facts.arena.origins.every(row => row.producers.every(bound =>
      pair.facts.arena.producers[pair.facts.arena.boundProducers[bound].producer].kind !== "local")), true);
    assert.deepEqual(pair.summary.initialization.points, [{ kind: "return" }]);
    for (const dimension of ["maximumWork", "maximumResultEntries"]) {
      let complete = false;
      for (let maximum = 0; maximum < 30000; maximum += 1) {
        const account = createAccount({ ...limits, [dimension]: maximum });
        const result = analyzeBodyRound({ ...caller.deps, account }, caller.input);
        if (result.kind === "complete") { complete = true; break; }
        assert.equal(result, accountFailure(account));
        assert.equal(analyzeBodyRound({ ...caller.deps, account }, new Proxy({}, {
          get() { assert.fail("No reference capture input after the original stop."); },
        })), result);
      }
      assert.equal(complete, true, "the exact captured-reference graph fits its actual invocation allowance");
    }
  }
  const data = locationDefaultProgram("body-round.reference-default.uninitialized", { selfRead: true, type: T.string });
  const child = fixture(data.child);
  const caller = fixture(data.program, data.internal, 1);
  child.related = [caller];
  const summary = checkedPair(child, analyzeBodyRound(child.deps, child.input)).summary;
  caller.related = [child];
  caller.deps.summaryOf = () => ({ value: summary, unit: { request: child.deps.unit, position: { kind: "result" } } });
  const result = analyzeBodyRound(caller.deps, caller.input);
  assert.equal(result.kind, "complete");
  assert.equal(result.value.value.kind, "error", "an unassigned captured reference content is not defaulted to an empty or initialized value");
  assert.equal(result.value.diagnostics[0].code.name, "TSONIC_READ_BEFORE_INITIALIZATION");
});

test("the actual capture-location inventory stops before even reading its body after original or zero allowance refusal", () => {
  const unread = new Proxy({}, { get() { assert.fail("No capture inventory input after its original stop."); } });
  for (const stopped of [false, true]) {
    const account = createAccount({ ...limits, maximumWork: 0 });
    const original = stopped ? refuseAccount(account, { kind: "refused", diagnostics: [] }) : null;
    const result = prepareCallCaptures({ account }, unread, unread, unread, unread, unread, unread, unread, unread, unread, 0);
    assert.equal(result, original ?? accountFailure(account));
  }
});

test("canonical row sorting stops immediately when its paid comparison installs the original refusal", () => {
  const account = createAccount(limits);
  const current = fixture(add("body-round.ordering-stop", T.int32, plus("int32", T.int32)));
  const refusal = { kind: "refused", diagnostics: [resourceLimitDiagnostic({ owner: "analyses/origins",
    limit: "analysis.maximumOriginAlternatives", maximum: 0, site: { kind: "source", origin: current.program.tir.root.origin },
    unit: { request: current.deps.unit, position: { kind: "result" } } })] };
  let calls = 0;
  const result = orderedRows([3, 2, 1], () => {
    calls += 1;
    assert.equal(calls, 1);
    refuseAccount(account, refusal);
    return 0;
  }, account);
  assert.equal(result, refusal);
  assert.equal(calls, 1);
});

test("reference entry and return union admit every record and alternative with the same original account", () => {
  const current = fixture(shaped("body-round.reference-allowances", [["flag", "required", T.bool],
    ["left", "required", T.string], ["right", "required", T.string]], T.string, builder =>
    builder.block(builder.ifElse(builder.id("flag", 0, T.bool), builder.returns(builder.id("right", 2, T.string)),
      builder.returns(builder.id("left", 1, T.string))))));
  const repeated = fixture(shaped("body-round.reference-sort-allowances", [["flag", "required", T.bool],
    ["input", "required", T.string]], T.string, builder => builder.block(builder.ifElse(builder.id("flag", 0, T.bool),
      builder.returns(builder.id("input", 1, T.string)), builder.returns(builder.id("input", 1, T.string))))));
  for (const selected of [current, repeated]) for (const dimension of ["maximumWork", "maximumResultEntries"]) {
    let completed = false;
    for (let maximum = 0; maximum <= 2048; maximum += 1) {
      const account = createAccount({ ...limits, [dimension]: maximum });
      const result = analyzeBodyRound({ ...selected.deps, account }, selected.input);
      if (result.kind === "complete") completed = true;
      else {
        assert.equal(completed, false);
        assert.equal(result, accountFailure(account));
        assert.equal(analyzeBodyRound({ ...selected.deps, account }, new Proxy({}, {
          get() { assert.fail("No input is read after the original reference account stop"); },
        })), result);
      }
    }
    assert.equal(completed, true);
  }
  for (const [limit, maximum] of [["maximumOriginAlternatives", 0], ["maximumOriginAlternatives", 1],
    ["maximumRelationalRecordsPerBody", 9], ["maximumRelationalReferencesPerBody", 8]]) {
    const account = createAccount(limits);
    const result = analyzeBodyRound({ ...current.deps, account, limits: { ...analysisLimits, [limit]: maximum } }, current.input);
    assert.equal(result.kind, "refused");
    assert.equal(result, accountFailure(account));
  }
});

test("retention of the same returned entry obeys canonical position keys beyond single-digit block IDs", () => {
  const program = shaped("body-round.reference-many-returns", [["flag", "required", T.bool], ["input", "required", T.string]], T.string,
    builder => builder.block(...Array.from({ length: 12 }, () => builder.ifElse(builder.id("flag", 0, T.bool),
      builder.returns(builder.id("input", 1, T.string)), builder.block())), builder.returns(builder.id("input", 1, T.string))));
  const current = fixture(program);
  const pair = checkedPair(current, analyzeBodyRound(current.deps, current.input));
  assert.equal(pair.summary.retention.length, 13);
  assert.equal(pair.facts.origins.escapes.length, 13);
  assert.equal(pair.summary.retention.some(row => row.at.point.block >= 10), true);
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

test("final initialization publication and callback refusal consume the same account before answer or output reads", () => {
  const current = fixture(add("body-round.proof-publication", T.float64, plus("float64", T.float64)));
  const pair = checkedPair(current, analyzeBodyRound(current.deps, current.input));
  const unit = { request: current.deps.unit, position: { kind: "result" } };
  const input = { modules: [], entries: [current.execution], storage: [] };
  const refusal = { kind: "refused", diagnostics: [resourceLimitDiagnostic({ owner: "analyses/initialization",
    limit: "analysis.maximumConditionAlternatives", maximum: 0, site: { kind: "source", origin: current.input.tir.root.origin }, unit })] };
  const account = createAccount(limits);
  assert.equal(proveInitialization({ account, unit: current.deps.unit, summaryOf: () => {
    refuseAccount(account, refusal);
    return new Proxy({}, { get() { throw new Error("no answer payload read after original callback refusal"); } });
  } }, input), refusal);
  for (const value of [pair.summary, { kind: "error", causes: [{ kind: "unit", unit }] }]) {
    const required = "kind" in value ? 8 : 2 * (2 + 3 + 1 + 5) + 8;
    for (let maximumResultEntries = 0; maximumResultEntries <= required; maximumResultEntries += 1) {
      const borrowed = createAccount({ ...limits, maximumResultEntries });
      const result = proveInitialization({ account: borrowed, unit: current.deps.unit, summaryOf: () => ({ value, unit }) }, input);
      if (maximumResultEntries < required) {
        assert.equal(result, accountFailure(borrowed));
        assert.equal(result.dimension, "result-entries");
        assert.equal(proveInitialization({ account: borrowed, unit: current.deps.unit,
          summaryOf: () => { throw new Error("no callback after stop"); } }, input), result);
      } else {
        assert.equal(result.kind, "complete");
        assert.equal(result.value.positions[0].error === null, !("kind" in value));
      }
    }
  }
  for (const maximumWork of [0, 1, 2]) {
    const borrowed = createAccount({ ...limits, maximumWork });
    const result = proveInitialization({ account: borrowed, unit: current.deps.unit,
      summaryOf: () => { throw new Error("an empty genuine execution inventory has no Summary demand"); } },
    { modules: [], entries: [], storage: [] });
    assert.equal(result.kind, maximumWork === 2 ? "complete" : "resource-limit");
  }
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

test("actual boolean selection preserves both float64 return paths and exact scalar formal inventory", () => {
  const current = fixture(shaped("body-round.choose", [["flag", "required", T.bool], ["left", "required", T.float64],
    ["right", "required", T.float64]], T.float64, builder => builder.block(builder.ifElse(builder.id("flag", 0, T.bool),
      builder.returns(builder.id("left", 1, T.float64)), builder.returns(builder.id("right", 2, T.float64))))));
  const pair = checkedPair(current, analyzeBodyRound(current.deps, current.input));
  assert.equal(current.input.mir.blocks.some(block => block.terminator.kind === "switch"), true);
  assert.equal(pair.facts.initialization.reads.every(row => row.assigned), true);
  assert.equal(pair.facts.origins.subjects.filter(row => row.role === "return").length, 2);
  assert.equal(pair.summary.returns, true);
  assert.equal(pair.summary.unwinds, false);
  assert.deepEqual(pair.summary.parameters.map(row => row.slot), [0, 1, 2].map(index => ({ kind: "parameter", index })));
  assert.deepEqual(pair.facts.origins.activations, []);
  assert.deepEqual(pair.summary.callbacks, []);
  assert.deepEqual(pair.summary.backing, []);
});

test("real branch joins and loop backedges retain only definite initialization", () => {
  for (const loop of [false, true]) {
    const name = `body-round.join.${loop}`;
    const builder = builders(name);
    const declaration = { $: "slot", ...builder.variable(builder.declName("slot", 2), 2, T.int32) };
    const write = expression => builder.expressionStatement(builder.assign(builder.target("slot", 2, T.int32),
      "EqualsToken", expression, T.int32, T.int32));
    const root = builder.block(builder.declare([declaration]),
      builder.ifElse(builder.id("choose", 0, T.bool), builder.block(write({ $: "assigned-input", ...builder.id("input", 1, T.int32) })),
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
    assert.equal(pair.facts.initialization.reads.some(row => row.node === program.nodeRef("assigned-input").node), true,
      "the assignment reads its actual RHS source occurrence, not its write-only destination");
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

test("repeated reads of the same actual source and place retain one canonical initialization row", () => {
  const current = fixture(add("body-round.source-identity", T.float64, plus("float64", T.float64)));
  const repeated = current.input.mir.blocks.map(block => ({ ...block, statements: block.statements.flatMap(statement =>
    statement.kind === "assign" ? [statement, statement] : [statement]) }));
  const result = analyzeBodyRound({ ...current.deps, account: createAccount(limits) },
    { ...current.input, mir: { ...current.input.mir, blocks: repeated } });
  assert.equal(result.kind, "complete");
  assert.equal(result.value.value.facts.initialization.reads.every(row => row.assigned), true);
  const rows = result.value.value.facts.initialization.reads;
  assert.equal(rows.every((row, index) => index === 0 || row.node !== rows[index - 1].node || row.place !== rows[index - 1].place), true);
  for (const dimension of ["maximumWork", "maximumResultEntries"]) {
    let complete = false;
    for (let maximum = 0; maximum < 10000; maximum += 1) {
      const account = createAccount({ ...limits, [dimension]: maximum });
      const next = analyzeBodyRound({ ...current.deps, account }, { ...current.input,
        mir: { ...current.input.mir, blocks: repeated } });
      if (next.kind === "complete") { complete = true; break; }
      assert.equal(next, accountFailure(account));
    }
    assert.equal(complete, true);
  }
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
