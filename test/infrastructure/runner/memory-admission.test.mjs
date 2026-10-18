import assert from "node:assert/strict";
import test from "node:test";
import { admittedScopeCgroup, planTestMemoryAdmission, processStartIdentity, reservationIsLive } from "../../scripts/memory-admission.mjs";

const machine = { totalMemoryMiB: 61_440, availableMemoryMiB: 57_344 };
const scope = (unit, memoryMiB) => ({ unit, memoryMiB });
const status = (start, name = "test guard") => `123 (${name}) ${["S", ...Array(18).fill("0"), String(start)].join(" ")}`;

test("reservation activation binds the exact outer scope, including its delegated runner and task children", () => {
  const scope = "/sys/fs/cgroup/user.slice/tsonic-host-tests-control.scope";
  for (const suffix of ["", "/runner", "/task-123"]) {
    assert.equal(admittedScopeCgroup(`0::/user.slice/tsonic-host-tests-control.scope${suffix}\n`, "tsonic-host-tests-control.scope"), scope);
  }
  assert.throws(() => admittedScopeCgroup("0::/user.slice/foreign.scope/runner", "tsonic-host-tests-control.scope"), /not within/u);
  assert.throws(() => admittedScopeCgroup("0::/user.slice/tsonic-host-tests-control.scope-extra/runner", "tsonic-host-tests-control.scope"), /not within/u);
});

test("memory reservations admit the entire safe remainder without fixed worker slots", () => {
  const running = Array.from({ length: 7 }, (_, index) => scope(`worker-${index}`, 4096));
  const result = planTestMemoryAdmission(machine, running, [], 16_384);
  assert.equal(result.admitted, true);
  assert.equal(result.reservedMiB + result.requestedMiB, 45_056);
  assert.equal(result.capacityMiB, machine.totalMemoryMiB - 16_384);
  assert.equal(planTestMemoryAdmission(machine, running, [], 16_385).admitted, false);
});

test("reservation and kernel scope are one claim, not two competing budgets", () => {
  const active = scope("same", 24_576);
  const result = planTestMemoryAdmission(machine, [active], [active], 20_480);
  assert.equal(result.admitted, true);
  assert.equal(result.reservedMiB, 24_576);
  assert.equal(result.activeUnits.length, 1);
  assert.throws(() => planTestMemoryAdmission(machine, [active], [scope("same", 6144)], 4096), /admitted MemoryMax/u);
});

test("pre-existing guarded scopes and physical free-memory pressure remain reserved", () => {
  assert.equal(planTestMemoryAdmission(machine, [], [scope("legacy", 49_152)], 8192).admitted, false);
  assert.equal(planTestMemoryAdmission({ ...machine, availableMemoryMiB: 10_239 }, [], [], 4096).admitted, false);
  assert.throws(() => planTestMemoryAdmission(machine, [], [], 45_057), /16384 MiB/u);
  assert.throws(() => planTestMemoryAdmission(machine, [scope("same", 1), scope("same", 1)], [], 1), /duplicate/u);
  assert.throws(() => planTestMemoryAdmission(machine, [], [scope("infinite", Infinity)], 1), /unbounded/u);
});

test("stale PID reuse releases only dead reservations and never a living scope", () => {
  const reservation = { unit: "owned", pid: 123, processStart: "555", memoryMiB: 4096, phase: "active", bootId: "boot" };
  assert.equal(processStartIdentity(status(555, "a ) b")), "555");
  assert.equal(reservationIsLive(reservation, [], () => status(555), "boot"), true);
  assert.equal(reservationIsLive(reservation, [], () => status(777), "boot"), false);
  assert.equal(reservationIsLive(reservation, [], () => undefined, "boot"), false);
  assert.equal(reservationIsLive(reservation, [scope("owned", 4096)], () => undefined, "boot"), true);
  assert.equal(reservationIsLive({ ...reservation, phase: "pending" }, [], () => undefined, "boot"), true);
  assert.equal(reservationIsLive({ ...reservation, phase: "pending" }, [], () => undefined, "new-boot"), false);
  assert.throws(() => processStartIdentity("malformed process"), /owning process/u);
});

test("every job meets the same physical headroom and aggregate admission rules", () => {
  for (const requestedMiB of [4096, 8192, 12_288, 20_480]) {
    const pressured = { ...machine, availableMemoryMiB: requestedMiB + 16_383 };
    assert.equal(planTestMemoryAdmission(pressured, [], [], requestedMiB).admitted, false);
    assert.equal(planTestMemoryAdmission({ ...pressured, availableMemoryMiB: pressured.availableMemoryMiB + 1 },
      [], [], requestedMiB).admitted, true);
    assert.equal(planTestMemoryAdmission(machine, [scope("running", 45_057 - requestedMiB)], [], requestedMiB).admitted, false);
  }
  assert.throws(() => planTestMemoryAdmission(machine, [], [], 4096, { permitHeadroom: true }), /accepts only/u,
    "the removed extra-configuration signature cannot bypass admission");
});

test("an explicit group reserve changes admission once, never per test", () => {
  const trial = { ...machine, availableMemoryMiB: 45_056, reserveMiB: 20_480 };
  const admitted = planTestMemoryAdmission(trial, [], [], 24_576);
  assert.equal(admitted.admitted, true);
  assert.equal(admitted.reserveMiB, 20_480);
  assert.equal(admitted.reservedMiB, 0);
  assert.equal(planTestMemoryAdmission({ ...trial, availableMemoryMiB: 45_055 }, [], [], 24_576).admitted, false);
  assert.equal(planTestMemoryAdmission({ ...trial, reserveMiB: 24_576 }, [], [], 24_576).admitted, false);
  for (const reserveMiB of [0, -1, 6144, 8192, 16_383, NaN, Infinity]) {
    assert.throws(() => planTestMemoryAdmission({ ...trial, reserveMiB }, [], [], 24_576), /reserve/u);
  }
});
