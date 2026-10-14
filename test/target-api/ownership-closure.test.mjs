import assert from "node:assert/strict";
import test from "node:test";
import { createSourceOwnershipQuery, createSourceStorageBudget, defaultSourceStorageLimits }
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
  assert.equal(held.every(dependency => dependency.retention.owner.node !== dependency.actual.node), true);
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
  const native = { ...fixture.native, retentionFor(value) {
    return { kind: "resolved", premises: [{ kind: "retained", reason: "owned-value", value,
      checkedType: fixture.typeFor(value), contractDeclaration: value.node }] };
  } };
  const selected = createSourceOwnershipQuery({ ...fixture, premises: native }).forCall(call);
  assert.equal(selected.kind === "resolved" && selected.decision === "observe-discarded-rejection", true,
    selected.kind === "unresolved" ? selected.reason : "owned discarded completion");
});

test("open native calls and recursive source bodies remain unresolved, never empty closures", () => {
  for (const name of ["unknownRead", "recurse"]) {
    const selected = fixture.query.continuationFor(fixture.call(name));
    assert.equal(selected.kind, "unresolved", name);
    assert.match(selected.reason, /contract|opaque|Recursive/u);
  }
});

test("foreign checked calls, copied bindings and exhausted closure budgets fail closed", () => {
  const foreign = closureFixture();
  const foreignCall = fixture.query.continuationFor(foreign.call("after"));
  assert.equal(foreignCall.kind, "unresolved");
  const call = fixture.call("after");
  const copied = fixture.query.continuationFor(call, { ...fixture.storage.emptyBindings });
  assert.equal(copied.kind, "unresolved");
  assert.match(copied.reason, /different source storage/u);
  for (const limits of [{ maximumSteps: 1 }, { maximumTransportRows: 1 }]) {
    const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, ...limits });
    const selected = createSourceOwnershipQuery({ ...fixture, budget, premises: fixture.native }).continuationFor(call);
    assert.equal(selected.kind, "unresolved");
    assert.equal(budget.failure() !== undefined, true);
  }
});
