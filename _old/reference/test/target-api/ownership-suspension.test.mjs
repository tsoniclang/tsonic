import assert from "node:assert/strict";
import test from "node:test";
import { createSourceDeclarationSuspensionQuery } from "../../packages/target-api/dist/public/analysis.js";
import { ownershipFixture } from "./ownership-fixture.mjs";

const fixture = ownershipFixture();
const query = premises => createSourceDeclarationSuspensionQuery({ ...fixture, premises });

test("an async modifier and an ordinary integer await do not prove pending work", () => {
  const reader = query(fixture.native);
  const integer = reader.forAwait(fixture.awaitNode(fixture.declaration("scalarAwait")));
  assert.equal(integer.kind, "never");
  for (const node of fixture.nodes.filter(node => fixture.within(node, fixture.declaration("scalarValues")) &&
    fixture.source.ast.is.IsAwaitExpression(node))) {
    assert.equal(reader.forAwait(node).kind, "never", "checked ordinary primitive await");
  }
  const body = fixture.source.ast.body(fixture.declaration("readImmediately"));
  assert.equal(reader.forAwait(body).kind, "unresolved", "a body is not a pending operation");
});

test("a native pending contract retains exact operation, instantiated operand and activation", () => {
  const operation = fixture.awaitNode(fixture.declaration("read"));
  const reader = query(fixture.native);
  const selected = reader.forAwait(operation);
  assert.equal(selected.kind, "resolved");
  assert.equal(selected.pending.operation === operation, true);
  assert.equal(selected.pending.region.owner === fixture.declaration("read") &&
    selected.pending.region.root === fixture.source.ast.body(fixture.declaration("read")) &&
    selected.pending.region.role === "body", true);
  assert.equal(selected.pending.contracts.length === 1 &&
    selected.pending.contracts[0].contract.expression === selected.pending.expression &&
    fixture.selectedDeclaration(selected.pending.expression) === fixture.declaration("pending"), true);
  assert.equal(reader.forAwait(operation) === selected, true, "stable witness identity for loop fixpoints");
  assert.equal(Object.isFrozen(selected) && Object.isFrozen(selected.pending) &&
    Object.isFrozen(selected.pending.contracts) && selected.pending.contracts.every(Object.isFrozen), true);
  const different = reader.forAwait(fixture.awaitNode(fixture.declaration("twoPending")));
  assert.equal(different.kind === "resolved" && different.pending !== selected.pending, true, "independent original operations retain distinct witnesses");
});

test("missing native pending facts do not become an empty or non-suspending answer", () => {
  for (const name of ["read", "unknownPending"]) {
    const operation = fixture.awaitNode(fixture.declaration(name));
    const region = fixture.values.regionFor(operation);
    assert.equal(!("kind" in region) && region.owner === fixture.declaration(name), true, `${name}: exact declaration-local context`);
    const selected = query({ suspensionFor: () => undefined }).forAwait(operation);
    assert.equal(selected.kind, "unresolved");
    assert.match(selected.reason, /not proof of a non-suspending operation/u);
    assert.equal(selected.cause.kind, "required-fact");
  }
});

test("checked native contracts can explicitly prove an already-completed operand", () => {
  const selected = query({ suspensionFor(value) {
    const evidence = fixture.native.suspensionFor(value);
    return evidence === undefined ? undefined : { ...evidence, kind: "never" };
  } }).forAwait(fixture.awaitNode(fixture.declaration("read")));
  assert.equal(selected.kind, "never");
});

test("foreign operand, unrelated declaration and wrong type cannot authorize pending work", () => {
  const operation = fixture.awaitNode(fixture.declaration("read"));
  const wrongType = fixture.source.semantics.forNode(operation).types.expressionType(operation);
  for (const amend of [
    evidence => ({ ...evidence, value: fixture.subject(operation) }),
    evidence => ({ ...evidence, contract: { kind: "declaration", declaration: fixture.declaration("identity"),
      component: evidence.contract.component } }),
    evidence => ({ ...evidence, contract: { ...evidence.contract, component: { selectedType: wrongType } } }),
  ]) {
    const selected = query({ suspensionFor(value) { return amend(fixture.native.suspensionFor(value)); } }).forAwait(operation);
    assert.equal(selected.kind, "unresolved");
  }
});

test("copied substitution contexts remain foreign to the pending native operation", () => {
  const selected = query({ suspensionFor(value) {
    return { ...fixture.native.suspensionFor(value), value: { ...value, region: { ...value.region } } };
  } }).forAwait(fixture.awaitNode(fixture.declaration("read")));
  assert.equal(selected.kind, "unresolved");
  assert.match(selected.reason, /different checked local operand/u);
});

test("generic await effects follow their actual scalar or native future, not the generic formal", () => {
  const owner = fixture.declaration("genericAwait");
  const calls = fixture.calls(fixture.declaration("actualAwaits")).filter(call => fixture.selectedDeclaration(call) === owner);
  assert.equal(calls.length, 2);
  const reader = query(fixture.native);
  const selections = calls.map(call => reader.forResult(fixture.source.ast.arguments(call)[0]));
  assert.equal(selections[0].kind, "never", "the owned scalar actual cannot become a borrowed future because its formal is generic");
  assert.equal(selections[1].kind, "resolved", "the checked native future actual can become pending");
  assert.equal(selections[1].pending.contracts[0].value.node === fixture.source.ast.arguments(calls[1])[0], true);
  assert.equal(selections[1].pending.region.owner === fixture.declaration("actualAwaits"), true,
    "the direct actual keeps its own checked caller region without entering the generic body");
});

test("alias awaits reuse one exact native-effect decision per actual origin and activation", () => {
  const counts = new Map();
  const reader = query({ suspensionFor(value) {
    counts.set(value, 1 + (counts.get(value) ?? 0));
    return fixture.native.suspensionFor(value);
  } });
  const operations = fixture.nodes.filter(node => fixture.within(node, fixture.declaration("aliasedPending")) &&
    fixture.source.ast.is.IsAwaitExpression(node));
  assert.equal(operations.length, 2);
  const selections = operations.map(node => reader.forAwait(node));
  assert.equal(selections.every(selected => selected.kind === "resolved"), true);
  assert.equal(counts.size === 2 && [...counts.values()].every(count => count === 1), true,
    "each checked operand needs its own completed native effect, not a reconstructed alias origin");
  assert.equal(selections.every((selected, index) => reader.forAwait(operations[index]) === selected), true,
    "each original operation reuses its immutable native-effect decision");
  assert.equal(selections[0].pending.region === selections[1].pending.region, true, "both operations retain one declaration region");
});

test("every conditional awaited origin needs a closed effect, even when one branch is already pending", () => {
  const operation = fixture.awaitNode(fixture.declaration("joinedPending"));
  const complete = query(fixture.native).forAwait(operation);
  assert.equal(complete.kind === "resolved" && complete.pending.contracts.length === 1 &&
    complete.pending.contracts[0].value.node === complete.pending.expression, true, "the whole selected native output needs its exact complete effect");
  assert.equal(complete.pending.region.owner === fixture.declaration("joinedPending"), true);
  const unknown = query(fixture.native).forAwait(fixture.awaitNode(fixture.declaration("mixedPending")));
  assert.equal(unknown.kind, "unresolved", "one pending branch cannot certify the unclassified actual branch");
});
