import assert from "node:assert/strict";
import { test } from "node:test";
import { pairedModuleFixture } from "./ir-program-fixtures.mjs";
import { publicationFixture } from "./fixtures/program-publication.mjs";
import { accountFailure, createAccount, refuseAccount } from "../../packages/host/dist/dataflow/index.js";
import { canonicalizeProgram, createProgramVerificationWork, parseProgramIndex, printProgramIndex, verifyModuleBodies, verifyProgramIndex } from "../../packages/host/dist/ir-program/index.js";
import { ProgramWork } from "../../packages/host/dist/ir-program/work.js";

test("constructed Program publication has one required operation inventory and rejects the retired execution vector", () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true);
  const fixture = publicationFixture();
  assert.deepEqual(verifyProgramIndex(fixture.index, fixture.context), { kind: "complete", violations: [] });
  assert.deepEqual(verifyModuleBodies(fixture.index, fixture.module, fixture.context), { kind: "complete", violations: [] });
  const text = printProgramIndex(fixture.index);
  assert.equal(text.includes("dependencyInventory=DependencyInventory("), true);
  assert.equal(text.includes("executions="), false);
  assert.deepEqual(parseProgramIndex(text), { kind: "parsed", value: fixture.index });
  const empty = { ...fixture.index, dependencyInventory: { operations: [], dependencies: [], components: [] } };
  const document = printProgramIndex(empty);
  assert.equal(parseProgramIndex(document.replace("dependencyInventory=DependencyInventory(operations=[], dependencies=[], components=[])", "executions=[]")).kind,
    "invalid-text");
  assert.equal(parseProgramIndex(document.replace("dependencyInventory=DependencyInventory(operations=[], dependencies=[], components=[]), ", "")).kind,
    "invalid-text");
});

test("constructed Program handoff verifies complete operation identity and the same dependency row domain", () => {
  for (const change of ["duplicate", "missing-component", "missing-row"]) {
    const fixture = publicationFixture();
    const inventory = fixture.index.dependencyInventory;
    if (change === "duplicate") inventory.operations.push(inventory.operations[0]);
    else if (change === "missing-component") inventory.components = [];
    else inventory.dependencies.push({ dependent: inventory.operations[0].execution,
      at: { body: fixture.bodyId, node: 0 }, reason: "call", target: inventory.operations[0] });
    const result = verifyProgramIndex(fixture.index, fixture.context);
    assert.equal(result.kind, "complete");
    const rule = change === "duplicate" ? "operation-unique" : change === "missing-component" ? "component-membership-exact" : "component-rows-exact";
    assert.equal(result.violations.some(row => row.rule === "dependency-inventory-valid" && row.detail[0]?.value === rule), true, change);
  }
});

test("canonical Program rewriting preserves dependency positions and rewrites the same complete key at both ends", () => {
  const fixture = publicationFixture();
  fixture.index.types.terms.push({ kind: "string" });
  const bindings = { kind: "instantiated", bindings: { classBindings: [], methodBindings: [{ kind: "bound",
    parameter: { owner: fixture.definition, index: 0 }, type: 1 }], capturedBindings: [], selfBindings: [] } };
  const execution = { instance: { body: fixture.bodyId, bindings }, provided: 0 };
  const operation = { kind: "body", execution };
  const components = [{ kind: "body", members: [0], rows: [0], dependencies: [] }];
  fixture.index.dependencyInventory = { operations: [operation], dependencies: [{ dependent: execution,
    at: { body: fixture.bodyId, node: 0 }, reason: "call", target: operation }], components };
  const publication = { table: { terms: [fixture.index.types.terms[1], fixture.index.types.terms[0]],
    signatures: fixture.index.types.signatures.map(row => ({ ...row, result: 1 })) }, types: [1, 0], signatures: [0] };
  const result = canonicalizeProgram({ index: fixture.index, modules: [fixture.module] }, publication);
  const inventory = result.index.dependencyInventory;
  assert.equal(inventory.components, components);
  assert.equal(inventory.operations[0].execution.instance.bindings.bindings.methodBindings[0].type, 0);
  assert.deepEqual(inventory.dependencies[0].dependent, inventory.operations[0].execution);
  assert.deepEqual(inventory.dependencies[0].target, inventory.operations[0]);
  assert.equal("executions" in result.index, false);
});

test("Program dependency handoff preserves the same qualified-ownership finding as its other Facts readers", () => {
  const pair = pairedModuleFixture();
  const fixture = publicationFixture(pair.first);
  const second = publicationFixture({ ...pair.second, index: fixture.index });
  for (const [key, value] of second.answers) fixture.answers.set(key, value);
  const inventory = fixture.index.dependencyInventory;
  inventory.dependencies.push({ dependent: inventory.operations[0].execution,
    at: { body: second.bodyId, node: 0 }, reason: "call", target: inventory.operations[0] });
  inventory.components[0].rows = [0];
  const result = verifyProgramIndex(fixture.index, fixture.context);
  assert.equal(result.kind, "complete");
  assert.equal(result.violations.some(row => row.rule === "cross-owner-qualified" && row.detail[0]?.value === "cross-owner-qualified"), true);
});

test("Program inventory validation returns its same original first stop before later publication readers", () => {
  const fixture = publicationFixture();
  const account = createAccount({ maximumWork: 0, maximumResultEntries: 100000 });
  fixture.context.resources = createProgramVerificationWork(ProgramWork.state(fixture.context.resources).limits, account);
  const result = verifyProgramIndex(fixture.index, fixture.context);
  assert.equal(result.kind, "resource-limit");
  assert.equal(result, accountFailure(account));
  assert.equal(verifyProgramIndex(fixture.index, { ...fixture.context, tirOf: () => { assert.fail("No later reader after the original stop."); } }), result);
  const next = publicationFixture();
  const enclosing = ProgramWork.state(next.context.resources).account;
  const refusal = { kind: "refused", diagnostics: [{ code: { kind: "checker", number: 1, rendered: "bound" }, severity: "error",
    site: { kind: "none" }, source: null, evidence: [], message: "bound", arguments: [], related: [], fix: null }] };
  refuseAccount(enclosing, refusal);
  assert.equal(verifyProgramIndex(next.index, next.context), refusal);
});
