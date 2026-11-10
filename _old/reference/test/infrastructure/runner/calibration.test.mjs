import assert from "node:assert/strict";
import test from "node:test";
import { calibrationSettings, cpuUtilization } from "../../scripts/calibrate-utilization.mjs";

test("calibration measures the assigned CPU budget rather than one process", () => {
  assert.deepEqual(cpuUtilization(1440, 120, 20), { cores: 12, percent: 60 });
  assert.deepEqual(cpuUtilization(2400, 120, 20), { cores: 20, percent: 100 });
  assert.deepEqual(cpuUtilization(0, 120, 20), { cores: 0, percent: 0 });
});

test("calibration rejects invalid accounting inputs", () => {
  for (const [cpu, elapsed, budget] of [[-1, 1, 1], [1, 0, 1], [1, 1, 0], [Infinity, 1, 1], [1, NaN, 1]]) {
    assert.throws(() => cpuUtilization(cpu, elapsed, budget), /finite valid measurements/u);
  }
});

test("calibration configuration is validated before workers start", () => {
  assert.deepEqual(calibrationSettings({ TSONIC_TEST_CALIBRATION_SECONDS: "120" }),
    { duration: 120, warmup: 60, target: 60 });
  for (const values of [
    {}, { TSONIC_TEST_CALIBRATION_SECONDS: "Infinity" },
    { TSONIC_TEST_CALIBRATION_SECONDS: "120", TSONIC_TEST_CALIBRATION_WARMUP_SECONDS: "-1" },
    { TSONIC_TEST_CALIBRATION_SECONDS: "120", TSONIC_TEST_MIN_CPU_PERCENT: "101" },
  ]) assert.throws(() => calibrationSettings(values), /Invalid test calibration/u);
});
