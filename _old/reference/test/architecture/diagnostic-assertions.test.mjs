import assert from "node:assert/strict";
import test from "node:test";
import { assertNoTargetDiagnostics } from "../scripts/diagnostic-assertions.mjs";

test("target diagnostic assertions retain the exact empty-array condition", () => {
  assertNoTargetDiagnostics([]);
  for (const value of [undefined, null, {}, { length: 0 }, "", [undefined], [{ code: "NATIVE_FAILURE", message: "not accepted" }]]) {
    assert.throws(() => assertNoTargetDiagnostics(value), error => {
      assert.equal(error.code, "ERR_ASSERTION");
      assert.equal(error.actual, false);
      assert.equal(error.expected, true);
      return true;
    });
  }
});

test("failure reporting retains bounded scalar evidence without traversing source ASTs", () => {
  const node = {};
  node.parent = node;
  Object.defineProperty(node, "unrelatedPayload", { get() { throw new Error("The source AST must not be inspected."); } });
  const diagnostics = Array.from({ length: 100 }, () => ({ code: "NATIVE_FAILURE", message: "x".repeat(100_000), sourceNode: node }));
  assert.throws(() => assertNoTargetDiagnostics(diagnostics), error => {
    assert.equal(error.actual, false);
    assert.equal(error.expected, true);
    assert.equal(error.message.length < 1600, true);
    assert.match(error.message, /NATIVE_FAILURE/u);
    assert.equal(error.message.includes("sourceNode"), false);
    return true;
  });
});
