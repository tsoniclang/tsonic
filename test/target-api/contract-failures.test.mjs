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
  assert.equal(result.contractId, "owner");
  assert.equal(result.reason, "Exact owner failure.");
  assert.equal(result.cause === cause, true);
  assert.equal(result.cause.diagnostics[0].sourceNode === node, true);
  assert.deepEqual(evaluated, ["owner"]);
});

test("a failed dependency keeps its original cause and never evaluates later work", () => {
  const cause = Object.freeze({ code: "DEPENDENCY_FAILURE" });
  const evaluated = [];
  const result = resolveTargetContractFixedPoint({ roots: ["root"], evaluate(id) {
    evaluated.push(id);
    return id === "root"
      ? { kind: "resolved", revision: { contract: 1, dependencies: ["first", "later"] } }
      : { kind: "rejected", reason: "Dependency failure.", cause };
  } });
  assert.equal(result.kind, "rejected");
  assert.equal(result.contractId, "first");
  assert.equal(result.cause === cause, true);
  assert.deepEqual(evaluated, ["root", "first"]);
});

test("false, zero, empty and null failure payloads remain exact", () => {
  for (const cause of [false, 0, "", null]) {
    const result = resolveTargetContractFixedPoint({ roots: ["owner"], evaluate: () => ({
      kind: "rejected", reason: "Native owner failure.", cause,
    }) });
    assert.equal(result.kind, "rejected");
    assert.equal(Object.hasOwn(result, "cause"), true);
    assert.equal(result.cause, cause);
  }
});

test("closure-owned limit failures never invent a producer cause", () => {
  const result = resolveTargetContractFixedPoint({ roots: ["root"], maximumContracts: 1,
    evaluate: () => ({ kind: "resolved", revision: { contract: 1, dependencies: ["child"] } }) });
  assert.equal(result.kind, "rejected");
  assert.match(result.reason, /1-contract limit/u);
  assert.equal(Object.hasOwn(result, "cause"), false);
});
