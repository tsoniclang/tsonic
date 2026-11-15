import assert from "node:assert/strict";
import { encodeBodyId, encodeDefId, encodeModuleId, encodePackageId } from "../../../packages/host/dist/ids/index.js";
import { accountFailure, chargeResultEntries, chargeWork, createAccount, refuseAccount } from "../../../packages/host/dist/dataflow/index.js";
import { InvocationAccount } from "../../../packages/host/dist/dataflow/account.js";
import { componentsOf } from "../../../packages/host/dist/summaries/index.js";
import { parseDependencyInventory, printDependencyInventory, verifyDependencyInventory, summaryKey } from "../../../packages/host/dist/ir-facts/index.js";
import { instanceKey, signatureRequestKey } from "../../../packages/host/dist/ir-types/index.js";

export async function dependencyInventoryCases(suite) {

const module = encodeModuleId({ package: encodePackageId("summary-inventory"), path: "main.ts" });
const definition = name => encodeDefId({ module, segments: [{ name, ordinal: 0 }] });
const body = (name, provided = 0, bindings = { kind: "parametric" }) => ({ kind: "body", execution: {
  instance: { body: encodeBodyId({ owner: definition(name), role: "function", ordinal: 0 }), bindings }, provided,
} });
const declared = (ordinal = 0, provided = 0) => ({ kind: "declared", execution: {
  request: { definition: definition("native"), endpoint: "api-signature", ordinal, bindings: { kind: "parametric" } }, provided,
} });
const edge = (source, target, node = 0, reason = "call") => ({ dependent: source.execution,
  at: { body: source.execution.instance.body, node }, reason, target });
const refusal = { kind: "refused", diagnostics: [{ code: { kind: "checker", number: 1, rendered: "component bound" },
  severity: "error", site: { kind: "none" }, source: null, evidence: [], message: "component bound", arguments: [], related: [], fix: null }] };
const account = (maximumWork = 1000000, maximumResultEntries = 1000000) => createAccount({ maximumWork, maximumResultEntries });
const resources = (current = account(), maximumComponentSize = 1000000) => ({ account: current, maximumComponentSize, componentRefusal: refusal });
const completed = result => { assert.equal(result.kind, "complete"); return result.value; };

function readyContext(operations) {
  const bodies = new Map();
  const owners = new Map();
  const requests = new Map();
  const signatures = [];
  for (const operation of operations) {
    if (operation.kind === "body") {
      const selected = operation.execution.instance;
      let mir = bodies.get(instanceKey(selected));
      if (mir === undefined) {
        mir = { body: selected.body, bindings: selected.bindings, entries: [], blocks: [{}] };
        bodies.set(instanceKey(selected), mir);
        owners.set(selected.body, definition("body-owner"));
      }
      mir.entries.push({ provided: operation.execution.provided, block: 0 });
    } else {
      const id = signatures.length;
      requests.set(signatureRequestKey(operation.execution.request), id);
      signatures.push({ id, declaration: operation.execution.request.definition, parameters: Array.from({ length: operation.execution.provided },
        () => ({ kind: "required", acceptsOmission: false })) });
    }
  }
  return { types: { terms: [], signatures }, definitionExists: () => true, bodyOwner: selected => owners.get(selected) ?? null,
    mirBody: selected => bodies.get(instanceKey(selected)) ?? null,
    signatureIdOf: request => requests.get(signatureRequestKey(request)) ?? null,
    bindingScopeOf: () => ({ classParameters: [], methodParameters: [], capturedParameters: [], selfOwners: [] }),
    nodeExists: at => at.kind === "body" && owners.has(at.value.body) && at.value.node >= 0 && at.value.node < 2 };
}

function verified(inventory, context = readyContext(inventory.operations), current = account()) {
  const result = verifyDependencyInventory(inventory, context, current);
  assert.equal(result.kind, "complete");
  return result.violations;
}

await suite.test("componentsOf schedules declared binding once and body dependencies before their dependents", () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true);
  const first = body("first"), second = body("second"), native = declared();
  const input = { operations: [first, second, native], dependencies: [edge(first, second), edge(second, native)] };
  const result = completed(componentsOf(resources(), input));
  assert.equal(result.operations === input.operations, true);
  assert.equal(result.dependencies === input.dependencies, true);
  assert.deepEqual(result.components, [{ kind: "declared", operation: 2 },
    { kind: "body", members: [1], rows: [1], dependencies: [0] }, { kind: "body", members: [0], rows: [0], dependencies: [1] }]);
});

