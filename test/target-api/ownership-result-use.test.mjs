import assert from "node:assert/strict";
import test from "node:test";
import { createSourceContinuationDependencyQuery, createSourceContinuationTransfer, createSourceSuspensionQuery,
  decideSourceAsyncResultUse, resolveSourceAsyncResultDisposition } from "../../packages/target-api/dist/public/analysis.js";
import { ownershipFixture } from "./ownership-fixture.mjs";

const fixture = ownershipFixture();

function dependencyFor(owner, native = fixture.native) {
  const { source, storage, budget } = fixture;
  const transfer = createSourceContinuationTransfer(budget);
  const call = fixture.readCall(owner);
  const bindings = fixture.invocationBindings(call);
  const suspensions = createSourceSuspensionQuery({ source, storage, budget, premises: native });
  const suspension = suspensions.forAwait(fixture.awaitNode(fixture.declaration("read")), bindings);
  assert.equal(suspension.kind === "resolved", true, "native pending guarantee");
  const state = transfer.suspend(transfer.lattice.empty(), suspension.pending);
  assert.equal(state !== undefined, true, "bounded suspension transfer");
  const selected = createSourceContinuationDependencyQuery({ source, storage, budget, premises: native, transfer, suspensions })
    .forRead(state, fixture.readReference(), fixture.declaration("read"), bindings);
  assert.equal(selected.kind === "resolved", true, "actual bound continuation dependency");
  transfer.release();
  return selected;
}

for (const surface of ["csharp", "rust"]) {
  for (const [name, expected] of [["awaited", "admitted"], ["discarded", "rejected"], ["stored", "rejected"],
    ["returned", "rejected"], ["forwarded", "admitted"], ["forwardedAsserted", "admitted"], ["passedToStorage", "rejected"]]) {
    test(`${surface}: the identical source-bound lease has the shared ${name} decision`, () => {
      const owner = fixture.declaration(name);
      const call = fixture.readCall(owner);
      const disposition = resolveSourceAsyncResultDisposition(fixture.source, fixture.storage, call, fixture.budget);
      const selected = decideSourceAsyncResultUse({ ...fixture, call, completion: fixture.completion(call), disposition,
        continuation: dependencyFor(owner) });
      assert.equal(selected.kind, "resolved", `${name}: complete shared proof`);
      assert.equal(selected.decision, expected, name);
      assert.equal(selected.dependencies.length > 0, true, "a real continuation lease was preserved");
      assert.equal(selected.dependencies.every(item => item.retention.kind === "scoped-borrowed"), true);
      assert.equal(selected.diagnostic?.code, expected === "rejected" ? "TSONIC_BORROWED_ASYNC_RESULT_ESCAPES" : undefined);
      assert.equal(Object.isFrozen(selected), true);
      if (name === "awaited" || name === "forwarded" || name === "forwardedAsserted") assert.equal(selected.disposition.completionReturned, true);
      if (name === "stored") assert.equal(selected.disposition.kind, "stored", "a later await does not erase Promise storage");
    });
  }
}

test("native discarded async values reject independently of an unresolved continuation", () => {
  const call = fixture.readCall(fixture.declaration("discarded"));
  const selected = decideSourceAsyncResultUse({ ...fixture, call, completion: fixture.completion(call, "must-observe"),
    disposition: resolveSourceAsyncResultDisposition(fixture.source, fixture.storage, call, fixture.budget),
    continuation: { kind: "unresolved", at: call, reason: "The shared CFG adapter has not supplied continuation closure." } });
  assert.equal(selected.kind === "resolved" && selected.decision === "rejected", true);
  assert.equal(selected.diagnostic?.code, "TSONIC_NATIVE_ASYNC_RESULT_DISCARDED");
});

test("D11 marks a discarded completed owning computation without a new runtime representation", () => {
  const call = fixture.readCall(fixture.declaration("discarded"));
  const dependency = dependencyFor(fixture.declaration("discarded"), { ...fixture.native,
    retentionFor(value, bindings) {
      const selected = fixture.native.retentionFor(value, bindings);
      return { kind: "resolved", premises: selected.premises.map(premise => ({ kind: "retained", value,
        reason: "owned-value", checkedType: premise.checkedType, contractDeclaration: premise.contractDeclaration })) };
    } });
  const selected = decideSourceAsyncResultUse({ ...fixture, call, completion: fixture.completion(call),
    disposition: resolveSourceAsyncResultDisposition(fixture.source, fixture.storage, call, fixture.budget), continuation: dependency });
  assert.equal(selected.kind === "resolved" && selected.decision === "observe-discarded-rejection", true);
  assert.equal(selected.dependencies.every(item => item.retention.kind === "retained"), true);
  assert.equal(selected.diagnostic === undefined, true, "observation is a sealed mark, not an ownership rejection");
});

