import assert from "node:assert/strict";
import test from "node:test";
import { createSourceDeclarationContinuationDependencyQuery, createSourceContinuationTransfer, createSourceDeclarationSuspensionQuery,
  createSourceDeclarationRetentionQuery, createSourceDeclarationOwnershipBudget, defaultSourceDeclarationOwnershipLimits }
  from "../../packages/target-api/dist/public/analysis.js";
import { ownershipFixture } from "./ownership-fixture.mjs";

const fixture = ownershipFixture();

function witnesses() {
  const reader = createSourceDeclarationSuspensionQuery({ ...fixture, premises: fixture.native });
  const pending = fixture.nodes.filter(node => fixture.within(node, fixture.declaration("read")) &&
    fixture.source.ast.is.IsAwaitExpression(node)).map(node => {
      const selected = reader.forAwait(node);
      assert.equal(selected.kind, "resolved");
      return selected.pending;
    });
  return { reader, pending };
}

test("the suspension lattice is monotone, associative, commutative and idempotent without mutating inputs", () => {
  const transfer = createSourceContinuationTransfer(fixture.transferBudget);
  const { pending: [first, second] } = witnesses();
  const empty = transfer.lattice.empty();
  const left = transfer.suspend(empty, first);
  const right = transfer.suspend(empty, second);
  assert.equal(left !== undefined && right !== undefined, true);
  const joined = transfer.lattice.join(left, right);
  assert.equal(joined !== undefined, true);
  assert.equal(empty.size === 0 && left.size === 1 && right.size === 1 && joined.size === 2, true);
  assert.equal(transfer.lattice.join(joined, joined) === joined, true, "join is idempotent");
  assert.equal(transfer.suspend(left, first) === left, true, "one witness is stable through a loop");
  assert.equal(transfer.lattice.equals(joined, transfer.lattice.join(right, left)), true, "join commutes");
  assert.equal(transfer.lattice.equals(transfer.lattice.join(joined, left),
    transfer.lattice.join(left, transfer.lattice.join(right, left))), true, "join associates");
  assert.equal(transfer.lattice.join(empty, left) === left && transfer.lattice.join(left, empty) === left, true);
  transfer.release();
});

test("reads before suspension need no lease proof, while post-suspension reads preserve all bound owners", () => {
  const transfer = createSourceContinuationTransfer(fixture.transferBudget);
  const reference = fixture.source.ast.arguments(fixture.readCall(fixture.declaration("alternatives")))[0];
  const { reader: suspensions, pending: [first, second] } = witnesses();
  const missing = createSourceDeclarationContinuationDependencyQuery({ ...fixture,
    retention: createSourceDeclarationRetentionQuery({ ...fixture, premises: { retentionFor: () => undefined } }), suspensions });
  const before = missing.forRead(transfer.lattice.empty(), reference, fixture.declaration("alternatives"));
  assert.equal(before.kind === "resolved" && before.dependencies.length === 0, true, "no suspended lease before any suspension");
  const state = transfer.suspend(transfer.suspend(transfer.lattice.empty(), first), second);
  const afterMissing = missing.forRead(state, reference, fixture.declaration("alternatives"));
  assert.equal(afterMissing.kind, "unresolved", "missing post-suspension evidence cannot become empty");
  const actual = createSourceDeclarationContinuationDependencyQuery({ ...fixture,
    retention: createSourceDeclarationRetentionQuery({ ...fixture, premises: fixture.native }), suspensions })
    .forRead(state, reference, fixture.declaration("alternatives"));
  assert.equal(actual.kind === "resolved" && actual.dependencies.length === 4, true, "two native owners across both pending operations");
  assert.equal(new Set(actual.dependencies.map(item => item.retention.owner)).size, 2);
  assert.equal(new Set(actual.dependencies.map(item => item.suspension)).size, 2);
  assert.equal(Object.isFrozen(actual.dependencies) && actual.dependencies.every(Object.isFrozen), true);
  transfer.release();
});

test("a bounded transfer reaches its finite witness fixpoint without a second solver", () => {
  const transfer = createSourceContinuationTransfer(fixture.transferBudget);
  const { pending } = witnesses();
  let state = transfer.lattice.empty();
  let rounds = 0;
  for (;;) {
    const next = transfer.lattice.join(state, transfer.suspend(state, pending[rounds % pending.length]));
    rounds += 1;
    assert.equal(rounds <= 3, true, "finite two-witness monotone domain");
    if (transfer.lattice.equals(state, next)) break;
    state = next;
  }
  assert.equal(state.size, 2);
  transfer.release();
});

test("analysis work exhaustion fails closed and is sticky", () => {
  const budget = createSourceDeclarationOwnershipBudget(fixture.file, { ...defaultSourceDeclarationOwnershipLimits, maximumSteps: 2 });
  const transfer = createSourceContinuationTransfer({ step: () => budget.step(fixture.file),
    createRows: () => budget.createRows(fixture.file), failure: () => budget.failure()?.reason });
  const { pending: [first, second] } = witnesses();
  const state = transfer.suspend(transfer.lattice.empty(), first);
  assert.equal(state !== undefined, true);
  assert.equal(transfer.suspend(state, second) !== undefined, true);
  assert.equal(transfer.suspend(state, second) === undefined, true);
  assert.equal(budget.failure().cause.kind === "resource-limit" && budget.failure().cause.subject === fixture.file &&
    budget.failure().cause.category === "step" && budget.failure().cause.limit === 2, true);
  assert.equal(transfer.lattice.join(transfer.lattice.empty(), state) === undefined, true,
    "an exhausted analysis cannot certify even an apparently trivial join");
  transfer.release();
});

test("retained-row exhaustion fails closed, without a hidden raised budget", () => {
  const budget = createSourceDeclarationOwnershipBudget(fixture.file, { ...defaultSourceDeclarationOwnershipLimits, maximumTransportRows: 2 });
  const transfer = createSourceContinuationTransfer({ step: () => budget.step(fixture.file),
    createRows: () => budget.createRows(fixture.file), failure: () => budget.failure()?.reason });
  const { pending: [first, second] } = witnesses();
  const one = transfer.suspend(transfer.lattice.empty(), first);
  assert.equal(one !== undefined, true);
  assert.equal(transfer.suspend(one, second) === undefined, true);
  assert.equal(budget.failure().cause.kind === "resource-limit" && budget.failure().cause.category === "row" &&
    budget.failure().cause.limit === 2, true);
  transfer.release();
  assert.equal(budget.failure() !== undefined, true, "release does not clear an exhausted query's failed proof");
});

test("copied and foreign pending witnesses cannot authorize continuation dependencies", () => {
  const transfer = createSourceContinuationTransfer(fixture.transferBudget);
  const { reader: suspensions, pending: [first] } = witnesses();
  const foreign = witnesses().pending[0];
  const query = createSourceDeclarationContinuationDependencyQuery({ ...fixture,
    retention: createSourceDeclarationRetentionQuery({ ...fixture, premises: fixture.native }), suspensions });
  for (const pending of [{ ...first }, foreign]) {
    const state = transfer.suspend(transfer.lattice.empty(), pending);
    const selected = query.forRead(state, fixture.readReference(), fixture.declaration("read"));
    assert.equal(selected.kind, "unresolved");
    assert.match(selected.reason, /real pending native operation/u);
  }
  transfer.release();
});
