import assert from "node:assert/strict";

export async function conditionCases(suite) {
  const facts = await import("../../../packages/host/dist/ir-facts/index.js");
  const flow = await import("../../../packages/host/dist/dataflow/index.js");
  const refusal = { kind: "refused", diagnostics: [{ code: { kind: "checker", number: 1, rendered: "condition bound" },
    severity: "error", site: { kind: "none" }, source: null, evidence: [], message: "condition bound", arguments: [], related: [], fix: null }] };
  const condition = alternatives => ({ alternatives });
  const limits = (maximumWork = 1_000_000, maximumConditionAlternatives = 256, eventCount = 3, maximumResultEntries = 1_000_000) => ({
    eventCount, maximumConditionAlternatives, account: flow.createAccount({ maximumWork, maximumResultEntries }), refusal });
  const value = result => { assert.equal(result.kind, "complete"); return result.value; };
  const truth = condition => Array.from({ length: 8 }, (_, assignment) => condition.alternatives.some(row =>
    row.every(event => (assignment & (1 << event)) !== 0)));
  const functions = [];
  for (let bits = 0; bits < 256; bits += 1) {
    let monotone = true;
    for (let first = 0; first < 8; first += 1) for (let second = 0; second < 8; second += 1)
      if ((first & second) === first && (bits & (1 << first)) !== 0 && (bits & (1 << second)) === 0) monotone = false;
    if (!monotone) continue;
    const alternatives = [];
    for (let assignment = 0; assignment < 8; assignment += 1) {
      if ((bits & (1 << assignment)) === 0) continue;
      let minimal = true;
      for (let earlier = 0; earlier < 8; earlier += 1)
        if (earlier !== assignment && (earlier & assignment) === earlier && (bits & (1 << earlier)) !== 0) minimal = false;
      if (minimal) alternatives.push([0, 1, 2].filter(event => (assignment & (1 << event)) !== 0));
    }
    alternatives.sort((left, right) => {
      for (let index = 0; index < Math.min(left.length, right.length); index += 1)
        if (left[index] !== right[index]) return left[index] - right[index];
      return left.length - right.length;
    });
    functions.push(condition(alternatives));
  }

  await suite.test("conditions: independent truth tables cover all twenty monotone functions and canonical operations", () => {
    assert.equal(functions.length, 20);
    for (const first of functions) for (const second of functions) {
      const beforeFirst = structuredClone(first);
      const beforeSecond = structuredClone(second);
      const joined = value(facts.conditionOr(first, second, limits()));
      const met = value(facts.conditionAnd(first, second, limits()));
      const firstTruth = truth(first);
      const secondTruth = truth(second);
      assert.deepEqual(truth(joined), firstTruth.map((bit, index) => bit || secondTruth[index]));
      assert.deepEqual(truth(met), firstTruth.map((bit, index) => bit && secondTruth[index]));
      assert.deepEqual(joined, value(facts.conditionOr(second, first, limits())));
      assert.deepEqual(met, value(facts.conditionAnd(second, first, limits())));
      assert.equal(value(facts.conditionEquals(first, second, limits())), firstTruth.every((bit, index) => bit === secondTruth[index]));
      assert.deepEqual(first, beforeFirst);
      assert.deepEqual(second, beforeSecond);
    }
    for (const first of functions) for (const second of functions) for (const third of functions) {
      const environment = limits();
      const and = (left, right) => value(facts.conditionAnd(left, right, environment));
      const or = (left, right) => value(facts.conditionOr(left, right, environment));
      assert.deepEqual(and(first, or(second, third)), or(and(first, second), and(first, third)));
      assert.deepEqual(or(first, and(second, third)), and(or(first, second), or(first, third)));
      assert.deepEqual(and(and(first, second), third), and(first, and(second, third)));
      assert.deepEqual(or(or(first, second), third), or(first, or(second, third)));
    }
  });

  await suite.test("conditions: absorption and substitution preserve the owning event table", () => {
    assert.deepEqual(value(facts.conditionOr(condition([[0, 1]]), condition([[0, 1, 2]]), limits())), condition([[0, 1]]));
    assert.deepEqual(value(facts.conditionOr(condition([[0, 1]]), condition([[1]]), limits())), condition([[1]]));
    assert.deepEqual(value(facts.conditionAnd(condition([[0], [1]]), condition([[2]]), limits())), condition([[0, 2], [1, 2]]));
    assert.deepEqual(value(facts.conditionSubstitute(condition([[0, 1]]), [condition([[2]]), condition([])], limits())), condition([]));
    assert.deepEqual(value(facts.conditionSubstitute(condition([[0, 1]]), [condition([[2]]), condition([[]])], limits())), condition([[2]]));
    assert.deepEqual(value(facts.conditionSubstitute(condition([[0], [1]]), [condition([[1]]), condition([[0]])], limits())), condition([[0], [1]]));
    assert.throws(() => facts.conditionSubstitute(condition([[1]]), [condition([])], limits()), TypeError);
    assert.throws(() => facts.conditionSubstitute(condition([]), new Array(1), limits()), TypeError);
    assert.throws(() => facts.conditionSubstitute(condition([]), [condition([[3]])], limits()), TypeError);
  });

  await suite.test("conditions: malformed domains, noncanonical alternatives and removed callback bindings are caller defects", () => {
    for (const malformed of [condition([[1, 0]]), condition([[0, 0]]), condition([[-0]]), condition([[-1]]),
      condition([[1.5]]), condition([[NaN]]), condition([[Infinity]]), condition([[3]]), condition([[1], [0]]),
      condition([[0], [0, 1]]), condition([[0, 1], [1]]), condition([[0], [0]]), condition(new Array(1)), condition([new Array(1)])]) {
      for (const operation of [facts.conditionOr, facts.conditionAnd, facts.conditionEquals]) {
        assert.throws(() => operation(malformed, condition([]), limits()), TypeError);
        assert.throws(() => operation(condition([]), malformed, limits()), TypeError);
      }
      assert.throws(() => facts.conditionSubstitute(malformed, [condition([]), condition([]), condition([])], limits()), TypeError);
    }
    for (const name of ["eventCount", "maximumConditionAlternatives"]) for (const invalid of [-0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])
      assert.throws(() => facts.conditionOr(condition([]), condition([]), { ...limits(), [name]: invalid }), TypeError);
  });

  await suite.test("conditions: the private application handoff rejects a missing actual event binding", async () => {
    const internal = await import("../../../packages/host/dist/ir-facts/conditions.js");
    assert.throws(() => internal.substituteCondition(condition([[0]]), [], limits()), TypeError);
  });

  await suite.test("conditions: exact shared work, zero, one-under and original first refusal are sticky", () => {
    const empty = condition([]);
    const always = condition([[]]);
    assert.deepEqual(value(facts.conditionOr(empty, empty, limits(3))), empty);
    assert.deepEqual(facts.conditionOr(empty, empty, limits(2)), { kind: "resource-limit", dimension: "work", maximum: 2 });
    assert.deepEqual(value(facts.conditionAnd(always, always, limits(7))), always);
    assert.deepEqual(facts.conditionAnd(always, always, limits(6)), { kind: "resource-limit", dimension: "work", maximum: 6 });
    assert.deepEqual(value(facts.conditionEquals(empty, empty, limits(3))), true);
    assert.deepEqual(facts.conditionEquals(empty, empty, limits(2)), { kind: "resource-limit", dimension: "work", maximum: 2 });
    assert.deepEqual(value(facts.conditionSubstitute(empty, [], limits(1))), empty);
    const shared = limits(9);
    assert.deepEqual(value(facts.conditionOr(empty, empty, shared)), empty);
    const stop = facts.conditionAnd(always, always, shared);
    assert.deepEqual(stop, { kind: "resource-limit", dimension: "work", maximum: 9 });
    assert.equal(flow.accountFailure(shared.account), stop);
    for (const operation of [facts.conditionOr, facts.conditionAnd, facts.conditionEquals]) assert.equal(operation(null, null, shared), stop);
    assert.equal(facts.conditionSubstitute(null, null, shared), stop);
    const bounded = limits(100, 0);
    assert.deepEqual(value(facts.conditionOr(empty, empty, bounded)), empty);
    assert.equal(facts.conditionAnd(always, always, bounded), refusal);
    assert.equal(flow.accountFailure(bounded.account), refusal);
    assert.equal(flow.chargeWork(bounded.account, 1000), refusal);
    const other = { ...refusal, diagnostics: [...refusal.diagnostics] };
    assert.equal(flow.refuseAccount(bounded.account, other), refusal);
    assert.equal(facts.conditionOr(null, null, bounded), refusal);
    const zero = limits(0, 0);
    const zeroStop = facts.conditionOr(empty, empty, zero);
    assert.deepEqual(zeroStop, { kind: "resource-limit", dimension: "work", maximum: 0 });
    assert.equal(facts.conditionAnd(null, null, zero), zeroStop);
    for (const maximum of [8, 9, 10]) {
      const result = facts.conditionAnd(condition([[0], [1], [2]]), condition([[3], [4], [5]]), limits(10000, maximum, 6));
      if (maximum === 8) assert.equal(result, refusal);
      else assert.equal(value(result).alternatives.length, 9);
    }
  });

  await suite.test("conditions: exact result rows and merged events share the original allocation account", () => {
    const empty = condition([]);
    const always = condition([[]]);
    const first = condition([[0]]);
    const second = condition([[1]]);
    const cases = [
      [0, environment => facts.conditionOr(empty, empty, environment), empty],
      [0, environment => facts.conditionAnd(empty, always, environment), empty],
      [0, environment => facts.conditionSubstitute(empty, [], environment), empty],
      [0, environment => facts.conditionEquals(first, second, environment), false],
      [1, environment => facts.conditionOr(first, empty, environment), first],
      [2, environment => facts.conditionAnd(always, always, environment), always],
      [4, environment => facts.conditionAnd(first, second, environment), condition([[0, 1]])],
      [3, environment => facts.conditionSubstitute(always, [], environment), always],
      [6, environment => facts.conditionSubstitute(first, [second], environment), second],
    ];
    for (const [needed, operation, expected] of cases) {
      assert.deepEqual(value(operation(limits(10000, 256, 3, needed))), expected);
      for (let maximum = 0; maximum < needed; maximum += 1) {
        const environment = limits(10000, 256, 3, maximum);
        const stop = operation(environment);
        assert.deepEqual(stop, { kind: "resource-limit", dimension: "result-entries", maximum });
        assert.equal(flow.accountFailure(environment.account), stop);
        assert.equal(facts.conditionOr(null, null, environment), stop);
        assert.equal(facts.conditionSubstitute(null, null, environment), stop);
      }
    }
    const shared = limits(10000, 256, 3, 5);
    assert.deepEqual(value(facts.conditionOr(first, empty, shared)), first);
    assert.deepEqual(value(facts.conditionAnd(first, second, shared)), condition([[0, 1]]));
    const stop = facts.conditionOr(second, empty, shared);
    assert.deepEqual(stop, { kind: "resource-limit", dimension: "result-entries", maximum: 5 });
    assert.equal(facts.conditionAnd(null, null, shared), stop);
  });

  await suite.test("conditions: every charged child can refuse without later input work or a partial public condition", () => {
    const first = condition([[0, 2], [1, 2]]);
    const second = condition([[0, 1], [2]]);
    const operations = [
      environment => facts.conditionOr(first, second, environment),
      environment => facts.conditionAnd(first, second, environment),
      environment => facts.conditionEquals(first, second, environment),
      environment => facts.conditionEquals(first, first, environment),
      environment => facts.conditionEquals(condition([[0]]), first, environment),
      environment => facts.conditionSubstitute(first, [first, second, condition([[2]])], environment),
    ];
    for (const operation of operations) {
      const expected = value(operation(limits()));
      for (const dimension of ["work", "result-entries"]) {
        let completed = false;
        for (let maximum = 0; maximum <= 500; maximum += 1) {
          const environment = limits(dimension === "work" ? maximum : 10000, 256, 3,
            dimension === "result-entries" ? maximum : 10000);
          const result = operation(environment);
          if (result.kind === "complete") {
            completed = true;
            assert.deepEqual(result.value, expected);
          } else {
            assert.equal(completed, false, "a larger allowance cannot create an earlier refusal");
            assert.deepEqual(result, { kind: "resource-limit", dimension, maximum });
            assert.equal(flow.accountFailure(environment.account), result);
            assert.equal(facts.conditionOr(null, null, environment), result);
            assert.equal(facts.conditionSubstitute(null, null, environment), result);
          }
        }
        assert.equal(completed, true, "the bounded owning case is complete with its hand-bounded allowance");
      }
    }
  });
}