test("missing continuation proof remains unresolved, never an empty borrowed-input success", () => {
  for (const name of ["awaited", "discarded", "stored", "returned"]) {
    const call = fixture.readCall(fixture.declaration(name));
    const selected = decideSourceAsyncResultUse({ ...fixture, call, completion: fixture.completion(call),
      disposition: resolveSourceAsyncResultDisposition(fixture.source, fixture.storage, call, fixture.budget),
      continuation: { kind: "unresolved", at: call, reason: "The shared CFG owner has not closed the continuation." } });
    assert.equal(selected.kind, "unresolved", name);
    assert.match(selected.reason, /shared CFG/u);
  }
});

test("passing to an asynchronous consumer is not proof of an await in the caller's region", () => {
  const call = fixture.readCall(fixture.declaration("passedToAsync"));
  const selected = resolveSourceAsyncResultDisposition(fixture.source, fixture.storage, call, fixture.budget);
  assert.equal(selected.kind, "unresolved");
  assert.match(selected.reason, /source-scoped consumer/u);
});

test("result disposition rejects a different checked source owner before reading its storage", () => {
  const call = fixture.readCall(fixture.declaration("awaited"));
  const selected = resolveSourceAsyncResultDisposition({ ...fixture.source }, fixture.storage, call, fixture.budget);
  assert.equal(selected.kind, "unresolved");
  assert.match(selected.reason, /identical checked source program/u);
});

test("the awaited lease must contain the actual await, not only the callee's body", () => {
  const call = fixture.readCall(fixture.declaration("awaited"));
  const proof = dependencyFor(fixture.declaration("awaited"));
  const continuation = { kind: "resolved", dependencies: proof.dependencies.map(item => ({ ...item,
    retention: { ...item.retention, region: fixture.source.ast.body(fixture.declaration("returned")) } })) };
  const selected = decideSourceAsyncResultUse({ ...fixture, call, completion: fixture.completion(call),
    disposition: resolveSourceAsyncResultDisposition(fixture.source, fixture.storage, call, fixture.budget), continuation });
  assert.equal(selected.kind, "unresolved");
  assert.match(selected.reason, /valid region/u);
});

test("selected completion contracts reject foreign declarations and incompatible checked types", () => {
  const call = fixture.readCall(fixture.declaration("awaited"));
  const completion = fixture.completion(call);
  const disposition = resolveSourceAsyncResultDisposition(fixture.source, fixture.storage, call, fixture.budget);
  for (const replacement of [{ contractDeclaration: fixture.declaration("identity") },
    { checkedType: fixture.source.semantics.forNode(call).types.expressionType(fixture.source.ast.arguments(call)[0]) }]) {
    const selected = decideSourceAsyncResultUse({ ...fixture, call, completion: { ...completion, ...replacement },
      disposition, continuation: { kind: "resolved", dependencies: [] } });
    assert.equal(selected.kind, "unresolved", "a checked type or declaration mismatch cannot authorize a policy");
  }
});

test("all four historically observed scoped source call shapes stay immediately awaited", () => {
  const historical = fixture.declaration("historicalScoped");
  const generic = fixture.declaration("genericForward");
  const calls = [...fixture.calls(historical), ...fixture.calls(generic)].filter(call => {
    const parent = fixture.source.ast.parent(call);
    return parent !== undefined && fixture.source.ast.is.IsAwaitExpression(parent);
  });
  assert.equal(calls.length, 4, "two receivers and both generic forwards, not generic declaration counts");
  for (const call of calls) {
    const selected = resolveSourceAsyncResultDisposition(fixture.source, fixture.storage, call, fixture.budget);
    assert.equal(selected.kind, "awaited-in-scope", "a temporary native receiver borrow cannot change source result use");
  }
});

test("mutable source leases obey the same scoped-await and escape decision as shared leases", () => {
  const native = { ...fixture.native, retentionFor(value, bindings) {
    const selected = fixture.native.retentionFor(value, bindings);
    return { kind: "resolved", premises: selected.premises.map(premise => ({ ...premise, mode: "mutable" })) };
  } };
  for (const name of ["awaited", "discarded", "stored", "returned"]) {
    const call = fixture.readCall(fixture.declaration(name));
    const selected = decideSourceAsyncResultUse({ ...fixture, call, completion: fixture.completion(call),
      disposition: resolveSourceAsyncResultDisposition(fixture.source, fixture.storage, call, fixture.budget),
      continuation: dependencyFor(fixture.declaration(name), native) });
    assert.equal(selected.kind, "resolved", name);
    assert.equal(selected.decision, name === "awaited" ? "admitted" : "rejected", name);
    assert.equal(selected.dependencies.every(item => item.retention.mode === "mutable"), true);
  }
});

test("a program-duration native owner does not create a D12 storage prohibition", () => {
  const owner = fixture.declaration("moduleStored");
  const call = fixture.readCall(owner);
  const selected = decideSourceAsyncResultUse({ ...fixture, call, completion: fixture.completion(call),
    disposition: resolveSourceAsyncResultDisposition(fixture.source, fixture.storage, call, fixture.budget),
    continuation: dependencyFor(owner) });
  assert.equal(selected.kind === "resolved" && selected.decision === "admitted", true);
  assert.equal(selected.disposition.kind, "stored");
  assert.equal(selected.dependencies.every(item => item.retention.kind === "retained" && item.retention.reason === "module-owner"), true);
});
