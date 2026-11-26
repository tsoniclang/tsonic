import assert from "node:assert/strict";
import { test } from "node:test";
import { createAccount, accountFailure, chargeWork, remainingWork } from "../../packages/host/dist/dataflow/index.js";
import { executionKey } from "../../packages/host/dist/ir-types/index.js";
import { bodyOccurrenceSlots, indexChapterSyntax, tirBodySyntaxOf } from "../../packages/host/dist/ir-tir/index.js";
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
    unit: { request: unit, position: { kind: "result" } } }, program.tir, [], [execution.provided]);
  assert.equal(lowered.kind, "ok");
  assert.deepEqual(verifyMir(lowered.value, verificationContext(program)), { kind: "complete", violations: [] });
  const nodes = new Map();
  const roots = [tirBodySyntaxOf(program.tir.root), ...program.tir.params.map(node => ({ kind: "formal", node }))];
  const nested = new Set(program.tir.nestedBodies);
  for (const subject of indexChapterSyntax(roots, node => bodyOccurrenceSlots(node, id => nested.has(id)), () => true))
    if (subject.kind !== "checked") nodes.set(subject.node.id, subject.node);
  const verification = { types: TABLE, limits, diagnostics: [],
    tirBody: instance => instance.body === program.tir.body ? program.tir : null,
    mirBody: instance => instance.body === lowered.value.body ? lowered.value : null,
    bodyOwner: body => body === program.tir.body ? program.tir.owner : null,
    definitionExists: definition => definition === program.tir.owner,
    declarationSourceOf: definition => definition === program.tir.owner
      ? { kind: "body", value: program.nodeRef(0) } : null,
    bindingScopeOf: definition => definition === program.tir.owner ? scope : null,
    sourceBindingScopesOf: () => assert.fail("The actual scalar integration has no definition-null binding vector."), nominalOf: () => null,
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
  const required = dependenciesOf({ account, signatureOf: current.environment.signatureOf, callableEntriesAt: unexpected, calleeAt: unexpected,
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

test("two real calls to the same outside execution retain and charge only one dependency key", async () => {
  const { loadFrontFixture } = await import("./fixtures/front/checked-module.mjs");
  const { analysisInput } = await import("./fixtures/front/analysis-input.mjs");
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { pipelineWiring } = await import("../../packages/host/dist/pipeline/wiring.js");
  const { admitSummaryIdentity, summaryKey } = await import("../../packages/host/dist/ir-facts/index.js");
  const { InvocationAccount } = await import("../../packages/host/dist/dataflow/account.js");
  const fixture = await loadFrontFixture();
  const source = "function pass(value: boolean): boolean { return value; } "
    + "export function caller(value: boolean): boolean { return pass(pass(value)); }";
  let selected;
  const converge = pipelineWiring.summaries.convergeComponent;
  pipelineWiring.summaries.convergeComponent = (deps, input) => {
    const body = fixture.ids.decodeBodyId(input.members[0].execution.instance.body).value;
    const definition = fixture.ids.decodeDefId(body.owner).value;
    if (definition.segments.at(-1)?.name === "caller") selected = { deps, input };
    return converge(deps, input);
  };
  try {
    const result = analyzeHostProgram(analysisInput(fixture, "sdk-minimal", source));
    assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  } finally {
    pipelineWiring.summaries.convergeComponent = converge;
  }
  assert.ok(selected);
  const { deps, input } = selected;
  const member = { kind: "body", execution: input.members[0].execution };
  const component = input.inventory.components[input.component];
  const operation = input.inventory.operations[component.members[0]];
  const rows = component.rows.map(index => input.inventory.dependencies[index]);
  assert.equal(input.members.length, 1);
  assert.equal(input.outside.length, 1);
  assert.equal(rows.filter(row => row.reason === "call").length, 2);
  const outside = input.outside[0];
  assert.equal(rows.every(row => summaryKey(row.target) === summaryKey(outside.key)), true);
  const identities = createAccount(flowLimits);
  const memberReads = operation.execution === member.execution ? [operation] : [operation, member];
  for (const key of [...memberReads, ...rows.flatMap(row => [{ kind: "body", execution: row.dependent }, row.target]),
    outside.key, outside.answer.value.key]) assert.equal(admitSummaryIdentity(key, identities), null);
  const exact = 6 + 2 + 1 + 1 + 1 + InvocationAccount.stateOf(identities).entries;
  const run = account => convergeComponent({ ...deps, resources: { ...deps.resources, account } }, { ...input, maximumIterations: 0 });
  const enough = createAccount({ ...flowLimits, maximumResultEntries: exact });
  assert.equal(run(enough) === input.iterationRefusal, true, "only one retained entry for the repeated outside key");
  assert.equal(accountFailure(enough) === input.iterationRefusal, true);
  const { work } = InvocationAccount.stateOf(enough);
  for (const [field, dimension, limit] of [["maximumWork", "work", work], ["maximumResultEntries", "result-entries", exact]]) {
    for (let maximum = 0; maximum < limit; maximum += 1) {
      const limited = createAccount({ ...flowLimits, [field]: maximum });
      const stopped = run(limited);
      assert.deepEqual(stopped, { kind: "resource-limit", dimension, maximum });
      assert.equal(stopped === accountFailure(limited), true);
      assert.equal(run(limited) === stopped, true);
    }
    assert.equal(run(createAccount({ ...flowLimits, [field]: limit })) === input.iterationRefusal, true);
  }
});
