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
import { EMPTY_BINDINGS, T, TABLE, bodyId, builders, callee, declareType, def, mapped, native, nativeIndex, seal, signature, typedBody, verificationContext } from "./fixtures/lower-mir/typed.mjs";
import { executionKey, nativeCarrierHoldingOf, sameInstance } from "../../packages/host/dist/ir-types/index.js";
import { lowerToMir } from "../../packages/host/dist/lower-mir/index.js";
import { verifyMir } from "../../packages/host/dist/ir-mir/index.js";
import { analyzeStorageUse } from "../../packages/host/dist/analyses/liveness/index.js";
import { accountFailure, createAccount, refuseAccount, remainingWork } from "../../packages/host/dist/dataflow/index.js";
import { verifyFacts, verifySummary, printFacts, parseFacts, printSummary, parseSummary, escapeTargetKey } from "../../packages/host/dist/ir-facts/index.js";
import { resourceLimitDiagnostic } from "../../packages/host/dist/diag/index.js";
import { checkRepeatedStaticInitialization } from "./fixtures/program-static-exposure.mjs";
import { checkActualBodyRoundCuts } from "./fixtures/body-round-cuts.mjs";
import { checkReachedProofCuts } from "./fixtures/dataflow-cuts.mjs";
import { checkBorrowedNativeArrayReturn, checkNativeArrayAlternatives, checkNativeArrayFacts, checkPlacedArrayReturn } from "./fixtures/native-array-initialization.mjs";
import { nativeInt32Input } from "./fixtures/native-int32-input.mjs";
import { nativeFactsFixture } from "./fixtures/native-facts.mjs";
import { checkCapturedFieldRefinement, checkNativeCountedLoopProofs, checkNativeFieldRefinement, checkNativeRefinementWalkthrough, checkSavedExtentReceivers, nativeRefinementInput } from "./fixtures/native-refinement-proofs.mjs";
import { checkDeclaredNullableReferenceStorage, checkSavedReferencePresence } from "./fixtures/saved-reference-presence.mjs";
import { checkSavedProjectionWithPlacedCaptures } from "./fixtures/native-refinement-proofs.mjs";

test("staged native array facts publish one completed backing and the actual unwind", checkNativeArrayFacts);
test("S-1: placed binding and array executions reproduce their facts at their exact limits", async () => {
  const reached = await checkActualBodyRoundCuts(checkPlacedArrayReturn, () => true);
  assert.deepEqual(reached.toSorted(), [["ArrayLiteralExpression", 0], ["Block", 0], ["Block", 2], ["NumericLiteral", 0], ["SourceFile", 0]]);
});
test("a native array result preserves independent borrowed and created producer alternatives", checkNativeArrayAlternatives);
test("a wholly borrowed native array result creates no new caller backing", checkBorrowedNativeArrayReturn);

test("a joined nested reference preserves both actual input subjects across a presence edge", async () => {
  const { loadFrontFixture } = await import("./fixtures/front/checked-module.mjs");
  const { analysisInput } = await import("./fixtures/front/analysis-input.mjs");
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const fixture = await loadFrontFixture();
  for (const writes of [false, true]) {
    const input = analysisInput(fixture, "sdk-minimal", `
      type Holder = { child: { flag: boolean } | null };
      export function read(left: Holder, right: Holder, choose: boolean): boolean {
        let current: Holder = left;
        if (choose) current = right;
        if (current.child !== null) {
          ${writes ? "current.child.flag = false;" : ""}
          return current.child.flag;
        }
        return false;
      }
    `);
    const result = analyzeHostProgram(input);
    assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
    const chapter = result.value.modules.find(row => row.module === input.snapshot.entryPoint);
    const body = chapter.bodies.find(row => row.kind === "selected" && row.tir.root.kind === "Block");
    const summary = result.value.index.summaries.find(row => row.key.kind === "body" && row.key.execution.instance.body === body.instance.body);
    const fields = arena => {
      const child = arena.projections.find(row => row.parent === null && row.projection.kind === "field"
        && row.projection.member.decision.key.value === "child");
      const flag = arena.projections.find(row => row.parent === child.id && row.projection.kind === "field"
        && row.projection.member.decision.key.value === "flag");
      return [child.id, flag.id];
    };
    const [child, flag] = fields(summary.arena);
    const [left, right, choose] = summary.parameters;
    for (const subject of [left, right]) {
      assert.deepEqual(subject.reads, { kind: "complete", paths: [child, flag] });
      assert.deepEqual(subject.writes, { kind: "complete", paths: writes ? [flag] : [] });
    }
    assert.deepEqual(choose.writes, { kind: "complete", paths: [] });
    const [facts] = body.facts;
    const [childPath] = fields(facts.arena);
    const joined = facts.arena.origins.filter(row => row.kind === "complete" && row.producers.length === 2 && row.producers.every(id => {
      const producer = facts.arena.producers[facts.arena.boundProducers[id].producer];
      return producer.kind === "parameter" && producer.path === childPath;
    }));
    assert.deepEqual(joined.map(row => [row.includesAbsence, row.producers.map(id =>
      facts.arena.producers[facts.arena.boundProducers[id].producer].index)]), [[true, [0, 1]], [false, [0, 1]]]);
    assert.equal(body.mir.blocks.some(block => block.terminator.kind === "check"), true);
  }
});

test("the application kernel remaps a projected return onto the actual caller field", async () => {
  const { loadFrontFixture } = await import("./fixtures/front/checked-module.mjs");
  const { analysisInput } = await import("./fixtures/front/analysis-input.mjs");
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { projectionEffects } = await import("../../packages/host/dist/analyses/body/projection-effects.js");
  const input = analysisInput(await loadFrontFixture(), "sdk-minimal", `
    type Holder = { child: { flag: boolean }; other: boolean };
    function child(formal: Holder) { return formal.child; }
    export function forward(holder: { other: boolean; child: { flag: boolean } }): boolean {
      child(holder);
      return true;
    }
  `);
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const chapter = result.value.modules.find(row => row.module === input.snapshot.entryPoint);
  const caller = chapter.bodies.find(row => row.kind === "selected" && row.instance.body.includes(";forward];function;0]"));
  const call = caller.mir.blocks.find(row => row.terminator.kind === "call").terminator;
  assert.equal(call.callee.kind, "direct");
  assert.equal(call.destination, null, "the authored call discards the result; this assertion does not claim end-to-end result storage");
  const { activation, decision } = call.callee.resolution;
  const mapping = decision.parameters[0];
  assert.equal(mapping.kind, "reference-argument");
  const [correspondence] = mapping.view.fields;
  assert.notEqual(correspondence.formal, correspondence.caller);
  const summary = result.value.index.summaries.find(row => row.key.kind === "body" && row.key.execution.instance.body === activation.body);
  const returned = summary.arena.origins[summary.result];
  assert.equal(returned.producers.length, 1);
  const formal = summary.arena.producers[summary.arena.boundProducers[returned.producers[0]].producer];
  assert.equal(formal.kind, "parameter");
  assert.equal(formal.index, 0);
  assert.equal(summary.arena.projections[formal.path].projection.member.decision.primary, correspondence.formal);

  const [facts] = caller.facts;
  const invocation = facts.origins.invocations.find(row => row.node === call.tir.node);
  const [alternative] = invocation.alternatives;
  const held = facts.arena.contexts[alternative.context].arguments[0].origins;
  const source = captureSourceBarrier(input);
  assert.equal(source.kind, "ok");
  const account = createAccount(limits);
  const deps = { account };
  const origins = valueOrigins(deps, [...facts.arena.origins]);
  assert.equal(origins.kind, "complete");
  const producers = [...facts.arena.producers];
  const bound = [...facts.arena.boundProducers];
  const projections = [];
  const effects = projectionEffects(deps, new Map([[0, "field"]]), null, projections, () => null, () => null, {
    lexical: caller.tir.lexicalBindings, scopeOf: definition => source.value.descriptions.get(definition)?.generics ?? null,
  });
  const apply = () => effects.appliedValue(call, summary, formal, formal.path, held, origins.value, bound, producers, () => null);
  const image = apply();
  assert.equal(typeof image, "number");
  assert.equal(apply(), image);
  assert.equal(projections.length, 1);
  assert.equal(projections[0].projection.member.decision.primary, correspondence.caller);
  const row = origins.value.rows[image];
  assert.equal(row.includesAbsence, false);
  assert.equal(row.producers.length, 1);
  const projected = producers[bound[row.producers[0]].producer];
  assert.deepEqual([projected.kind, projected.index, projected.path], ["parameter", 0, projections[0].id]);
});

const limits = { maximumWork: 1000000, maximumResultEntries: 1000000 };
const analysisLimits = { maximumProjectionDepth: 64, maximumOriginAlternatives: 128, maximumConditionAlternatives: 128,
  maximumRelationalRecordsPerBody: 100000, maximumRelationalReferencesPerBody: 100000 };
const scope = { classParameters: [], methodParameters: [], capturedParameters: [], selfOwners: [] };
const repository = fileURLToPath(new URL("../../", import.meta.url));
const runtimeFiles = ["index", "round", "storage", "source", "proof", "calls", "open-calls", "values", "value-flow", "places",
  "projection-effects", "static-calls", "captures", "initialization", "writes", "exits", "array-results", "summary-subjects"]
  .map(name => resolve(repository, `packages/host/dist/analyses/body/${name}.js`));
const session = new Session();
const post = (method, parameters = {}) => new Promise((done, reject) =>
  session.post(method, parameters, (error, value) => error === null ? done(value) : reject(error)));
let analyzeBodyRound;
let proveInitialization;
let solveAssigned;
let sourceOccurrences;
let selectedSourceApplication;
let orderedRows;
let transferAssigned;
let statementOperands;
let terminatorOperands;
let readLocal;
let assignedLattice;
let assignedEntry;
let taintUnwritten;
let unwrittenCause;
let localSlotLifetimes;
let solveStorageLive;
let storageLiveLattice;
let bodyNodes;
let callSummary;
let scalarArgument;
let applyScalarCall;
let joinOrigins;
let appliedOrigins;
let noCallBoundary;
let valueOrigins;
let valueProblem;
let transferValue;
let operandOrigins;
let callValueEffects;
let prepareCallCaptures;
let cellMustAtExit;
let callExitAssigned;
let sourceNeedAssigned;
let recordUninitializedRead;
let callSlotAt;
let callWrites;
let collectCellWrites;
let primitiveExitLocals;
let collectExitContents;
let removeUnchangedContents;
let retainValue;
let retainCallCaptures;
let collectRetainedValues;
const unexpectedExpandedApplication = () => assert.fail("An ordinary fixed argument does not request an expanded application.");

