import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultParallelWorkerCount,
  maximumDefaultParallelWorkers,
} from "../../scripts/parallel-worker-budget.mjs";
import {
  parallelGroupWorkerCount,
} from "../../scripts/parallel-group-budget.mjs";

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

test("parallel runner applies declarative per-group resource limits", () => {
  const limits = Object.freeze({ "runtime-dotnet": 2 });
  assert.equal(parallelGroupWorkerCount(8, "runtime-dotnet", limits), 2);
  assert.equal(parallelGroupWorkerCount(1, "runtime-dotnet", limits), 1);
  assert.equal(parallelGroupWorkerCount(8, "host-cli-build-core", limits), 8);
});

test("parallel runner group limits fail closed for invalid configuration", () => {
  assert.equal(parallelGroupWorkerCount(8, "runtime-dotnet", { "runtime-dotnet": 0 }), 1);
  assert.equal(parallelGroupWorkerCount(8, "runtime-dotnet", { "runtime-dotnet": 2.5 }), 1);
  assert.equal(parallelGroupWorkerCount(0, "runtime-dotnet", { "runtime-dotnet": 2 }), 1);
});
