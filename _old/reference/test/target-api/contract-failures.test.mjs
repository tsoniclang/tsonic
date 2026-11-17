import assert from "node:assert/strict";
import test from "node:test";
import { resolveTargetContractFixedPoint } from "../../packages/target-api/dist/public/analysis.js";

test("contract closure preserves exact owner failures without a mutable side channel", () => {
  const node = {};
  const diagnostic = Object.freeze({ code: "OWNER_FAILURE", sourceNode: node });
  const cause = Object.freeze({ kind: "rejected", diagnostics: Object.freeze([diagnostic]) });
  const evaluated = [];
  const result = resolveTargetContractFixedPoint({ roots: ["owner"], evaluate(id) {
    evaluated.push(id);
    return { kind: "rejected", reason: "Exact owner failure.", cause };
  } });
  assert.equal(result.kind, "rejected");
  assert.equal(result.failures.length, 1, "one exact owner failure");
  assert.equal(result.failures[0].contractId, "owner");
  assert.equal(result.failures[0].reason, "Exact owner failure.");
  assert.equal(result.failures[0].cause === cause, true, "complete typed cause identity is retained");
  assert.equal(result.failures[0].cause.diagnostics[0].sourceNode === node, true, "diagnostic source identity is retained");
  assert.deepEqual(evaluated, ["owner"]);
});

test("independent failed dependencies keep their causes without retrying their blocked user", () => {
  const cause = Object.freeze({ code: "DEPENDENCY_FAILURE" });
  const evaluated = [];
  const result = resolveTargetContractFixedPoint({ roots: ["root"], evaluate(id) {
    evaluated.push(id);
    return id === "root"
      ? { kind: "resolved", revision: { contract: 1, dependencies: ["first", "later"] } }
      : { kind: "rejected", reason: "Dependency failure.", cause };
  } });
  assert.equal(result.kind, "rejected");
  assert.deepEqual(result.failures.map(failure => failure.contractId), ["first", "later"]);
  assert.equal(result.failures.every(failure => failure.cause === cause), true, "both native failure identities remain exact");
  assert.deepEqual(evaluated, ["root", "first", "later"]);
  assert.equal(Object.hasOwn(result, "program"), false, "no provisional dependent contract is published");
});

test("false, zero, empty and null failure payloads remain exact", () => {
  for (const cause of [false, 0, "", null]) {
    const result = resolveTargetContractFixedPoint({ roots: ["owner"], evaluate: () => ({
      kind: "rejected", reason: "Native owner failure.", cause,
    }) });
    assert.equal(result.kind, "rejected");
    assert.equal(result.failures.length, 1, "one falsy native cause");
    assert.equal(Object.hasOwn(result.failures[0], "cause"), true);
    assert.equal(result.failures[0].cause, cause);
  }
});

test("closure-owned limit failures never invent a producer cause", () => {
  const result = resolveTargetContractFixedPoint({ roots: ["root"], maximumContracts: 1,
    evaluate: () => ({ kind: "resolved", revision: { contract: 1, dependencies: ["child"] } }) });
  assert.equal(result.kind, "rejected");
  assert.equal(result.failures.length, 1, "one closure-owned limit failure");
  assert.match(result.failures[0].reason, /1-contract limit/u);
  assert.equal(Object.hasOwn(result.failures[0], "cause"), false);
});

test("independent roots aggregate exact failures and never publish a partial program", () => {
  const causes = new Map([["first", { code: "FIRST" }], ["second", { code: "SECOND" }]]);
  const evaluated = [];
  const result = resolveTargetContractFixedPoint({ roots: ["second", "healthy", "first"], evaluate(id) {
    evaluated.push(id);
    return id === "healthy" ? { kind: "resolved", revision: { contract: 7, dependencies: [] } }
      : { kind: "rejected", reason: `${id} rejected`, cause: causes.get(id) };
  } });
  assert.equal(result.kind, "rejected");
  assert.deepEqual(result.failures.map(failure => failure.contractId), ["first", "second"]);
  assert.equal(result.failures.every(failure => failure.cause === causes.get(failure.contractId)), true, "all exact typed causes survive");
  assert.deepEqual(evaluated, ["first", "healthy", "second"]);
  assert.equal(Object.isFrozen(result) && Object.isFrozen(result.failures) && result.failures.every(Object.isFrozen), true,
    "only immutable failure data is published");
  for (const key of ["program", "contractId", "reason", "cause"])
    assert.equal(Object.hasOwn(result, key), false, `superseded ${key} is absent`);
});

