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
