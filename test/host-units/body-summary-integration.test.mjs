import assert from "node:assert/strict";
import { test } from "node:test";
import { createAccount, accountFailure, chargeWork, remainingWork } from "../../packages/host/dist/dataflow/index.js";
import { executionKey } from "../../packages/host/dist/ir-types/index.js";
import { iterateChildrenOfSyntax } from "../../packages/host/dist/ir-hir/index.js";
import { lowerToMir } from "../../packages/host/dist/lower-mir/index.js";
import { verifyMir } from "../../packages/host/dist/ir-mir/index.js";
import { analyzeStorageUse } from "../../packages/host/dist/analyses/liveness/index.js";
import { analyzeBodyRound, proveInitialization } from "../../packages/host/dist/analyses/body/index.js";
import { componentsOf, convergeComponent, dependenciesOf } from "../../packages/host/dist/summaries/index.js";
import { add, plus } from "./fixtures/lower-mir/programs/first.mjs";
import { T, TABLE, verificationContext } from "./fixtures/lower-mir/typed.mjs";

const flowLimits = { maximumWork: 1000000, maximumResultEntries: 1000000 };
const limits = { maximumProjectionDepth: 64, maximumOriginAlternatives: 128, maximumConditionAlternatives: 128,
  maximumRelationalRecordsPerBody: 100000, maximumRelationalReferencesPerBody: 100000 };
const scope = { classParameters: [], methodParameters: [], capturedParameters: [], selfOwners: [] };
const conditionRefusal = { kind: "refused", diagnostics: [] };
const unexpected = () => assert.fail("A call-free selected scalar body has no external dependency.");

function prepared(name) {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true);
  const program = add(name, T.float64, plus("float64", T.float64));
  const execution = { instance: { body: program.tir.body, bindings: program.tir.bindings }, provided: 2 };
  const unit = { query: "bodyRound", key: executionKey(execution) };
  const typeOf = type => TABLE.terms[type];
  const signatureOf = signature => TABLE.signatures[signature];
  const lowered = lowerToMir({ typeOf, signatureOf, limits: { maximumRecords: 10000 },
    defs: { completionSelector: T.int32, exceptionStorage: T.unknown },
    unit: { request: unit, position: { kind: "result" } } }, program.tir, []);
  assert.equal(lowered.kind, "ok");
  assert.deepEqual(verifyMir(lowered.value, verificationContext(program)), { kind: "complete", violations: [] });
  const nodes = new Map();
  const pending = [program.tir.root, ...program.tir.params];
  for (let node = pending.pop(); node !== undefined; node = pending.pop()) {
    nodes.set(node.id, node);
    for (const child of iterateChildrenOfSyntax(node)) pending.push(child);
  }
  const verification = { types: TABLE, limits, diagnostics: [],
    tirBody: instance => instance.body === program.tir.body ? program.tir : null,
    mirBody: instance => instance.body === lowered.value.body ? lowered.value : null,
    bodyOwner: body => body === program.tir.body ? program.tir.owner : null,
    definitionExists: definition => definition === program.tir.owner,
    declarationSourceOf: definition => definition === program.tir.owner
      ? { kind: "body", value: program.nodeRef(0) } : null,
    bindingScopeOf: definition => definition === program.tir.owner ? scope : null,
    bindingScopesOf: () => [scope], nominalOf: () => null,
    nodeExists: selected => selected.kind === "body"
      ? selected.value.body === program.tir.body && nodes.has(selected.value.node)
      : program.tir.params.some(header => header.tsonic.declaration === selected.value.owner && nodes.has(selected.value.node)),
    localExists: local => local.body === program.tir.body && program.tir.locals[local.local]?.id === local.local,
    signatureIdOf: () => null, bindingDependentOf: definition => definition === program.tir.owner ? false : null,
    captureCount: key => key.kind === "body" && key.execution.instance.body === program.tir.body ? 0 : null,
    callbackSignaturesOf: () => null, metadataOf: () => null, libraryExportExists: () => false,
    declaredSiteCount: () => null, arenaOf: () => null, summaryOf: () => null };
  return { program, execution, unit, mir: lowered.value, verification,
    environment: { types: TABLE, typeOf, signatureOf, limits } };
}

test("real LowerMir output is discovered, scheduled, analyzed and handoff-verified in one runtime and account", () => {
  const current = prepared("integrated.scalar.add");
  const account = createAccount(flowLimits);
  const required = dependenciesOf({ account, callableEntriesAt: unexpected, calleeAt: unexpected,
    initializerAt: unexpected, operationEntriesAt: unexpected, dispatchEntriesAt: unexpected },
  { execution: current.execution, tir: current.program.tir });
  assert.equal(required.kind, "complete");
  assert.deepEqual(required.value.dependencies, []);
  const inventory = componentsOf({ account, maximumComponentSize: 1, componentRefusal: conditionRefusal }, required.value);
  assert.equal(inventory.kind, "complete");
  const before = remainingWork(account);
  const result = convergeComponent({ analyzeStorageUse, analyzeBodyRound, environment: current.environment,
    verification: current.verification, resources: { account, conditionRefusal } }, {
    inventory: inventory.value, component: 0,
    members: [{ execution: current.execution, mir: current.mir, tir: current.program.tir, unit: current.unit }],
    outside: [], maximumIterations: 1, iterationRefusal: conditionRefusal });
  assert.equal(result.kind, "complete");
  assert.equal(result.value.length, 1);
  const terminal = result.value[0].result;
  assert.equal(terminal.kind, "ok");
  assert.equal("facts" in terminal.value, true);
  const pair = terminal.value;
  assert.equal(pair.facts.arena, pair.summary.arena);
  assert.equal(pair.summary.returns, true);
  assert.equal(pair.summary.parameters.length, 2);
  assert.equal(pair.facts.origins.writes.length > 0, true);
  assert.equal(pair.facts.initialization.reads.length > 0, true);
  assert.deepEqual(terminal.positions, [{ position: { kind: "result" }, error: null }]);
  assert.deepEqual(terminal.diagnostics, []);
  assert.equal(remainingWork(account) < before, true);
  const proof = proveInitialization({ account, unit: { query: "initializationProof", key: "integrated.scalar.add" },
    summaryOf: key => {
      assert.deepEqual(key, pair.summary.key);
      return { value: pair.summary, unit: { request: current.unit, position: { kind: "result" } } };
    } }, { modules: [], entries: [current.execution], storage: [] });
  assert.equal(proof.kind, "complete");
  assert.equal(proof.value.kind, "ok");
  assert.equal(proof.value.value.entries[0], current.execution);
  assert.equal(accountFailure(account), null);
});

test("the integrated convergence boundary preserves the original stop before reading any member", () => {
  const account = createAccount({ maximumWork: 0, maximumResultEntries: 0 });
  const original = chargeWork(account, 1);
  const input = new Proxy({}, { get() { assert.fail("No member read after the original invocation stop."); } });
  const result = convergeComponent({ resources: { account, conditionRefusal } }, input);
  assert.equal(result.kind, "resource-limit");
  assert.equal(result, original);
  assert.equal(result, accountFailure(account));
  assert.equal(convergeComponent({ resources: { account, conditionRefusal } }, input), result);
});
