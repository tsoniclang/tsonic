import assert from "node:assert/strict";
import test from "node:test";
import { taskTimeoutMilliseconds, taskTimeoutsFromBaseline } from "../../scripts/parallel-task-resources.mjs";

test("file timeouts use task wall time, never individual case duration, with a five minute floor", () => {
  const timeouts = taskTimeoutsFromBaseline({ results: [
    { id: "long-file", durationMs: 40_001.25, tests: [{ durationMs: 1 }] },
    { id: "short-file", durationMs: 10 },
    { id: "failed-file", durationMs: 55_000, status: 1 },
  ] });
  assert.equal(taskTimeoutMilliseconds({ id: "long-file" }, timeouts), 400_013, "round upwards, not below the measured wall time");
  assert.equal(taskTimeoutMilliseconds({ id: "short-file" }, timeouts), 300_000, "five minute minimum");
  assert.equal(taskTimeoutMilliseconds({ id: "failed-file" }, timeouts), 550_000, "a failed file still has actual wall time");
  assert.equal(taskTimeoutMilliseconds({ id: "unknown-file" }, timeouts), 1_800_000, "an unmeasured file has thirty minutes");
});

test("missing, duplicate or invalid baseline task times fail closed instead of borrowing a case time", () => {
  for (const results of [undefined, [{ id: "same", durationMs: 1 }, { id: "same", durationMs: 2 }],
    [{ id: "case-only", tests: [{ durationMs: 5 }] }], [{ id: "bad", durationMs: -1 }],
    [{ id: "bad", durationMs: Infinity }], [{ id: "bad", durationMs: "1" }]]) {
    assert.throws(() => taskTimeoutsFromBaseline({ results }), /baseline/u);
  }
});
