import assert from "node:assert/strict";
import test from "node:test";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/target-analysis/source-storage/resource-budget.js";
import { createSourceStorageSubjects } from "../../packages/target-api/dist/target-analysis/source-storage/subjects.js";

test("source storage preserves independent finite node, edge, subject, transport-row and work guards", () => {
  const cases = [
    ["maximumNodes", "node"], ["maximumEdges", "edge"], ["maximumSubjectRows", "subject"],
    ["maximumTransportRows", "row"], ["maximumSteps", "step"],
  ];
  for (const [limit, operation] of cases) {
    const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, [limit]: 1 });
    assert.equal(budget[operation](1), true, limit);
    assert.equal(budget[operation](1), false, limit);
    assert.equal(typeof budget.failure() === "string", true, limit);
    assert.equal(budget.node(), false, "exhaustion cannot be bypassed through another budget family");
  }
});

test("owned source storage rows release only their retained cells without resetting finite failures", () => {
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumTransportRows: 3 });
  const permanent = budget.row();
  assert.equal(permanent, true);
  const first = budget.createRows();
  assert.equal(first.add(2), true, "same shared row ceiling");
  first.release();
  first.release();
  const second = budget.createRows();
  assert.equal(second.add(2), true, "evicted cells no longer occupy storage");
  assert.equal(budget.failure() === undefined, true);
  assert.equal(budget.row(), false, "permanent and retained rows still enforce the original ceiling");
  second.release();
  assert.equal(budget.row(), false, "release cannot clear a failed budget");
  for (const cost of [0, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    const invalidBudget = createSourceStorageBudget(defaultSourceStorageLimits);
    assert.equal(invalidBudget.createRows().add(cost), false, "invalid owned reservation");
    assert.equal(invalidBudget.failure() !== undefined, true);
  }
  const closedBudget = createSourceStorageBudget(defaultSourceStorageLimits);
  const closed = closedBudget.createRows();
  closed.release();
  assert.equal(closed.add(1), false, "released owners cannot resurrect storage");
  assert.equal(closedBudget.failure() !== undefined, true);
});

test("source storage rejects invalid, nonfinite, imprecise and increased budget selections", () => {
  for (const field of Object.keys(defaultSourceStorageLimits)) {
    for (const value of [0, -1, 0.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1, defaultSourceStorageLimits[field] + 1, undefined]) {
      const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, [field]: value });
      assert.equal(budget.step(), false, `${field}: ${String(value)}`);
      assert.equal(budget.failure() !== undefined, true);
    }
  }
  for (const selection of [null, undefined, "unbounded", {}]) {
    assert.equal(createSourceStorageBudget(selection).step(), false);
  }
  const selection = Object.defineProperty({ ...defaultSourceStorageLimits }, "maximumSteps", {
    get: () => assert.fail("budget selection getter executed"),
  });
  assert.equal(createSourceStorageBudget(selection).step(), false, "data-only budget selection");
});

test("scoped row reservations share the one finite peak and preserve independent retained facts", () => {
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumTransportRows: 3 });
  const retained = budget.createRows();
  assert.equal(retained.add(1), true);
  const result = {};
  for (let index = 0; index < 1000; index += 1) {
    const selected = budget.withRows(rows => {
      assert.equal(rows.add(1), true);
      return budget.withRows(nested => {
        assert.equal(nested.add(1), true, "actual nested peak includes both outer and independently retained rows");
        return result;
      });
    });
    assert.equal(selected === result, true, "scope changes no returned identity");
  }
  assert.equal(budget.failure() === undefined, true);
  assert.equal(budget.createRows().add(2), true, "dead scopes release exactly two rows, not the independent retained fact");
  assert.equal(budget.row(), false, "live retained facts still enforce the original shared ceiling");
  assert.match(budget.failure(), /transport-row/u);
});

test("row scope unwind preserves thrown identity and never resets row or work failure", () => {
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumTransportRows: 2 });
  const failure = new Error("exact scope failure");
  let selectedOwner;
  assert.throws(() => budget.withRows(rows => {
    selectedOwner = rows;
    assert.equal(rows.add(2), true);
    throw failure;
  }), error => error === failure);
  assert.equal(budget.failure() === undefined && budget.createRows().add(2), true, "throw releases only the dead scope");
  assert.equal(selectedOwner.add(1), false, "an escaped released reservation cannot resurrect a scope");
  assert.match(budget.failure(), /live owner/u);
  for (const family of ["row", "step"]) {
    const bounded = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumTransportRows: 1, maximumSteps: 1 });
    bounded.withRows(rows => {
      if (family === "row") {
        assert.equal(rows.add(1), true);
        assert.equal(rows.add(1), false);
      } else {
        assert.equal(bounded.step(), true);
        assert.equal(bounded.step(), false);
      }
    });
    const reason = bounded.failure();
    assert.equal(typeof reason === "string" && bounded.row() === false && bounded.failure() === reason, true,
      `scope release preserves exact ${family} exhaustion`);
  }
});

test("source storage subjects retain dense data-only projections and reject malformed paths without executing accessors", () => {
  const root = {};
  const budget = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumSubjectRows: 5 });
  const subject = createSourceStorageSubjects(budget.subject, budget.reject);
  const first = subject(root, "value", [{ kind: "tuple-element", index: 0 }]);
  const second = subject(root, "value", [{ kind: "tuple-element", index: 1 }]);
  assert.equal(first !== undefined && second !== undefined && first !== second, true);
  assert.equal(subject(root, "value", [{ kind: "tuple-element", index: 0 }]) === first, true, "interning does not consume another row");
  assert.equal(subject(root, "value", [{ kind: "tuple-element", index: 2 }]) === undefined, true, "independent subject-row ceiling");
  assert.equal(Object.isFrozen(first) && Object.isFrozen(first.projection) && Object.isFrozen(first.projection[0]), true);
  const getter = Object.defineProperty({}, "kind", { get: () => assert.fail("projection getter executed") });
  const malformed = [
    [getter], new Array(1), [null], [{ kind: "unknown" }], [{ kind: "tuple-element", index: -1 }],
    [{ kind: "tuple-element", index: 0.5 }], [{ kind: "tuple-element", index: Infinity }],
    Array.from({ length: 257 }, () => ({ kind: "array-element" })),
  ];
  for (const projection of malformed) {
    const budget = createSourceStorageBudget(defaultSourceStorageLimits);
    const subject = createSourceStorageSubjects(budget.subject, budget.reject);
    assert.equal(subject(root, "value", projection) === undefined, true, "invalid component path rejected");
    assert.equal(budget.failure() !== undefined, true, "cannot manufacture immutable evidence");
  }
});
