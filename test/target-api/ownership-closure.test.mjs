import assert from "node:assert/strict";
import test from "node:test";
import { createSourceDeclarationOwnershipQuery, createSourceDeclarationOwnershipBudget, defaultSourceDeclarationOwnershipLimits }
  from "../../packages/target-api/dist/public/analysis.js";
import { closureFixture, borrowed } from "./ownership-closure-fixture.mjs";

const fixture = closureFixture();

for (const [name, expected] of [["after", true], ["beforeOnly", false], ["scalarOnly", false],
  ["conditionalRead", true], ["oppositeRead", false], ["loopRead", true], ["nestedRead", true], ["unusedRead", false],
  ["nativeOnly", true], ["settledOnly", false], ["handlers", true], ["nestedAsync", true], ["nativeReturned", true],
  ["afterAdoption", true], ["nativeAlias", true], ["aliasRead", true], ["conditionalAlias", true],
  ["unawaitedNative", false], ["returnedPayload", false]]) {
  test(`checked continuation closure preserves the exact ${name} suspended-lease result`, () => {
    const call = fixture.call(name);
    const selected = fixture.query.continuationFor(call);
    assert.equal(borrowed(selected, name).length > 0, expected, name);
    assert.equal(fixture.query.continuationFor(call) === selected, true, "one completed call/context result");
    assert.equal(Object.isFrozen(selected) && Object.isFrozen(selected.dependencies), true);
  });
}

test("actual supplied defaults skip uninvoked captured bodies while omitted defaults invoke them", () => {
  const calls = fixture.calls(fixture.declaration("runClosed")).filter(call => fixture.selectedDeclaration(call) === fixture.declaration("defaultRead"))
    .sort((left, right) => fixture.source.ast.pos(left) - fixture.source.ast.pos(right));
  assert.equal(calls.length, 2);
  assert.equal(borrowed(fixture.query.continuationFor(calls[0]), "omitted captured default").length > 0, true);
  assert.equal(borrowed(fixture.query.continuationFor(calls[1]), "supplied owned default").length, 0);
});

test("a pending native result retains its lease through await without a later source read", () => {
  const selected = fixture.query.continuationFor(fixture.call("nativeOnly"));
  const held = borrowed(selected, "held native future");
  assert.equal(held.some(dependency => fixture.selectedDeclaration(dependency.actual.node) === fixture.declaration("nativeFuture")), true);
  assert.equal(held.every(dependency => dependency.retention.kind === "formal-borrowed"
    ? dependency.retention.region.parameter !== dependency.actual.node
    : dependency.retention.owner.node !== dependency.actual.node), true);
});

for (const owner of ["storedClosed", "discardedClosed", "returnedClosed"]) {
  test(`the complete shared query rejects a real native pending lease in ${owner}`, () => {
    const selected = fixture.query.forCall(fixture.call("nativeOnly", owner));
    assert.equal(selected.kind === "resolved" && selected.decision === "rejected", true,
      selected.kind === "unresolved" ? selected.reason : owner);
    assert.equal(selected.diagnostic?.code, "TSONIC_BORROWED_ASYNC_RESULT_ESCAPES");
  });
}

test("the complete shared query admits immediate await and marks an owned discarded result for D11", () => {
  const awaited = fixture.query.forCall(fixture.call("nativeOnly"));
  assert.equal(awaited.kind === "resolved" && awaited.decision === "admitted", true,
    awaited.kind === "unresolved" ? awaited.reason : "immediate await");
  const call = fixture.call("nativeOnly", "discardedClosed");
  const native = { ...fixture.native, retentionFor(request) {
    const { value } = request;
    return { kind: "resolved", premises: [{ kind: "retained", reason: "owned-value", value,
      contract: { kind: "expression", expression: value.node, component: value.component } }] };
  } };
  const selected = createSourceDeclarationOwnershipQuery({ ...fixture, nodes: fixture.nodes, premises: native }).forCall(call);
  assert.equal(selected.kind === "resolved" && selected.decision === "observe-discarded-rejection", true,
    selected.kind === "unresolved" ? selected.reason : "owned discarded completion");
});

test("an open native call without a contract remains unresolved, never an empty closure", () => {
  const selected = fixture.query.continuationFor(fixture.call("unknownRead"));
  assert.equal(selected.kind, "unresolved", "unknown native contract");
  assert.match(selected.reason, /contract|opaque/u);
});

test("a recursive source component closes with its actual pending lease instead of an empty approximation", () => {
  const selected = fixture.query.continuationFor(fixture.call("recurse"));
  const held = borrowed(selected, "complete recursive component");
  assert.equal(held.length > 0, true, "recursive convergence preserves pending borrowed reads");
  assert.equal(held.every(dependency => dependency.actual === dependency.retention.value), true,
    "each dependency retains its exact actual source origin");
});

test("foreign checked calls, copied bindings and exhausted closure budgets fail closed", () => {
  const foreign = closureFixture();
  const foreignCall = fixture.query.continuationFor(foreign.call("after"));
  assert.equal(foreignCall.kind, "unresolved");
  const call = fixture.call("after");
  const copied = fixture.query.continuationFor({ ...call });
  assert.equal(copied.kind, "unresolved");
  assert.match(copied.reason, /checked|selected|original/u);
  for (const limits of [{ maximumSteps: 1 }, { maximumTransportRows: 1 }]) {
    const budget = createSourceDeclarationOwnershipBudget(call, { ...defaultSourceDeclarationOwnershipLimits, ...limits });
    const selected = createSourceDeclarationOwnershipQuery({ ...fixture, budget, premises: fixture.native }).continuationFor(call);
    assert.equal(selected.kind, "unresolved");
    assert.equal(budget.failure() !== undefined, true);
  }
});
