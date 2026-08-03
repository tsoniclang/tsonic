import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultParallelWorkerCount,
  maximumDefaultParallelWorkers,
} from "../scripts/test/parallel-worker-budget.mjs";

test("parallel runner defaults to a bounded global worker budget", () => {
  assert.equal(maximumDefaultParallelWorkers, 8);
  assert.equal(defaultParallelWorkerCount(1), 1);
  assert.equal(defaultParallelWorkerCount(4), 3);
  assert.equal(defaultParallelWorkerCount(16), 8);
  assert.equal(defaultParallelWorkerCount(168), 8);
});

test("parallel runner worker-budget selection fails closed for invalid host counts", () => {
  assert.equal(defaultParallelWorkerCount(0), 1);
  assert.equal(defaultParallelWorkerCount(-1), 1);
  assert.equal(defaultParallelWorkerCount(Number.NaN), 1);
  assert.equal(defaultParallelWorkerCount(1.5), 1);
});