before(async () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true, "the aggregate owner guard admitted this process");
  session.connect();
  await post("Debugger.enable");
  await post("Profiler.enable");
  await post("Profiler.startPreciseCoverage", { callCount: true, detailed: true });
  ({ analyzeBodyRound, proveInitialization } = await import("../../packages/host/dist/analyses/body/index.js"));
  const storage = await import("../../packages/host/dist/analyses/body/storage.js");
  ({ transferAssigned, statementOperands, terminatorOperands, assignedLattice, assignedEntry,
    localSlotLifetimes, solveStorageLive, storageLiveLattice, taintUnwritten, unwrittenCause } = storage);
  solveAssigned = (deps, input) => storage.solveAssigned(deps, input, unexpectedExpandedApplication);
  ({ readLocal } = await import("../../packages/host/dist/analyses/body/places.js"));
  ({ sourceOccurrences, selectedSourceApplication, orderedRows } = await import("../../packages/host/dist/analyses/body/source.js"));
  ({ bodyNodes } = await import("../../packages/host/dist/ir-facts/verify-body-nodes.js"));
  const calls = await import("../../packages/host/dist/analyses/body/calls.js");
  ({ scalarArgument, applyScalarCall, callValueEffects } = calls);
  callSummary = (deps, mir, operation, source = unexpectedExpandedApplication) => calls.callSummary(deps, mir, operation, source);
  ({ noCallBoundary } = await import("../../packages/host/dist/analyses/body/open-calls.js"));
  const originValues = await import("../../packages/host/dist/analyses/body/values.js");
  ({ joinOrigins, valueOrigins } = originValues);
  appliedOrigins = (deps, values, value, admit) => originValues.appliedOrigins(deps, values, value, admit, noCallBoundary, null);
  ({ valueProblem, transferValue, operandOrigins, collectExitContents, removeUnchangedContents } =
    await import("../../packages/host/dist/analyses/body/value-flow.js"));
  ({ prepareCallCaptures } = await import("../../packages/host/dist/analyses/body/captures.js"));
  ({ cellMustAtExit, callExitAssigned, sourceNeedAssigned, callSlotAt, recordUninitializedRead } =
    await import("../../packages/host/dist/analyses/body/initialization.js"));
  ({ callWrites, collectCellWrites, primitiveExitLocals } = await import("../../packages/host/dist/analyses/body/writes.js"));
  ({ retainValue, retainCallCaptures, collectRetainedValues } = await import("../../packages/host/dist/analyses/body/exits.js"));
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
    defs: { completionSelector: T.int32, exceptionStorage: T.unknown }, unit: { request: unit, position: { kind: "result" } } }, program.tir, internal, verificationContext(program).requiredEntries);
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
  const deps = { types: TABLE, typeOf, signatureOf, bindingScopeOf: () => null, sourceObjectHolding: () => ({ kind: "complete", value: null }),
    sourceObjectFields: () => ({ kind: "complete", value: () => ({ kind: "complete", value: null }) }),
    carrierHoldingOf: (meter, carrier) => accountFailure(meter) ?? { kind: "complete",
      value: nativeCarrierHoldingOf(canonical.selectedNativeFacts.carrierHolding, carrier) },
    enumValueOf: meter => accountFailure(meter) ?? { kind: "complete", value: null },
    summaryOf: () => { throw new Error("A call-free actual body has no Summary demand"); },
    declaredAt: () => null,
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
  const conditionRefusal = { kind: "refused", diagnostics: [resourceLimitDiagnostic({ owner: "analyses/body",
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
      const refused = { kind: "refused", diagnostics: [resourceLimitDiagnostic({ owner: "analyses/body",
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

test("an errored placed call does not invent effects for a later actual captured read", () => {
  for (const incoming of [false, true]) {
    const data = locationDefaultProgram(`body-round.tainted-capture.${incoming}`, { count: 2, incoming });
    const caller = fixture(data.program, data.internal, incoming ? 0 : 1);
    const initializers = data.children.map(child => fixture(child));
    const outer = data.owner === null ? [] : [fixture(data.owner)];
    const retained = initializers.map(initializer => {
      initializer.related = [caller, ...outer];
      return { value: checkedPair(initializer, analyzeBodyRound(initializer.deps, initializer.input)).summary,
        unit: { request: initializer.deps.unit, position: { kind: "result" } } };
    });
    const answerWithFailure = failed => key => {
      const index = initializers.findIndex(initializer => executionKey(key.execution) === executionKey(initializer.execution));
      assert.notEqual(index, -1);
      const selected = retained[index];
      return index === failed ? { value: { kind: "error", causes: [{ kind: "unit", unit: selected.unit }] }, unit: selected.unit } : selected;
    };
    const answer = answerWithFailure(0);
    const full = analyzeBodyRound({ ...caller.deps, summaryOf: answer, account: createAccount(limits) }, caller.input);
    assert.equal(full.kind, "complete");
    assert.deepEqual(full.value.diagnostics, []);
    assert.deepEqual(full.value.value.causes, [{ kind: "unit", unit: retained[0].unit }]);
    const reversed = analyzeBodyRound({ ...caller.deps, summaryOf: answerWithFailure(1), account: createAccount(limits) }, caller.input);
    assert.equal(reversed.kind, "complete");
    assert.deepEqual(reversed.value.diagnostics, []);
    assert.deepEqual(reversed.value.value.causes, [{ kind: "unit", unit: retained[1].unit }]);
    for (const field of ["maximumWork", "maximumResultEntries"]) {
      let completed = false;
      for (let maximum = 0; maximum < 10000; maximum += 1) {
        const account = createAccount({ ...limits, [field]: maximum });
        const result = analyzeBodyRound({ ...caller.deps, summaryOf: answer, account }, caller.input);
        if (result.kind === "complete") { completed = true; break; }
        assert.equal(result, accountFailure(account));
      }
      assert.equal(completed, true, field);
    }
  }
});

test("error taint follows the real edge and cell rather than suppressing an unrelated read or ready call", async () => {
  const { analyzeOptionalSource } = await import("./fixtures/optional-default.mjs");
  const definitions = "let state: boolean; function fail(flag: boolean): boolean { let broken: boolean; return broken; } "
    + "function identity(value: boolean): boolean { return value; } ";
  for (const [body, local] of [
    ["if (flag) return fail(flag); return identity(state);", null],
    ["let clean: boolean; if (flag) { clean = true; fail(flag); } return clean;", "clean"],
  ]) {
    const text = `${definitions}export function inspect(flag: boolean): boolean { ${body} }`;
    const result = await analyzeOptionalSource(text);
    assert.equal(result.kind, "refused", body);
    assert.deepEqual(result.diagnostics.map(diagnostic => [diagnostic.code.rendered, diagnostic.site.origin.start]),
      [text.lastIndexOf("broken"), ...(local === null ? [] : [text.lastIndexOf(local)])]
        .map(start => ["TSONIC_READ_BEFORE_INITIALIZATION", start]), body);
  }
});

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
  const { projectBodyFacts } = await import("../../packages/host/dist/ir-program/canonical-facts.js");
  const { createProjectionInventory } = await import("../../packages/host/dist/ir-program/program-values.js");
  const { createInstantiationMeter } = await import("../../packages/host/dist/ir-program/work.js");
  const binding = { parameterBinding: () => assert.fail("No selected local transport substitution."),
    selfBinding: () => assert.fail("No selected local transport self substitution.") };
  const scan = createProjectionInventory(createInstantiationMeter({ maximumWork: 100000, maximumCreatedRecords: 10000,
    maximumBindingVectorsPerArtifact: 1, typeExpansion: { maximumDepth: 10, maximumVisits: 100, maximumUnionMembers: 10, maximumIntersectionMembers: 10 } }), binding, path => assert.fail(path));
  const projected = projectBodyFacts(scan, { type: type => type, signature: signature => signature }, pair.facts);
  assert.equal(projected.kind, "copied");
  const canonical = projected.value;
  assert.equal(canonical.arena.producers === pair.facts.arena.producers, true);
  assert.equal(canonical.arena.producers[location.id] === location, true);
  assert.deepEqual(canonical.arena.contexts, pair.facts.arena.contexts, "location transport does not infer a different cell association");
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
    assert.throws(() => run({ ...pair.summary, arena: { ...pair.summary.arena, cells: [{ ...cell, role }] } }), /actual static, capture or created-cell binding/);
  assert.throws(() => run({ ...pair.summary, arena: { ...pair.summary.arena, producers: [{ id: 0, path: 0, kind: "capture", index: 0 }] } }),
    /An applied projected entry requires its actual caller reference inventory/u);
  assert.equal(run({ ...pair.summary, writes: [{ target: 0, value: 0 }] }).kind, "complete",
    "a known primitive cell history is not an unsupported event or reference effect");
  assert.throws(() => run({ ...pair.summary, concurrentWrites: [{ target: 0, value: 0 }] }),
    /actual caller cell, event, callback or backing producer/);
  for (const field of ["reads", "writes"]) {
    assert.throws(() => run({ ...pair.summary, captures: [{ ...pair.summary.captures[0], [field]: { kind: "open", paths: [], boundaries: [0] } }] }),
      /captured subobject read\/write transport/);
    assert.throws(() => run({ ...pair.summary, captures: [{ ...pair.summary.captures[0], [field]: { kind: "complete", paths: [0] } }] }),
      /no verified caller reference producer/);
  }
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
      const [original, completed] = result.value.positions;
      assert.equal(original.position.kind, "execution-source-node");
      assert.equal(completed.position.kind, "execution-result");
      assert.equal(result.value.value, completed.error);
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

test("native faults initialize only the verified normal destination and preserve the round account", () => {
  const type = declareType("body-native-int64", { kind: "primitive", primitive: "int64" });
  const makeBody = failure => {
    const name = `body-round.native-add.${failure}`;
    const builder = builders(name);
    const operation = native("+", "int64", [type, type], type,
      { kind: "invocation", writesStorage: false, failure });
    return fixture(typedBody(name, { signature: signature(name, [["left", type], ["right", type], ["borrowed", T.string]], type),
      completion: type, params: [[0, "required", type], [1, "required", type], [2, "required", T.string]],
      locals: [["left", "parameter", type], ["right", "parameter", type], ["borrowed", "parameter", T.string]],
      root: builder.block(builder.returns(builder.arithmetic(builder.id("left", 0, type), "PlusToken",
        builder.id("right", 1, type), type, operation))) }));
  };
  const current = makeBody("abort");
  const mir = current.input.mir;
  const invoke = mir.blocks.find(block => block.terminator.kind === "invoke").terminator;
  const destination = mir.places[invoke.destination].base.local;
  const whole = checkedPair(current, analyzeBodyRound(current.deps, current.input));
  assert.equal(whole.summary.returns, true);
  assert.equal(whole.summary.unwinds, false);
  assert.equal(whole.facts.initialization.reads.every(row => row.assigned), true);
  const assigned = solveAssigned({ ...current.deps, account: createAccount(limits) }, current.input);
  assert.equal(assigned.kind, "complete");
  const incoming = mir.blocks.find(block => block.terminator === invoke).id;
  assert.equal(assigned.value.entry[incoming].written.has(destination), false);
  assert.equal(assigned.value.entry[invoke.next].written.has(destination), true);
  const live = solveStorageLive(current.input, assigned.value.entry, createAccount(limits));
  assert.equal(live.kind, "complete");
  assert.ok(live.value[invoke.next] !== null);

  const unwind = makeBody("unwind");
  const unwinding = checkedPair(unwind, analyzeBodyRound(unwind.deps, unwind.input));
  assert.equal(unwinding.summary.returns, true);
  assert.equal(unwinding.summary.unwinds, true);
  assert.equal(unwinding.summary.thrown, whole.summary.thrown, "A native scalar fault invents no source value origins.");
  for (const [fixture, expected] of [[current, whole], [unwind, unwinding]]) {
    for (const dimension of ["maximumWork", "maximumResultEntries"]) {
      let complete = false;
      for (let maximum = 0; maximum < 2000; maximum += 1) {
        const account = createAccount({ ...limits, [dimension]: maximum });
        const result = analyzeBodyRound({ ...fixture.deps, account }, fixture.input);
        if (result.kind === "complete") {
          assert.deepEqual(result.value.value, expected);
          complete = true;
          break;
        }
        assert.equal(result, accountFailure(account));
        assert.equal(analyzeBodyRound({ ...fixture.deps, account },
          new Proxy({}, { get() { assert.fail("No input after the original operation stop."); } })), result);
      }
      assert.equal(complete, true);
    }
  }
  const stopped = createAccount(limits);
  const refusal = { kind: "refused", diagnostics: [] };
  const stoppedReader = solveAssigned({ ...current.deps, account: stopped, typeOf: () => {
    refuseAccount(stopped, refusal);
    return { kind: "primitive", primitive: "int64" };
  } }, current.input);
  assert.equal(stoppedReader, refusal);

  for (const [change, failure] of [
    [candidate => { candidate.blocks.find(block => block.terminator.kind === "invoke").terminator.unwind = { kind: "escape" }; },
      /selected call, failure or suspension transport/u],
    [candidate => { candidate.blocks.find(block => block.terminator.kind === "invoke").terminator.destination = null; },
      /selected call, failure or suspension transport/u],
    [candidate => { candidate.places[invoke.destination].storage = T.bool; }, /exact local result place/u],
    [candidate => { candidate.locals[destination].role = { kind: "user" }; }, /own temporary result/u],
  ]) {
    const opposite = structuredClone(mir);
    change(opposite);
    assert.throws(() => solveAssigned({ ...current.deps, account: createAccount(limits) }, { ...current.input, mir: opposite }), failure);
  }
  assert.throws(() => solveAssigned({ ...current.deps, account: createAccount(limits), typeOf: () => ({ kind: "string" }) },
    current.input), /selected primitive result/u);
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
    const entry = pair.summary.arena.contexts[0].arguments[0];
    if (provided === 0) assert.deepEqual(entry, { kind: "omitted" });
    else {
      assert.equal(entry.kind, "provided");
      assert.equal(pair.summary.arena.origins[entry.origins].includesAbsence, true);
    }
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
  assert.equal(pair.facts.arena.contexts[alternative.context].arguments[0].origins, transport.actual);
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
  const nodes = sourceOccurrences(current.input.tir, createAccount(limits)).value;
  const actualApplication = at => at.body === current.input.tir.body ? selectedSourceApplication(nodes.get(at.node)) : null;
  for (const mapping of [{ ...selected.decision.parameters[0], parameter: 1 },
    { ...selected.decision.parameters[0], argument: 1 }, { ...selected.decision.parameters[0], component: 0 },
    { ...selected.decision.parameters[0], passing: "move" }, { kind: "default", parameter: 0, initializer: DEFAULT_BODY }])
    assert.throws(() => callSummary(current.deps, current.input.mir, { ...operation, callee: { ...operation.callee,
      resolution: { ...selected, decision: { ...selected.decision, parameters: [mapping] } } } }, actualApplication), /actual fixed by-value mapping/);
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
  const erroneous = entry => ({ ...entry, deps: { ...entry.deps, summaryOf: () => ({ value: failed.value.value, unit: completed }) } });
  const ownRead = analyzeBodyRound(erroneous(unwritten).deps, unwritten.input);
  assert.equal(ownRead.kind, "complete");
  assert.deepEqual(ownRead.value.diagnostics, failed.value.diagnostics);
  const borrowed = analyzeBodyRound({ ...erroneous(current).deps, account: createAccount(limits) }, current.input);
  assert.equal(borrowed.kind, "complete");
  assert.deepEqual(borrowed.value.value.causes, [{ kind: "unit", unit: completed }]);
  assert.deepEqual(borrowed.value.diagnostics, []);
  for (const dimension of ["maximumWork", "maximumResultEntries"]) {
    for (const entry of [current, unwritten, erroneous(unwritten)]) {
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

test("an omitted reference formal is initialized by its real body, with no fictitious caller value", () => {
  const name = "body-round.omitted-reference";
  const { program, children, internal } = locationDefaultProgram(name, { type: T.string, count: 2 });
  const target = fixture(program, internal, 1);
  const initializers = children.map(child => fixture(child));
  const answers = new Map(initializers.map(initializer => {
    initializer.related = [target];
    const initialPair = checkedPair(initializer, analyzeBodyRound(initializer.deps, initializer.input));
    return [executionKey(initializer.execution), { value: initialPair.summary, unit: { request: initializer.deps.unit, position: { kind: "result" } } }];
  }));
  target.related = initializers;
  target.deps.summaryOf = key => answers.get(executionKey(key.execution));
  const result = checkedPair(target, analyzeBodyRound(target.deps, target.input));
  const selected = callee(name, program.tir.signature, [mapped(0, 0), ...children.map((child, index) =>
    ({ kind: "default", parameter: index + 1, initializer: child.tir.body }))], T.string);
  const current = fixture(shaped(`${name}.call`, [["argument", "required", T.string]], T.string, builder =>
    builder.block(builder.returns(builder.call(builder.global("target", name, T.unknown),
      [{ $: "input-argument", ...builder.id("argument", 0, T.string) }], T.string, at =>
        ({ callee: selected, receiver: null, arguments: [{ kind: "provided", parameter: 0, expression: at("input-argument") },
          ...internal.map(({ instance }, index) =>
            ({ kind: "omitted", parameter: index + 1, value: { kind: "initializer", instance } }))] }))))));
  current.related = [target, ...initializers];
  const unit = { request: target.deps.unit, position: { kind: "result" } };
  current.deps.summaryOf = key => {
    assert.deepEqual(key, result.summary.key);
    return { value: result.summary, unit };
  };
  const pair = checkedPair(current, analyzeBodyRound(current.deps, current.input));
  const invocation = pair.facts.origins.invocations[0];
  const selectedCall = invocation.alternatives[0];
  const supplied = pair.facts.arena.contexts[0].arguments[0];
  assert.equal(supplied.kind, "provided");
  assert.deepEqual(pair.facts.arena.contexts[selectedCall.context].arguments, [supplied, { kind: "omitted" }, { kind: "omitted" }]);
  assert.equal(selectedCall.arguments[1].kind, "omitted");
  assert.deepEqual(Object.keys(selectedCall.arguments[1]).sort(), ["formal", "kind", "parameter", "parameterIndex"]);
  assert.equal(pair.summary.result, supplied.origins);
  assert.deepEqual(result.summary.arena.contexts[0].arguments[1], { kind: "omitted" });
  assert.deepEqual(result.summary.arena.boundProducers.map(row => result.summary.arena.producers[row.producer].index), [0]);

  const operation = current.input.mir.blocks[invocation.point.block].terminator;
  const deps = { ...current.deps, account: createAccount(limits) };
  assert.throws(() => scalarArgument(deps, operation, 1), /actual selected argument/);
  const retained = TABLE.signatures[program.tir.signature];
  for (const formal of [undefined, { ...retained.parameters[1], kind: "required" },
    { ...retained.parameters[1], acceptsOmission: false }, { ...retained.parameters[1], passing: "move" },
    { ...retained.parameters[1], initializer: DEFAULT_BODY }]) {
    assert.throws(() => callSummary({ ...deps, signatureOf: () => ({ ...retained,
      parameters: [retained.parameters[0], formal, retained.parameters[2]] }),
    summaryOf: () => assert.fail("No Summary reader after the actual default signature is invalid."),
    }, current.input.mir, operation), /actual default of each omitted/);
  }
  const mapping = selected.decision.parameters[1];
  const wrongPosition = { ...operation, callee: { ...operation.callee, resolution: { ...selected,
    decision: { ...selected.decision, parameters: [selected.decision.parameters[0], { ...mapping, parameter: 0 }] } } } };
  assert.throws(() => callSummary({ ...deps, summaryOf: () => assert.fail("No Summary reader for the wrong formal.") },
    current.input.mir, wrongPosition), /actual selected argument omission/);
  const refusal = { kind: "refused", diagnostics: [] };
  const refusedAccount = createAccount(limits);
  assert.equal(callSummary({ ...deps, account: refusedAccount, signatureOf: () => {
    refuseAccount(refusedAccount, refusal);
    return new Proxy({}, { get() { assert.fail("No signature answer read after its original refusal."); } });
  }, summaryOf: () => assert.fail("No Summary reader after the selected signature refuses."),
  }, current.input.mir, operation), refusal);
  for (const dimension of ["maximumWork", "maximumResultEntries"]) {
    let complete = false;
    for (let maximum = 0; maximum < 2000; maximum += 1) {
      const account = createAccount({ ...limits, [dimension]: maximum });
      let signatureReads = 0;
      const response = callSummary({ ...current.deps, account, signatureOf: id => {
        signatureReads += 1;
        assert.equal(id, retained.id);
        return retained;
      } }, current.input.mir, operation);
      assert.equal(signatureReads <= 1, true);
      if (response.kind === "complete") {
        assert.equal(response.value, result.summary);
        assert.equal(signatureReads, 1);
        complete = true;
        break;
      }
      assert.equal(response, accountFailure(account));
    }
    assert.equal(complete, true);
  }
  const syntax = sourceOccurrences(current.input.tir, createAccount(limits)).value.get(invocation.node);
  const args = syntax.tsonic.application.decision.arguments;
  for (const wrong of [undefined, { ...args[1], parameter: 0 }]) {
    const original = args[1];
    args[1] = wrong;
    try {
      assert.throws(() => analyzeBodyRound({ ...current.deps, account: createAccount(limits) }, current.input),
        /exact selected omitted disposition/);
    } finally { args[1] = original; }
  }
  const invented = { ...result.summary, arena: { ...result.summary.arena, boundProducers: [
    ...result.summary.arena.boundProducers, { id: 1, producer: 1, context: 0, bindings: EMPTY_BINDINGS },
  ] } };
  const state = current.input.mir.locals.map(() => supplied.origins);
  assert.throws(() => callValueEffects(deps, current.input, operation, invocation.point, invented, pair.facts.arena,
    operand => operandOrigins(current.input, [], state, operand, null, null, null), [], null, null, null,
    () => assert.fail("An omitted formal cannot request a projected value.")),
    /actual provided argument/);
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
  assert.deepEqual(pair.facts.arena.contexts[alternative.context].arguments.map(slot => slot.origins), alternative.arguments.map(row => row.actual));
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
  const refused = { kind: "refused", diagnostics: [resourceLimitDiagnostic({ owner: "analyses/body", limit: "analysis.maximumOriginAlternatives",
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
  assert.throws(() => run(operation, { ...summary, suspends: true }), /actual suspension transport/);
  assert.equal(run(operation, { ...summary, unwinds: true }).kind, "complete");
  assert.equal(run({ ...operation, unwind: { kind: "handler", target: 0, exception: null } },
    { ...summary, unwinds: true }).kind, "complete");
  for (const unwind of [{ kind: "none" }, { kind: "abort" }])
    assert.throws(() => run({ ...operation, unwind }, { ...summary, unwinds: true }), /actual selected callee failure continuation/u);
  const arena = analyzeBodyRound({ ...current.deps, account: createAccount(limits) }, current.input).value.value.facts.arena;
  const apply = (answer, overrides = {}) => applyScalarCall({ ...current.deps, account: createAccount(limits), ...overrides },
    current.input, operation, point, answer, arena, 1, [], [],
    () => assert.fail("These scalar argument fixtures have no selected parameter field read."), null);
  assert.throws(() => apply({ ...summary, arena: { ...summary.arena, cells: [{}] } }), /actual caller-cell bindings/);
  const absent = { ...summary.arena.origins[0], id: 1, includesAbsence: true };
  const absentArena = { ...summary.arena, origins: [...summary.arena.origins, absent] };
  assert.equal(apply({ ...summary, arena: absentArena, thrown: 1 }).value.thrown.includesAbsence, true,
    "the one native absence is a genuine transported thrown value, not a fabricated fault");
  assert.throws(() => apply({ ...summary, arena: { ...summary.arena,
    producers: [{ id: 0, path: null, kind: "call-result", at: operation.tir, callee: { kind: "indirect" } }],
    boundProducers: [{ id: 0, producer: 0, bindings: EMPTY_BINDINGS, context: 0 }] } }),
  /actual caller cell, event, callback or backing producer/);
  assert.throws(() => apply({ ...summary, thrown: 1, arena: { ...summary.arena,
    producers: [{ id: 0, path: null, kind: "call-result", at: operation.tir, callee: { kind: "indirect" } }],
    boundProducers: [{ id: 0, producer: 0, bindings: EMPTY_BINDINGS, context: 0 }],
    origins: [...summary.arena.origins, { id: 1, kind: "complete", producers: [0], includesAbsence: false }] } }),
  /actual Origins result and thrown-value binding/);
  const pending = { ...summary, initialization: { ...summary.initialization,
    points: [{ kind: "need", cell: 0 }], rows: [{ point: 0, cell: null, condition: 0 }] } };
  assert.throws(() => apply(pending), /actual required source-cell formal/);
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
  const first = { kind: "error", key: "a", unit, provided: 0 };
  const later = { kind: "error", key: "z", unit: { request: current.deps.unit, position: { kind: "result" } }, provided: 0 };
  const assigned = { written: new Set([0]), taint: null };
  const other = { written: new Set([1]), taint: null };
  const lattice = assignedLattice(4);
  const account = createAccount(limits);
  const fromFirst = taintUnwritten(assigned, first, account);
  const fromLater = taintUnwritten(other, later, account);
  const joined = lattice.join(fromFirst, fromLater, account);
  assert.deepEqual([...joined.written], []);
  assert.deepEqual([0, 1, 2].map(local => unwrittenCause(joined, local)), [later, first, first]);
  assert.equal(unwrittenCause(fromFirst, 0), null);
  assert.equal(unwrittenCause(assigned, 2), null);
  assert.equal(lattice.equals(joined, lattice.join(fromLater, fromFirst, account), account), true);
  assert.equal(lattice.join(fromFirst, assigned, account).taint, fromFirst.taint);
  const same = taintUnwritten(assigned, { ...first }, account);
  assert.equal(lattice.equals(fromFirst, same, account), true);
  assert.equal(lattice.equals(fromFirst, fromLater, account), false);
  assert.equal(lattice.equals(fromFirst, assigned, account), false);
  assert.equal(lattice.equals(assigned, fromFirst, account), false);
  const another = taintUnwritten(fromFirst, later, account);
  assert.equal(unwrittenCause(another, 0), null, "both real calls leave the previously written slot alone");
  assert.equal(unwrittenCause(another, 2), first);
  const dead = transferAssigned(current.input.mir, { kind: "storage-dead", local: 0 }, another, account);
  assert.equal(unwrittenCause(dead, 0), null, "the earlier exceptions apply even after the slot is no longer written");
  assert.equal(unwrittenCause(taintUnwritten(dead, later, account), 0), later,
    "the previously written exception stops protecting the now unwritten cell on a later failing edge");
  const local = current.input.mir.places[operation.destination].base.local;
  const unwritten = taintUnwritten({ written: new Set(), taint: null }, first, account);
  assert.equal(unwrittenCause(unwritten, local), first);
  const cleared = transferAssigned(current.input.mir, { kind: "assign", place: operation.destination }, unwritten, account);
  assert.equal(cleared.written.has(local), true);
  const reset = transferAssigned(current.input.mir, { kind: "storage-live", local }, cleared, account);
  assert.equal(unwrittenCause(reset, local), null, "an actual write clears taint before a later reset");
  assert.equal(transferAssigned(current.input.mir, { kind: "assign", place: operation.destination }, reset, account).taint,
    reset.taint, "a write to an already clean slot needs no new exception");
  const otherClean = taintUnwritten({ written: new Set([1]), taint: null }, first, account);
  const unequal = lattice.join(otherClean, { written: new Set([0]), taint: null }, account);
  const equalShape = lattice.join(fromFirst, other, account);
  assert.equal(lattice.equals(equalShape, unequal, account), false);
  for (const field of ["maximumWork", "maximumResultEntries"]) {
    for (const run of [borrowed => taintUnwritten(fromFirst, later, borrowed),
      borrowed => lattice.join(fromFirst, fromLater, borrowed),
      borrowed => lattice.join(fromLater, fromFirst, borrowed),
      borrowed => lattice.equals(equalShape, unequal, borrowed),
      borrowed => transferAssigned(current.input.mir, { kind: "assign", place: operation.destination }, unwritten, borrowed)]) {
      let completed = false;
      for (let maximum = 0; maximum < 256; maximum += 1) {
        const limited = createAccount({ ...limits, [field]: maximum });
        run(limited);
        const stop = accountFailure(limited);
        if (stop === null) { completed = true; break; }
        assert.equal(stop.kind, "resource-limit");
        run(limited);
        assert.equal(accountFailure(limited), stop);
      }
      assert.equal(completed, true, field);
    }
  }
  const callBlock = current.input.mir.blocks.find(block => block.terminator === operation);
  const next = current.input.mir.blocks[operation.next];
  const blocks = current.input.mir.blocks.map(block => block === next ? { ...block, statements: [], terminator: operation } : block);
  const response = solveAssigned({ ...current.deps, account: createAccount(limits),
    summaryOf: () => ({ value: { kind: "error", causes: [] }, unit }) }, { ...current.input, mir: { ...current.input.mir, blocks } });
  assert.equal(response.kind, "complete");
  assert.equal(response.value.error.grounds.length, 1);
  assert.strictEqual(response.value.error.grounds[0], unit);
  assert.equal(response.value.entry[callBlock.id].written instanceof Set, true);
  const destination = current.input.mir.places[operation.destination].base.local;
  assert.equal(response.value.entry[next.id].written.has(destination), true);
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
  assert.equal(reads, 1);
  let roundReads = 0;
  const retained = analyzeBodyRound({ ...current.deps, account: createAccount(limits), summaryOf: key => {
    assert.equal(++roundReads, 1, "the replay borrows the exact completed answer selected by the solver");
    return current.deps.summaryOf(key);
  } }, current.input);
  checkedPair(current, retained);
  assert.equal(roundReads, 1);
});

test("an offered prior or outside read pays its exact identity before any selected signature demand", async () => {
  const { InvocationAccount } = await import("../../packages/host/dist/dataflow/account.js");
  const { admitSummaryIdentity } = await import("../../packages/host/dist/ir-facts/index.js");
  const { declaredInvocationFixture } = await import("./fixtures/program-invocations.mjs");
  const { current, childPair, initializer, operation, unit } = defaultRound();
  const summary = childPair.summary;
  const entry = initializer.input.mir.entries.find(row => row.provided === initializer.execution.provided);
  assert.ok(entry);
  const least = { kind: "least", execution: initializer.execution, signature: initializer.input.tir.signature, entry };
  const authority = auth => {
    const account = createAccount(limits);
    assert.equal(admitSummaryIdentity(auth, account), null);
    const { work, entries } = InvocationAccount.stateOf(account);
    return { maximumWork: work, maximumResultEntries: entries };
  };
  const run = (observe, maxima = limits) => {
    const account = createAccount(maxima);
    const state = () => {
      const { work, entries } = InvocationAccount.stateOf(account);
      return { maximumWork: work, maximumResultEntries: entries };
    };
    const reads = [];
    const result = callSummary({ ...current.deps, account, summaryOf: () => {
      reads.push("answer");
      return observe(state(), reads);
    }, signatureOf: requested => {
      reads.push("signatureOf");
      return current.deps.signatureOf(requested);
    } }, current.input.mir, operation);
    return { result, reads, stop: accountFailure(account), used: state() };
  };
  for (const [authored, offered, wrap, expectations] of [
    [summary, summary.key, selected => ({ kind: "prior-summary", summary: selected }), ["answer", "key", "signature", "signatureOf"]],
    [summary, summary.key, selected => ({ value: selected, unit }), ["answer", "key", "signature", "signatureOf"]],
    [least, { kind: "body", execution: least.execution }, selected => selected, ["answer", "signature", "signatureOf"]],
  ]) {
    let prefix;
    let selected;
    const observe = (used, reads) => {
      prefix = used;
      selected = { ...authored, get signature() { reads.push("signature"); return authored.signature; } };
      if (authored === summary) Object.defineProperty(selected, "key", { get() { reads.push("key"); return summary.key; } });
      return wrap(selected);
    };
    const baseline = run(observe);
    assert.equal(baseline.result.kind, "complete");
    assert.strictEqual(baseline.result.value, selected);
    assert.deepEqual(baseline.reads, expectations);
    const beforeOffered = prefix;
    const price = authority(offered);
    for (const dimension of ["maximumWork", "maximumResultEntries"]) {
      for (let admitted = 0; admitted < price[dimension]; admitted += 1) {
        const blocked = run(observe, { ...limits, [dimension]: beforeOffered[dimension] + admitted });
        assert.strictEqual(blocked.result, blocked.stop);
        assert.equal(blocked.result.dimension, dimension === "maximumWork" ? "work" : "result-entries");
        assert.deepEqual(blocked.reads, expectations.slice(0, -2));
      }
    }
    const exact = run(observe, baseline.used);
    assert.equal(exact.result.kind, "complete");
    assert.strictEqual(exact.result.value, selected);
    assert.deepEqual(exact.reads, expectations);
  }
  const declared = declaredInvocationFixture().summary;
  assert.equal(declared.key.kind, "declared");
  let beforeDeclared;
  let crossedReads;
  const wrong = (used, reads) => {
    beforeDeclared = used;
    crossedReads = reads;
    return { kind: "prior-summary", summary: { ...declared, get signature() {
      assert.fail("a declared offer cannot authorize a selected body signature");
    } } };
  };
  assert.throws(() => run(wrong), /exact complete selected execution and provided count/u);
  assert.deepEqual(crossedReads, ["answer"]);
  const keyStop = run(wrong, { ...limits, maximumWork: beforeDeclared.maximumWork + authority(declared.key).maximumWork - 1 });
  assert.strictEqual(keyStop.result, keyStop.stop);
  assert.deepEqual(keyStop.reads, ["answer"]);
});

test("private ordinary least validates the actual entry and does not read either unproved continuation", () => {
  const { current, initializer, operation } = defaultRound();
  const target = initializer.input.mir.entries.find(row => row.provided === initializer.execution.provided);
  assert.ok(target);
  const least = { kind: "least", execution: initializer.execution, signature: initializer.input.tir.signature, entry: target };
  const currentOperation = { ...operation, get destination() { assert.fail("normal destination requires a finite return"); } };
  const input = { ...current.input, mir: { ...current.input.mir, blocks: current.input.mir.blocks.map(block =>
    block.terminator === operation ? { ...block, terminator: currentOperation } : block) } };
  let reads = 0;
  const deps = { ...current.deps, account: createAccount(limits), summaryOf: key => {
    reads += 1;
    assert.equal(executionKey(key.execution), executionKey(initializer.execution));
    return least;
  } };
  const state = solveAssigned(deps, input);
  assert.equal(state.kind, "complete");
  assert.equal(reads, 1);
  assert.equal(state.value.entry[operation.next], null);
  assert.ok([...state.value.calls.values()].some(row => row === least));
  const call = { ...operation, get destination() { assert.fail("least must not read the normal destination"); },
    get unwind() { assert.fail("least must not read unwind effects after structural graph admission"); } };
  assert.strictEqual(callSummary({ ...deps, account: createAccount(limits) }, input.mir, call).value, least);
  assert.throws(() => callSummary({ ...deps, account: createAccount(limits),
    summaryOf: () => ({ ...least, entry: { ...target, provided: target.provided + 1 } }) }, input.mir, currentOperation),
  /actual selected ordinary entry and provided count/u);
  const actual = analyzeBodyRound({ ...deps, account: createAccount(limits) }, current.input);
  assert.equal(actual.kind, "complete");
  assert.equal(actual.value.value.summary.returns, false);
  assert.equal(actual.value.value.summary.unwinds, false);
  assert.deepEqual(actual.value.value.facts.origins.invocations, []);
  assert.deepEqual(actual.value.value.facts.origins.activations, []);
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

test("native indexed places produce the selected element and the actual counted-loop proof", async () => {
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { loadFrontFixture } = await import("./fixtures/front/checked-module.mjs");
  const fixture = await loadFrontFixture();
  for (const [mode, source] of [["loop", `
      export function read(values: Native[]): Native {
        let sum: Native = 0;
        for (let i = 0; i < values.length; i++) sum += values[i];
        return sum;
      }
    `], ["read", `
      export function read(values: Native[], index: Native, base: Native): Native { return base + values[index]; }
    `], ["write", `
      export function write(values: Native[], index: Native, value: Native): Native {
        values[index] = value; values[index] = 1; return values[index];
      }
    `], ["read-write", `
      export function update(values: Native[], index: Native, value: Native): Native {
        values[index] += value; return values[index];
      }
    `], ["replace", `
      export function replace(values: Native[], replacement: Native[]): Native {
        let sum: Native = 0;
        for (let i = 0; i < values.length; i++) { values = replacement; sum += values[i]; }
        return sum;
      }
    `]]) {
    const input = await nativeInt32Input({ ...fixture, projectSnapshot: specification => fixture.projectSnapshot({
      ...specification, libraries: fixture.sdk.getBundledLibraryClosure(["lib.es5.d.ts"]),
    }) }, source, true);
    const result = analyzeHostProgram({ ...input, snapshot: { ...input.snapshot, nativeFacts: {
      ...input.snapshot.nativeFacts, integerOverflow: [
        { carrier: "int32", operation: "add", result: "int32", law: "wrap" },
        { carrier: "int64", operation: "increment", result: "int64", law: "wrap" },
      ],
    } } });
    assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
    const chapter = result.value.modules.find(row => row.module === input.snapshot.entryPoint);
    const selected = chapter.bodies.find(row => row.kind === "selected" && row.mir.blocks.some(block => block.terminator.kind === "check"));
    assert.ok(selected);
    const terms = result.value.index.types.terms;
    const indexed = sourceOccurrences(selected.tir, createAccount(limits));
    assert.equal(indexed.kind, "complete");
    const accesses = [...new Set(selected.mir.blocks.filter(block => block.terminator.kind === "check")
      .map(block => indexed.value.get(block.terminator.tir.node)))];
    const read = accesses.find(access => access.kind === "ElementAccessExpression" && access.tsonic.role === "value");
    assert.ok(read);
    assert.equal(read.tsonic.index.read, read.tsonic.type);
    assert.equal(read.tsonic.index.write, null);
    assert.deepEqual(terms[read.tsonic.type], { kind: "primitive", primitive: "int32" });
    const writes = accesses.filter(access => access.kind === "ElementAccessExpression" && access.tsonic.role === "assignment-target");
    assert.equal(writes.length, mode === "write" ? 2 : mode === "read-write" ? 1 : 0);
    for (const { tsonic } of writes) {
      assert.equal(tsonic.access.kind, mode);
      assert.equal(tsonic.access.storage, tsonic.index.write);
      assert.equal(tsonic.index.write, read.tsonic.type);
      assert.equal(tsonic.index.read, mode === "read-write" ? read.tsonic.type : null);
    }
    const [facts] = selected.facts;
    const branch = selected.tir.root.statements.nodes.find(row => row.kind === "ForStatement");
    assert.equal(facts.refinements.countedLoops.length, mode === "loop" || mode === "replace" ? 1 : 0);
    assert.deepEqual(facts.refinements.refinements, mode === "loop"
      ? [{ kind: "proven", node: read.id, guards: [branch.condition.id] }] : []);
  }
});

test("counted-loop facts bind the actual placed initializer, counter and checked array receiver", checkNativeCountedLoopProofs);
test("counted-loop facts use the actual saved array, not the source slot or a previous iteration", checkSavedExtentReceivers);
test("a selected field proof survives a read-only call and records the actual interfering write call", checkNativeFieldRefinement);
test("a placed captured field write preserves only the independently guarded cell", checkCapturedFieldRefinement);
test("the WT-10 walkthrough combines the counted range and ordered field checks", checkNativeRefinementWalkthrough);
test("a saved nullable local keeps the actual guarded producer even through a copied capture", checkSavedReferencePresence);
test("an explicitly declared nullable reference local gets its live value from the actual reaching writes", checkDeclaredNullableReferenceStorage);
test("actual placed captures do not lend the temporary holding a saved field value", checkSavedProjectionWithPlacedCaptures);
test("the actual WT-10 Body round returns its original refusal at every reached limit cut", async () => {
  const { loadFrontFixture } = await import("./fixtures/front/checked-module.mjs");
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = await nativeRefinementInput(await loadFrontFixture(), false);
  const reached = await checkActualBodyRoundCuts(() => assert.equal(analyzeHostProgram(input).kind, "ok"),
    round => round.tir.body.includes(";read];function;0]") && round.execution.provided === 3);
  assert.deepEqual(reached, [["Block", 3]]);
});

test("WT-10: a saved field argument keeps its projected Origins across evaluation of the next argument", async () => {
  const { loadFrontFixture } = await import("./fixtures/front/checked-module.mjs");
  const { analysisInput } = await import("./fixtures/front/analysis-input.mjs");
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(await loadFrontFixture(), "sdk-minimal", `
    type Part = { flag: boolean | undefined; other: boolean | undefined };
    type Box = { part: Part; counter: boolean };
    function prepare(box: Box): boolean { box.counter = true; return true; }
    function effect(part: Part, ignored: boolean): void { part.other = true; }
    export function read(box: Box): boolean {
      if (box.part.flag !== undefined) {
        box.part.other = (effect(box.part, prepare(box)), undefined);
        return box.part.flag;
      }
      return false;
    }
  `);
  const reached = await checkActualBodyRoundCuts(() => {
    const result = analyzeHostProgram(input);
    assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
    const chapter = result.value.modules.find(row => row.module === input.snapshot.entryPoint);
    const body = chapter.bodies.find(row => row.kind === "selected" && row.instance.body.includes(";read];function;0]"));
    const callBlock = name => body.mir.blocks.find(({ terminator }) => terminator.kind === "call"
      && terminator.callee.kind === "direct" && terminator.callee.resolution.activation.body.includes(`;${name}];function;0]`));
    const prepare = callBlock("prepare");
    const effect = callBlock("effect");
    assert.equal(prepare.terminator.next, effect.id);
    const [argument] = effect.terminator.arguments;
    assert.equal(argument.kind, "value");
    assert.equal(argument.passing, "by-value");
    assert.equal(argument.operand.kind, "place");
    const saved = argument.operand.place;
    const copies = body.mir.blocks.flatMap(block => block.statements.filter(row => row.kind === "assign" && row.place === saved));
    assert.equal(copies.length, 1);
    const [copy] = copies;
    assert.equal(prepare.statements.includes(copy), true);
    assert.equal(copy.value.kind, "use");
    assert.equal(copy.value.operand.kind, "place");
    const source = body.mir.places[copy.value.operand.place].base;
    assert.equal(source.kind, "place");
    assert.equal(source.projection.kind, "field");
    assert.equal(source.tir.node, copy.tir.node);
    const [facts] = body.facts;
    const reads = facts.origins.reads.filter(row => row.place === saved);
    assert.equal(reads.length, 1);
    const [read] = reads;
    assert.equal(read.node, copy.tir.node);
    const origins = facts.arena.origins[read.origins];
    assert.equal(origins.kind, "complete");
    assert.equal(origins.includesAbsence, false);
    assert.equal(origins.producers.length, 1);
    const bound = facts.arena.boundProducers[origins.producers[0]];
    const producer = facts.arena.producers[bound.producer];
    assert.equal(producer.kind, "parameter");
    assert.equal(producer.index, 0);
    const path = facts.arena.projections[producer.path];
    assert.equal(path.parent, null);
    assert.equal(path.projection.kind, "field");
    assert.equal(path.projection.member.decision.primary, source.projection.member.decision.primary);
    assert.equal(path.projection.member.decision.key.value, "part");
    const [refinement] = facts.refinements.refinements;
    assert.equal(facts.refinements.refinements.length, 1);
    assert.equal(refinement.kind, "proven");
    assert.equal(body.mir.blocks.some(({ terminator }) => terminator.kind === "check" && terminator.tir.node === refinement.node), true);
  }, round => round.tir.body.includes(";read];function;0]") && round.execution.provided === 1);
  assert.deepEqual(reached, [["Block", 1]]);
});

test("WT-10 retains the earlier local or formal argument when a later operand rebinds it", async () => {
  const { loadFrontFixture } = await import("./fixtures/front/checked-module.mjs");
  const { analysisInput } = await import("./fixtures/front/analysis-input.mjs");
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(await loadFrontFixture(), "sdk-minimal", `
    type Box = { flag: boolean };
    function choose(value: Box, enabled: boolean): boolean { return value.flag && enabled; }
    export function localCopy(first: Box, second: Box, enabled: boolean): boolean {
      let held: Box = first;
      return choose(held, (held = second, held.flag));
    }
    export function formalCopy(first: Box, second: Box, enabled: boolean): boolean {
      return choose(first, (first = second, enabled));
    }
  `);
  const reached = await checkActualBodyRoundCuts(() => {
    const result = analyzeHostProgram(input);
    assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
    const chapter = result.value.modules.find(row => row.module === input.snapshot.entryPoint);
    for (const [name, expectedRole, paths] of [["localCopy", "user", [["flag"], ["flag"]]],
      ["formalCopy", "parameter", [["flag"], []]]]) {
      const selected = chapter.bodies.find(row => row.kind === "selected" && row.instance.body.includes(`;${name}];function;0]`));
      const { mir, facts: [facts] } = selected;
      const selectedCall = mir.blocks.find(block => block.terminator.kind === "call" && block.terminator.callee.kind === "direct"
        && block.terminator.callee.resolution.activation.body.includes(";choose];function;0]"));
      const [earlier] = selectedCall.terminator.arguments;
      assert.equal(earlier.kind, "value", name);
      assert.equal(earlier.passing, "by-value", name);
      assert.equal(earlier.operand.kind, "place", name);
      const saved = mir.places[earlier.operand.place].base;
      assert.equal(saved.kind === "local" && mir.locals[saved.local].role.kind === "temporary", true, name);
      const copyAt = selectedCall.statements.findIndex(row => row.kind === "assign" && row.place === earlier.operand.place);
      const copy = selectedCall.statements[copyAt];
      assert.equal(copy?.value.kind, "use", name);
      assert.equal(copy.value.operand.kind, "place", name);
      const original = copy.value.operand.place;
      const base = mir.places[original].base;
      assert.equal(base.kind === "local" && mir.locals[base.local].role.kind === expectedRole, true, name);
      assert.equal(selectedCall.statements.findIndex(row => row.kind === "assign" && row.place === original) > copyAt, true, name);
      const read = facts.origins.reads.find(row => row.place === earlier.operand.place && row.node === copy.tir.node);
      const origins = facts.arena.origins[read.origins];
      assert.equal(origins.kind, "complete", name);
      assert.equal(origins.includesAbsence, false, name);
      assert.deepEqual(origins.producers.map(id => {
        const producer = facts.arena.producers[facts.arena.boundProducers[id].producer];
        return [producer.kind, producer.index, producer.path];
      }), [["parameter", 0, null]], name);
      const summary = result.value.index.summaries.find(row => row.key.kind === "body" && row.key.execution.instance.body === selected.instance.body);
      assert.deepEqual(summary.parameters.slice(0, 2).map(row => row.reads.paths.map(path =>
        summary.arena.projections[path].projection.member.decision.key.value)), paths, name);
    }
  }, round => /;(localCopy|formalCopy)\];function;0\]/u.test(round.tir.body) && round.execution.provided === 3);
  assert.deepEqual(reached, [["Block", 3], ["Block", 3]]);
});

test("a placed binding default retains the captured reference at its actual earlier argument read", async () => {
  const { loadFrontFixture } = await import("./fixtures/front/checked-module.mjs");
  const { analysisInput } = await import("./fixtures/front/analysis-input.mjs");
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(await loadFrontFixture(), "sdk-minimal", `
    type Box = { flag: boolean };
    function choose(value: Box, enabled: boolean): boolean { return value.flag && enabled; }
    export function read(first: Box, next: Box, input: { value?: boolean }): boolean {
      const { value = choose(first, (first = next, first.flag)) } = input;
      return value;
    }
  `);
  const reached = await checkActualBodyRoundCuts(() => {
    const result = analyzeHostProgram(input);
    assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
    const chapter = result.value.modules.find(row => row.module === input.snapshot.entryPoint);
    const caller = chapter.bodies.find(row => row.kind === "selected" && row.instance.body.includes(";read];function;0]"));
    const placement = caller.mir.blocks.find(row => row.terminator.kind === "call" && row.terminator.callee.kind === "body");
    assert.ok(placement);
    const placed = chapter.bodies.find(row => row.kind === "selected" && row.instance.body === placement.terminator.callee.instance.body);
    assert.ok(placed);
    const { mir, tir, facts: [facts] } = placed;
    const block = mir.blocks.find(row => row.terminator.kind === "call" && row.terminator.callee.kind === "direct"
      && row.terminator.callee.resolution.activation.body.includes(";choose];function;0]"));
    assert.ok(block);
    const [earlier] = block.terminator.arguments;
    assert.equal(earlier.kind, "value");
    assert.equal(earlier.operand.kind, "place");
    const base = mir.places[earlier.operand.place].base;
    assert.equal(base.kind === "local" && mir.locals[base.local].role.kind === "temporary", true);
    const copied = block.statements.find(row => row.kind === "assign" && row.place === earlier.operand.place);
    assert.equal(copied?.value.kind, "use");
    assert.equal(copied.value.operand.kind, "place");
    const capturedBase = mir.places[copied.value.operand.place].base;
    assert.equal(capturedBase.kind, "local");
    const captured = mir.locals[capturedBase.local];
    assert.equal(captured.role.kind, "capture");
    assert.equal(captured.mode, "captured-location");
    assert.deepEqual(captured.source, tir.captures[captured.role.index].local);
    const replacement = block.statements.find(row => row.kind === "assign" && row.place === copied.value.operand.place);
    assert.equal(block.statements.indexOf(replacement) > block.statements.indexOf(copied), true);
    assert.equal(replacement.value.kind, "use");
    assert.equal(replacement.value.operand.kind, "place");
    const replacementBase = mir.places[replacement.value.operand.place].base;
    assert.equal(replacementBase.kind, "local");
    const next = mir.locals[replacementBase.local];
    assert.equal(next.role.kind, "capture");
    assert.notEqual(next.role.index, captured.role.index);
    const read = facts.origins.reads.find(row => row.place === earlier.operand.place && row.node === copied.tir.node);
    const origins = facts.arena.origins[read.origins];
    assert.equal(origins.kind, "complete");
    assert.equal(origins.includesAbsence, false);
    assert.deepEqual(origins.producers.map(id => {
      const producer = facts.arena.producers[facts.arena.boundProducers[id].producer];
      return [producer.kind, producer.index, producer.path];
    }), [["capture", captured.role.index, null]]);
    const summary = result.value.index.summaries.find(row => row.key.kind === "body"
      && executionKey(row.key.execution) === executionKey(facts.execution));
    const cell = summary.arena.cells.find(row => row.role.kind === "capture" && row.role.index === captured.role.index);
    const write = summary.contentsOnReturn.find(row => row.target === cell.id);
    const returned = summary.arena.origins[write.value];
    assert.equal(returned.kind, "complete");
    assert.equal(returned.includesAbsence, false);
    assert.deepEqual(returned.producers.map(id => {
      const producer = summary.arena.producers[summary.arena.boundProducers[id].producer];
      return [producer.kind, producer.index, producer.path];
    }), [["capture", next.role.index, null]]);
  }, round => round.tir.body.includes(";read/value];initializer;0]") && round.execution.provided === 0);
  assert.deepEqual(reached, [["CallExpression", 0]]);
});

test("an actual native address loan is not a saved reference-copy destination", async () => {
  const { wt6 } = await import("./fixtures/lower-mir/programs/wt6.mjs");
  const { localReferenceCopies } = await import("../../packages/host/dist/analyses/body/projection-effects.js");
  const { InvocationAccount } = await import("../../packages/host/dist/dataflow/account.js");
  const program = wt6({ bounds: "unwind", absent: "unwind" }).orderFixedAliased;
  const { input: { mir } } = fixture(program);
  const check = mir.blocks.map(block => block.terminator).find(term => term.kind === "check" && term.tir.node === program.at("@target"));
  const call = mir.blocks.find(block => block.terminator.kind === "call" && block.terminator.tir.node === program.at("mutateFixed(a)"));
  const [loan] = call.terminator.arguments;
  assert.equal(loan.kind, "place");
  assert.equal(loan.passing, "byref-readwrite");
  assert.equal(mir.places[check.place].base.place, loan.place);
  const saved = mir.blocks.flatMap(block => block.statements).find(row => row.kind === "assign" && row.value.kind === "use"
    && row.value.operand.kind === "place" && row.value.operand.place === check.place);
  const borrowed = mir.places[loan.place].base.local;
  const temporary = mir.places[saved.place].base.local;
  assert.equal(mir.locals[borrowed].role.kind, "parameter");
  assert.equal(mir.locals[temporary].role.kind, "temporary");
  let reads = 0;
  const observed = { ...mir, blocks: mir.blocks.map(block => block !== call ? block : { ...call,
    terminator: { ...call.terminator, arguments: [{ ...loan, get place() { reads += 1; return loan.place; } }] } }) };
  const run = account => {
    const prior = accountFailure(account);
    const before = reads;
    const result = localReferenceCopies(observed, account);
    if (prior !== null) assert.equal(reads, before);
    return result.kind !== "complete" ? result : { kind: "complete", value: [result.value.has(borrowed), result.value.get(temporary) === saved] };
  };
  checkReachedProofCuts(InvocationAccount.stateOf, run, [false, true], "selected array location loan", () => assert.equal(reads, 1));
});

test("the actual optional field write transfers its selected absence at the original round limits", async () => {
  const { loadFrontFixture } = await import("./fixtures/front/checked-module.mjs");
  const { analysisInput } = await import("./fixtures/front/analysis-input.mjs");
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { pipelineWiring } = await import("../../packages/host/dist/pipeline/wiring.js");
  const { InvocationAccount } = await import("../../packages/host/dist/dataflow/account.js");
  const input = analysisInput(await loadFrontFixture(), "sdk-minimal", `
    export type Holder = { child: { flag: boolean } | null };
    export function clear(holder: Holder): void { holder.child = null; }
  `);
  const original = pipelineWiring.bodyAnalysis.analyzeBodyRound;
  let captured;
  try {
    pipelineWiring.bodyAnalysis.analyzeBodyRound = (deps, subject) => {
      if (subject.tir.root.kind === "Block" && subject.execution.provided === 1) captured = { deps, subject };
      return original(deps, subject);
    };
    const program = analyzeHostProgram(input);
    assert.equal(program.kind, "ok", JSON.stringify(program.diagnostics));
  } finally {
    pipelineWiring.bodyAnalysis.analyzeBodyRound = original;
  }
  assert.ok(captured);
  const replay = (account, subject = captured.subject) => original({ ...captured.deps, account }, subject);
  const ample = createAccount(limits);
  const expected = replay(ample);
  assert.equal(expected.kind, "complete");
  assert.equal(expected.value.kind, "ok");
  const { facts } = expected.value.value;
  const write = facts.origins.writes.find(row => row.destination === "member");
  assert.ok(write);
  const [stored] = write.values;
  assert.deepEqual(facts.arena.origins[stored.origins], { id: stored.origins, kind: "complete", producers: [], includesAbsence: true });
  const { work, entries } = InvocationAccount.stateOf(ample);
  assert.deepEqual(replay(createAccount({ maximumWork: work, maximumResultEntries: entries })), expected);
  const unread = new Proxy({}, { get() { assert.fail("No round input read after refusal."); } });
  for (const [dimension, maximumWork, maximumResultEntries] of [
    ["work", work - 1, entries], ["result-entries", work, entries - 1],
  ]) {
    const account = createAccount({ maximumWork, maximumResultEntries });
    const stop = replay(account);
    assert.equal(stop.kind, "resource-limit");
    assert.equal(stop.dimension, dimension);
    assert.equal(stop === accountFailure(account), true);
    assert.equal(replay(account, unread) === stop, true);
  }
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
    assert.equal(result.value.entry[entry.block].written.has(0), provided === 1, "omitted storage is not prematurely initialized at entry");
    assert.equal(result.value.entry[0].written.has(0), true, "the actual omission prologue assignment establishes initialization before the full body");
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
    assert.equal(assignedEntry(solved.value.entry, selected.block).written.has(captured.id), capture === "captured-value",
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
      { modules: [], entries: [current.execution], storage: [] }), /actual supplied cell and completion-event bindings/);
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
      current.related = [fixture(owner)];
      const pair = checkedPair(current, analyzeBodyRound({ ...current.deps, account: createAccount(limits) }, current.input));
      assert.deepEqual(pair.facts.arena.cells, []);
      assert.deepEqual(pair.summary.arena.contexts[0].captures, [{ index: 0, origins: pair.summary.result }]);
      assert.equal(pair.facts.initialization.reads[0].assigned, true);
      assert.equal(pair.summary.initialization.points.some(point => point.kind === "need"), false);
      assert.deepEqual(pair.summary.writes, []);
      const alias = { ...pair.facts, arena: { ...pair.facts.arena, cells: [{ id: 0, role: { kind: "capture", index: 0 },
        occurrence: { kind: "entry", execution: current.execution, local: captured.id }, lifetimes: [] }] } };
      const rejected = verifyFacts(alias, current.input.mir, current.factsContext, createAccount(limits));
      assert.equal(rejected.kind, "complete");
      assert.equal(rejected.violations.some(violation => violation.rule === "cell-role-resolves"
        && violation.detail[0]?.value === "A copied capture has no incoming caller cell."), true);
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
  assert.equal(cellMustAtExit({ account }, new Proxy([], { get() { assert.fail("No return-state input after original stop."); } }),
    new Set(), null), refusal);
});

test("a captured reference store retains its actual mutation, escape and distinct location target", () => {
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
  current.related = [fixture(owner)];
  const pair = checkedPair(current, analyzeBodyRound(current.deps, current.input));
  const write = pair.facts.origins.writes.find(row => row.operation === "mutation");
  const right = pair.facts.arena.contexts[0].captures[1].location;
  assert.equal(pair.facts.origins.escapes.some(row => row.producer === pair.facts.arena.boundProducers[right].producer
    && row.point.block === write.point.block && row.point.statement === write.point.statement
    && row.target.kind === "capture" && row.target.index === 0 && row.target.path === null), true);
  assert.equal(pair.summary.retention.some(row => row.source === right && row.into.kind === "capture" && row.into.index === 0), true);
  assert.equal(pair.summary.contentsOnReturn[0].value, write.values[0].origins);
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
  const [detector, completed] = result.value.positions;
  const read = current.input.tir.root.statements.nodes.at(-1).expression;
  const execution = executionKey(current.execution);
  assert.deepEqual(detector.position, { kind: "execution-source-node", execution, node: { body: current.input.tir.body, node: read.id } });
  assert.deepEqual(completed.position, { kind: "execution-result", execution });
  assert.equal(completed.error, result.value.value);
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

test("an actual escaping authored callee throw binds its value and retention to the caller's real argument and call point", () => {
  const targetName = "body-round.called-throw.target";
  const target = fixture(shaped(targetName, [["value", "required", T.string]], T.string,
    builder => builder.block(builder.throws(builder.id("value", 0, T.string)))));
  const summary = checkedPair(target, analyzeBodyRound(target.deps, target.input)).summary;
  const current = fixture(shaped("body-round.called-throw.caller", [["value", "required", T.string]], T.string, builder =>
    builder.block(builder.returns(builder.call(builder.global("target", targetName, T.unknown),
      [{ $: "argument", ...builder.id("value", 0, T.string) }], T.string, at => ({
        callee: callee(targetName, target.program.tir.signature, [mapped(0, 0)], T.string), receiver: null,
        arguments: [{ kind: "provided", parameter: 0, expression: at("argument") }],
      }))))));
  current.related = [target];
  current.deps.summaryOf = () => ({ value: summary, unit: { request: target.deps.unit, position: { kind: "result" } } });
  const pair = checkedPair(current, analyzeBodyRound(current.deps, current.input));
  const call = current.input.mir.blocks.find(row => row.terminator.kind === "call");
  const argument = pair.facts.arena.contexts[0].arguments[0].origins;
  assert.equal(pair.summary.returns, false);
  assert.equal(pair.summary.unwinds, true);
  assert.equal(pair.summary.thrown, argument);
  assert.equal(pair.summary.result, 0);
  assert.equal(pair.facts.origins.invocations[0].alternatives[0].thrown, argument);
  assert.deepEqual(pair.facts.origins.escapes, [{ point: { block: call.id, statement: null }, node: call.terminator.tir.node,
    producer: pair.facts.arena.boundProducers[pair.facts.arena.origins[argument].producers[0]].producer, target: { kind: "throw" } }]);
  assert.deepEqual(pair.summary.retention.map(row => ({ at: row.at, into: row.into })), [{
    at: { kind: "body", execution: current.execution, point: { block: call.id, statement: null }, edge: null }, into: { kind: "throw" },
  }]);
  assert.equal(pair.facts.origins.writes.some(row => row.point.block === call.id && row.destination === "binding"), false,
    "the non-returning call never initializes its normal destination");
  checkSignatureStops(current);
  for (const dimension of ["maximumWork", "maximumResultEntries"]) {
    let complete = false;
    for (let maximum = 0; maximum < 20000; maximum += 1) {
      const account = createAccount({ ...limits, [dimension]: maximum });
      const result = analyzeBodyRound({ ...current.deps, account }, current.input);
      if (result.kind === "complete") { checkedPair(current, result); complete = true; break; }
      assert.equal(result, accountFailure(account));
      assert.equal(analyzeBodyRound({ ...current.deps, account }, new Proxy({}, {
        get() { assert.fail("No reference throw binding or exit is read after its original stop."); },
      })), result);
    }
    assert.equal(complete, true);
  }
});

function referenceWriteProgram(name, incoming = false) {
  const childName = `${name}.b`;
  const childBody = bodyId(childName, "default-argument");
  const owner = incoming ? fixture(shaped(`${name}.owner`, [["a", "required", T.string], ["replacement", "required", T.string]], T.string,
    builder => builder.block(builder.returns(builder.id("a", 0, T.string))))) : null;
  const incomingCaptures = owner === null ? [] : [0, 1].map(local => ({ local: { body: owner.program.tir.body, local }, capture: "captured-location" }));
  const builder = builders(name);
  const program = typedBody(name, { signature: signature(name, [...(incoming ? [] : [["a", T.string], ["replacement", T.string]]),
    ["b", T.string, "default", childBody]], T.string), completion: T.string, captures: incomingCaptures,
    params: [...(incoming ? [] : [[0, "required", T.string], [1, "required", T.string]]), [2, "default", T.string, childBody]],
    locals: [["a", incoming ? "capture" : "parameter", T.string, true, incomingCaptures[0]?.local ?? null],
      ["replacement", incoming ? "capture" : "parameter", T.string, false, incomingCaptures[1]?.local ?? null], ["b", "parameter", T.string]],
    root: builder.block(builder.returns(builder.id("a", 0, T.string))) });
  const captures = incoming ? incomingCaptures : [0, 1].map(local => ({ local: { body: program.tir.body, local }, capture: "captured-location" }));
  const childBuilder = builders(childName, "default-argument");
  const expression = childBuilder.assign(childBuilder.target("a", 0, T.string), "EqualsToken",
    childBuilder.id("replacement", 1, T.string), T.string, T.string);
  const childProgram = typedBody(childName, { role: "default-argument", signature: signature(childName, [], T.string), completion: T.string,
    locals: [["a", "capture", T.string, true, captures[0].local], ["replacement", "capture", T.string, false, captures[1].local]],
    captures, root: expression });
  childProgram.tir.root = seal(childName, expression, "default-argument", program.nodeCount).root;
  childProgram.tir.root.parent = program.tir.params[incoming ? 0 : 2].id;
  program.tir.params[incoming ? 0 : 2].initializer = childProgram.tir.root;
  const bodies = [program.tir, childProgram.tir, ...(owner === null ? [] : [owner.program.tir])];
  const bodyOf = instance => bodies.find(tir => sameInstance(instance, { body: tir.body, bindings: tir.bindings })) ?? null;
  program.bodyOf = childProgram.bodyOf = bodyOf;
  const child = fixture(childProgram);
  const internal = [{ instance: { body: childBody, bindings: childProgram.tir.bindings }, captures, signature: childProgram.tir.signature }];
  const provided = fixture(program, internal, incoming ? 1 : 3);
  child.related = [provided, ...(owner === null ? [] : [owner])];
  const selected = checkedPair(child, analyzeBodyRound(child.deps, child.input));
  return { child, selected, program, internal, owner };
}

test("an actual placed reference write replaces current content and transports only a genuine incoming capture target", () => {
  for (const incoming of [false, true]) {
  const { child, selected, program, internal, owner } = referenceWriteProgram(`body-round.reference-capture-write.${incoming}`, incoming);
  const replacement = selected.summary.arena.contexts[0].captures.find(row => row.index === 1).location;
  const replacementOrigins = selected.summary.arena.origins.find(row => row.producers.length === 1 && row.producers[0] === replacement).id;
  assert.deepEqual(selected.summary.writes, [{ target: 0, value: replacementOrigins }]);
  assert.equal(selected.summary.retention.some(row => row.into.kind === "capture" && row.into.index === 0), true);
  for (const count of incoming ? [0, 1] : [2, 3]) {
    const current = fixture(program, internal, count);
    current.related = [child, ...(owner === null ? [] : [owner])];
    current.deps.summaryOf = () => ({ value: selected.summary, unit: { request: child.deps.unit, position: { kind: "result" } } });
    const pair = checkedPair(current, analyzeBodyRound(current.deps, current.input));
    const executed = count === (incoming ? 0 : 2);
    const source = incoming ? pair.summary.arena.contexts[0].captures[executed ? 1 : 0].location : null;
    const expected = incoming ? pair.summary.arena.origins.find(row => row.producers.length === 1 && row.producers[0] === source).id
      : pair.summary.arena.contexts[0].arguments[executed ? 1 : 0].origins;
    assert.equal(pair.summary.result, expected);
    assert.equal(pair.summary.retention.some(row => row.into.kind === "capture"), incoming && executed,
      "an internal parameter SLOT is not an externally retained parameter VALUE target");
    assert.equal(pair.summary.contentsOnReturn.length, incoming && executed ? 1 : 0);
    if (executed) {
      checkSignatureStops(current);
      for (const dimension of ["maximumWork", "maximumResultEntries"]) {
        let complete = false;
        for (let maximum = 0; maximum < 30000; maximum += 1) {
          const account = createAccount({ ...limits, [dimension]: maximum });
          const result = analyzeBodyRound({ ...current.deps, account }, current.input);
          if (result.kind === "complete") { checkedPair(current, result); complete = true; break; }
          assert.equal(result, accountFailure(account));
          const unread = new Proxy({}, { get() { assert.fail("No retained store, call binding or current cell after original stop."); } });
          assert.equal(analyzeBodyRound({ ...current.deps, account }, unread), result);
        }
        assert.equal(complete, true);
      }
    }
  }
  }
});

test("an actual both-exit callee keeps returned and thrown arguments distinct at the caller's real points", () => {
  for (const sameValue of [false, true]) {
    const targetName = `body-round.called-reference-exits.${sameValue}.target`;
    const parameters = [["flag", "required", T.bool], ["left", "required", T.string], ["right", "required", T.string]];
    const target = fixture(shaped(targetName, parameters, T.string, builder => builder.block(
      builder.ifElse(builder.id("flag", 0, T.bool), builder.block(builder.returns(builder.id("left", 1, T.string))),
        builder.block(builder.throws(builder.id(sameValue ? "left" : "right", sameValue ? 1 : 2, T.string)))))));
    const summary = checkedPair(target, analyzeBodyRound(target.deps, target.input)).summary;
    const current = fixture(shaped(`body-round.called-reference-exits.${sameValue}.caller`, parameters, T.string, builder =>
      builder.block(builder.returns(builder.call(builder.global("target", targetName, T.unknown),
        parameters.map(([name, , type], index) => ({ $: name, ...builder.id(name, index, type) })), T.string,
        at => ({ callee: callee(targetName, target.program.tir.signature, parameters.map((_, index) => mapped(index, index)), T.string),
          receiver: null, arguments: parameters.map(([name], index) => ({ kind: "provided", parameter: index, expression: at(name) })) }))))));
    current.related = [target];
    current.deps.summaryOf = () => ({ value: summary, unit: { request: target.deps.unit, position: { kind: "result" } } });
    const pair = checkedPair(current, analyzeBodyRound(current.deps, current.input));
    const call = pair.facts.origins.invocations[0];
    const arguments_ = pair.facts.arena.contexts[0].arguments.map(slot => slot.origins);
    const thrown = arguments_[sameValue ? 1 : 2];
    assert.equal(pair.summary.returns && pair.summary.unwinds, true);
    assert.equal(pair.summary.result, arguments_[1]);
    assert.equal(pair.summary.thrown, thrown);
    assert.equal(call.alternatives[0].result, arguments_[1]);
    assert.equal(call.alternatives[0].thrown, thrown);
    assert.deepEqual(pair.facts.origins.escapes.map(row => ({ target: row.target.kind, point: row.point,
      producer: row.producer })), [{ target: "throw", point: call.point, producer: sameValue ? 1 : 2 },
      { target: "return", point: { block: current.input.mir.blocks.find(row => row.terminator.kind === "return").id,
        statement: null }, producer: 1 }]);
    assert.deepEqual(pair.summary.retention.map(row => [row.source, row.into.kind]),
      sameValue ? [[0, "throw"], [0, "return"]] : [[0, "return"], [1, "throw"]]);
  }
});

test("reference cell contents union actual finite exits and omit an entry value only after every exit is collected", () => {
  const outer = fixture(shaped("body-round.reference-state.outer", [["a", "required", T.string], ["replacement", "required", T.string]], T.string,
    builder => builder.block(builder.returns(builder.id("a", 0, T.string)))));
  for (const mode of ["branch", "normal", "unwind", "restore"]) {
    const name = `body-round.reference-state.${mode}`;
    const builder = builders(name);
    const captures = [0, 1].map(local => ({ local: { body: outer.program.tir.body, local }, capture: "captured-location" }));
    const write = (target, index, source, from) => builder.expressionStatement(builder.assign(builder.target(target, index, T.string),
      "EqualsToken", builder.id(source, from, T.string), T.string, T.string));
    const root = mode === "restore" ? builder.block(builder.declare([builder.variable(builder.declName("saved", 3), 3, T.string)]),
      write("saved", 3, "a", 1), write("a", 1, "replacement", 2), write("a", 1, "saved", 3), builder.returns(builder.id("replacement", 2, T.string)))
      : builder.block(builder.ifElse(builder.id("flag", 0, T.bool), builder.block(...(mode === "unwind" ? [] : [write("a", 1, "replacement", 2)]),
        builder.returns(builder.id("a", 1, T.string))), builder.block(...(mode === "unwind" ? [write("a", 1, "replacement", 2)] : []),
        mode === "branch" ? builder.returns(builder.id("a", 1, T.string)) : builder.throws(builder.id("a", 1, T.string)))));
    const program = typedBody(name, { signature: signature(name, [["flag", T.bool]], T.string), completion: T.string,
      params: [[0, "required", T.bool]], captures, locals: [["flag", "parameter", T.bool],
        ["a", "capture", T.string, true, captures[0].local], ["replacement", "capture", T.string, false, captures[1].local],
        ...(mode === "restore" ? [["saved", "binding", T.string, true]] : [])], root });
    program.bodyOf = instance => sameInstance(instance, outer.execution.instance) ? outer.program.tir : null;
    const current = fixture(program);
    current.related = [outer];
    const pair = checkedPair(current, analyzeBodyRound(current.deps, current.input));
    const entry = pair.facts.arena.contexts[0].captures.map(row => row.location);
    const content = rows => rows.map(row => [row.target, pair.facts.arena.origins[row.value].producers]);
    assert.deepEqual(content(pair.summary.writes), [[0, mode === "restore" ? entry : [entry[1]]]]);
    assert.deepEqual(content(pair.summary.contentsOnReturn), mode === "restore" || mode === "unwind" ? []
      : [[0, mode === "branch" ? entry : [entry[1]]]]);
    assert.deepEqual(content(pair.summary.contentsOnUnwind), mode === "unwind" ? [[0, [entry[1]]]] : []);
    assert.equal(pair.facts.origins.escapes.filter(row => row.target.kind === "capture").length, mode === "restore" ? 2 : 1);
    if (mode === "restore") for (const dimension of ["maximumWork", "maximumResultEntries"]) {
      let complete = false;
      for (let maximum = 0; maximum < 20000; maximum += 1) {
        const account = createAccount({ ...limits, [dimension]: maximum });
        const result = analyzeBodyRound({ ...current.deps, account }, current.input);
        if (result.kind === "complete") { checkedPair(current, result); complete = true; break; }
        assert.equal(result, accountFailure(account));
      }
      assert.equal(complete, true);
    }
  }
});

test("two real placed reference writes union may history while the last normal content replaces the earlier value", () => {
  const name = "body-round.reference-write-history";
  const builder = builders(name);
  const defaults = ["b", "c"].map(parameter => ({ name: `${name}.${parameter}`, body: bodyId(`${name}.${parameter}`, "default-argument") }));
  const program = typedBody(name, { signature: signature(name, [["a", T.string], ["first", T.string], ["second", T.string],
    ...defaults.map((row, index) => [index === 0 ? "b" : "c", T.string, "default", row.body])], T.string), completion: T.string,
    params: [[0, "required", T.string], [1, "required", T.string], [2, "required", T.string],
      ...defaults.map((row, index) => [index + 3, "default", T.string, row.body])],
    locals: [["a", "parameter", T.string, true], ["first", "parameter", T.string], ["second", "parameter", T.string],
      ["b", "parameter", T.string], ["c", "parameter", T.string]], root: builder.block(builder.returns(builder.id("a", 0, T.string))) });
  let next = program.nodeCount;
  const children = defaults.map((row, index) => {
    const child = builders(row.name, "default-argument");
    const captures = [0, index + 1].map(local => ({ local: { body: program.tir.body, local }, capture: "captured-location" }));
    const expression = () => child.assign(child.target("a", 0, T.string), "EqualsToken", child.id("source", 1, T.string), T.string, T.string);
    const result = typedBody(row.name, { role: "default-argument", signature: signature(row.name, [], T.string), completion: T.string,
      locals: [["a", "capture", T.string, true, captures[0].local], ["source", "capture", T.string, false, captures[1].local]], captures, root: expression() });
    const sealed = seal(row.name, expression(), "default-argument", next);
    next = sealed.count;
    result.tir.root = sealed.root;
    result.tir.root.parent = program.tir.params[index + 3].id;
    program.tir.params[index + 3].initializer = result.tir.root;
    return result;
  });
  const bodies = [program.tir, ...children.map(row => row.tir)];
  const bodyOf = instance => bodies.find(body => sameInstance(instance, { body: body.body, bindings: body.bindings })) ?? null;
  program.bodyOf = bodyOf;
  for (const child of children) child.bodyOf = bodyOf;
  const internal = children.map(child => ({ instance: { body: child.tir.body, bindings: child.tir.bindings }, signature: child.tir.signature,
    captures: child.tir.captures }));
  const current = fixture(program, internal, 3);
  const ready = children.map(child => fixture(child));
  const summaries = ready.map(child => {
    child.related = [current];
    return checkedPair(child, analyzeBodyRound(child.deps, child.input)).summary;
  });
  current.related = ready;
  current.deps.summaryOf = key => {
    const index = ready.findIndex(child => sameInstance(child.execution.instance, key.execution.instance));
    return { value: summaries[index], unit: { request: ready[index].deps.unit, position: { kind: "result" } } };
  };
  const pair = checkedPair(current, analyzeBodyRound(current.deps, current.input));
  assert.equal(pair.summary.result, pair.facts.arena.contexts[0].arguments[2].origins);
  assert.deepEqual(pair.facts.arena.origins[pair.facts.origins.exitContents.onReturn[0].value].producers, [2]);
  assert.equal(pair.summary.writes.length, 0, "only actual incoming captured cells are exported as external histories");
  for (const dimension of ["maximumWork", "maximumResultEntries"]) {
    let complete = false;
    for (let maximum = 0; maximum < 30000; maximum += 1) {
      const account = createAccount({ ...limits, [dimension]: maximum });
      const result = analyzeBodyRound({ ...current.deps, account }, current.input);
      if (result.kind === "complete") { checkedPair(current, result); complete = true; break; }
      assert.equal(result, accountFailure(account));
    }
    assert.equal(complete, true);
  }
});

for (const mode of ["supplied", "omitted", "shadow", "null"]) {
  test(`verified optional Boolean calls keep ${mode} distinct through conversion and applied Origins`, async () => {
    const { checkOptionalDefault } = await import("./fixtures/optional-default.mjs");
    await checkOptionalDefault(mode);
  });
}

test("authored native scalar array effects retain the checked parameter and reached element", async () => {
  const { loadFrontFixture } = await import("./fixtures/front/checked-module.mjs");
  const { analysisInput } = await import("./fixtures/front/analysis-input.mjs");
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { parseModuleBodies, printModuleBodies } = await import("../../packages/host/dist/ir-program/index.js");
  const fixture = await loadFrontFixture();
  const source = `
    function key() { return 0; }
    function next(value: number): number { return value; }
    function take(values: number[]): number[] { return values; }
    export function exchange(values: boolean[], value: boolean): boolean {
      const alias = values;
      alias[0] = value;
      return values[1];
    }
    export function compound(values: number[], value: number): number {
      values[key()] += next(value);
      return values[1];
    }
    export function guarded(values: boolean[], value: boolean): boolean {
      try { values[0] = value; } catch { return false; }
      return true;
    }
    export function evaluated(values: number[], value: number): number {
      take(values)[key()] = next(value);
      return values[1];
    }
    function edit(values: number[], value: number): void {
      values[0] = value;
      values[key()] += value;
    }
    export function forwarded(ignored: number[], values: number[], value: number): number {
      edit(values, value);
      return value;
    }
  `;
  const stock = fixture.bundled().filter(library => library.name === "lib.es5.d.ts"
    || library.name === "lib.decorators.d.ts" || library.name === "lib.decorators.legacy.d.ts");
  const defaults = analysisInput(fixture, "sdk-minimal", source);
  const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": source }, libraries: stock });
  for (const arrayIndexFailure of ["unwind", "abort"]) {
    const result = analyzeHostProgram({ ...defaults, snapshot: { ...snapshot, nativeFacts: { ...snapshot.nativeFacts, arrayIndexFailure } } });
    assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
    const { index, modules } = result.value;
    const chapter = modules.find(row => row.module === snapshot.entryPoint);
    const text = printModuleBodies(index, chapter);
    assert.deepEqual(parseModuleBodies(index, text).kind, "parsed");
    const missingHolding = text.replace('holding="by-reference", ', "");
    assert.notEqual(missingHolding, text);
    assert.notEqual(parseModuleBodies(index, missingHolding).kind, "parsed");
    const selected = name => {
      const declaration = chapter.tree.root.statements.nodes.find(row => row.kind === "ready-callable" && row.node.name.text === name);
      return chapter.bodies.find(row => row.kind === "selected" && row.instance.body === declaration.node.tsonic.signatures[0].body);
    };
    const summaryOf = body => index.summaries.find(row => row.key.kind === "body" && row.key.execution.instance.body === body.instance.body);
    for (const name of ["exchange", "compound"]) {
      const body = selected(name);
      const [facts] = body.facts;
      const [target, returned] = facts.arena.projections;
      assert.deepEqual(target.projection, name === "exchange" ? { kind: "index", constant: 0n } : { kind: "element" });
      assert.deepEqual(returned.projection, { kind: "index", constant: 1n });
      assert.equal(facts.arena.projections.length, 2);
      const [owned] = facts.arena.producers.filter(row => row.kind === "parameter");
      assert.equal(owned.index, 0);
      const receiver = facts.arena.boundProducers.find(row => row.producer === owned.id);
      const writes = facts.origins.writes.filter(row => row.destination === "element");
      assert.equal(writes.length, 1);
      const [written] = writes;
      assert.deepEqual(written.targets, [receiver.id]);
      const statement = body.tir.root.statements.nodes.find(row => row.kind === "ExpressionStatement");
      assert.equal(written.node, statement.expression.id);
      const store = body.mir.blocks[written.point.block].statements[written.point.statement];
      assert.equal(store.kind, "assign");
      assert.equal(store.tir.node, written.node);
      const summary = summaryOf(body);
      assert.equal(summary.returns, true);
      assert.equal(summary.unwinds, arrayIndexFailure === "unwind");
      const [scope] = summary.parameters;
      assert.deepEqual(scope.slot, { kind: "parameter", index: 0 });
      assert.deepEqual(scope.reads, { kind: "complete", paths: name === "exchange" ? [returned.id] : [target.id, returned.id] });
      assert.deepEqual(scope.writes, { kind: "complete", paths: [target.id] });
    }
    const guarded = selected("guarded");
    const check = guarded.mir.blocks.find(block => block.terminator.kind === "check").terminator;
    const [write] = guarded.facts[0].origins.writes.filter(row => row.destination === "element");
    assert.equal(write.point.block, check.next);
    assert.equal(check.unwind.kind, arrayIndexFailure === "unwind" ? "handler" : "abort");
    if (check.unwind.kind === "handler") assert.notEqual(check.unwind.target, write.point.block);
    assert.equal(summaryOf(guarded).returns, true);
    assert.equal(summaryOf(guarded).unwinds, false);

    const evaluated = selected("evaluated");
    const assignment = evaluated.tir.root.statements.nodes[0].expression;
    const sequence = [];
    let block = evaluated.mir.blocks[evaluated.mir.entries[0].block];
    while (block !== undefined) {
      assert.ok(sequence.length < evaluated.mir.blocks.length);
      sequence.push(block.terminator);
      block = block.terminator.kind === "return" ? undefined : evaluated.mir.blocks[block.terminator.next];
    }
    const calls = sequence.filter(row => row.kind === "call");
    assert.deepEqual(calls.map(row => row.tir.node), [assignment.left.expression.id, assignment.left.argumentExpression.id, assignment.right.id]);
    const storeChecks = sequence.filter(row => row.kind === "check" && row.tir.node === assignment.left.id);
    assert.equal(storeChecks.length, 2);
    assert.equal(storeChecks[0].place, storeChecks[1].place);
    const location = evaluated.mir.places[storeChecks[0].place];
    assert.equal(location.base.place, calls[0].destination);
    const [effect, returned] = evaluated.facts[0].arena.projections;
    assert.deepEqual(effect.projection, { kind: "element" });
    assert.deepEqual(returned.projection, { kind: "index", constant: 1n });
    const [formalEffect] = summaryOf(evaluated).parameters;
    assert.deepEqual(formalEffect.writes, { kind: "complete", paths: [effect.id] });

    const forwarded = selected("forwarded");
    const summary = summaryOf(forwarded);
    const [ignored, affected] = summary.parameters;
    assert.deepEqual(ignored.writes, { kind: "complete", paths: [] });
    assert.deepEqual(ignored.reads, { kind: "complete", paths: [] });
    assert.deepEqual(affected.slot, { kind: "parameter", index: 1 });
    assert.equal(affected.reads.kind, "complete");
    assert.equal(affected.writes.kind, "complete");
    assert.deepEqual(affected.reads.paths.map(id => summary.arena.projections[id].projection), [{ kind: "element" }]);
    const contributions = affected.writes.paths.map(id => summary.arena.projections[id].projection);
    assert.equal(contributions.length, 2);
    assert.deepEqual(contributions.find(path => path.kind === "index"), { kind: "index", constant: 0n });
    assert.deepEqual(contributions.find(path => path.kind === "element"), { kind: "element" });
    assert.equal(forwarded.facts[0].origins.writes.some(row => row.destination === "element"), false);
  }
});

test("a selected reference-held fixed array transports its actual read and write effects across a call", async () => {
  const { InvocationAccount } = await import("../../packages/host/dist/dataflow/account.js");
  const facts = nativeFactsFixture({ fixedArrayHolding: "by-reference" });
  const targetName = "body-round.fixed-reference-effects.target";
  const callerName = "body-round.fixed-reference-effects.caller";
  const parameters = [["values", "required", T.int32Fixed4], ["position", "required", T.int32]];
  const targetProgram = shaped(targetName, parameters, T.int32, builder => {
    const element = (access, index) => builder.element(builder.id("values", 0, T.int32Fixed4), index,
      nativeIndex(T.int32Fixed4, T.int32, access, facts.fixedArrayIndexFailure, facts));
    return builder.block(
      builder.expressionStatement(builder.assign(element("write", builder.num("0", T.int32)), "EqualsToken",
        builder.num("5", T.int32), T.int32, T.int32)),
      builder.returns(element("read", builder.id("position", 1, T.int32))));
  });
  targetProgram.nativeFacts = facts;
  const target = fixture(targetProgram);
  const targetSummary = checkedPair(target, analyzeBodyRound(target.deps, target.input)).summary;
  const calleeDecision = callee(targetName, targetProgram.tir.signature, [mapped(0, 0), mapped(1, 1)], T.int32);
  const callerProgram = shaped(callerName, parameters, T.int32, builder => builder.block(builder.returns(builder.call(
    builder.global("target", targetName, T.unknown),
    [{ $: "values", ...builder.id("values", 0, T.int32Fixed4) }, { $: "position", ...builder.id("position", 1, T.int32) }],
    T.int32, at => ({ callee: calleeDecision, receiver: null, arguments: [
      { kind: "provided", parameter: 0, expression: at("values") }, { kind: "provided", parameter: 1, expression: at("position") },
    ] })))));
  callerProgram.nativeFacts = facts;
  callerProgram.bodyOf = instance => sameInstance(instance, target.execution.instance) ? target.program.tir : null;
  const caller = fixture(callerProgram);
  caller.related = [target];
  caller.deps.summaryOf = key => {
    assert.equal(executionKey(key.execution), executionKey(target.execution));
    return { value: targetSummary, unit: { request: target.deps.unit, position: { kind: "result" } } };
  };
  const pair = checkedPair(caller, analyzeBodyRound(caller.deps, caller.input));
  for (const summary of [targetSummary, pair.summary]) {
    const [carrier, scalar] = summary.parameters;
    assert.equal(carrier.reads.kind, "complete");
    assert.equal(carrier.writes.kind, "complete");
    assert.deepEqual(carrier.reads.paths.map(id => summary.arena.projections[id].projection), [{ kind: "element" }]);
    assert.deepEqual(carrier.writes.paths.map(id => summary.arena.projections[id].projection), [{ kind: "index", constant: 0n }]);
    assert.deepEqual(scalar.writes, { kind: "complete", paths: [] });
  }
  const call = caller.input.mir.blocks.find(row => row.terminator.kind === "call");
  assert.equal(call.terminator.arguments[0].passing, "by-value");
  assert.deepEqual(pair.facts.origins.invocations[0].point, { block: call.id, statement: null });
  checkSignatureStops(caller);
  const expectedFacts = printFacts(pair.facts);
  const expectedSummary = printSummary(pair.summary);
  const run = account => {
    const answer = analyzeBodyRound({ ...caller.deps, account }, caller.input);
    if (answer.kind !== "complete") return answer;
    assert.equal(answer.value.kind, "ok");
    return { kind: "complete", value: printFacts(answer.value.value.facts) === expectedFacts
      && printSummary(answer.value.value.summary) === expectedSummary };
  };
  checkReachedProofCuts(InvocationAccount.stateOf, run, true, callerName);
});

test("repeated scalar field reads share a projection but retain separate read occurrences", async () => {
  const { loadFrontFixture } = await import("./fixtures/front/checked-module.mjs");
  const { analysisInput } = await import("./fixtures/front/analysis-input.mjs");
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(await loadFrontFixture(), "sdk-minimal", `export type Box = { flag: boolean; };
    export function read(box: Box): boolean { box.flag; return box.flag; }`);
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  const module = result.value.modules.find(row => row.module === input.snapshot.entryPoint);
  const body = module.bodies.find(row => row.kind === "selected" && row.tir.params.length === 1);
  const places = body.mir.places.filter(row => row.base.kind === "place" && row.base.projection.kind === "field");
  assert.equal(places.length, 2);
  assert.notEqual(places[0].base.tir.node, places[1].base.tir.node);
  const summary = result.value.index.summaries.find(row => row.key.kind === "body" && row.key.execution.instance.body === body.instance.body);
  assert.deepEqual(summary.parameters[0].reads, { kind: "complete", paths: [0] });
  assert.deepEqual(summary.parameters[0].writes, { kind: "complete", paths: [] });
  assert.equal(summary.arena.projections.length, 1);
  assert.equal(summary.arena.projections[0].projection.member.decision.primary, places[0].base.projection.member.decision.primary);
  const reads = body.facts[0].origins.reads.filter(row => places.some(place => place.id === row.place));
  assert.equal(reads.length, 2);
  assert.equal(reads.every(row => body.facts[0].arena.origins[row.origins].producers.length === 0), true);
});

test("an optional reference default retains only the actual fallback or supplied actor and never retains absence", async () => {
  const { checkOptionalReferenceDefault } = await import("./fixtures/optional-reference-default.mjs");
  await checkOptionalReferenceDefault();
});

test("an optional string without a default starts its omitted entry with native absence and only retains a supplied reference", async () => {
  const { checkOptionalReferenceNoInitializer } = await import("./fixtures/optional-no-initializer.mjs");
  await checkOptionalReferenceNoInitializer();
});

test("a module static destination is written only by a returning placed initializer", async () => {
  const { analyzeOptionalSource } = await import("./fixtures/optional-default.mjs");
  const { pipelineWiring } = await import("../../packages/host/dist/pipeline/wiring.js");
  const { bindInitialization, summaryKey } = await import("../../packages/host/dist/ir-facts/index.js");
  const { conditionRefusal } = await import("./fixtures/facts-verification.mjs");
  const { InvocationAccount } = await import("../../packages/host/dist/dataflow/account.js");
  const { decodeDefId } = await import("../../packages/host/dist/ids/index.js");
  const converge = pipelineWiring.summaries.convergeComponent;
  let observed;
  pipelineWiring.summaries.convergeComponent = (deps, input) => {
    const outcome = converge(deps, input);
    const member = input.members[0];
    if (member.tir.root.kind === "SourceFile" && member.mir.places.some(place => place.base.kind === "static")) {
      assert.equal(outcome.kind, "complete");
      const value = outcome.value[0].result;
      assert.equal(value.kind, "ok");
      observed = { member, ...value.value, environment: deps.environment, outside: input.outside };
    }
    return outcome;
  };
  const read = key => {
    const selected = observed.outside.find(row => summaryKey(row.key) === summaryKey(key));
    assert.ok(selected);
    return selected.answer;
  };
  const invoke = (account, mir = observed.member.mir) => analyzeBodyRound({ ...observed.environment, account,
    unit: observed.member.unit, summaryOf: read }, { ...observed.member, mir, liveness: observed.facts.liveness });
  const bind = summary => {
    const cells = summary.initialization.cells.map(index => ({ kind: "cell", index }));
    const answer = bindInitialization({ caller: summary.arena, events: [],
      application: { owner: { kind: "summary", key: summary.key }, arena: summary.arena, table: summary.initialization,
        binding: { cells, events: [] } } }, { account: createAccount(limits), eventCount: 0, refusal: conditionRefusal,
      maximumConditionAlternatives: analysisLimits.maximumConditionAlternatives });
    assert.equal(answer.kind, "complete");
    return answer.value;
  };
  const exerciseCuts = () => {
    const complete = createAccount(limits);
    assert.equal(invoke(complete).kind, "complete");
    const { work, entries } = InvocationAccount.stateOf(complete);
    for (const [dimension, needed] of [["work", work], ["result-entries", entries]]) {
      for (let maximum = 0; maximum < needed; maximum += 1) {
        const account = createAccount({ maximumWork: dimension === "work" ? maximum : work,
          maximumResultEntries: dimension === "result-entries" ? maximum : entries });
        const refused = invoke(account);
        assert.equal(refused.kind, "resource-limit", dimension);
        assert.equal(refused.dimension, dimension);
        assert.equal(refused, accountFailure(account));
      }
    }
    const exact = createAccount({ maximumWork: work, maximumResultEntries: entries });
    assert.equal(invoke(exact).kind, "complete");
  };
  try {
    for (const returns of [true, false]) {
      observed = undefined;
      const source = returns ? "export const selected: boolean = true;"
        : "export function fail(value: boolean): boolean { throw value; } export const selected: boolean = fail(true);";
      assert.equal((await analyzeOptionalSource(source)).kind, "ok");
      assert.ok(observed);
      const { member, facts, summary } = observed;
      const [cell] = facts.arena.cells;
      assert.equal(facts.arena.cells.length, 1);
      assert.deepEqual(summary.arena.cells, [cell]);
      const call = member.mir.blocks.find(({ terminator }) => terminator.kind === "call"
        && terminator.destination !== null && member.mir.places[terminator.destination].base.kind === "static").terminator;
      const place = member.mir.places[call.destination];
      assert.deepEqual(cell.role, { kind: "static", declaration: { definition: place.base.definition, bindings: member.mir.bindings } });
      assert.deepEqual(cell.occurrence, { kind: "declared", at: { kind: "node", node: { kind: "item",
        value: { owner: place.base.definition, node: call.tir.node } } } });
      assert.deepEqual(summary.initialization.cells, [cell.id]);
      assert.equal(summary.returns, returns);
      assert.equal(summary.unwinds, !returns);
      assert.deepEqual(summary.initialization.points, [{ kind: returns ? "return" : "unwind" }]);
      const noValue = { target: cell.id, value: 0 };
      assert.deepEqual(summary.writes, returns ? [noValue] : []);
      assert.deepEqual(summary.contentsOnReturn, returns ? [noValue] : []);
      assert.deepEqual(summary.contentsOnUnwind, []);
      assert.deepEqual(summary.initialization.rows, returns ? [
        { point: 0, cell: null, condition: 0 }, { point: 0, cell: cell.id, condition: 1 },
      ] : [{ point: 0, cell: null, condition: 0 }]);
      const point = { kind: returns ? "return" : "unwind" };
      assert.deepEqual(bind(summary), returns ? [
        { point, cell: null, condition: { alternatives: [] } },
        { point, cell: { kind: "cell", index: cell.id }, condition: { alternatives: [[]] } },
      ] : [{ point, cell: null, condition: { alternatives: [] } }]);
      if (!returns) continue;
      exerciseCuts();
      const mismatched = { ...member.mir, places: member.mir.places.map(entry =>
        entry !== place ? entry : { ...entry, base: { kind: "static", definition: member.tir.owner } }) };
      assert.throws(() => invoke(createAccount(limits), mismatched), /actual declaration, storage and placed initializer/);
      const unchecked = { ...member.mir, places: [...member.mir.places, { ...place, id: member.mir.places.length }] };
      assert.throws(() => invoke(createAccount(limits), unchecked), /static-cell association/);
      const projected = { ...member.mir, places: [...member.mir.places, { ...place, id: member.mir.places.length,
        base: { kind: "checked", place: place.id, projection: { kind: "deref" }, tir: call.tir } }] };
      assert.throws(() => invoke(createAccount(limits), projected), /projection or static-cell producer/);
      const followedProjection = { ...projected, blocks: projected.blocks.map(block => block.terminator !== call ? block
        : { ...block, terminator: { ...call, destination: projected.places.length - 1 } }) };
      assert.throws(() => solveAssigned({ ...observed.environment, summaryOf: read, unit: member.unit, account: createAccount(limits) },
        { ...member, mir: followedProjection }), /actual selected logical-cell binding/);
      const unrelatedLocal = { ...unchecked, places: unchecked.places.map(entry => entry !== place ? entry
        : { ...entry, base: { kind: "local", local: 0 } }) };
      assert.throws(() => invoke(createAccount(limits), unrelatedLocal), /static-cell association/);
      const nonScalar = { ...observed.environment, typeOf: type => type === place.storage ? { kind: "string" }
        : observed.environment.typeOf(type) };
      assert.throws(() => analyzeBodyRound({ ...nonScalar, account: createAccount(limits), unit: member.unit, summaryOf: read },
        { ...member, liveness: facts.liveness }), /non-scalar static content and retention producer/);
    }
    observed = undefined;
    assert.equal((await analyzeOptionalSource("export function fail(value: boolean): boolean { throw value; } "
      + "export const z: boolean = true; export const a: boolean = fail(false); export const m: boolean = true;")).kind, "ok");
    assert.ok(observed);
    const { summary } = observed;
    const cells = summary.arena.cells;
    assert.equal(cells.length, 3);
    assert.deepEqual(cells.map(cell => decodeDefId(cell.role.declaration.definition).value.segments.at(-1).name), ["a", "m", "z"]);
    assert.equal(summary.returns, false);
    assert.equal(summary.unwinds, true);
    assert.deepEqual(summary.writes, [{ target: 2, value: 0 }]);
    assert.deepEqual(summary.contentsOnReturn, []);
    assert.deepEqual(summary.contentsOnUnwind, [{ target: 2, value: 0 }]);
    assert.deepEqual(summary.initialization.points, [{ kind: "unwind" }]);
    assert.deepEqual(summary.initialization.rows, [{ point: 0, cell: null, condition: 0 }, { point: 0, cell: 2, condition: 1 }]);
    assert.deepEqual(bind(summary).filter(row => row.cell !== null).map(row => row.cell.index), [2]);
    exerciseCuts();
    observed = undefined;
    assert.equal((await analyzeOptionalSource("export let selected: boolean | undefined;")).kind, "ok");
    assert.ok(observed);
    assert.deepEqual(observed.summary.initialization.cells, [0]);
    assert.deepEqual(observed.summary.contentsOnReturn.map(row => row.target), [0]);
    const absence = observed.summary.arena.origins[observed.summary.contentsOnReturn[0].value];
    assert.deepEqual(absence, { id: absence.id, kind: "complete", producers: [], includesAbsence: true });
    assert.deepEqual(observed.summary.initialization.rows, [
      { point: 0, cell: null, condition: 0 }, { point: 0, cell: 0, condition: 1 },
    ]);
    exerciseCuts();
  } finally { pipelineWiring.summaries.convergeComponent = converge; }
});

test("ready enum constants retain their own scalar carrier while two layouts keep independent geometry", async () => {
  const { loadFrontFixture } = await import("./fixtures/front/checked-module.mjs");
  const { layoutInput } = await import("./fixtures/front/layout-input.mjs");
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { pipelineWiring } = await import("../../packages/host/dist/pipeline/wiring.js");
  const { InvocationAccount } = await import("../../packages/host/dist/dataflow/account.js");
  const { create } = layoutInput(await loadFrontFixture());
  const fixture = create(`export enum Width { Word = 8, Padded = 16 }
    const first = make<boolean>({ datalayout: Abi, bytealignment: 8, fields: [], bytesize: 8, stride: 8 });
    const second = make<boolean>({ datalayout: Abi, bytealignment: 8, fields: [], bytesize: 16, stride: 16 });
    export const small = measure(first); export const large = measure(second); export const enumValue = Width.Padded;`);
  const original = pipelineWiring.bodyAnalysis.analyzeBodyRound;
  let observed;
  let result;
  try {
    pipelineWiring.bodyAnalysis.analyzeBodyRound = (deps, input) => {
      const constant = input.mir.constants.find(row => row.value.kind === "constant" && row.value.reference.context === "enum-member");
      if (constant !== undefined) observed = { deps, input, constant };
      return original(deps, input);
    };
    result = analyzeHostProgram(fixture);
  } finally { pipelineWiring.bodyAnalysis.analyzeBodyRound = original; }
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  assert.ok(observed);
  const { index, modules } = result.value;
  const layouts = index.metadata.filter(row => row.kind === "memory-layout");
  assert.equal(layouts.length, 2);
  const geometry = layouts.map(row => row.layouts[row.root]);
  assert.equal(geometry[0].source, geometry[1].source);
  assert.deepEqual(geometry.map(row => [row.byteSize, row.stride]).sort((left, right) => left[0] < right[0] ? -1 : 1), [[8n, 8n], [16n, 16n]]);
  const observations = modules.flatMap(chapter => chapter.bodies.flatMap(row => row.observations?.rows ?? []));
  assert.equal(observations.length, 2);
  for (const observation of observations) {
    const layout = layouts.find(row => row.key.definition === observation.layout.metadata.definition);
    assert.equal(observation.value, layout.layouts[observation.layout.layout].byteSize);
  }
  const named = index.constants.filter(row => row.reference.context === "enum-member");
  assert.equal(named.length, 2);
  const { deps, input, constant } = observed;
  const reference = constant.value.reference;
  const meter = createAccount(limits);
  const reads = [];
  const read = deps.enumValueOf(meter, {
    context: "enum-member",
    get member() { reads.push("member"); return reference.member; },
    get bindings() { reads.push("bindings"); return reference.bindings; },
  });
  assert.equal(read.kind, "complete");
  assert.deepEqual(reads, ["member", "bindings"]);
  assert.equal(read.value.type, constant.type);
  assert.equal(read.value.kind, "number");
  assert.deepEqual(read.value.value, { numerator: 16n, denominator: 1n, negativeZero: false });
  const { work } = InvocationAccount.stateOf(meter);
  for (let maximumWork = 0; maximumWork < work; maximumWork += 1) {
    const account = createAccount({ ...limits, maximumWork });
    const stopped = deps.enumValueOf(account, reference);
    assert.equal(stopped === accountFailure(account), true, maximumWork);
    assert.equal(deps.enumValueOf(account, { get member() { assert.fail("an exhausted read must not access the next enum identity"); } }) === stopped, true);
  }
  const settled = original({ ...deps, account: createAccount(limits) }, input);
  assert.equal(settled.kind, "complete");
  assert.equal(settled.value.kind, "ok");
  const summary = settled.value.value.summary;
  assert.deepEqual(summary.arena.origins[summary.result].producers, []);
  const booleanType = deps.types.terms.findIndex(term => term.kind === "primitive" && term.primitive === "bool");
  assert.ok(booleanType >= 0 && booleanType !== constant.type);
  for (const value of [null, { ...read.value, type: booleanType }]) {
    assert.throws(() => original({ ...deps, account: createAccount(limits), enumValueOf: () => ({ kind: "complete", value }) }, input),
      error => error.cause?.message === "BodyAnalysis requires the completed numeric enum constant at its actual selected carrier.");
  }
});

test("module static reads use one actual cell per declaration and preserve the declaring execution binding", async () => {
  const { analyzeOptionalSource } = await import("./fixtures/optional-default.mjs");
  const { staticCells } = await import("../../packages/host/dist/analyses/body/places.js");
  const { InvocationAccount } = await import("../../packages/host/dist/dataflow/account.js");
  const { summaryKey } = await import("../../packages/host/dist/ir-facts/index.js");
  const { pipelineWiring } = await import("../../packages/host/dist/pipeline/wiring.js");
  const converge = pipelineWiring.summaries.convergeComponent;
  let observed;
  let owner;
  pipelineWiring.summaries.convergeComponent = (deps, input) => {
    if (input.members[0].tir.root.kind === "Block") observed = { deps, member: input.members[0], outside: input.outside };
    if (input.members[0].tir.root.kind === "SourceFile" && input.members[0].mir.places.some(place => place.base.kind === "static"))
      owner = input.members[0];
    return converge(deps, input);
  };
  try {
    const actual = await analyzeOptionalSource("export const state: boolean = true; "
      + "export function read(): boolean { if (state) return state; return state; }");
    assert.equal(actual.kind, "ok");
    assert.ok(observed && owner);
    const { deps, member, outside } = observed;
    const selected = actual.value.modules.flatMap(module => module.bodies)
      .find(body => body.kind === "selected" && body.instance.body === member.tir.body);
    const [facts] = selected.facts;
    const members = { ...member, liveness: facts.liveness };
    const summaryOf = key => outside.find(row => summaryKey(row.key) === summaryKey(key))?.answer;
    const run = (account, changes = {}) => analyzeBodyRound({ ...deps.environment, summaryOf, unit: member.unit, account, ...changes }, members);
    const exact = createAccount(limits);
    assert.equal(run(exact).kind, "complete");
    assert.equal(facts.arena.cells.filter(cell => cell.role.kind === "static").length, 1);
    const { work, entries } = InvocationAccount.stateOf(exact);
    for (const [dimension, needed] of [["work", work], ["result-entries", entries]]) for (let maximum = 0; maximum < needed; maximum += 1) {
      const account = createAccount({ maximumWork: dimension === "work" ? maximum : work,
        maximumResultEntries: dimension === "result-entries" ? maximum : entries });
      assert.equal(run(account), accountFailure(account));
      assert.equal(accountFailure(account)?.dimension, dimension);
    }
    assert.equal(run(createAccount({ maximumWork: work, maximumResultEntries: entries })).kind, "complete");

    const refused = { kind: "refused", diagnostics: [] };
    const stopped = createAccount(limits);
    assert.equal(run(stopped, { staticModuleBindingsOf: () => { refuseAccount(stopped, refused); return null; } }), refused);
    assert.throws(() => run(createAccount(limits), { staticModuleBindingsOf: () => null }), /actual initialized module execution binding/);
    const nodes = sourceOccurrences(member.tir, createAccount(limits)).value;
    const read = [...nodes.values()].find(node => node.kind === "Identifier" && node.tsonic.resolution?.kind === "static");
    assert.ok(read);
    const changedReference = declaration => ({ ...read, tsonic: { ...read.tsonic, resolution: { ...read.tsonic.resolution, declaration } } });
    const invoke = (input, source = nodes) => staticCells({ ...deps.environment, account: createAccount(limits) },
      input, source, input.tir.captures.filter(capture => capture.capture === "captured-location").length, null);
    assert.throws(() => invoke({ ...members, mir: { ...member.mir, bindings: { kind: "parametric" } } }), /projection or static-cell producer/);
    assert.throws(() => invoke(members, new Map(nodes).set(read.id,
      changedReference({ ...read.tsonic.resolution.declaration, node: read.id }))), /actual declaration node and storage/);
    const foreign = "bad declaration";
    const crossed = { ...members, mir: { ...member.mir, places: member.mir.places.map(place =>
      place.base.kind === "static" ? { ...place, base: { kind: "static", definition: foreign } } : place) } };
    assert.throws(() => invoke(crossed, new Map([[read.id, changedReference({ owner: foreign, node: read.id })]])), /qualified declaration module/);
    const mismatch = { ...members, mir: { ...member.mir, places: member.mir.places.map(place =>
      place.base.kind === "static" ? { ...place, storage: T.float64 } : place) } };
    assert.throws(() => invoke(mismatch), /actual declaration root/);
    const ownNodes = sourceOccurrences(owner.tir, createAccount(limits)).value;
    assert.throws(() => invoke({ ...owner, tir: { ...owner.tir, root: member.tir.root } }, ownNodes), /actual declaration root/);
    assert.throws(() => invoke(owner, new Map([[read.id, read]])), /actual declaration, storage and placed initializer/);
  } finally { pipelineWiring.summaries.convergeComponent = converge; }
  const absence = await analyzeOptionalSource("export let first: undefined; export let second: undefined; "
    + "export function read(): undefined { first; return second; }");
  assert.equal(absence.kind, "ok");
  const index = absence.value.index;
  const absenceReader = absence.value.modules.flatMap(module => module.bodies)
    .find(record => record.kind === "selected" && record.tir.root.kind === "Block");
  const [absenceFacts] = absenceReader.facts;
  const absenceCheck = account => analyzeBodyRound({
    ...observed.deps.environment, account, types: index.types, unit: observed.member.unit,
    typeOf: type => index.types.terms[type], signatureOf: signature => index.types.signatures[signature],
    staticModuleBindingsOf: () => index.initialization.modules[0].instance.bindings,
    summaryOf: () => assert.fail("a direct static read has no callee summary dependency"),
  }, { execution: absenceFacts.execution, mir: absenceReader.mir, tir: absenceReader.tir, liveness: absenceFacts.liveness });
  const exact = createAccount(limits);
  assert.equal(absenceCheck(exact).kind, "complete");
  const { entries } = InvocationAccount.stateOf(exact);
  for (let maximumResultEntries = 0; maximumResultEntries < entries; maximumResultEntries += 1) {
    const account = createAccount({ ...limits, maximumResultEntries });
    assert.equal(absenceCheck(account), accountFailure(account));
    assert.equal(accountFailure(account)?.dimension, "result-entries");
  }
  await assert.rejects(() => analyzeOptionalSource("export let state: boolean | undefined; "
    + "export function read(): boolean | undefined { return state; }"), /actual incoming value contents/);
  const authored = await analyzeOptionalSource("export let state: boolean; "
    + "export function replace(next: boolean): boolean { state = next; return state; }");
  assert.equal(authored.kind, "ok");
  const written = authored.value.index.summaries.find(summary => summary.key.kind === "body"
    && summary.arena.cells.some(cell => cell.role.kind === "static") && summary.contentsOnReturn.length !== 0);
  const [effect] = written.contentsOnReturn;
  assert.equal(written.arena.cells[effect.target].role.kind, "static");
  assert.equal(written.initialization.points.some(point => point.kind === "need"), false);
});

test("called static reads bind the complete declaration identity and preserve the first resource stop", async () => {
  const { analyzeOptionalSource } = await import("./fixtures/optional-default.mjs");
  const { staticCallInventory } = await import("../../packages/host/dist/analyses/body/static-calls.js");
  const { InvocationAccount } = await import("../../packages/host/dist/dataflow/account.js");
  const { decodeBodyId } = await import("../../packages/host/dist/ids/index.js");
  const ready = await analyzeOptionalSource("export const first: boolean = true; "
    + "export const copy: boolean = first; export const again: boolean = first;");
  assert.equal(ready.kind, "ok");
  const imported = await analyzeOptionalSource("import { value } from './provider.js'; "
    + "function read(): boolean | undefined { return value; } export const copy: boolean | undefined = read();",
  { "provider.ts": "export const value: boolean = true;" });
  assert.equal(imported.kind, "ok");
  const importedAbsence = await analyzeOptionalSource("import { value } from './provider.js'; export const copy: undefined = value;",
    { "provider.ts": "export const value: undefined = undefined;" });
  assert.equal(importedAbsence.kind, "ok");
  const { index, modules } = ready.value;
  const actual = modules.flatMap(module => module.bodies).find(row => row.kind === "selected" && row.tir.root.kind === "SourceFile");
  const [facts] = actual.facts;
  const source = index.summaries.find(row => row.key.kind === "body" && decodeBodyId(row.key.execution.instance.body).value.role === "initializer"
    && row.initialization.points.some(point => point.kind === "need"));
  const [borrowed] = source.arena.cells;
  assert.equal(borrowed.role.kind, "static");
  const direct = facts.arena.cells.filter(cell => cell.role.kind === "static");
  assert.equal(direct.filter(cell => cell.role.declaration.definition === borrowed.role.declaration.definition).length, 1);
  const run = (account, admit = () => null, declared = direct, overrides = {}) => staticCallInventory({
    account, types: index.types, typeOf: type => index.types.terms[type], staticTypeOf: () => index.types.terms.findIndex(type =>
      type.kind === "primitive" && type.primitive === "bool"), ...overrides,
  }, { tir: actual.tir, mir: actual.mir }, declared,
  actual.tir.captures.filter(capture => capture.capture === "captured-location").length, admit);
  const exact = createAccount(limits);
  const current = run(exact);
  assert.equal(current.kind, "complete");
  const view = current.value;
  assert.equal(view.include(source), null);
  assert.equal(view.include(source), null);
  assert.deepEqual(view.additional, []);
  const expected = direct.find(cell => cell.role.declaration.definition === borrowed.role.declaration.definition).id;
  assert.equal(view.cellOf(source, borrowed.id), expected);
  assert.equal(view.slotOf(source, borrowed.id), actual.mir.locals.length + expected - actual.tir.captures.length);
  assert.equal(view.slotOf(source, borrowed.id + 1), undefined);
  for (const declared of [direct, []]) {
    const measured = createAccount(limits);
    const complete = run(measured, () => null, declared).value;
    assert.equal(complete.include(source), null);
    assert.equal(complete.include(source), null);
    const { work, entries } = InvocationAccount.stateOf(measured);
    for (const [dimension, need] of [["work", work], ["result-entries", entries]]) for (let maximum = 0; maximum < need; maximum += 1) {
      const account = createAccount({ maximumWork: dimension === "work" ? maximum : work,
        maximumResultEntries: dimension === "result-entries" ? maximum : entries });
      const result = run(account, () => null, declared);
      const stop = result.kind === "complete" ? result.value.include(source) ?? result.value.include(source) : result;
      assert.equal(stop, accountFailure(account));
      assert.equal(stop?.dimension, dimension);
    }
  }
  const absent = await analyzeOptionalSource("export const first: undefined = undefined; export const copy: undefined = first;");
  assert.equal(absent.kind, "ok");
  const absentSummary = absent.value.index.summaries.find(row => row.initialization.points.some(point => point.kind === "need")
    && row.key.kind === "body" && decodeBodyId(row.key.execution.instance.body).value.role === "initializer");
  const absentType = absent.value.index.types.terms.findIndex(type => type.kind === "intrinsic" && type.intrinsic === "absence");
  const absentView = run(createAccount(limits), () => null, [], {
    staticTypeOf: () => absentType, typeOf: type => absent.value.index.types.terms[type],
  }).value;
  assert.equal(absentView.include(absentSummary), null);
  assert.deepEqual([...absentView.absent], [actual.mir.locals.length]);
  assert.equal(absentView.additional.length, 1);

  const refused = { kind: "refused", diagnostics: [] };
  for (const phase of ["type", "classification", "allocation"]) {
    const account = createAccount(limits);
    const stop = () => { refuseAccount(account, refused); return refused; };
    const branch = run(account, phase === "allocation" ? stop : () => null, [], {
      staticTypeOf: phase === "type" ? () => { stop(); return null; } : () => T.bool,
      typeOf: phase === "classification" ? () => { stop(); return { kind: "primitive", primitive: "bool" }; }
        : () => ({ kind: "primitive", primitive: "bool" }),
    }).value;
    assert.equal(branch.include(source), refused);
    assert.deepEqual(branch.additional, []);
  }
  const rejected = (row, message, overrides = {}) => {
    const inventory = run(createAccount(limits), () => null, [], overrides).value;
    assert.throws(() => inventory.include({ ...source, arena: { ...source.arena, cells: [row] } }), message);
  };
  rejected({ ...borrowed, occurrence: { kind: "entry" } }, /actual declaration/);
  rejected({ ...borrowed, occurrence: { kind: "declared", at: { kind: "node", node: { kind: "item",
    value: { ...borrowed.occurrence.at.node.value, owner: actual.tir.owner } } } } }, /same qualified declaration/);
  rejected(borrowed, /actual declared storage type/, { staticTypeOf: () => null });
  rejected(borrowed, /actual incoming non-scalar/, { typeOf: () => ({ kind: "string" }) });
  assert.throws(() => run(createAccount(limits), () => null, [{ ...borrowed, role: { kind: "detached" } }]), /only its actual static cells/);
  const crossedDirect = { ...borrowed, occurrence: { kind: "declared", at: { kind: "node", node: { kind: "item",
    value: { ...borrowed.occurrence.at.node.value, node: borrowed.occurrence.at.node.value.node + 1 } } } } };
  assert.throws(() => run(createAccount(limits), () => null, [crossedDirect]).value.include(source), /same qualified declaration/);
});

for (const completion of ["boolean", "void"]) test(`called ${completion} writes retain one bound static per declaration and separate its two finite exits`, async () => {
  const { analyzeOptionalSource } = await import("./fixtures/optional-default.mjs");
  const { decodeBodyId, decodeDefId } = await import("../../packages/host/dist/ids/index.js");
  const result = await analyzeOptionalSource(
    "import { write } from './provider.js'; "
    + `function relay(flag: boolean, value: boolean): boolean { ${completion === "void" ? "write(flag, value); return value;" : "return write(flag, value);"} } `
    + "export const started: boolean = relay(true, true);",
    { "provider.ts": "export let returned: boolean; export let unwound: boolean; "
      + `export function write(flag: boolean, value: boolean): ${completion} { `
      + `if (flag) { returned = value; return${completion === "void" ? "" : " value"}; } unwound = value; throw value; }` },
  );
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const relay = result.value.index.summaries.find(row => row.key.kind === "body"
    && decodeDefId(decodeBodyId(row.key.execution.instance.body).value.owner).value.segments.at(-1)?.name === "relay");
  assert.ok(relay);
  const nameOf = cell => decodeDefId(relay.arena.cells[cell].role.declaration.definition).value.segments.at(-1).name;
  assert.equal(relay.returns && relay.unwinds, true);
  assert.deepEqual(relay.writes.map(row => nameOf(row.target)).sort(), ["returned", "unwound"]);
  assert.deepEqual(relay.contentsOnReturn.map(row => nameOf(row.target)), ["returned"]);
  assert.deepEqual(relay.contentsOnUnwind.map(row => nameOf(row.target)), ["unwound"]);
  for (const [kind, name] of [["return", "returned"], ["unwind", "unwound"]]) {
    const point = relay.initialization.points.findIndex(current => current.kind === kind);
    const written = relay.initialization.rows.filter(row => row.point === point && row.cell !== null && row.condition === 1);
    assert.deepEqual(written.map(row => nameOf(relay.initialization.cells[row.cell])), [name]);
  }
  const caller = result.value.modules.flatMap(module => module.bodies).find(body =>
    body.kind === "selected" && body.instance.body === relay.key.execution.instance.body);
  const callee = result.value.index.summaries.find(row => row.key.kind === "body"
    && decodeDefId(decodeBodyId(row.key.execution.instance.body).value.owner).value.segments.at(-1)?.name === "write");
  const operation = caller.mir.blocks.find(block => block.terminator.kind === "call").terminator;
  assert.equal(operation.destination === null, completion === "void");
  assert.throws(() => callSlotAt({ account: createAccount(limits) }, caller.mir, operation, callee, callee.writes[0].target, null),
    /actual static-slot binding for this callee declaration/);
});

test("a real optional formal without an initializer distinguishes omitted absence from a supplied undefined", async () => {
  const { checkOptionalNoInitializer } = await import("./fixtures/optional-no-initializer.mjs");
  const { omitted, requiredFormal } = await checkOptionalNoInitializer();
  const { index, caller, mir, formal, header } = omitted;
  const original = mir.callee.resolution.decision;
  const signature = index.types.signatures[original.completion.signature];
  const check = (operation, named = formal) => callSummary({ account: createAccount(limits),
    signatureOf: selected => {
      assert.equal(selected, signature.id);
      return { ...signature, parameters: [named] };
    },
    summaryOf: () => assert.fail("an invalid omission must not read a Summary"),
  }, caller.mir, operation);
  const crossed = { ...mir, callee: { ...mir.callee, resolution: { ...mir.callee.resolution,
    decision: { ...original, parameters: [{ ...original.parameters[0], type: header.type.tsonic.type }] },
  } } };
  assert.throws(() => check(crossed), /actual absence omission of a selected formal without an initializer/);
  const required = { ...formal, kind: requiredFormal.kind, acceptsOmission: requiredFormal.acceptsOmission };
  assert.throws(() => check(mir, required), /actual absence omission of a selected formal without an initializer/);
});

test("copied optional entries share the existing account and do not suppress actual reference retention", async () => {
  const { analyzeOptionalSource } = await import("./fixtures/optional-default.mjs");
  const program = await analyzeOptionalSource(
    "export function copy(first: boolean | undefined, second: boolean | undefined): boolean | undefined { return first; }\n"
    + "export function keep(first: boolean | undefined, second: boolean | undefined, text: string): string { return text; }");
  assert.equal(program.kind, "ok");
  const { index, modules } = program.value;
  const active = modules.flatMap(module => module.bodies).filter(body => body.kind === "selected" && body.tir.root.kind === "Block");
  const copy = active.find(body => body.tir.params.length === 2);
  const keep = active.find(body => body.tir.params.length === 3);
  assert.ok(copy && keep);
  assert.deepEqual(copy.facts[0].origins.escapes, []);
  assert.deepEqual(keep.facts[0].origins.escapes.map(row => row.producer), [2]);
  const execution = { instance: copy.instance, provided: 2 };
  const storage = analyzeStorageUse({ account: createAccount(limits) }, { execution, body: copy.mir });
  assert.equal(storage.kind, "ok");
  const deps = { types: index.types, typeOf: type => index.types.terms[type], signatureOf: signature => index.types.signatures[signature],
    summaryOf: () => assert.fail("The actual by-value copy does not call"), limits: analysisLimits,
    unit: { query: "bodyRound", key: executionKey(execution) } };
  const input = { execution, mir: copy.mir, tir: copy.tir, liveness: storage.value };
  for (const dimension of ["maximumWork", "maximumResultEntries"]) {
    let complete = false;
    for (let maximum = 0; maximum < 1000; maximum += 1) {
      const account = createAccount({ ...limits, [dimension]: maximum });
      const result = analyzeBodyRound({ ...deps, account }, input);
      if (result.kind === "complete") {
        assert.equal(result.value.kind, "ok");
        assert.deepEqual(result.value.value.facts, copy.facts[0]);
        complete = true;
        break;
      }
      assert.equal(result, accountFailure(account));
    }
    assert.equal(complete, true);
  }
});

test("optional value transfer rejects an unselected or unsupported replacement of the actual conversion", async () => {
  const { checkOptionalDefault } = await import("./fixtures/optional-default.mjs");
  const { types, initializer, defaultValue } = await checkOptionalDefault("omitted");
  const state = initializer.mir.locals.map(() => 0);
  const constants = initializer.mir.constants.map(() => 0);
  const input = { mir: initializer.mir };
  const call = value => transferValue({ types, typeOf: type => types.terms[type], account: createAccount(limits) }, input,
    constants, state, state, { ...defaultValue, value }, null);
  const value = defaultValue.value;
  assert.throws(() => call({ ...value, kind: "unary" }), /actual selected optional value conversion/);
  assert.throws(() => call({ ...value, to: value.operation.decision.operation.from }), /actual selected absent or present optional conversion/);
});

test("an actual optional capture has a symbolic entry value distinct from its initialization need", async () => {
  const { InvocationAccount } = await import("../../packages/host/dist/dataflow/account.js");
  for (const [name, payload, retains] of [["boolean", T.bool, false], ["string", T.string, true]]) {
    const optional = declareType(`bodyRoundOptionalCapture.${name}`, { kind: "optional", value: payload });
    const data = locationDefaultProgram(`body-round.optional-capture.${name}`, { type: optional });
    const current = fixture(data.child);
    current.related = [fixture(data.program, data.internal, 1)];
    const { input, deps } = current;
    assert.equal(input.mir.locals.find(local => local.role.kind === "capture").storage, optional);
    const run = (account, bounds = analysisLimits) => analyzeBodyRound({ ...deps, account, limits: bounds }, input);
    const account = createAccount(limits);
    const pair = checkedPair(current, run(account));
    const [location] = pair.summary.arena.contexts[0].captures;
    assert.deepEqual(pair.summary.arena.origins[pair.summary.result],
      { id: pair.summary.result, kind: "complete", producers: [location.location], includesAbsence: false });
    assert.deepEqual(pair.summary.retention.map(row => row.source), retains ? [location.location] : []);
    assert.equal(pair.summary.initialization.points[0].kind, "need");
    assert.equal(pair.summary.initialization.points[0].cell, location.cell);
    assert.equal(pair.facts.initialization.reads[0].assigned, false);
    const cut = createAccount(limits);
    const refusal = run(cut, { ...analysisLimits, maximumOriginAlternatives: 0 });
    assert.equal(refusal.kind, "refused");
    assert.equal(refusal === accountFailure(cut), true);
    assert.deepEqual(refusal.diagnostics, [resourceLimitDiagnostic({
      owner: "analyses/body", limit: "analysis.maximumOriginAlternatives", maximum: 0,
      site: { kind: "source", origin: current.program.tir.root.origin },
      unit: { request: deps.unit, position: { kind: "result" } },
    })]);
    const { work, entries } = InvocationAccount.stateOf(account);
    for (const [field, required] of [["maximumWork", work], ["maximumResultEntries", entries]]) {
      for (let maximum = 0; maximum <= required; maximum += 1) {
        const limited = createAccount({ maximumWork: work, maximumResultEntries: entries, [field]: maximum });
        const outcome = run(limited);
        if (maximum === required) assert.equal(outcome.kind, "complete");
        else {
          assert.equal(outcome.kind, "resource-limit");
          assert.equal(outcome === accountFailure(limited), true);
          assert.equal(analyzeBodyRound({ ...deps, account: limited }, new Proxy({}, {
            get() { assert.fail("A stopped optional capture cannot read another input"); },
          })) === outcome, true);
        }
      }
    }
  }
  const optional = declareType("bodyRoundOptionalCapture.receiver", { kind: "optional", value: T.string });
  const data = locationDefaultProgram("body-round.optional-capture.receiver", { type: optional, receiver: true });
  const current = fixture(data.program, data.internal, 0);
  assert.equal(current.input.mir.locals.find(local => local.role.kind === "receiver").storage, optional);
  assert.throws(() => analyzeBodyRound(current.deps, current.input), /actual optional receiver value binding/u);
});

test("complete retained targets and positions are paid, distinct, canonically ordered and share original stops", () => {
  const { child, selected } = referenceWriteProgram("body-round.reference-retained-key");
  const write = child.input.mir.blocks.flatMap(block => block.statements.map((statement, index) =>
    ({ statement, point: { block: block.id, statement: index } }))).find(row => row.statement.kind === "assign");
  const source = selected.summary.result;
  const targets = [{ kind: "throw" }, { kind: "return" }, { kind: "capture", index: 1, path: null }, { kind: "capture", index: 0, path: null }];
  const escapes = [];
  const retention = [];
  for (const point of [write.point, { block: write.point.block, statement: null }, { block: write.point.block + 1, statement: 0 }])
    for (const target of targets) for (const repeat of [false, true]) {
      assert.equal(retainValue(child.deps, child.execution, write.statement, point, target, source, selected.facts.arena, escapes, retention, null), null);
      assert.equal(typeof repeat, "boolean");
    }
  const sorted = collectRetainedValues(child.deps, escapes, retention);
  assert.equal(sorted.kind, "complete");
  assert.equal(sorted.value.escapes.length, 12);
  assert.equal(sorted.value.retention.length, 12);
  const ordered = targets.map(target => ({ target, key: escapeTargetKey(target, createAccount(limits)).value }))
    .sort((left, right) => left.key < right.key ? -1 : left.key > right.key ? 1 : 0);
  assert.deepEqual(sorted.value.escapes.slice(0, 4).map(row => row.target), ordered.map(row => row.target));
  const run = account => collectRetainedValues({ ...child.deps, account }, escapes.toReversed(), retention.toReversed());
  for (const dimension of ["maximumWork", "maximumResultEntries"]) {
    let complete = false;
    for (let maximum = 0; maximum < 30000; maximum += 1) {
      const account = createAccount({ ...limits, [dimension]: maximum });
      const result = run(account);
      if (result.kind === "complete") { assert.deepEqual(result.value, sorted.value); complete = true; break; }
      assert.equal(result, accountFailure(account));
    }
    assert.equal(complete, true);
  }
  const call = { ...write.statement, kind: "call", callee: { kind: "body", captures: [{ place: 0 }] } };
  const invalid = { into: { kind: "capture", index: 0, path: null }, value: { kind: "caller", value: { origins: source } } };
  const invoke = (operation, row, captured = new Map()) => retainCallCaptures({ ...child.deps, account: createAccount(limits) }, child.input,
    operation, write.point, { retention: [row] }, captured, selected.facts.arena, [], [], null);
  for (const operation of [call, { ...call, callee: { kind: "direct" } }]) for (const row of [
    { ...invalid, into: { ...invalid.into, path: 0 } }, { ...invalid, value: { kind: "callee" } },
  ]) assert.throws(() => invoke(operation, row), /actual immediate capture target and value binding/);
  const stopped = createAccount(limits);
  const original = refuseAccount(stopped, { kind: "refused", diagnostics: [] });
  const unread = new Proxy({}, { get() { assert.fail("No retained-value input after its original stop."); } });
  assert.equal(retainCallCaptures({ ...child.deps, account: stopped }, unread, unread, unread, unread, unread, unread, unread, unread, unread), original);
});

test("actual placed calls keep both finite exits, sibling needs and normal/unwind-only captured writes distinct", () => {
  for (const [normalWrites, unwindWrites] of [[true, false], [false, true], [true, true], [false, false]]) {
    const name = `body-round.called-exits.${normalWrites}.${unwindWrites}`;
    const outer = fixture(shaped(`${name}.outer`, [["a", "required", T.bool], ["flag", "required", T.bool]], T.bool,
      builder => builder.block(builder.returns(builder.id("a", 0, T.bool)))));
    const failName = `${name}.fail`;
    const failed = fixture(shaped(failName, [], T.bool, builder => builder.block(builder.throws(builder.keyword("FalseKeyword", T.bool)))));
    const failure = checkedPair(failed, analyzeBodyRound(failed.deps, failed.input)).summary;
    const childName = `${name}.b`;
    const childBody = bodyId(childName, "default-argument");
    const captures = [0, 1].map(local => ({ local: { body: outer.program.tir.body, local }, capture: "captured-location" }));
    const builder = builders(name);
    const program = typedBody(name, { signature: signature(name, [["b", T.bool, "default", childBody]], T.bool), completion: T.bool,
      params: [[2, "default", T.bool, childBody]], locals: [["a", "capture", T.bool, true, captures[0].local],
        ["flag", "capture", T.bool, false, captures[1].local], ["b", "parameter", T.bool]], captures,
      root: builder.block(builder.returns(builder.id("b", 2, T.bool))) });
    const childBuilder = builders(childName, "default-argument");
    const root = () => {
      const branch = (writes, expression) => writes ? childBuilder.sequence(childBuilder.assign(childBuilder.target("a", 0, T.bool),
        "EqualsToken", childBuilder.keyword("TrueKeyword", T.bool), T.bool, T.bool), expression, T.bool) : expression;
      const normal = branch(normalWrites, childBuilder.keyword("FalseKeyword", T.bool));
      const unwind = branch(unwindWrites, childBuilder.call(childBuilder.global("fail", failName, T.unknown), [], T.bool,
        () => ({ callee: callee(failName, failed.program.tir.signature, [], T.bool), receiver: null, arguments: [] })));
      const arm = (node, when) => ({ ...node, $: when, tsonic: at => ({
        ...(typeof node.tsonic === "function" ? node.tsonic(at) : node.tsonic), demand: { kind: "selected", control: at("flag"), when },
      }) });
      const choice = { kind: "ConditionalExpression", condition: { $: "flag", ...childBuilder.id("flag", 1, T.bool) },
        questionToken: { kind: "QuestionToken", tsonic: null }, whenTrue: arm(normal, "true"),
        colonToken: { kind: "ColonToken", tsonic: null }, whenFalse: arm(unwind, "false"), tsonic: at => ({
          type: T.bool, convertedType: T.bool, conversion: { kind: "identity" }, narrowing: null, evidenceIndex: null, demand: { kind: "always" },
          selection: { kind: "conditional", control: at("flag"), whenTrue: at("true"), whenFalse: at("false"), disposition: "dynamic" },
        }) };
      return childBuilder.sequence(childBuilder.prefix(childBuilder.id("a", 0, T.bool), "ExclamationToken", T.bool,
        native("!", "bool", [T.bool], T.bool)), choice, T.bool);
    };
    const childProgram = typedBody(childName, { role: "default-argument", signature: signature(childName, [], T.bool), completion: T.bool,
      locals: [["a", "capture", T.bool, true, captures[0].local], ["flag", "capture", T.bool, false, captures[1].local]], captures, root: root() });
    childProgram.tir.root = seal(childName, root(), "default-argument", program.nodeCount).root;
    childProgram.tir.root.parent = program.tir.params[0].id;
    program.tir.params[0].initializer = childProgram.tir.root;
    const bodies = [program.tir, childProgram.tir, outer.program.tir, failed.program.tir];
    const bodyOf = instance => bodies.find(tir => sameInstance(instance, { body: tir.body, bindings: tir.bindings })) ?? null;
    program.bodyOf = childProgram.bodyOf = bodyOf;
    const current = fixture(program, [{ instance: { body: childBody, bindings: childProgram.tir.bindings }, captures,
      signature: childProgram.tir.signature }], 0);
    const child = fixture(childProgram);
    child.related = [outer, failed, current];
    child.deps.summaryOf = () => ({ value: failure, unit: { request: failed.deps.unit, position: { kind: "result" } } });
    const summary = checkedPair(child, analyzeBodyRound(child.deps, child.input)).summary;
    assert.equal(summary.returns && summary.unwinds, true);
    current.related = [outer, child, failed];
    current.deps.summaryOf = () => ({ value: summary, unit: { request: child.deps.unit, position: { kind: "result" } } });
    const pair = checkedPair(current, analyzeBodyRound(current.deps, current.input));
    const write = [{ target: 0, value: 0 }];
    assert.equal(pair.summary.returns && pair.summary.unwinds, true);
    assert.deepEqual(pair.summary.writes, normalWrites || unwindWrites ? write : []);
    assert.deepEqual(pair.summary.contentsOnReturn, normalWrites ? write : []);
    assert.deepEqual(pair.summary.contentsOnUnwind, unwindWrites ? write : []);
    assert.deepEqual(pair.facts.origins.exitContents, { onReturn: pair.summary.contentsOnReturn, onUnwind: pair.summary.contentsOnUnwind });
    for (const [kind, assigned] of [["return", normalWrites], ["unwind", unwindWrites]]) {
      const point = pair.summary.initialization.points.findIndex(row => row.kind === kind);
      assert.notEqual(point, -1);
      assert.equal(pair.summary.initialization.rows.some(row => row.point === point && row.cell === 0 && row.condition === 1), assigned,
        `the actual ${kind} must state does not borrow the opposite exit's write`);
    }
    assert.deepEqual(pair.summary.initialization.points.filter(row => row.kind === "need").map(row => row.cell), [0, 1]);
    if (normalWrites && unwindWrites) for (const dimension of ["maximumWork", "maximumResultEntries"]) {
      let complete = false;
      for (let maximum = 0; maximum < 20000; maximum += 1) {
        const account = createAccount({ ...limits, [dimension]: maximum });
        const result = analyzeBodyRound({ ...current.deps, account }, current.input);
        if (result.kind === "complete") { checkedPair(current, result); complete = true; break; }
        assert.equal(result, accountFailure(account));
        const unread = new Proxy({}, { get() { assert.fail("No call exit or need state is read after original refusal."); } });
        assert.equal(analyzeBodyRound({ ...current.deps, account }, unread), result);
      }
      assert.equal(complete, true);
    }
  }
});

test("actual finite return and unwind contents do not borrow the other exit's reachable write history", () => {
  const owner = shaped("body-round.exit-partition.owner", [["value", "required", T.bool]], T.bool,
    builder => builder.block(builder.returns(builder.id("value", 0, T.bool))));
  for (const [normalWrites, unwindWrites] of [[true, false], [false, true], [true, true], [false, false]]) {
    const name = `body-round.exit-partition.${normalWrites}.${unwindWrites}`;
    const builder = builders(name);
    const source = { body: owner.tir.body, local: 0 };
    const branch = (writes, terminal) => builder.block(...(writes ? [builder.expressionStatement(builder.assign(
      builder.target("value", 1, T.bool), "EqualsToken", builder.keyword("TrueKeyword", T.bool), T.bool, T.bool))] : []), terminal);
    const program = typedBody(name, { signature: signature(name, [["flag", T.bool]], T.bool), completion: T.bool,
      params: [[0, "required", T.bool]], locals: [["flag", "parameter", T.bool], ["value", "capture", T.bool, true, source]],
      captures: [{ local: source, capture: "captured-location" }], root: builder.block(builder.ifElse(builder.id("flag", 0, T.bool),
        branch(normalWrites, builder.returns(builder.keyword("FalseKeyword", T.bool))),
        branch(unwindWrites, builder.throws(builder.keyword("FalseKeyword", T.bool))))) });
    program.bodyOf = instance => sameInstance(instance, { body: owner.tir.body, bindings: owner.tir.bindings }) ? owner.tir : null;
    const current = fixture(program);
    current.related = [fixture(owner)];
    const pair = checkedPair(current, analyzeBodyRound(current.deps, current.input));
    const written = [{ target: 0, value: 0 }];
    assert.deepEqual(pair.summary.writes, normalWrites || unwindWrites ? written : [], "may history includes every actual reached store");
    assert.deepEqual(pair.summary.contentsOnReturn, normalWrites ? written : [], "normal contents come only from actual finite normal exits");
    assert.deepEqual(pair.summary.contentsOnUnwind, unwindWrites ? written : [], "unwind contents come only from actual finite unwind exits");
    assert.deepEqual(pair.facts.origins.exitContents, { onReturn: pair.summary.contentsOnReturn, onUnwind: pair.summary.contentsOnUnwind });
    assert.deepEqual(pair.summary.arena.origins[0], { id: 0, kind: "complete", producers: [], includesAbsence: false },
      "the primitive entry remains C1, not a manufactured reference or entry allocation");
  }
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
    root: builder.assign(builder.target("value", 0, T.bool), "EqualsToken",
      builder.call(builder.global("thunk", thunkName, T.unknown), [], T.bool,
        () => ({ callee: callee(thunkName, thunk.program.tir.signature, [], T.bool), receiver: null, arguments: [] })), T.bool, T.bool) });
  program.bodyOf = instance => [owner.tir, thunk.program.tir].find(tir => sameInstance(instance, { body: tir.body, bindings: tir.bindings })) ?? null;
  const current = fixture(program);
  const captured = current.input.mir.locals.find(row => row.role.kind === "capture");
  const place = current.input.mir.places.find(row => row.base.kind === "local" && row.base.local === captured.id);
  const selectedStore = current.input.mir.blocks.flatMap(block => block.statements).find(statement =>
    statement.kind === "assign" && statement.tir.node === program.tir.root.id && statement.place === place.id);
  assert.ok(selectedStore);
  const mir = { ...current.input.mir, blocks: current.input.mir.blocks.map(block => ({ ...block,
    statements: block.statements.filter(statement => statement !== selectedStore),
    terminator: block.terminator.kind === "call" ? { ...block.terminator, destination: place.id } : block.terminator.kind === "return"
      ? { ...block.terminator, value: { kind: "place", place: place.id } } : block.terminator,
  })) };
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
  const bindings = [{ kind: "cell", index: 0 }];
  const run = (rows = [write], mappedCells = bindings, overrides = {}) => callWrites({ ...caller.deps,
    account: createAccount(limits), ...overrides }, call, mappedCells, summary.writes, rows);
  assert.equal(run(), null);
  assert.deepEqual(primitiveExitLocals({ ...caller.deps, account: createAccount(limits) }, caller.input, call, summary, "unwind"),
    { kind: "complete", value: [] });
  for (const value of [{ kind: "open", producers: [], includesAbsence: false, boundaries: [] },
    { kind: "complete", producers: [0], includesAbsence: false },
    { kind: "complete", producers: [], includesAbsence: true }])
    assert.deepEqual(primitiveExitLocals({ ...caller.deps, account: createAccount(limits) }, caller.input, call,
      { ...summary, arena: { ...summary.arena, origins: [value] } }, "return"), { kind: "complete", value: null });
  for (const changed of [{ ...write, target: { ...target, same: null } }, { ...write, target: { ...target, targets: [cell, cell] } },
    { ...write, target: { ...target, targets: [{ ...cell, cell: 1 }] } },
    ...["callee", "boundaries"].map(key => ({ ...write, value: { ...empty, [key]: [0] } }))])
    assert.throws(() => run([changed]), /actual created, open or unresolved caller-cell write transport/);
  for (const changed of [[], [{ kind: "cell", index: 1 }]])
    assert.throws(() => run([write], changed), /actual created, open or unresolved caller-cell write transport/);
  for (const value of [{ ...empty, caller: [{ owner, producer: 0 }] }, { ...empty, includesAbsence: true }])
    assert.equal(run([{ ...write, value }]), null);
  const local = caller.input.mir.places[call.callee.captures[0].place].base.local;
  const referenceInput = { ...caller.input, mir: { ...caller.input.mir, locals: caller.input.mir.locals.map(row =>
    row.id === local ? { ...row, storage: T.string } : row) } };
  assert.deepEqual(primitiveExitLocals({ ...caller.deps, account: createAccount(limits) }, referenceInput, call, summary, "return"),
    { kind: "complete", value: null });
  const unsupported = declareType("bodyRoundCapturedWriteUnknown", { kind: "enum", definition: def("bodyRoundCapturedWriteUnknown") });
  const unresolved = { ...caller.input, mir: { ...caller.input.mir, locals: caller.input.mir.locals.map(row =>
    row.id === local ? { ...row, storage: unsupported } : row) } };
  assert.throws(() => primitiveExitLocals({ ...caller.deps, account: createAccount(limits) }, unresolved, call, summary, "return"),
    /actual selected caller-cell write representation/);
  for (const dimension of ["maximumWork", "maximumResultEntries"]) {
    let complete = false;
    for (let maximum = 0; maximum < 100; maximum += 1) {
      const account = createAccount({ ...limits, [dimension]: maximum });
      const result = run([write], bindings, { account });
      if (result === null) { complete = true; break; }
      assert.equal(result, accountFailure(account));
      const unread = new Proxy([], { get() { assert.fail("No write-vector read after original stop."); } });
      assert.equal(callWrites({ ...caller.deps, account }, call, unread, unread, unread), result);
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
  const run = (changed = summary, assigned = new Set()) => callExitAssigned({ ...caller.deps, account: createAccount(limits) },
    caller.input.mir, call, changed, assigned, "return");
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
  assert.throws(() => callSlotAt({ ...caller.deps, account: createAccount(limits) }, caller.input.mir,
    { ...call, callee: { kind: "direct" } }, summary, 0, null), /actual immediate captured-slot binding/);
  const failed = createAccount(limits);
  const original = refuseAccount(failed, { kind: "refused", diagnostics: [] });
  const unread = new Proxy({}, { get() { assert.fail("No point-state input after original refusal."); } });
  assert.equal(callExitAssigned({ ...caller.deps, account: failed }, unread, unread, unread, unread, "return"), original);
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
  const [detector, completed] = result.value.positions;
  const read = current.input.tir.root.statements.nodes.at(-1).expression;
  const execution = executionKey(current.execution);
  const unit = { request: current.deps.unit, position: { kind: "execution-source-node", execution,
    node: { body: current.input.tir.body, node: read.id } } };
  assert.deepEqual(detector, { position: unit.position, error: { kind: "error", causes: [{ kind: "diagnostic",
    diagnostic: { kind: "host", unit, code: "TSONIC_READ_BEFORE_INITIALIZATION" } }] } });
  assert.deepEqual(completed.position, { kind: "execution-result", execution });
  assert.equal(completed.error, result.value.value, "the identical ErrorValue occupies the actual result position");
  assert.deepEqual(completed.error.causes, [{ kind: "unit", unit }]);
  assert.equal(result.value.diagnostics[0].code.rendered, "TSONIC_READ_BEFORE_INITIALIZATION");
  assert.equal(result.value.emissions[0].diagnostic, result.value.diagnostics[0]);
  assert.equal("summary" in result.value.value, false);
  const origin = { request: current.deps.unit, position: { kind: "execution-result", execution } };
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

test("intrinsic read collection keys actual lowered source occurrences once and pays before retaining each failure", () => {
  const name = "body-round.unwritten-occurrences";
  const builder = builders(name);
  const program = typedBody(name, { signature: signature(name, [["flag", T.bool]], T.bool), completion: T.bool,
    params: [[0, "required", T.bool]], locals: [["flag", "parameter", T.bool], ["first", "binding", T.bool, true], ["second", "binding", T.bool, true]],
    root: builder.block(builder.declare([
      builder.variable(builder.declName("first", 1), 1, T.bool),
      builder.variable(builder.declName("second", 2), 2, T.bool),
    ]), builder.ifElse(builder.id("flag", 0, T.bool), builder.returns({ $: "first-read", ...builder.id("first", 1, T.bool) }),
      builder.returns({ $: "second-read", ...builder.id("second", 2, T.bool) }))) });
  const current = fixture(program);
  const { mir, tir } = current.input;
  const nodes = sourceOccurrences(tir, createAccount(limits)).value;
  const operands = mir.blocks.filter(block => block.terminator.kind === "return" && block.terminator.value?.kind === "place")
    .map(block => readLocal(mir, block.terminator.value));
  const first = nodes.get(program.at("first-read"));
  const second = nodes.get(program.at("second-read"));
  assert.notEqual(operands[0], operands[1]);
  const record = (account, reads, node, local) =>
    recordUninitializedRead({ ...current.deps, account }, mir, reads, node.id, local, node.origin);
  const start = record(createAccount(limits), null, first, operands[0]);
  assert.equal(start.kind, "complete");
  assert.equal(record(createAccount(limits), start.value, first, operands[0]).value, start.value);
  assert.equal(start.value.size, 1);
  assert.throws(() => record(createAccount(limits), start.value, first, operands[1]), /same lowered storage local/);
  for (const [field, needed] of [["maximumWork", 2], ["maximumResultEntries", 3]]) {
    for (let maximum = 0; maximum < needed; maximum += 1) {
      const account = createAccount({ ...limits, [field]: maximum });
      const outcome = record(account, start.value, second, operands[1]);
      assert.equal(outcome, accountFailure(account));
      assert.equal(record(account, start.value, second, operands[1]), outcome);
      assert.equal(start.value.size, 1);
    }
  }
  const full = record(createAccount({ ...limits, maximumWork: 2, maximumResultEntries: 3 }), start.value, second, operands[1]);
  assert.equal(full.kind, "complete");
  assert.equal(full.value, start.value);
  assert.deepEqual([...full.value.keys()], [first.id, second.id]);
  const analyzed = analyzeBodyRound({ ...current.deps, account: createAccount(limits) }, current.input);
  assert.equal(analyzed.kind, "complete");
  assert.equal(analyzed.value.diagnostics.length, 2);
  assert.deepEqual(analyzed.value.emissions.map(row => row.identity.unit.position.node.node), [first.id, second.id]);
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
    assert.equal(arena.contexts[0].arguments[0].origins, pair.summary.result);
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
    assert.deepEqual(arena.origins[arena.contexts[0].arguments[0].origins].producers, []);
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
  assert.equal(arena.contexts[0].receiver === arena.contexts[0].arguments[0].origins, false);
  assert.deepEqual(arena.producers[arena.boundProducers[arena.origins[pair.summary.result].producers[0]].producer],
    { id: 0, path: null, kind: "receiver" });
  const parameter = arena.origins[arena.contexts[0].arguments[0].origins].producers[0];
  assert.deepEqual(arena.producers[arena.boundProducers[parameter].producer], { id: 1, path: null, kind: "parameter", index: 0 });
  for (const index of [-1, 0.5, -0, 7]) {
    const invalid = { ...current.input, mir: { ...current.input.mir, locals: current.input.mir.locals.map(local =>
      local.role.kind === "parameter" ? { ...local, role: { kind: "parameter", index } } : local) } };
    assert.throws(() => analyzeBodyRound({ ...current.deps, account: createAccount(limits) }, invalid), /actual signature formal or receiver producer/);
  }
  const selected = TABLE.signatures[current.program.tir.signature];
  assert.throws(() => analyzeBodyRound({ ...current.deps, account: createAccount(limits),
    signatureOf: () => ({ ...selected, parameters: [] }) }, current.input), /actual signature formal or receiver producer/);
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
    const refusal = { kind: "refused", diagnostics: [resourceLimitDiagnostic({ owner: "analyses/body",
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
  const state = current.input.mir.locals.map(local => pair.facts.arena.contexts[0].arguments[local.role.kind === "parameter" ? local.role.index : 0].origins);
  return { current, target, summary: targetPair.summary, unit, pair, operation: block.terminator,
    point: { block: block.id, statement: null }, initial, state };
}

test("the direct least round evaluates its supplied argument without applying either continuation", () => {
  const { current, target, summary, operation, point, pair, initial, state } = referenceRound("body-round.direct-least");
  const entry = target.input.mir.entries.find(row => row.provided === target.execution.provided);
  assert.ok(entry);
  assert.equal(operation.callee.kind, "direct");
  const least = { kind: "least", execution: target.execution, signature: target.input.tir.signature, entry };
  const selected = analyzeBodyRound({ ...current.deps, account: createAccount(limits), summaryOf: () => least }, current.input);
  assert.equal(selected.kind, "complete");
  assert.equal(selected.value.value.summary.returns, false);
  assert.equal(selected.value.value.summary.unwinds, false);
  assert.deepEqual(selected.value.value.facts.origins.invocations, []);
  const boundary = { origins: state, contents: new Set() };
  const account = createAccount(limits);
  const effects = valueProblem({ ...current.deps, account }, current.input, pair.facts.arena,
    indexedOrigins(current, pair.facts.arena.origins), [], initial, boundary, current.input.mir.blocks.map(() => true),
    () => null, new Map(), new Set([0, 1]), new Map([[point.block, least]]), null, null,
    () => assert.fail("A least call does not project any formal."));
  const noContinuation = { ...operation, get destination() { assert.fail("a least value edge cannot apply a selected destination"); },
    get unwind() { assert.fail("a least value edge cannot apply an unwind effect"); } };
  assert.deepEqual(effects.terminator(noContinuation, boundary, account, point.block), []);
  const stable = analyzeBodyRound({ ...current.deps, account: createAccount(limits),
    summaryOf: () => ({ kind: "prior-summary", summary }) }, current.input);
  const prior = checkedPair(current, stable);
  assert.equal(prior.summary.returns, true);
  assert.equal(prior.facts.origins.invocations.length, pair.facts.origins.invocations.length);
});

test("a private mutual round transports an actual prior detector to both stable execution results", async () => {
  const { InvocationAccount } = await import("../../packages/host/dist/dataflow/account.js");
  const { loadFrontFixture } = await import("./fixtures/front/checked-module.mjs");
  const { analysisInput } = await import("./fixtures/front/analysis-input.mjs");
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const { analyzeTypedSource } = await import("../../packages/host/dist/pipeline/analysis-barrier.js");
  const { pipelineWiring } = await import("../../packages/host/dist/pipeline/wiring.js");
  const source = "export function head(flag:boolean):boolean { if(flag) { let unread:boolean; return unread; } return tail(true); }\n"
    + "export function tail(flag:boolean):boolean { return head(flag); }";
  const input = analysisInput(await loadFrontFixture(), "sdk-minimal", source);
  const checked = captureSourceBarrier(input);
  assert.equal(checked.kind, "ok");
  const account = createAccount(input.limits.dataflow);
  const typed = typeSourceBarrier(input, checked.value, account);
  assert.equal(typed.kind, "ok");
  const converge = pipelineWiring.summaries.convergeComponent;
  const round = pipelineWiring.bodyAnalysis.analyzeBodyRound;
  let members;
  let received;
  pipelineWiring.summaries.convergeComponent = (deps, component) => {
    if (component.members.length === 2) members = component.members.map(row => executionKey(row.execution));
    return converge(deps, component);
  };
  pipelineWiring.bodyAnalysis.analyzeBodyRound = (deps, input) => round({ ...deps, summaryOf: (key, admittedKey) => {
    const selected = deps.summaryOf(key, admittedKey);
    const statement = input.tir.root.kind === "Block" ? input.tir.root.statements.nodes[0] : null;
    if (statement?.kind === "ReturnStatement" && statement.expression?.kind === "CallExpression"
      && "kind" in selected && selected.kind === "prior-error") received = { deps, input, selected, admittedKey };
    return selected;
  } }, input);
  try {
    const result = analyzeTypedSource(input, typed.value, account);
    assert.equal(result.kind, "refused");
    assert.deepEqual(result.diagnostics.map(row => [row.code.rendered, row.site.origin.start]),
      [["TSONIC_READ_BEFORE_INITIALIZATION", source.lastIndexOf("unread")]]);
    assert.equal(members.length, 2);
    const request = { query: "bodyFactsOf", key: members[0] };
    const outcomes = members.map(execution => typed.value.database.errorOf({ request, position: { kind: "execution-result", execution } }));
    assert.equal(outcomes.every(outcome => outcome.kind === "completed" && outcome.error?.causes.length === 1), true);
    const [ground] = outcomes[0].error.causes;
    assert.equal(ground.kind, "unit");
    assert.equal(ground.unit.position.kind, "execution-source-node");
    assert.deepEqual(outcomes[1].error.causes, [ground]);
    const original = typed.value.database.errorOf(ground.unit);
    assert.equal(original.kind, "completed");
    assert.equal(original.error.causes[0].kind, "diagnostic");
    assert.ok(received);
    assert.equal(received.selected.grounds.length, 1);
    const [retainedGround] = received.selected.grounds;
    assert.deepEqual(retainedGround, ground.unit);
    const attempt = (sparse, maxima = limits) => {
      const account = createAccount(maxima);
      const reads = [];
      const grounds = [];
      Object.defineProperty(grounds, 0, { get() {
        const { work, entries } = InvocationAccount.stateOf(account);
        reads.push({ work, entries });
        return retainedGround;
      } });
      if (sparse) {
        grounds.length = 2;
        assert.equal(1 in grounds, false);
      }
      return { account, reads, run: () => analyzeBodyRound({ ...received.deps, account, summaryOf: (_key, admittedKey) => {
        assert.equal(admittedKey, received.admittedKey);
        return { kind: "prior-error", grounds };
      } }, received.input) };
    };
    const dense = attempt(false);
    const usable = dense.run();
    assert.equal(usable.kind, "complete");
    assert.equal(usable.value.value.kind, "error");
    assert.strictEqual(usable.value.value.causes[0].unit, retainedGround);
    assert.deepEqual(usable.value.emissions, []);
    assert.equal(dense.reads.length, 1);
    const [first] = dense.reads;
    const malformed = attempt(true);
    const message = "An absorbed initialization cause must name its actual ground.";
    let invalid;
    assert.throws(() => { invalid = malformed.run(); }, error => {
      assert.equal(error.message, message);
      assert.deepEqual(error.cause, { owner: "analyses/body", query: null, origin: null, message });
      return true;
    });
    assert.equal(invalid, undefined);
    assert.deepEqual(malformed.reads, dense.reads);
    for (const [maxima, dimension, readCount] of [
      [{ ...limits, maximumWork: first.work - 1 }, "work", 0],
      [{ ...limits, maximumWork: first.work }, "work", 1],
      [{ ...limits, maximumResultEntries: first.entries }, "result-entries", 1],
    ]) {
      const cut = attempt(true, maxima);
      const refused = cut.run();
      assert.strictEqual(refused, accountFailure(cut.account));
      assert.equal(refused.dimension, dimension);
      assert.equal("value" in refused, false);
      assert.deepEqual(cut.reads, dense.reads.slice(0, readCount));
    }
  } finally {
    pipelineWiring.summaries.convergeComponent = converge;
    pipelineWiring.bodyAnalysis.analyzeBodyRound = round;
  }
});

test("one execution grounds its result in the distinct direct read and placed detector", async () => {
  const { loadFrontFixture } = await import("./fixtures/front/checked-module.mjs");
  const { analysisInput } = await import("./fixtures/front/analysis-input.mjs");
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const { analyzeTypedSource } = await import("../../packages/host/dist/pipeline/analysis-barrier.js");
  const { pipelineWiring } = await import("../../packages/host/dist/pipeline/wiring.js");
  const source = "export function read(flag:boolean):boolean { if(flag){let own:boolean;return own;} for(let first:boolean,second:boolean=first;;){return second;} }";
  const input = analysisInput(await loadFrontFixture(), "sdk-minimal", source);
  const checked = captureSourceBarrier(input);
  assert.equal(checked.kind, "ok");
  const account = createAccount(input.limits.dataflow);
  const typed = typeSourceBarrier(input, checked.value, account);
  assert.equal(typed.kind, "ok");
  const round = pipelineWiring.bodyAnalysis.analyzeBodyRound;
  const observations = [];
  pipelineWiring.bodyAnalysis.analyzeBodyRound = (deps, input) => {
    const output = round(deps, input);
    if (output.kind === "complete" && output.value.kind === "ok" && output.value.emissions.length !== 0)
      observations.push({ input, output: output.value });
    return output;
  };
  try {
    const result = analyzeTypedSource(input, typed.value, account);
    assert.equal(result.kind, "refused");
    assert.equal("value" in result, false);
    assert.equal(observations.length, 1);
    const [{ input: executing, output }] = observations;
    assert.equal(output.emissions.length, 2);
    assert.equal(executing.tir.root.kind, "Block");
    const [conditional] = executing.tir.root.statements.nodes;
    assert.equal(conditional.kind, "IfStatement");
    const own = conditional.thenStatement.statements.nodes.at(-1).expression;
    assert.equal(own.kind, "Identifier");
    assert.equal(own.text, "own");
    const placed = executing.mir.blocks.filter(({ terminator }) => terminator.kind === "call"
      && terminator.origin.start === source.indexOf("second:boolean=first"));
    assert.equal(placed.length, 1);
    const [block] = placed;
    assert.equal(block.terminator.callee.kind, "body");
    assert.notEqual(own.id, block.terminator.tir.node);
    const execution = executionKey(executing.execution);
    const units = [];
    for (const [position, [site, node]] of [
      ["own", { body: executing.tir.body, node: own.id }],
      ["second:boolean=first", block.terminator.tir],
    ].entries()) {
      const emission = output.emissions[position];
      assert.equal(emission.identity.kind, "host");
      const unit = emission.identity.unit;
      assert.deepEqual(unit.position, { kind: "execution-source-node", execution, node });
      const { origin } = emission.diagnostic.site;
      assert.equal(source.slice(origin.start, origin.start + origin.length), site);
      assert.equal(emission.diagnostic.code.rendered, "TSONIC_READ_BEFORE_INITIALIZATION");
      assert.strictEqual(result.diagnostics[position], emission.diagnostic);
      assert.deepEqual(typed.value.database.errorOf(unit), {
        kind: "completed", error: { kind: "error", causes: [{ kind: "diagnostic", diagnostic: emission.identity }] },
      });
      units.push(unit);
    }
    assert.equal(result.diagnostics.length, units.length);
    assert.strictEqual(units[0].request, units[1].request);
    const member = { request: units[0].request, position: { kind: "execution-result", execution } };
    const completed = typed.value.database.errorOf(member);
    assert.equal(completed.kind, "completed");
    assert.deepEqual(completed.error.causes, units.map(unit => ({ kind: "unit", unit })));
  } finally {
    pipelineWiring.bodyAnalysis.analyzeBodyRound = round;
  }
});

test("the canonical reference lattice compares values, pays joins and treats unreachable state as bottom", () => {
  const { current, pair, initial, state, operation, point, summary, unit } = referenceRound("body-round.value-lattice");
  const rows = [...pair.facts.arena.origins];
  const reference = state[0];
  const absent = rows.length;
  rows.push({ id: absent, kind: "complete", producers: [], includesAbsence: true });
  const other = pair.facts.arena.contexts[0].arguments[1].origins;
  const values = indexedOrigins(current, rows);
  const contentState = (origins, contents = new Set()) => ({ origins, contents });
  const boundary = contentState(state);
  const make = (account = createAccount(limits), answer = summary, reachable = current.input.mir.blocks.map(() => true), admit = () => null) =>
    valueProblem({ ...current.deps, account }, current.input, pair.facts.arena, values, [], initial, boundary, reachable, admit, new Map(),
      new Set([0, 1]), new Map([[point.block, answer]]), null, null,
      () => assert.fail("This summary provides only root values."));
  const problem = make();
  const lattice = problem.lattice;
  assert.equal(lattice.equals(boundary, boundary, createAccount(limits)), true);
  assert.equal(lattice.equals(null, boundary, createAccount(limits)), false);
  assert.equal(lattice.equals(boundary, null, createAccount(limits)), false);
  assert.equal(lattice.equals(boundary, contentState([...state]), createAccount(limits)), true);
  assert.equal(lattice.equals(contentState([reference]), contentState([other]), createAccount(limits)), false);
  assert.equal(lattice.equals(contentState([reference]), contentState([0]), createAccount(limits)), false);
  assert.equal(lattice.equals(contentState([0]), contentState([absent]), createAccount(limits)), false);
  assert.equal(lattice.join(null, boundary, createAccount(limits)), boundary);
  assert.equal(lattice.join(boundary, null, createAccount(limits)), boundary);
  assert.equal(lattice.join(boundary, boundary, createAccount(limits)), boundary);
  assert.equal(lattice.equals(boundary, contentState(state, new Set([0])), createAccount(limits)), false);
  assert.equal(lattice.equals(contentState(state, new Set([0])), contentState(state, new Set([1])), createAccount(limits)), false);
  assert.equal(lattice.equals(contentState(state, new Set([0])), contentState(state, new Set([0])), createAccount(limits)), true);
  assert.deepEqual(lattice.join(contentState(state, new Set([0])), contentState(state, new Set([1])), createAccount(limits)),
    contentState(state, new Set([0, 1])));
  const reset = { kind: "storage-live", local: 0, origin: operation.origin };
  assert.deepEqual(problem.statement(reset, contentState(state, new Set([0])), createAccount(limits), 0, 0).contents, new Set());
  assert.deepEqual(problem.statement(reset, boundary, createAccount(limits), 0, 0).contents, new Set());
  assert.equal(problem.statement({}, null, createAccount(limits), 0, 0), null);
  assert.deepEqual(problem.terminator({}, null, createAccount(limits), 0), []);
  assert.deepEqual(make(createAccount(limits), summary, []).terminator({ kind: "goto", target: 0 }, boundary,
    createAccount(limits), point.block), []);
  assert.deepEqual(make(createAccount(limits), { ...summary, returns: false })
    .terminator(operation, boundary, createAccount(limits), point.block), []);
  assert.throws(() => make(createAccount(limits), { kind: "error", key: "error", provided: 1, unit })
    .terminator(operation, boundary, createAccount(limits), point.block), /already-completed semantic answer/);
  for (const dimension of ["maximumWork", "maximumResultEntries"]) for (const action of [
    (kernel, account) => kernel.lattice.join(contentState([reference], new Set([0])), contentState([other], new Set([1])), account),
    (kernel, account) => kernel.lattice.equals(contentState(state, new Set([0])), contentState([...state], new Set([0])), account),
    (kernel, account) => kernel.statement(reset, contentState(state, new Set([0])), account, 0, 0),
    (kernel, account) => kernel.terminator({ ...operation, destination: null }, boundary, account, point.block),
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
      }), [], [], unread, {}, null), stop);
    }
    assert.equal(complete, true);
  }
  const account = createAccount(limits);
  const refusal = { kind: "refused", diagnostics: [] };
  const rejected = make(account, {}, [], () => refuseAccount(account, refusal));
  const rejectedLeft = contentState([reference]);
  assert.equal(rejected.lattice.join(rejectedLeft, contentState([pair.facts.arena.contexts[0].arguments[2].origins]), account), rejectedLeft);
  assert.equal(accountFailure(account), refusal);
});

test("real many-slot joins and immediate callee exit contents use one linear paid content copy", () => {
  for (const count of [4, 16, 64]) {
    const name = `body-round.content-batch.${String(count).padStart(3, "0")}`;
    const childName = `${name}.value`;
    const childBody = bodyId(childName, "default-argument");
    const builder = builders(name);
    const names = Array.from({ length: count }, (_, index) => `slot${index}`);
    const program = typedBody(name, { signature: signature(name,
      [...names.map(slot => [slot, T.bool]), ["value", T.bool, "default", childBody]], T.bool), completion: T.bool,
      params: [...names.map((_, index) => [index, "required", T.bool]), [count, "default", T.bool, childBody]],
      locals: [...names.map(slot => [slot, "parameter", T.bool, true]), ["value", "parameter", T.bool]],
      root: builder.block(builder.returns(builder.id("value", count, T.bool))) });
    const captures = names.map((_, local) => ({ local: { body: program.tir.body, local }, capture: "captured-location" }));
    const childBuilder = builders(childName, "default-argument");
    const root = () => names.map((slot, local) => childBuilder.assign(childBuilder.target(slot, local, T.bool), "EqualsToken",
      childBuilder.keyword("TrueKeyword", T.bool), T.bool, T.bool)).reduce((left, right) => childBuilder.sequence(left, right, T.bool));
    const childProgram = typedBody(childName, { role: "default-argument", signature: signature(childName, [], T.bool), completion: T.bool,
      locals: names.map((slot, index) => [slot, "capture", T.bool, true, captures[index].local]), captures, root: root() });
    childProgram.tir.root = seal(childName, root(), "default-argument", program.nodeCount).root;
    childProgram.tir.root.parent = program.tir.params[count].id;
    program.tir.params[count].initializer = childProgram.tir.root;
    const bodies = [program.tir, childProgram.tir];
    program.bodyOf = childProgram.bodyOf = instance => bodies.find(tir => sameInstance(instance, { body: tir.body, bindings: tir.bindings })) ?? null;
    const current = fixture(program, [{ instance: { body: childBody, bindings: childProgram.tir.bindings },
      captures, signature: childProgram.tir.signature }], count);
    const child = fixture(childProgram);
    child.related = [current];
    const summary = checkedPair(child, analyzeBodyRound(child.deps, child.input)).summary;
    current.related = [child];
    current.deps.summaryOf = () => ({ value: summary, unit: { request: child.deps.unit, position: { kind: "result" } } });
    const pair = checkedPair(current, analyzeBodyRound(current.deps, current.input));
    const block = current.input.mir.blocks.find(row => row.terminator.kind === "call");
    const locals = block.terminator.callee.captures.map(row => current.input.mir.places[row.place].base.local);
    const left = new Set(locals.slice(0, count / 2));
    const right = new Set(locals.slice(count / 2));
    const origins = current.input.mir.locals.map(() => 0);
    const state = { origins, contents: left };
    const other = { origins, contents: right };
    const values = indexedOrigins(current, [...pair.facts.arena.origins]);
    const activation = pair.facts.origins.activations.find(row => row.point.block === block.id);
    const contexts = new Map([[block.id, pair.facts.arena.contexts[activation.context].captures]]);
    const make = account => valueProblem({ ...current.deps, account }, current.input, pair.facts.arena, values, [], origins, state,
      current.input.mir.blocks.map(() => true), () => null, contexts, new Set(locals), new Map([[block.id, summary]]), null, null,
      () => assert.fail("A location capture is not a projected parameter."));
    const expected = new Set(locals);
    const length = origins.length;
    const joinWork = 3 * length + count + 1;
    const joinEntries = length + count + 4;
    const preludeWork = count + 2 * childBody.length + 11;
    const callWork = length + 9 * count + count / 2 + 8;
    const callEntries = length + 2 * count + 9;
    const actions = [
      { work: joinWork, entries: joinEntries, run: (kernel, account) => kernel.lattice.join(state, other, account).contents },
      { work: callWork, entries: callEntries, run: (kernel, account) =>
        kernel.terminator(block.terminator, state, account, block.id)[0]?.state.contents },
    ];
    const measured = createAccount(limits);
    assert.equal(callSummary({ ...current.deps, account: measured }, current.input.mir, block.terminator).kind, "complete");
    assert.equal(limits.maximumWork - remainingWork(measured), preludeWork, "the selected identity/read prelude is paid independently of content copying");
    for (const action of actions) for (const [dimension, required] of [["maximumWork", action.work], ["maximumResultEntries", action.entries]]) {
      for (let maximum = 0; maximum <= required; maximum += 1) {
        const account = createAccount({ ...limits, [dimension]: maximum });
        const kernel = make(account);
        const result = action.run(kernel, account);
        if (maximum === required) {
          assert.equal(accountFailure(account), null, `linear ${count}-cell ${dimension} allowance is sufficient`);
          assert.deepEqual(result, expected);
        } else {
          const stop = accountFailure(account);
          assert.notEqual(stop, null, `each smaller ${dimension} stops before publication`);
          const unread = new Proxy({}, { get() { assert.fail("No immutable state read after the same original stop."); } });
          assert.equal(kernel.lattice.join(unread, unread, account), unread);
          assert.equal(accountFailure(account), stop);
        }
        assert.deepEqual(state.contents, left, "the original borrowed state is never mutated");
        assert.deepEqual([...left], locals.slice(0, count / 2));
        assert.deepEqual([...right], locals.slice(count / 2));
      }
    }
  }
});

test("finite exit content unions pay their own current-cell projection and preserve the original refusal", () => {
  const { current, pair } = referenceRound("body-round.exit-current-state");
  const rows = [...pair.facts.arena.origins];
  const values = indexedOrigins(current, rows);
  const [first, second] = pair.facts.arena.contexts[0].arguments.map(slot => slot.origins);
  const collect = (account, output, admit = () => null) => collectExitContents({ ...current.deps, account },
    [second], [first], new Set([0]), [0], output, values, admit);
  const output = new Map([[0, first]]);
  assert.equal(collect(createAccount(limits), output), null);
  assert.deepEqual(rows[output.get(0)].producers, [0, 1], "each actual finite exit contributes its current value, not a may-history row");
  for (const dimension of ["maximumWork", "maximumResultEntries"]) for (const prior of [[], [[0, first]]]) {
    let complete = false;
    for (let maximum = 0; maximum < 200; maximum += 1) {
      const account = createAccount({ ...limits, [dimension]: maximum });
      const result = collect(account, new Map(prior));
      if (result === null) { complete = true; break; }
      assert.equal(result, accountFailure(account));
      const unread = new Proxy({}, { get() { assert.fail("No finite-exit state read after original refusal."); } });
      assert.equal(collectExitContents({ ...current.deps, account }, unread, unread, unread, unread, unread, unread, unread), result);
    }
    assert.equal(complete, true);
  }
  const rejected = createAccount(limits);
  const refusal = { kind: "refused", diagnostics: [] };
  const third = pair.facts.arena.contexts[0].arguments[2].origins;
  assert.equal(collectExitContents({ ...current.deps, account: rejected }, [third], [first], new Set([0]), [0], new Map([[0, first]]),
    values, () => refuseAccount(rejected, refusal)), refusal);
  assert.equal(removeUnchangedContents({ ...current.deps, account: rejected }, new Proxy({}, {
    get() { assert.fail("No finite-exit projection after its original refusal."); },
  }), [], [], values), refusal);
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

test("unsupported projections, parameter writes and external retention remain explicit call boundaries", async () => {
  const { projectionEffects } = await import("../../packages/host/dist/analyses/body/projection-effects.js");
  const { current, pair, operation, point, summary } = referenceRound("body-round.reference-effects");
  const arena = pair.facts.arena;
  const context = pair.facts.origins.activations[0].context;
  const entries = [{ formal: 0, actual: arena.contexts[context].arguments[0].origins }];
  const apply = value => {
    const deps = { ...current.deps, account: createAccount(limits) };
    const fields = projectionEffects(deps, new Map(), null, [], () => assert.fail("An unsupported read must not retain a projection."), () => null,
      { lexical: current.input.tir.lexicalBindings, scopeOf: () => assert.fail("An unsupported read must not reach a caller field scope.") });
    return applyScalarCall(deps, current.input, operation, point, value, arena, context, entries, [],
      (access, parameter) => fields.call(operation, access, parameter, value, arena), null);
  };
  for (const field of ["reads", "writes"]) assert.throws(() => apply({ ...summary,
    arena: { ...summary.arena, projections: [{ id: 0, parent: null, projection: { kind: "element" } }] },
    parameters: summary.parameters.map(row => ({ ...row, [field]: { kind: "complete", paths: [0] } })),
  }), /actual selected array formal/);
  assert.throws(() => apply({ ...summary, retention: summary.retention.map(row => ({ ...row, into: { kind: "parameter", index: 0, path: null } })) }),
    /external retention transport/);
  assert.throws(() => apply({ ...summary, initialization: { ...summary.initialization,
    points: [{ kind: "before", at: summary.retention[0].at, subject: { owner: { kind: "summary", key: summary.key }, producer: 0 } }],
    rows: [{ point: 0, cell: null, condition: 0 }] } }), /actual supplied cell and completion-event bindings/);
});

test("one held field joins its independently selected arms at paid cuts without joining effect subjects", async () => {
  const { projectionEffects } = await import("../../packages/host/dist/analyses/body/projection-effects.js");
  const { loadFrontFixture } = await import("./fixtures/front/checked-module.mjs");
  const { analysisInput } = await import("./fixtures/front/analysis-input.mjs");
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { admitSelectionIdentity } = await import("../../packages/host/dist/ir-facts/index.js");
  const { InvocationAccount } = await import("../../packages/host/dist/dataflow/account.js");
  const input = analysisInput(await loadFrontFixture(), "sdk-minimal", `
    export type Box = { flag: boolean };
    export function touch(before: Box, after: Box, value: boolean): boolean {
      after.flag = value;
      return before.flag;
    }
  `);
  const program = analyzeHostProgram(input);
  assert.equal(program.kind, "ok");
  const selected = program.value.modules.find(module => module.module === input.snapshot.entryPoint)
    .bodies.find(row => row.kind === "selected" && row.tir.params.length === 3);
  const [assigned, returned] = selected.tir.root.statements.nodes;
  const selections = { write: assigned.expression.left.tsonic.selection.decision, read: returned.expression.tsonic.selection.decision };
  const { arena } = selected.facts.find(row => row.execution.provided === 3);
  const [before, after] = arena.contexts[0].arguments;
  const subjects = { read: arena.origins[before.origins], write: arena.origins[after.origins] };
  assert.equal(selections.read.decision.write, null);
  assert.equal(selections.write.decision.read, null);
  for (const [first, next] of [["read", "write"], ["write", "read"]]) {
    const run = maxima => {
      const account = createAccount(maxima);
      const fields = projectionEffects({ account }, new Map([[0, "field"], [1, "field"]]), null, [], () => null, () => null,
        { lexical: selected.tir.lexicalBindings, scopeOf: () => assert.fail("A direct field is not rebound.") });
      const observe = role => fields.observe(role, { kind: "field", member: selections[role] }, subjects[role], arena.boundProducers, arena.producers);
      assert.equal(observe(first), null);
      const prefix = { ...InvocationAccount.stateOf(account) };
      return { fields, account, prefix, observe, projection: fields.projections[0] };
    };
    const complete = run(limits);
    assert.equal(complete.observe(next), null);
    assert.equal(complete.fields.projections.length, 1);
    const merged = complete.fields.projections[0].projection.member.decision;
    assert.equal(merged.read, selections.read.decision.read);
    assert.equal(merged.write, selections.write.decision.write);
    assert.deepEqual([...complete.fields.paths("read", "parameter", 0)], [0]);
    assert.deepEqual([...complete.fields.paths("write", "parameter", 1)], [0]);
    assert.equal(complete.fields.paths("read", "parameter", 1), undefined);
    assert.equal(complete.fields.paths("write", "parameter", 0), undefined);
    const identity = createAccount(limits);
    assert.equal(admitSelectionIdentity(selections[next], identity), null);
    const charge = InvocationAccount.stateOf(identity);
    for (const [maxima, dimension] of [
      [{ ...limits, maximumWork: complete.prefix.work + charge.work + 1 + 4 + 10 - 1 }, "work"],
      [{ ...limits, maximumResultEntries: complete.prefix.entries + charge.entries + 4 - 1 }, "result-entries"],
    ]) {
      const stopped = run(maxima);
      const refusal = stopped.observe(next);
      assert.equal(refusal.dimension, dimension);
      assert.strictEqual(refusal, accountFailure(stopped.account));
      assert.ok(stopped.fields.projections[0] === stopped.projection);
      assert.strictEqual(stopped.observe(next), refusal);
    }
  }
});

test("selected reference-call helpers keep genuine unsupported inputs explicit and stop before reader payloads", () => {
  const { current, pair, operation, point, summary, state, initial } = referenceRound("body-round.reference-boundaries");
  const invoke = (changed = operation, answer = summary, overrides = {}) => callValueEffects({ ...current.deps,
    account: createAccount(limits), ...overrides }, current.input, changed, point, answer, pair.facts.arena,
    operand => operandOrigins(current.input, [], state, operand, null, null, null), [], null, null, null,
    () => assert.fail("The selected reference formal has no projected producer."));
  assert.throws(() => invoke({ ...operation, callee: { kind: "body", instance: current.execution.instance, captures: [] } }),
    /A selected callee entry value requires its actual argument or capture transport/u);
  assert.throws(() => invoke({ ...operation, arguments: [{ kind: "place", place: 0 }] }), /actual operand/);
  assert.throws(() => invoke(operation, { ...summary, arena: { ...summary.arena,
    producers: [{ id: 0, kind: "capture", path: null, index: 0 }] } }), /A selected callee entry value requires its actual argument or capture transport/u);
  for (const role of [{ kind: "capture", index: 0 }, { kind: "parameter", index: 0 }])
    assert.throws(() => invoke(operation, { ...summary, arena: { ...summary.arena,
      cells: [{ id: 0, role, occurrence: { kind: "entry", execution: summary.key.execution, local: 0 }, lifetimes: [] }] } }),
    /actual static, capture or created-cell binding/);
  const enumeration = declareType("bodyRoundCallReferenceEnum", { kind: "enum", definition: def("bodyRoundCallReferenceEnum") });
  assert.throws(() => invoke(operation, summary, { signatureOf: () => ({ ...TABLE.signatures[summary.signature], result: enumeration }) }),
    /selected call-result representation/);
  assert.throws(() => transferValue(current.deps, current.input, [], initial, state,
    { kind: "assign", place: operation.destination, tir: operation.tir, origin: operation.origin,
      value: { kind: "convert", operand: operation.arguments[0].operand } }, null), /reference operation value producer/);
});

test("a direct reference throw carries its original value through cleanup unless the finalizer returns", async () => {
  const { analyzeOptionalSource } = await import("./fixtures/optional-default.mjs");
  const result = await analyzeOptionalSource(`
    export function escape(value: string, replacement: string): string {
      try { throw value; } finally { value = replacement; }
    }
    export function override(value: string, replacement: string): string {
      try { throw value; } finally { return replacement; }
    }
  `);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  for (const [name, overridden] of [["escape", false], ["override", true]]) {
    const body = result.value.modules.flatMap(module => module.bodies).find(row =>
      row.kind === "selected" && row.instance.body.includes(`;${name}];function;0]`));
    assert.ok(body);
    const [facts] = body.facts;
    const summary = result.value.index.summaries.find(row => row.key.kind === "body"
      && executionKey(row.key.execution) === executionKey(facts.execution));
    assert.ok(summary);
    const operations = body.mir.blocks.map(block => block.terminator);
    const thrown = operations.find(operation => operation.kind === "throw");
    assert.equal(thrown.unwind.kind, "carry");
    assert.equal(body.mir.blocks[thrown.unwind.target].terminator.kind, "cleanup-enter");
    assert.equal(summary.returns, overridden);
    assert.equal(summary.unwinds, !overridden);
    const observed = summary.arena.origins[overridden ? summary.result : summary.thrown];
    const suppressed = summary.arena.origins[overridden ? summary.thrown : summary.result];
    assert.equal(observed.kind, "complete");
    assert.equal(observed.includesAbsence, false);
    assert.deepEqual(observed.producers.map(bound => {
      const producer = summary.arena.producers[summary.arena.boundProducers[bound].producer];
      return [producer.kind, producer.index, producer.path];
    }), [["parameter", overridden ? 1 : 0, null]]);
    assert.deepEqual(suppressed.producers, []);
  }
});

test("S-1: a reference-valued field default copies the actual fallback only on the absence edge", async () => {
  const { loadFrontFixture } = await import("./fixtures/front/checked-module.mjs");
  const { analysisInput } = await import("./fixtures/front/analysis-input.mjs");
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const input = analysisInput(await loadFrontFixture(), "sdk-minimal", `
  export function property(input: { value: string }): string { return input.value; }
  export function binding(input: { value: string }): string { const { value } = input; return value; }
  export function fallback(input: { seed: string; value?: string }): string {
    const { seed, value = seed } = input;
    return value;
  }
  export function present(input: { seed: string; value: string }): string {
    const { seed, value = seed } = input;
    return value;
  }
  type Holder = { value: string };
  function project(input: Holder): string { const { value } = input; return value; }
  export function forward(input: Holder): string { return project(input); }
`);
  const bounded = (maximumWork, maximumResultEntries) => analyzeHostProgram({ ...input, limits: { ...input.limits,
    dataflow: { maximumWork, maximumResultEntries },
  } });
  const maximumWork = 140753;
  const maximumRecords = 18815;
  const result = bounded(maximumWork, maximumRecords);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const chapter = result.value.modules.find(row => row.module === input.snapshot.entryPoint);
  const originFields = (arena, origins) => arena.origins[origins].producers.map(reference => {
    const producer = arena.producers[arena.boundProducers[reference].producer];
    assert.equal(producer.kind, "parameter");
    assert.equal(producer.index, 0);
    const path = arena.projections[producer.path];
    assert.equal(path.parent, null);
    assert.equal(path.projection.kind, "field");
    return path.projection.member.decision.key.value;
  });
  for (const [name, resultFields, readFields] of [
    ["property", ["value"], ["value"]], ["binding", ["value"], ["value"]],
    ["fallback", ["seed", "value"], ["seed", "value"]], ["present", ["value"], ["seed", "value"]],
    ["forward", ["value"], ["value"]],
  ]) {
    const body = chapter.bodies.find(row => row.kind === "selected" && row.instance.body.includes(`;${name}];function;0]`));
    const [facts] = body.facts;
    const summary = result.value.index.summaries.find(row => row.key.kind === "body"
      && executionKey(row.key.execution) === executionKey(facts.execution));
    const value = summary.arena.origins[summary.result];
    assert.equal(value.kind, "complete");
    assert.equal(value.includesAbsence, false);
    assert.deepEqual(originFields(summary.arena, summary.result), resultFields);
    const [parameter] = summary.parameters;
    assert.equal(parameter.reads.kind, "complete");
    assert.deepEqual(parameter.reads.paths.map(id => summary.arena.projections[id].projection.member.decision.key.value), readFields);
    assert.deepEqual(parameter.writes, { kind: "complete", paths: [] });
    const operations = body.mir.blocks.map(block => block.terminator);
    const calls = operations.filter(operation => operation.kind === "call");
    if (name === "forward") {
      assert.equal(calls.length, 1);
      const [call] = calls;
      const [invocation] = facts.origins.invocations;
      assert.equal(call.callee.kind, "direct");
      assert.equal(facts.origins.invocations.length, 1);
      assert.equal(invocation.node, call.tir.node);
      assert.deepEqual(originFields(facts.arena, invocation.alternatives[0].result), ["value"]);
      continue;
    }
    if (name !== "fallback") {
      assert.equal(calls.length, 0);
      assert.deepEqual(facts.origins.activations, []);
      continue;
    }
    assert.equal(calls.length, 1);
    const [call] = calls;
    const [seed, leaf] = body.tir.root.statements.nodes[0].declarationList.declarations.nodes[0].name.elements.nodes;
    assert.equal(call.callee.kind, "body");
    assert.equal(call.callee.instance.body, leaf.tsonic.initializer);
    const [capture] = call.callee.captures;
    assert.deepEqual([capture.capture, capture.local], ["captured-value", seed.tsonic.declaration.local]);
    const split = operations.find(operation => operation.kind === "switch" && operation.tir.node === leaf.id);
    assert.equal(split.targets.length, 1);
    assert.deepEqual(body.mir.constants[split.targets[0].constant].value, { kind: "literal", value: { kind: "absence" } });
    assert.equal(body.mir.blocks[split.targets[0].target].terminator === call, true);
    assert.equal(body.mir.blocks[split.otherwise].terminator.kind, "goto");
    const [activation] = facts.origins.activations;
    assert.equal(facts.origins.activations.length, 1);
    assert.equal(activation.point.block, split.targets[0].target);
    const [copied] = facts.arena.contexts[activation.context].captures;
    assert.equal("cell" in copied, false);
    assert.deepEqual(originFields(facts.arena, copied.origins), ["seed"]);
  }
  for (const [dimension, work, records, maximum] of [
    ["work", maximumWork - 1, maximumRecords, maximumWork - 1],
    ["result-entries", maximumWork, maximumRecords - 1, maximumRecords - 1],
  ]) {
    const refused = bounded(work, records);
    assert.equal(refused.kind, "refused");
    assert.equal("value" in refused, false);
    assert.deepEqual(refused.diagnostics.map(row => [row.source, row.code.rendered, row.site, row.arguments]), [
      ["pipeline", "TSONIC_COMPILER_RESOURCE_LIMIT", { kind: "none" },
        [{ kind: "text", value: dimension }, { kind: "number", value: maximum }]],
    ]);
  }
});

test("canonical Origins unions retain strict supersets and deduplicate genuine overlapping alternatives", () => {
  const { current, pair } = referenceRound("body-round.reference-overlap");
  const rows = [...pair.facts.arena.origins];
  const values = indexedOrigins(current, rows);
  const [first, second, third] = pair.facts.arena.contexts[0].arguments.map(slot => slot.origins);
  const left = joinOrigins(current.deps, values, first, second, () => null);
  const right = joinOrigins(current.deps, values, second, third, () => null);
  assert.equal(joinOrigins(current.deps, values, first, left, () => null), left);
  const all = joinOrigins(current.deps, values, left, right, () => null);
  assert.deepEqual(rows[all].producers, [0, 1, 2]);
});

test("opaque native reference calls retain ordered referent effects and the actual returned value through their caller", async () => {
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { loadFrontFixture } = await import("./fixtures/front/checked-module.mjs");
  const { analysisInput } = await import("./fixtures/front/analysis-input.mjs");
  const fixture = await loadFrontFixture();
  const { sdk, packageOf, projectSnapshot, openAndCapture } = fixture;
  const reference = { package: packageOf("/text-provider"), moduleSpecifier: "./plugin.js", exportId: "provider", version: "1" };
  const provider = { identity: { id: "test.provider.open-reference", version: "1.0.0", extensionContractVersion: sdk.TstsSourceProviderContractVersion,
    diagnosticRange: { start: 9_900_000, end: 9_900_099 } }, declarationMaterialization: "complete",
    ownsModule: requested => ({ kind: requested === "native:text" ? "owned" : "unowned" }),
    resolveModule: requested => ({ kind: "virtual", moduleSpecifier: requested, virtualFileName: "/provider/native/text.d.ts", providerModuleId: "native.text" }),
    getDeclarationModel: () => ({ moduleSpecifier: "native:text", providerModuleId: "native.text", exports: [
      { id: "ResolveText", name: "nativeText", exportName: "resolve", kind: "function", signatures: [{ id: "ResolveText.string",
        parameters: [{ name: "value", type: { kind: "string" } }], returnType: { kind: "string" } }] },
    ] }) };
  const snapshot = projectSnapshot({
    sourceFiles: { "main.ts": 'import { resolve } from "native:text"; function forward(value:string):string {resolve(value); return resolve(value);}'
      + 'export function call(value:string):string{return forward(value);}'
      + 'function choose(value:string,flag:boolean):string {if(flag) return resolve(value); return resolve(value);}'
      + 'export function branch(value:string,flag:boolean):string {return choose(value,flag);}' },
    libraries: [{ name: "lib.es5.d.ts", text: sdk.barebonesLibContent }],
    providerPackages: [{ root: "/text-provider", name: "text-provider" }], declarationProviders: [reference],
  });
  const opened = openAndCapture(snapshot, [{ reference, value: { kind: "declaration-provider", value: provider } }]);
  const result = analyzeHostProgram({ ...analysisInput(fixture, "sdk-minimal"), snapshot, extensions: opened.deps.extensions });
  assert.equal(result.kind, "ok");
  const chapter = result.value.modules.find(row => row.module === snapshot.entryPoint);
  const executing = result.value.index.summaries.filter(summary => summary.key.kind === "body" && summary.parameters.length === 1);
  assert.equal(executing.length, 2);
  let discardedCalls = 0;
  for (const summary of executing) {
    const value = summary.arena.origins[summary.result];
    const reads = summary.parameters[0].reads;
    const writes = summary.parameters[0].writes;
    assert.equal(value.kind, "open");
    assert.equal(reads.kind, "open");
    assert.equal(writes.kind, "open");
    assert.equal(reads.boundaries.length, 2);
    assert.equal(reads.boundaries[0] < reads.boundaries[1], true);
    assert.deepEqual(writes.boundaries, reads.boundaries);
    assert.equal(value.boundaries.length, 1);
    assert.equal(reads.boundaries.includes(value.boundaries[0]), true);
    const selected = chapter.bodies.find(row => row.kind === "selected" && sameInstance(row.instance, summary.key.execution.instance));
    const calls = selected.mir.blocks.map(row => row.terminator).filter(terminator => terminator.kind === "call");
    const returned = calls.find(call => call.destination !== null);
    const discarded = calls.find(call => call.destination === null);
    const actual = summary.arena.boundaries[value.boundaries[0]];
    assert.equal(actual.kind, "opaque-invocation");
    assert.deepEqual(actual.at, { kind: "node", node: { kind: "body", value: returned.tir } });
    if (discarded !== undefined) {
      discardedCalls += 1;
      assert.deepEqual(reads.boundaries.map(id => summary.arena.boundaries[id].at.node.value.node).sort((left, right) => left - right),
        [discarded.tir.node, returned.tir.node]);
    } else assert.deepEqual(reads.boundaries.map(id => summary.arena.boundaries[id].at.node.value.node), [returned.tir.node, returned.tir.node]);
    assert.equal(summary.retention.some(row => row.into.kind === "external"), true);
    assert.equal(summary.returns && summary.unwinds, true);
  }
  assert.equal(discardedCalls, 1);
  const alternatives = result.value.index.summaries.filter(summary => summary.key.kind === "body" && summary.parameters.length === 2);
  assert.equal(alternatives.length, 2);
  for (const summary of alternatives) {
    const value = summary.arena.origins[summary.result];
    const { reads, writes } = summary.parameters[0];
    assert.equal(value.kind, "open");
    assert.equal(reads.kind, "open");
    assert.equal(writes.kind, "open");
    assert.equal(value.boundaries.length, 2);
    assert.equal(value.boundaries[0] < value.boundaries[1], true);
    assert.deepEqual(reads.boundaries, value.boundaries);
    assert.deepEqual(writes.boundaries, value.boundaries);
    assert.deepEqual(summary.parameters[1].writes, { kind: "complete", paths: [] });
    assert.equal(summary.returns && summary.unwinds, true);
  }
});

test("an actual discarded reference call retains its effects without writing a normal result destination", () => {
  const { target, summary } = referenceRound("body-round.discarded-reference-base");
  const current = fixture(shaped("body-round.discarded-reference", [["input", "required", T.string]], T.string, builder => builder.block(
    builder.expressionStatement(builder.call(builder.global("target", "body-round.discarded-reference-base.target", T.unknown),
      [{ $: "input", ...builder.id("input", 0, T.string) }], T.string, at => ({
        callee: callee("body-round.discarded-reference-base.target", target.program.tir.signature, [mapped(0, 0)], T.string), receiver: null,
        arguments: [{ kind: "provided", parameter: 0, expression: at("input") }],
      }))), builder.returns(builder.id("input", 0, T.string)))));
  current.related = [target];
  current.deps.summaryOf = () => ({ value: summary, unit: { request: target.deps.unit, position: { kind: "result" } } });
  const mir = { ...current.input.mir, blocks: current.input.mir.blocks.map(block => block.terminator.kind === "call"
    ? { ...block, terminator: { ...block.terminator, destination: null } } : block) };
  assert.deepEqual(verifyMir(mir, verificationContext(current.program)), { kind: "complete", violations: [] });
  const storage = analyzeStorageUse({ account: createAccount(limits) }, { execution: current.execution, body: mir });
  assert.equal(storage.kind, "ok");
  current.input = { ...current.input, mir, liveness: storage.value };
  const pair = checkedPair(current, analyzeBodyRound(current.deps, current.input));
  assert.equal(current.input.mir.blocks.find(row => row.terminator.kind === "call").terminator.destination, null);
  assert.equal(pair.facts.origins.writes.length, 0);
  assert.equal(pair.summary.result, pair.facts.arena.contexts[0].arguments[0].origins);
  for (const dimension of ["maximumWork", "maximumResultEntries"]) {
    let complete = false;
    for (let maximum = 0; maximum < 20000; maximum += 1) {
      const account = createAccount({ ...limits, [dimension]: maximum });
      const result = analyzeBodyRound({ ...current.deps, account }, current.input);
      if (result.kind === "complete") { checkedPair(current, result); complete = true; break; }
      assert.equal(result, accountFailure(account));
    }
    assert.equal(complete, true);
  }
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
  const joined = [...source];
  const values = indexedOrigins(current, joined);
  assert.equal(values.index.size, 4, "kind, each actual boundary and absence distinguish otherwise equal producer sets");
  assert.throws(() => valueOrigins(current.deps, [...source, { ...source[0], id: 4 }]), /distinct actual entry Origins rows/);
  assert.equal(joinOrigins(current.deps, values, 0, 1, () => null), 1);
  assert.equal(joinOrigins(current.deps, values, 1, 0, () => null), 1);
  const open = joinOrigins(current.deps, values, 1, 2, () => null);
  assert.deepEqual(joined[open], { id: open, kind: "open", producers: [0], includesAbsence: false, boundaries: [0, 1] });
  assert.equal(joinOrigins(current.deps, values, 2, 1, () => null), open);
  const absent = joinOrigins(current.deps, values, open, 3, () => null);
  assert.deepEqual(joined[absent], { id: absent, kind: "open", producers: [0], includesAbsence: true, boundaries: [0, 1] });
  const independent = [...joined, { id: joined.length, kind: "open", producers: [], includesAbsence: false, boundaries: [2] }];
  const openValues = indexedOrigins(current, independent);
  const boundaryOnly = joinOrigins(current.deps, openValues, 0, independent.length - 1, () => null);
  assert.deepEqual(independent[boundaryOnly], { id: boundaryOnly, kind: "open", producers: [0], includesAbsence: false, boundaries: [2] });
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
  const repeated = callValueEffects({ ...current.deps, account: createAccount(limits) }, current.input, operation,
    point, summary, pair.facts.arena, operand => operandOrigins(current.input, [], state, operand, null, null, null), [], null, null, null,
    () => assert.fail("The repeated call has only its direct reference argument."));
  assert.equal(repeated.kind, "complete");
  assert.equal(repeated.value.kind, "applied");
  const result = appliedOrigins({ ...current.deps, account: createAccount(limits) }, actual, repeated.value.value.result, (_count, retain) => {
      assert.equal(retain, false, "an existing payload admits alternatives without reserving a new relational row");
      return null;
    });
  assert.equal(result, alternative.result);
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
    const entry = pair.facts.arena.contexts[0].arguments[0].origins;
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
  const refusal = { kind: "refused", diagnostics: [resourceLimitDiagnostic({ owner: "analyses/body",
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
  const refusal = { kind: "refused", diagnostics: [resourceLimitDiagnostic({ owner: "analyses/body",
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
  const refusal = { kind: "refused", diagnostics: [resourceLimitDiagnostic({ owner: "analyses/body",
    limit: "analysis.maximumConditionAlternatives", maximum: 0, site: { kind: "source", origin: current.input.tir.root.origin }, unit })] };
  const account = createAccount(limits);
  assert.equal(proveInitialization({ account, unit: current.deps.unit, summaryOf: () => {
    refuseAccount(account, refusal);
    return new Proxy({}, { get() { throw new Error("no answer payload read after original callback refusal"); } });
  } }, input), refusal);
  for (const value of [pair.summary, { kind: "error", causes: [{ kind: "unit", unit }] }]) {
    const required = "kind" in value ? 8 : 2 * (2 + 3 + 1 + 5) + 5 + 8;
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

test("module initialization proof retains each real static once across returning module summaries", checkRepeatedStaticInitialization);

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
  const state = { written: new Set([local]), taint: null };
  assert.equal(transferAssigned(body, assignment, null, createAccount(limits)), null);
  const stopped = createAccount({ ...limits, maximumWork: 0 });
  assert.equal(transferAssigned(body, assignment, state, stopped), state);
  assert.equal(transferAssigned(body, assignment, state, stopped), state);
  const dead = { ...assignment, kind: "storage-dead", local };
  assert.deepEqual([...transferAssigned(body, dead, state, createAccount(limits)).written], []);
  assert.deepEqual(statementOperands(dead), []);
  const operand = { kind: "place", place: assignment.place };
  for (const kind of ["use", "unary", "convert"]) assert.deepEqual(statementOperands({ ...assignment,
    value: { kind, operand } }), [operand]);
  assert.throws(() => statementOperands({ ...assignment,
    value: { kind: "aggregate", type: T.int32Array, aggregate: { kind: "array", elements: [] } } }), /aggregate, capture or backing/);
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
      summaryOf: () => ({ value: summary, unit: origin }) }, input), /actual supplied cell and completion-event bindings/);
  }
  for (const kind of ["need", "before", "completed"]) {
    const summary = { ...pair.summary, initialization: { ...pair.summary.initialization, points: [{ kind }] } };
    assert.throws(() => proveInitialization({ account: createAccount(limits), unit: current.deps.unit,
      summaryOf: () => ({ value: summary, unit: origin }) }, input), /actual supplied cell and completion-event bindings/);
  }
});

test("body initialization uses the actual counted-loop condition and paid transparent read path", async () => {
  const { analyzeOptionalSource } = await import("./fixtures/optional-default.mjs");
  const { InvocationAccount } = await import("../../packages/host/dist/dataflow/account.js");
  const program = await analyzeOptionalSource("export function run(flag: boolean): boolean { "
    + "for (; flag; ) { break; } return (flag = !flag, ((flag))); }");
  assert.equal(program.kind, "ok");
  const { index, modules } = program.value;
  const body = modules.flatMap(module => module.bodies).find(row => row.kind === "selected" && row.tir.root.kind === "Block");
  const [loop, returned] = body.tir.root.statements.nodes;
  const result = returned.expression.expression.right.expression.expression;
  assert.equal(loop.kind, "ForStatement");
  assert.equal(result.kind, "Identifier");
  const execution = { instance: body.instance, provided: 1 };
  const liveness = analyzeStorageUse({ account: createAccount(limits) }, { execution, body: body.mir });
  assert.equal(liveness.kind, "ok");
  const deps = { types: index.types, typeOf: type => index.types.terms[type], signatureOf: signature => index.types.signatures[signature],
    summaryOf: () => assert.fail("This read path has no callee"), limits: analysisLimits,
    unit: { query: "bodyRound", key: executionKey(execution) } };
  const run = (account, tir = body.tir) => analyzeBodyRound({ ...deps, account }, { execution, tir, mir: body.mir, liveness: liveness.value });
  const complete = createAccount(limits);
  const expected = run(complete);
  assert.equal(expected.kind, "complete");
  assert.equal(expected.value.value.facts === undefined, false);
  const reads = expected.value.value.facts.initialization.reads;
  assert.equal(reads.some(row => row.node === loop.condition.id && row.assigned), true);
  assert.equal(reads.some(row => row.node === result.id && row.assigned), true);
  const { work, entries } = InvocationAccount.stateOf(complete);
  for (const [field, need] of [["maximumWork", work], ["maximumResultEntries", entries]]) {
    for (let maximum = 0; maximum < need; maximum += 1) {
      const account = createAccount({ maximumWork: work, maximumResultEntries: entries, [field]: maximum });
      assert.equal(run(account), accountFailure(account), `${field} ${maximum}`);
    }
  }
  assert.deepEqual(run(createAccount({ maximumWork: work, maximumResultEntries: entries })), expected);
  const root = body.tir.root;
  assert.throws(() => run(createAccount(limits), { ...body.tir, root: { ...root,
    statements: { ...root.statements, nodes: [{ ...loop, condition: null }, returned] } } }), /actual source occurrence/);
});

test("the module proof checks each published static exposure and propagates original reader stops", async () => {
  const { analyzeOptionalSource } = await import("./fixtures/optional-default.mjs");
  const { conditionRefusal } = await import("./fixtures/facts-verification.mjs");
  const { InvocationAccount } = await import("../../packages/host/dist/dataflow/account.js");
  const { decodeDefId } = await import("../../packages/host/dist/ids/index.js");
  const source = "export const ready: boolean = true; export let first: boolean; export let second: boolean;";
  const program = await analyzeOptionalSource(source);
  assert.equal(program.kind, "ok");
  const execution = program.value.index.initialization.modules[0];
  const record = program.value.modules.flatMap(module => module.bodies)
    .find(body => body.kind === "selected" && body.instance.body === execution.instance.body);
  const summary = program.value.index.summaries.find(row => row.key.kind === "body"
    && row.key.execution.instance.body === execution.instance.body);
  const declarations = record.tir.root.statements.nodes.flatMap(row => row.kind === "ready-statement" && row.node.kind === "VariableStatement"
    ? row.node.declarationList.declarations.nodes : []);
  const originOf = node => declarations
    .find(declaration => node.kind === "item" && declaration.id === node.value.node)?.origin ?? null;
  const reference = cell => ({ owner: { kind: "summary", key: summary.key }, cell });
  const cells = new Map(summary.arena.cells.map(cell => [decodeDefId(cell.role.declaration.definition).value.segments.at(-1).name, reference(cell.id)]));
  const unit = { query: "body-proof-static-exposure", key: "main" };
  const answer = { value: summary, unit: { request: unit, position: { kind: "result" } } };
  const input = { modules: [execution], entries: [], storage: [...cells.values()] };
  const check = (account, plan = input, overrides = {}) => proveInitialization({
    account, unit, summaryOf: () => answer, originOf, maximumConditionAlternatives: 64, conditionRefusal, ...overrides,
  }, plan);
  assert.equal(declarations.length, 3);
  const complete = createAccount(limits);
  const failed = check(complete);
  assert.equal(failed.kind, "complete");
  assert.equal(failed.value.value.kind, "error");
  assert.deepEqual(failed.value.diagnostics.map(row => row.site.origin), ["first", "second"].map(name =>
    originOf(summary.arena.cells[cells.get(name).cell].occurrence.at.node)));
  assert.equal(failed.value.value.causes.length, 2);
  const onlyReady = { ...input, storage: [cells.get("ready")] };
  assert.ok("modules" in check(createAccount(limits), onlyReady).value.value);
  const { work, entries } = InvocationAccount.stateOf(complete);
  for (const [dimension, needed] of [["work", work], ["result-entries", entries]]) {
    for (let maximum = 0; maximum < needed; maximum += 1) {
      const account = createAccount({ maximumWork: dimension === "work" ? maximum : work,
        maximumResultEntries: dimension === "result-entries" ? maximum : entries });
      assert.equal(check(account), accountFailure(account));
      assert.equal(accountFailure(account)?.dimension, dimension);
    }
  }
  assert.deepEqual(check(createAccount({ maximumWork: work, maximumResultEntries: entries })), failed);
  const untouched = { kind: "refused", diagnostics: failed.value.diagnostics };
  for (const route of ["summary", "source"]) {
    const account = createAccount(limits);
    let reads = 0;
    const stopped = check(account, input, {
      summaryOf: () => {
        if (route !== "summary" || reads++ === 0) return answer;
        refuseAccount(account, untouched);
        return { get value() { assert.fail("the refused summary is unread"); } };
      },
      originOf: () => { refuseAccount(account, untouched); return null; },
    });
    assert.equal(stopped, untouched);
  }
  assert.throws(() => check(createAccount(limits), input, { originOf: () => null }), /actual declaration source/);
  const withReference = (ref, value) => {
    let reads = 0;
    return check(createAccount(limits), { ...input, storage: [ref] }, { summaryOf: () => reads++ === 0 ? answer : { ...answer, value } });
  };
  assert.throws(() => withReference(undefined, summary), /actual exposed-storage cell binding/);
  assert.throws(() => withReference(reference(100), summary), /actual exposed-storage cell binding/);
  for (const value of [failed.value.value, { ...summary, key: { ...summary.key, execution: { ...execution, provided: 1 } } }])
    assert.throws(() => withReference(cells.get("ready"), value), /actual exposed-storage cell binding/);
  const stoppedAccount = createAccount({ ...limits, maximumWork: 1 });
  const unread = new Proxy(input.storage, { get(target, key) {
    assert.equal(key, "length", "a storage cell reference is not read before its work is admitted");
    return target.length;
  } });
  assert.equal(check(stoppedAccount, { modules: [], entries: [], storage: unread }), accountFailure(stoppedAccount));
});

test("the module proof discharges a constructed static need only from an earlier normal module exit", async () => {
  const { analyzeOptionalSource } = await import("./fixtures/optional-default.mjs");
  const { conditionRefusal } = await import("./fixtures/facts-verification.mjs");
  const { InvocationAccount } = await import("../../packages/host/dist/dataflow/account.js");
  const { programLookup } = await import("../../packages/host/dist/ir-program/program-values.js");
  const { verifyInitializationEffects } = await import("../../packages/host/dist/ir-program/verify-initialization.js");
  const { summaryKey } = await import("../../packages/host/dist/ir-facts/index.js");
  const source = "import './first.js'; export const ready: boolean = true; export function read(value: boolean): boolean { return value; }";
  const program = await analyzeOptionalSource(source, { "first.ts": "export const earlier: boolean = true;" });
  assert.equal(program.kind, "ok");
  const [first, writer] = program.value.index.initialization.modules;
  const lookup = programLookup(program.value.index);
  const store = lookup.summaries.get(summaryKey({ kind: "body", execution: writer }));
  const typed = program.value.modules.flatMap(module => module.bodies).find(body => body.kind === "selected" && body.tir.root.kind === "Block");
  const record = typed.facts[0];
  const reader = record.execution;
  const readerKey = { kind: "body", execution: reader };
  const stable = lookup.summaries.get(summaryKey(readerKey));
  const [cell] = store.arena.cells;
  const returning = typed.mir.blocks.find(block => block.terminator.kind === "return");
  const at = { kind: "body", execution: reader, point: { block: returning.id, statement: null }, edge: null };
  const expression = typed.tir.root.statements.nodes[0].expression;
  const read = { kind: "body", value: { body: reader.instance.body, node: expression.id } };
  const witness = { read, via: [] };
  const need = { kind: "need", cell: 0, at, witness };
  const pending = { ...stable, arena: { ...stable.arena, cells: [cell] }, initialization: {
    ...stable.initialization, cells: [0], points: [need, { kind: "return" }],
    rows: [{ point: 0, cell: null, condition: 0 }, { point: 0, cell: 0, condition: 0 }, { point: 1, cell: null, condition: 0 }],
  } };
  const unit = { query: "test-static-initialization-proof", key: ["ordered"] };
  const answer = value => ({ value, unit: { request: unit, position: { kind: "result" } } });
  const qualified = key => summaryKey(key) === summaryKey(pending.key);
  const requests = [];
  const deps = {
    summaryOf: key => { requests.push(key); return answer(qualified(key) ? pending : lookup.summaries.get(summaryKey(key))); },
    unit, conditionRefusal, maximumConditionAlternatives: analysisLimits.maximumConditionAlternatives,
    originOf: reference => { assert.deepEqual(reference, read); return expression.origin; },
    originAt: position => { assert.deepEqual(position, at); return returning.terminator.origin; },
    declarationOriginOf: definition => {
      assert.equal(definition, cell.role.declaration.definition);
      return program.value.modules.find(module => module.module === expression.origin.module).bodies
        .find(body => body.tir.root.kind === "SourceFile").tir.root.statements.nodes
        .find(statement => statement.kind === "ready-statement" && statement.node.kind === "VariableStatement").node
        .declarationList.declarations.nodes[0].origin;
    },
  };
  const ordered = { modules: [first, writer], entries: [reader], storage: [] };
  const missing = { modules: [], entries: [reader, writer], storage: [] };
  assert.deepEqual(proveInitialization({ ...deps, account: createAccount(limits) }, ordered).value.value,
    { modules: [first, writer], entries: [reader] });
  const failed = account => proveInitialization({ ...deps, account }, missing);
  const exact = createAccount(limits);
  const result = failed(exact);
  assert.equal(result.value.value.kind, "error");
  const [diagnostic] = result.value.diagnostics;
  assert.equal(diagnostic.code.name, "TSONIC_STATIC_READ_BEFORE_INITIALIZATION");
  assert.deepEqual(diagnostic.site, { kind: "source", origin: expression.origin });
  assert.deepEqual(diagnostic.related.map(row => row.site.origin), [deps.declarationOriginOf(cell.role.declaration.definition)]);
  assert.equal(result.value.emissions[0].diagnostic, diagnostic);
  assert.deepEqual(requests.map(key => key.execution), [first, writer, reader, reader]);
  const exercise = invoke => {
    const exact = createAccount(limits);
    assert.equal(invoke(exact).kind, "complete");
    const { work, entries } = InvocationAccount.stateOf(exact);
    for (const [dimension, needed] of [["work", work], ["result-entries", entries]]) {
      for (let maximum = 0; maximum < needed; maximum += 1) {
        const account = createAccount({ maximumWork: dimension === "work" ? maximum : work,
          maximumResultEntries: dimension === "result-entries" ? maximum : entries });
        const stopped = invoke(account);
        assert.equal(stopped.kind, "resource-limit");
        assert.equal(stopped, accountFailure(account));
      }
    }
  };
  exercise(failed);
  exercise(account => proveInitialization({ ...deps, account }, ordered));
  const effectsLookup = { ...lookup, summaries: new Map(lookup.summaries).set(summaryKey(readerKey), pending) };
  const conditionLimits = () => ({ account: createAccount(limits), eventCount: 0,
    maximumConditionAlternatives: analysisLimits.maximumConditionAlternatives, refusal: conditionRefusal });
  const plan = program.value.index.initialization;
  assert.equal(verifyInitializationEffects({ ...plan, modules: [writer], entries: [reader] }, effectsLookup, conditionLimits()).value, null);
  const violation = verifyInitializationEffects({ ...plan, modules: [], entries: [writer, reader] }, effectsLookup, conditionLimits()).value;
  assert.equal(violation.rule, "plan-initialized", "one exposed entry cannot initialize another exposed entry");
  const thrown = { ...store, returns: false, unwinds: true,
    initialization: { ...store.initialization, points: [{ kind: "unwind" }] } };
  const missingAfterUnwind = account => proveInitialization({ ...deps, account, summaryOf: key => {
    assert.equal(qualified(key), false, "execution never advances to this reader after the module cannot return");
    return answer(thrown);
  } }, { ...ordered, modules: [writer] });
  assert.equal(missingAfterUnwind(createAccount(limits)).value.value.kind, undefined);
  const through = structuredClone(pending);
  through.initialization.points[0].witness.via.push({ key: store.key, row: 0 });
  const writerBody = program.value.modules.flatMap(module => module.bodies)
    .find(body => body.kind === "selected" && body.instance.body === writer.instance.body);
  const placement = writerBody.mir.blocks.find(block => block.terminator.kind === "call");
  const modulePosition = { kind: "body", execution: writer, point: { block: placement.id, statement: null }, edge: null };
  const selected = { ...store, initialization: { ...store.initialization, points: [{ ...need, at: modulePosition }, { kind: "return" }],
    rows: pending.initialization.rows } };
  const via = (account, overrides = {}) => proveInitialization({ ...deps, account, summaryOf: key =>
    answer(qualified(key) ? through : selected), ...overrides }, missing);
  const propagated = via(createAccount(limits)).value.diagnostics[0];
  assert.deepEqual(propagated.related.map(row => row.site.origin), [
    returning.terminator.origin, deps.declarationOriginOf(cell.role.declaration.definition),
  ]);
  const nested = structuredClone(through);
  const earlierSummary = lookup.summaries.get(summaryKey({ kind: "body", execution: first }));
  nested.initialization.points[0].witness.via.push({ key: earlierSummary.key, row: 0 });
  const chain = account => proveInitialization({ ...deps, account, summaryOf: key => answer(qualified(key) ? nested
    : summaryKey(key) === summaryKey(store.key) ? selected : { ...earlierSummary, initialization: selected.initialization }),
  originAt: position => {
    if (position.execution.instance.body === writer.instance.body) {
      assert.deepEqual(position, modulePosition);
      return placement.terminator.origin;
    }
    return deps.originAt(position);
  } }, missing);
  assert.deepEqual(chain(createAccount(limits)).value.diagnostics[0].related.map(row => row.site.origin), [
    returning.terminator.origin, placement.terminator.origin, deps.declarationOriginOf(cell.role.declaration.definition),
  ]);
  exercise(chain);
  exercise(via);
  for (const [readerName, message] of [
    ["originOf", /qualified source read/], ["originAt", /actual propagation site/],
    ["declarationOriginOf", /retains its actual declaration/],
  ]) {
    assert.throws(() => via(createAccount(limits), { [readerName]: () => null }), message);
    const account = createAccount(limits);
    assert.equal(via(account, { [readerName]: () => { refuseAccount(account, conditionRefusal); return null; } }), conditionRefusal);
  }
  assert.throws(() => via(createAccount(limits), { summaryOf: key => answer(qualified(key) ? through : store) }),
    /actual propagated need/);
  for (const unusable of [{ ...store, initialization: { ...store.initialization, rows: [] } },
    { kind: "error", causes: [{ kind: "unit", unit: answer(store).unit }] }]) {
    assert.throws(() => via(createAccount(limits), { summaryOf: key => answer(qualified(key) ? through : unusable) }), /actual propagated need/);
  }
  const interrupted = createAccount(limits);
  assert.equal(via(interrupted, { summaryOf: key => {
    if (!qualified(key)) refuseAccount(interrupted, conditionRefusal);
    return answer(qualified(key) ? through : selected);
  } }), conditionRefusal);
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

test("inline tuple views borrow their actual initialized root and pay each reached place before reading it", async () => {
  const { loadFrontFixture } = await import("./fixtures/front/checked-module.mjs");
  const { analysisInput } = await import("./fixtures/front/analysis-input.mjs");
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { inlineTupleSlots } = await import("../../packages/host/dist/analyses/body/places.js");
  const { InvocationAccount } = await import("../../packages/host/dist/dataflow/account.js");
  const input = analysisInput(await loadFrontFixture(), "sdk-minimal",
    "export function start(pair: [boolean, boolean]): boolean { const [first, second] = pair; return second; }");
  const native = input.snapshot.nativeFacts;
  const completed = analyzeHostProgram({ ...input, snapshot: { ...input.snapshot,
    nativeFacts: { ...native, carrierHolding: [...native.carrierHolding, { carrier: "tuple", holding: "in-place" }] } } });
  assert.equal(completed.kind, "ok", JSON.stringify(completed.diagnostics));
  const chapter = completed.value.modules.find(row => row.module === input.snapshot.entryPoint);
  const body = chapter.bodies.find(row => row.kind === "selected" && row.tir.root.kind === "Block");
  const projected = body.mir.places.filter(place => place.base.kind === "place" && place.base.projection.kind === "element");
  assert.equal(projected.length, 2);
  const parent = body.mir.places[projected[0].base.place];
  assert.equal(parent.base.kind, "local");
  const roots = new Set([parent.base.local]);
  const run = (maximumWork, maximumResultEntries, rows = projected, admitted = roots) => {
    const account = createAccount({ maximumWork, maximumResultEntries });
    const reads = [];
    const lazy = new Array(rows.length);
    for (let index = 0; index < rows.length; index += 1)
      Object.defineProperty(lazy, index, { get() { reads.push(index); return rows[index]; } });
    const deps = { account, typeOf: type => completed.value.index.types.terms[type] };
    const result = inlineTupleSlots(deps, { tir: body.tir, mir: body.mir }, lazy, admitted);
    return { account, result, reads };
  };
  const exact = run(8, 3);
  assert.equal(exact.result.kind, "complete");
  assert.deepEqual([...exact.result.value], projected.map(place => [place.id, parent.base.local]));
  assert.deepEqual(exact.reads, [0, 1]);
  const paid = InvocationAccount.stateOf(exact.account);
  assert.deepEqual([paid.work, paid.entries], [8, 3]);
  for (const [work, entries, prefix] of [[2, 3, []], [3, 3, [0]], [6, 3, [0]], [7, 3, [0, 1]],
    [8, 0, []], [8, 1, [0]], [8, 2, [0, 1]]]) {
    const stopped = run(work, entries);
    assert.equal(stopped.result, accountFailure(stopped.account));
    assert.deepEqual(stopped.reads, prefix);
    assert.equal("value" in stopped.result, false);
  }
  assert.throws(() => run(8, 3, projected, new Set()), /actual proven inline parent/);
  const crossed = { ...projected[0], base: { ...projected[0].base, projection: { kind: "element", index: 2 } } };
  assert.throws(() => run(8, 3, [crossed, projected[1]]), /actual required native slot/);
});

test("ready relation frontiers never fabricate projection, capture, absence or guard evidence", () => {
  const current = fixture(add("body-round.ready-frontiers", T.float64, plus("float64", T.float64)));
  const run = input => analyzeBodyRound({ ...current.deps, account: createAccount(limits) }, input);
  const capture = { local: { body: current.program.tir.body, local: 0 }, capture: "captured-location" };
  assert.throws(() => run({ ...current.input, tir: { ...current.input.tir, captures: [capture] } }), /actual association for every selected captured execution slot/);
  const place = current.input.mir.places[0];
  assert.throws(() => run({ ...current.input, mir: { ...current.input.mir,
    places: [{ ...place, base: { kind: "static", definition: current.program.tir.owner } }, ...current.input.mir.places.slice(1)] } }),
    /actual declaration root/);
  for (const value of [{ kind: "literal", value: { kind: "absence" } }, { kind: "reference" }]) {
    assert.throws(() => run({ ...current.input, mir: { ...current.input.mir,
      constants: [{ id: 0, type: T.float64, value }] } }), /non-scalar constant relation/);
  }
  const optionalReference = declareType("bodyRoundOptionalReferenceConstant", { kind: "optional", value: T.string });
  assert.throws(() => run({ ...current.input, mir: { ...current.input.mir,
    constants: [{ id: 0, type: optionalReference, value: { kind: "literal", value: { kind: "string", value: "unbound" } } }] } }),
    /non-scalar constant relation/);
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
  const state = written => ({ written: new Set(written), taint: null });
  const variants = [null, state([]), state([0]), state([1]), state([0, 1]), state([1, 0])];
  assert.equal(lattice.isOverflow(null), false);
  for (const left of variants) for (const right of variants) {
    const account = createAccount(limits);
    const expected = left === null || right === null ? left === right
      : left.written.size === right.written.size && [...left.written].every(local => right.written.has(local));
    assert.equal(lattice.equals(left, right, account), expected);
    const joined = lattice.join(left, right, account);
    const common = left === null ? right?.written ?? null : right === null ? left.written : new Set([...left.written].filter(local => right.written.has(local)));
    assert.deepEqual(joined === null ? null : [...joined.written].sort(), common === null ? null : [...common].sort());
  }
  const first = state([0, 1]);
  const second = state([1, 0]);
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
  assert.equal(assignedEntry(solution.value.entry, 0).written.has(0), true);
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

test("a module owns neither its nested callable headers nor their separately executing defaults", async () => {
  const { analyzeOptionalSource } = await import("./fixtures/optional-default.mjs");
  const program = await analyzeOptionalSource("export function child(flag: boolean = true): boolean { return flag; }");
  assert.equal(program.kind, "ok");
  const [execution] = program.value.index.initialization.modules;
  const outer = program.value.modules.flatMap(module => module.bodies)
    .find(body => body.kind === "selected" && sameInstance(body.instance, execution.instance));
  assert.equal(outer.tir.root.kind, "SourceFile");
  const [slot] = outer.tir.root.statements.nodes;
  assert.equal(slot.kind, "ready-callable");
  const selected = slot.node;
  const header = selected.parameters.nodes[0];
  assert.equal(header.initializer.kind, "ready-default");
  assert.deepEqual(outer.facts[0].refinements.integers, [], "only the callee's unexecuted subtree contains values");
  const summary = program.value.index.summaries.find(row => row.key.kind === "body" && sameInstance(row.key.execution.instance, outer.instance));
  assert.equal(summary.returns, true, "the actual module returns without running a nested function/default");
  Object.defineProperty(header, "initializer", { get() { throw new Error("the outer module cannot read a child's default syntax"); } });
  const result = sourceOccurrences(outer.tir, createAccount(limits));
  assert.equal(result.kind, "complete");
  assert.equal(result.value.get(selected.id), selected);
  assert.equal(result.value.has(header.id), false);
  assert.equal(result.value.has(header.name.id), false);
  assert.equal(result.value.has(selected.body.id), false);
  const syntax = bodyNodes(outer.tir, createAccount(limits));
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
      assert.deepEqual(pair.facts.arena.contexts[0].arguments, [{ kind: "provided", origins: 0 }, { kind: "provided", origins: 0 }]);
    }
  }
});