for (const access of ["get", "revision"]) {
  test(`an observed ${access} failure blocks an apparent independent success without changing the public graph`, () => {
    const evaluated = [];
    const result = resolveTargetContractFixedPoint({ roots: ["failed", "reader"], evaluate(id, context) {
      evaluated.push(id);
      if (id === "failed") return { kind: "rejected", reason: "actual producer failure" };
      assert.equal(context[access]("failed"), undefined, "no failed fact is readable");
      return { kind: "resolved", revision: { contract: "must not publish", dependencies: [] } };
    } });
    assert.equal(result.kind, "rejected");
    assert.deepEqual(result.failures.map(failure => failure.contractId), ["failed"]);
    assert.deepEqual(evaluated, ["failed", "reader"]);
    assert.equal(Object.hasOwn(result, "program"), false, "the apparent success is blocked, never published");
  });
  test(`an observed ${access} dependency invalidates stale provisional facts before another reader`, () => {
    const evaluated = [];
    const result = resolveTargetContractFixedPoint({ roots: ["a-reader", "z-producer", "zz-observer"], evaluate(id, context) {
      evaluated.push(id);
      if (id === "z-producer") return { kind: "rejected", reason: "actual producer failure" };
      if (id === "zz-observer") assert.equal(context.get("a-reader"), undefined, "stale provisional contract is unavailable");
      else assert.equal(context[access]("z-producer"), undefined, "producer is initially open");
      return { kind: "resolved", revision: { contract: id, dependencies: [] } };
    } });
    assert.equal(result.kind, "rejected");
    assert.deepEqual(result.failures.map(failure => failure.contractId), ["z-producer"]);
    assert.deepEqual(evaluated, ["a-reader", "z-producer", "zz-observer"]);
    assert.equal(Object.hasOwn(result, "program"), false, "no stale or dependent fact escapes");
  });
}

test("a rejection after reading a failed dependency is blocked rather than reported as a new source failure", () => {
  const cause = { code: "NATIVE_PRODUCER" };
  const result = resolveTargetContractFixedPoint({ roots: ["failed", "reader"], evaluate(id, context) {
    if (id === "failed") return { kind: "rejected", reason: "native error", cause };
    context.get("failed");
    return { kind: "rejected", reason: "must not become a cascade", cause: { code: "CASCADE" } };
  } });
  assert.equal(result.kind, "rejected");
  assert.equal(result.failures.length, 1, "only the actual terminal producer fails");
  assert.equal(result.failures[0].cause === cause, true, "the original cause is not replaced by a downstream error");
});

test("a later source failure removes a previously provisional explicit dependency chain", () => {
  const result = resolveTargetContractFixedPoint({ roots: ["a-parent", "z-producer", "zz-observer"], evaluate(id, context) {
    if (id === "z-producer") return { kind: "rejected", reason: "source failure" };
    if (id === "a-parent") return { kind: "resolved", revision: { contract: id, dependencies: ["z-producer"] } };
    assert.equal(context.get("a-parent"), undefined, "explicitly dependent provisional state was discarded");
    return { kind: "resolved", revision: { contract: id, dependencies: [] } };
  } });
  assert.equal(result.kind, "rejected");
  assert.deepEqual(result.failures.map(failure => failure.contractId), ["z-producer"]);
  assert.equal(Object.hasOwn(result, "program"), false, "no failed dependency facts are published");
});