await suite.test("componentsOf retains complete bindings and provided counts instead of definition components", () => {
  const first = body("entry", 0), second = body("entry", 1);
  const bindings = { kind: "instantiated", bindings: { classBindings: [], methodBindings: [
    { kind: "bound", parameter: { owner: definition("generic"), index: 0 }, type: 7 }], capturedBindings: [], selfBindings: [] } };
  const third = body("entry", 0, bindings), fourth = declared(2, 0), fifth = declared(2, 1);
  const input = { operations: [first, second, third, fourth, fifth], dependencies: [edge(first, second), edge(second, first)] };
  const result = completed(componentsOf(resources(account(), 2), input));
  assert.deepEqual(result.components, [{ kind: "body", members: [0, 1], rows: [0, 1], dependencies: [] },
    { kind: "body", members: [2], rows: [], dependencies: [] }, { kind: "declared", operation: 3 }, { kind: "declared", operation: 4 }]);
  const failed = account();
  assert.equal(componentsOf(resources(failed, 1), input), refusal);
  assert.equal(accountFailure(failed), refusal);
});

await suite.test("componentsOf admits self recursion and deduplicates only condensation dependencies", () => {
  const first = body("first"), second = body("second"), third = body("third");
  const input = { operations: [first, second, third], dependencies: [edge(first, first), edge(first, second),
    edge(first, third), edge(first, second, 1), edge(second, third), edge(third, second)] };
  assert.deepEqual(completed(componentsOf(resources(), input)).components,
    [{ kind: "body", members: [1, 2], rows: [4, 5], dependencies: [] }, { kind: "body", members: [0], rows: [0, 1, 2, 3], dependencies: [0] }]);
  assert.deepEqual(completed(componentsOf(resources(), { operations: [], dependencies: [] })).components, []);
});

await suite.test("componentsOf refuses every under-budget cut with the original same-account stop", () => {
  const first = body("first"), second = body("second"), native = declared(3, 1);
  const input = { operations: [first, second, native], dependencies: [edge(first, second), edge(first, native), edge(second, native)] };
  const actual = account();
  const expected = completed(componentsOf(resources(actual), input));
  const units = InvocationAccount.stateOf(actual);
  for (const [dimension, needed] of [["work", units.work], ["result-entries", units.entries]]) {
    for (let maximum = 0; maximum < needed; maximum += 1) {
      const current = account(dimension === "work" ? maximum : units.work, dimension === "result-entries" ? maximum : units.entries);
      const result = componentsOf(resources(current), input);
      assert.equal(result.kind, "resource-limit");
      assert.equal(result.dimension, dimension);
      assert.equal(result.maximum, maximum);
      assert.equal(result, accountFailure(current));
      const stopped = { ...InvocationAccount.stateOf(current) };
      assert.equal(componentsOf(resources(current), input), result);
      assert.deepEqual(InvocationAccount.stateOf(current), stopped);
    }
  }
  assert.deepEqual(completed(componentsOf(resources(account(units.work, units.entries)), input)), expected);
});

await suite.test("componentsOf preserves an enclosing refusal and reads no later caller row", () => {
  const current = account();
  refuseAccount(current, refusal);
  const operations = [];
  Object.defineProperty(operations, 0, { get() { assert.fail("no operation read after original refusal"); } });
  assert.equal(componentsOf(resources(current), { operations, dependencies: [] }), refusal);
  const empty = account(0, 100);
  assert.equal(chargeWork(empty, 1), accountFailure(empty));
  assert.equal(componentsOf(resources(empty), { operations, dependencies: [] }), accountFailure(empty));
  const entries = account(100, 0);
  const stop = chargeResultEntries(entries, 1);
  assert.equal(componentsOf(resources(entries), { operations, dependencies: [] }), stop);
});

await suite.test("componentsOf rejects unclosed inventories and invalid caller component bounds", () => {
  const first = body("first"), missing = body("missing");
  for (const maximum of [-1, -0, NaN, Infinity, 0.5])
    assert.throws(() => componentsOf(resources(account(), maximum), { operations: [], dependencies: [] }), /safe count/);
  assert.throws(() => componentsOf(resources(), { operations: [first, first], dependencies: [] }), /occurs once/);
  assert.throws(() => componentsOf(resources(), { operations: [first], dependencies: [edge(first, missing)] }), /complete closed/);
  assert.throws(() => componentsOf(resources(), { operations: [first], dependencies: [edge(missing, first)] }), /complete closed/);
  assert.throws(() => componentsOf(resources(), { operations: [first], dependencies: [{ ...edge(first, first), at: { body: missing.execution.instance.body, node: 0 } }] }), /actual dependent/);
  assert.throws(() => componentsOf(resources(), { operations: Array(1), dependencies: [] }), /dense/);
  assert.throws(() => componentsOf(resources(), { operations: [first], dependencies: Array(1) }), /dense/);
  assert.equal(componentsOf(resources(account(), 0), { operations: [first], dependencies: [] }), refusal);
});

