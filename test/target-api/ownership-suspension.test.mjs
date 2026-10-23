import assert from "node:assert/strict";
import test from "node:test";
import { createSourceSuspensionQuery } from "../../packages/target-api/dist/public/analysis.js";
import { ownershipFixture } from "./ownership-fixture.mjs";

const fixture = ownershipFixture();
const query = premises => createSourceSuspensionQuery({ ...fixture, premises });

test("an async modifier and an ordinary integer await do not prove pending work", () => {
  const reader = query(fixture.native);
  const integer = reader.forAwait(fixture.awaitNode(fixture.declaration("scalarAwait")), fixture.storage.emptyBindings);
  assert.equal(integer.kind, "never");
  for (const node of fixture.nodes.filter(node => fixture.within(node, fixture.declaration("scalarValues")) &&
    fixture.source.ast.is.IsAwaitExpression(node))) {
    assert.equal(reader.forAwait(node, fixture.storage.emptyBindings).kind, "never", "checked ordinary primitive await");
  }
  const body = fixture.source.ast.body(fixture.declaration("readImmediately"));
  assert.equal(reader.forAwait(body, fixture.storage.emptyBindings).kind, "unresolved", "a body is not a pending operation");
});

test("a native pending contract retains exact operation, instantiated operand and activation", () => {
  const call = fixture.readCall(fixture.declaration("awaited"));
  const bindings = fixture.invocationBindings(call);
  const operation = fixture.awaitNode(fixture.declaration("read"));
  const reader = query(fixture.native);
  const selected = reader.forAwait(operation, bindings);
  assert.equal(selected.kind, "resolved");
  assert.equal(selected.pending.operation === operation, true);
  assert.equal(selected.pending.bindings === bindings, true);
  assert.equal(selected.pending.contracts.length === 1 &&
    selected.pending.contracts[0].contractDeclaration === fixture.declaration("pending"), true);
  assert.equal(reader.forAwait(operation, bindings) === selected, true, "stable witness identity for loop fixpoints");
  assert.equal(Object.isFrozen(selected) && Object.isFrozen(selected.pending) &&
    Object.isFrozen(selected.pending.contracts) && selected.pending.contracts.every(Object.isFrozen), true);
  const different = reader.forAwait(operation, fixture.invocationBindings(fixture.readCall(fixture.declaration("discarded"))));
  assert.equal(different.kind === "resolved" && different.pending !== selected.pending, true, "do not merge independent actual activations");
});

test("missing native pending facts do not become an empty or non-suspending answer", () => {
  for (const name of ["read", "unknownPending"]) {
    const operation = fixture.awaitNode(fixture.declaration(name));
    const context = fixture.storage.bindingsForLexicalOwner(operation);
    assert.equal(context.kind === "resolved", true, `${name}: the checked declaration context preserves its input`);
    const selected = query({ suspensionFor: () => undefined }).forAwait(operation, context.bindings);
    assert.equal(selected.kind, "unresolved");
    assert.match(selected.reason, /possibly-pending|non-suspending/u);
  }
});

test("checked native contracts can explicitly prove an already-completed operand", () => {
  const selected = query({ suspensionFor(value, bindings) {
    const evidence = fixture.native.suspensionFor(value, bindings);
    return evidence === undefined ? undefined : { ...evidence, kind: "never" };
  } }).forAwait(fixture.awaitNode(fixture.declaration("read")), fixture.storage.emptyBindings);
  assert.equal(selected.kind, "never");
});

test("foreign operand, unrelated declaration and wrong type cannot authorize pending work", () => {
  const operation = fixture.awaitNode(fixture.declaration("read"));
  const wrongType = fixture.source.semantics.forNode(operation).types.expressionType(operation);
  for (const replacement of [{ value: fixture.subject(operation) }, { contractDeclaration: fixture.declaration("identity") },
    { checkedType: wrongType }]) {
    const selected = query({ suspensionFor(value, bindings) {
      return { ...fixture.native.suspensionFor(value, bindings), ...replacement };
    } }).forAwait(operation, fixture.storage.emptyBindings);
    assert.equal(selected.kind, "unresolved");
  }
});

test("copied substitution contexts remain foreign to the pending native operation", () => {
  const selected = query(fixture.native).forAwait(fixture.awaitNode(fixture.declaration("read")),
    { ...fixture.invocationBindings(fixture.readCall(fixture.declaration("awaited"))) });
  assert.equal(selected.kind, "unresolved");
  assert.match(selected.reason, /different source storage query/u);
});

test("generic await effects follow their actual scalar or native future, not the generic formal", () => {
  const owner = fixture.declaration("genericAwait");
  const calls = fixture.calls(fixture.declaration("actualAwaits")).filter(call => fixture.selectedDeclaration(call) === owner);
  assert.equal(calls.length, 2);
  const reader = query(fixture.native);
  const selections = calls.map(call => reader.forAwait(fixture.awaitNode(owner), fixture.invocationBindings(call)));
  assert.equal(selections[0].kind, "never", "the owned scalar actual cannot become a borrowed future because its formal is generic");
  assert.equal(selections[1].kind, "resolved", "the checked native future actual can become pending");
  assert.equal(selections[1].pending.contracts[0].value.node === fixture.source.ast.arguments(calls[1])[0], true);
});

test("alias awaits reuse one exact native-effect decision per actual origin and activation", () => {
  const counts = new Map();
  const reader = query({ suspensionFor(value, bindings) {
    counts.set(value, 1 + (counts.get(value) ?? 0));
    return fixture.native.suspensionFor(value, bindings);
  } });
  const operations = fixture.nodes.filter(node => fixture.within(node, fixture.declaration("aliasedPending")) &&
    fixture.source.ast.is.IsAwaitExpression(node));
  assert.equal(operations.length, 2);
  const selections = operations.map(node => reader.forAwait(node, fixture.storage.emptyBindings));
  assert.equal(selections.every(selected => selected.kind === "resolved"), true);
  assert.equal(counts.size === 1 && [...counts.values()][0] === 1, true, "aliases do not recompute a checked native effect");
  assert.equal(selections[0].pending.contracts[0] === selections[1].pending.contracts[0], true);
});

test("every conditional awaited origin needs a closed effect, even when one branch is already pending", () => {
  const complete = query(fixture.native).forAwait(fixture.awaitNode(fixture.declaration("joinedPending")), fixture.storage.emptyBindings);
  assert.equal(complete.kind === "resolved" && complete.pending.contracts.length === 2, true, "both exact native branches");
  const unknown = query(fixture.native).forAwait(fixture.awaitNode(fixture.declaration("mixedPending")), fixture.storage.emptyBindings);
  assert.equal(unknown.kind, "unresolved", "one pending branch cannot certify the unclassified actual branch");
});