test("a self-dependent producer preserves its own typed rejection after a real revision", () => {
  const node = {};
  const cause = Object.freeze({ kind: "rejected", diagnostics: Object.freeze([{ code: "SELF_FAILURE", sourceNode: node }]) });
  const revisions = [];
  const result = resolveTargetContractFixedPoint({ roots: ["self"], evaluate(id, context) {
    const prior = context.get(id);
    revisions.push(context.revision(id));
    return prior === undefined ? { kind: "resolved", revision: { contract: 1, dependencies: [id] } }
      : { kind: "rejected", reason: "native self owner", cause };
  } });
  assert.equal(result.kind, "rejected");
  assert.deepEqual(revisions, [undefined, 1]);
  assert.equal(result.failures.length, 1, "self-read never hides the native producer's terminal error");
  assert.equal(result.failures[0].contractId, "self");
  assert.equal(result.failures[0].cause === cause, true, "the complete representation rejection remains identical");
  assert.equal(result.failures[0].cause.diagnostics[0].sourceNode === node, true, "the original source identity survives");
  assert.equal(Object.hasOwn(result, "program"), false, "the previous representation revision is not published");
});

test("an indirect failed-read cycle cannot erase its terminal producer cause", () => {
  const cause = { code: "FIRST_FAILURE" };
  const evaluated = [];
  const result = resolveTargetContractFixedPoint({ roots: ["first", "second"], evaluate(id, context) {
    evaluated.push(id);
    if (id === "first") {
      context.get("second");
      return { kind: "rejected", reason: "first source failure", cause };
    }
    context.get("first");
    return { kind: "resolved", revision: { contract: id, dependencies: ["first"] } };
  } });
  assert.equal(result.kind, "rejected");
  assert.deepEqual(evaluated, ["first", "second"]);
  assert.equal(result.failures.length, 1, "causal blocking does not erase the terminal cycle anchor");
  assert.equal(result.failures[0].cause === cause, true, "the cycle retains the actual source error");
});

test("an unresolved dependency cycle closes boundedly beside an independent source rejection", () => {
  const evaluated = [];
  const result = resolveTargetContractFixedPoint({ roots: ["first", "other"], maximumEvaluations: 8, evaluate(id) {
    evaluated.push(id);
    if (id === "other") return { kind: "rejected", reason: "independent native failure" };
    return { kind: "deferred", dependencies: [id === "first" ? "second" : "first"], reason: "cycle input stays open" };
  } });
  assert.equal(result.kind, "rejected");
  assert.deepEqual(result.failures.map(failure => failure.contractId), ["first", "other"]);
  assert.equal(result.failures[0].reason.includes("remained deferred"), true, "the unresolved cycle is not relabelled as a valid contract");
  assert.deepEqual(evaluated, ["first", "other", "second"]);
  assert.equal(Object.hasOwn(result, "program"), false, "neither failed component publishes facts");
});

test("a fatal global evaluation budget retains prior native causes and never raises its limit", () => {
  const cause = { code: "EARLIER_NATIVE_FAILURE" };
  const result = resolveTargetContractFixedPoint({ roots: ["failed", "self"], maximumEvaluations: 2, evaluate(id, context) {
    return id === "failed" ? { kind: "rejected", reason: "native error", cause }
      : { kind: "resolved", revision: { contract: (context.get(id) ?? 0) + 1, dependencies: [id] } };
  } });
  assert.equal(result.kind, "rejected");
  assert.equal(result.failures.length, 2, "prior source failure and actual exhausted global budget remain separate");
  assert.equal(result.failures[0].cause === cause, true, "global failure does not replace the source error");
  assert.match(result.failures[1].reason, /2-evaluation limit/u);
  assert.equal(Object.hasOwn(result.failures[1], "cause"), false, "a budget failure invents no native producer");
});

test("a per-contract revision limit does not hide another independent native failure", () => {
  const cause = { code: "INDEPENDENT_NATIVE_FAILURE" };
  const evaluated = [];
  const result = resolveTargetContractFixedPoint({ roots: ["growing", "other"], maximumRevisionsPerContract: 2,
    maximumEvaluations: 8, evaluate(id, context) {
      evaluated.push(id);
      return id === "other" ? { kind: "rejected", reason: "native owner", cause }
        : { kind: "resolved", revision: { contract: (context.get(id) ?? 0) + 1, dependencies: [id] } };
    } });
  assert.equal(result.kind, "rejected");
  assert.deepEqual(result.failures.map(failure => failure.contractId), ["growing", "other"]);
  assert.match(result.failures[0].reason, /2-revision limit/u);
  assert.equal(result.failures[1].cause === cause, true, "the native error stays independent of revision exhaustion");
  assert.deepEqual(evaluated, ["growing", "other", "growing", "growing"]);
});