await suite.test("dependency inventory codecs transport one qualified operation domain and reject the removed graph", () => {
  const first = body("first", 1), second = body("second"), native = declared(4, 1);
  const input = { operations: [first, second, native], dependencies: [edge(first, second), edge(second, native)] };
  const inventory = completed(componentsOf(resources(), input));
  const text = printDependencyInventory(inventory);
  assert.equal(text.startsWith("DependencyInventory(operations=["), true);
  assert.deepEqual(parseDependencyInventory(text), { kind: "parsed", value: inventory });
  assert.deepEqual(verified(inventory), []);
  for (const retired of ["CallGraph(definitions=[], edges=[], components=[])",
    text.replace("operations=", "definitions="), text.replace("ExecutionDependency(", "direct("),
    text.replace("declared(operation=2)", "CallComponent(id=0, definitions=[], dependencies=[])")])
    assert.equal(parseDependencyInventory(retired).kind, "invalid-text");
  const recursive = completed(componentsOf(resources(), { operations: [first, second], dependencies: [edge(first, second), edge(second, first)] }));
  assert.deepEqual(verified(recursive), []);
});

await suite.test("dependency inventory verification retains all qualified closure, entry and occurrence opposites", () => {
  const first = body("first"), second = body("second"), native = declared();
  const original = completed(componentsOf(resources(), { operations: [first, second, native], dependencies: [edge(first, second), edge(second, native)] }));
  const cases = [
    ["operation-unique", value => value.operations.push(first)],
    ["dependency-unique", value => value.dependencies.push(value.dependencies[0])],
    ["dependency-resolves", value => { value.dependencies[0].target = body("unlisted"); }],
    ["cross-owner-qualified", value => { value.dependencies[0].at.body = second.execution.instance.body; }],
    ["call-site-resolves", value => { value.dependencies[0].at.node = 2; }],
    ["execution-resolves", value => { value.operations[2].execution.request.ordinal = 9; }],
    ["execution-resolves", value => { value.operations[0].execution.provided = 1; }],
    ["component-membership-exact", value => { value.components[1].members = []; }],
    ["component-membership-exact", value => { value.components[2].members.push(1); }],
    ["component-kind-exact", value => { value.components[0] = { kind: "body", members: [2], rows: [], dependencies: [] }; }],
    ["component-rows-exact", value => { value.components[1].rows = []; }],
    ["component-rows-exact", value => { value.components[1].rows = [0]; }],
    ["component-rows-exact", value => { value.components[1].rows = [1, 1]; }],
    ["component-dependencies-exact", value => { value.components[1].dependencies = []; }],
    ["component-acyclic", value => { value.components.reverse(); value.components[0].dependencies = [1]; value.components[1].dependencies = [2]; }],
  ];
  for (const [rule, amend] of cases) {
    const value = structuredClone(original);
    amend(value);
    const findings = verified(value, readyContext(original.operations));
    assert.equal(findings.some(finding => finding.rule === rule), true, rule);
  }
  const missingDefinition = readyContext(original.operations);
  missingDefinition.definitionExists = () => false;
  assert.equal(verified(original, missingDefinition).some(finding => finding.rule === "execution-resolves"), true);
  const instantiated = body("generic", 0, { kind: "instantiated", bindings: { classBindings: [], methodBindings: [
    { kind: "bound", parameter: { owner: definition("generic"), index: 0 }, type: 0 }], capturedBindings: [], selfBindings: [] } });
  const inventory = completed(componentsOf(resources(), { operations: [instantiated], dependencies: [] }));
  assert.equal(verified(inventory).some(finding => finding.rule === "bindings-complete"), true);
  assert.notEqual(summaryKey(first), summaryKey({ ...first, execution: { ...first.execution, provided: 1 } }));
});

await suite.test("dependency inventory verification shares both actual dimensions and never reads after its original refusal", () => {
  const first = body("first"), native = declared();
  const inventory = completed(componentsOf(resources(), { operations: [first, native], dependencies: [edge(first, native)] }));
  const context = readyContext(inventory.operations);
  const actual = account();
  assert.deepEqual(verified(inventory, context, actual), []);
  const units = InvocationAccount.stateOf(actual);
  for (const [dimension, needed] of [["work", units.work], ["result-entries", units.entries]]) {
    for (let maximum = 0; maximum < needed; maximum += 1) {
      const current = account(dimension === "work" ? maximum : units.work, dimension === "result-entries" ? maximum : units.entries);
      const result = verifyDependencyInventory(inventory, context, current);
      assert.equal(result.kind, "resource-limit");
      assert.equal(result.dimension, dimension);
      assert.equal(result.maximum, maximum);
      assert.equal(result, accountFailure(current));
    }
  }
  const stopped = account();
  refuseAccount(stopped, refusal);
  const operations = [];
  Object.defineProperty(operations, 0, { get() { assert.fail("no operation lookup after original stop"); } });
  assert.equal(verifyDependencyInventory({ operations, dependencies: [], components: [] }, context, stopped), refusal);
  assert.deepEqual(verified(inventory, context, account(units.work, units.entries)), []);
});

}
