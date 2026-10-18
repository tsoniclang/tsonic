import assert from "node:assert/strict";
import test from "node:test";
import { planTestMemoryAdmission, processStartIdentity, reservationIsLive } from "../../scripts/memory-admission.mjs";

const machine = { totalMemoryMiB: 61_440, availableMemoryMiB: 57_344 };
const scope = (unit, memoryMiB) => ({ unit, memoryMiB });
const status = (start, name = "test guard") => `123 (${name}) ${["S", ...Array(18).fill("0"), String(start)].join(" ")}`;

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
  assert.equal(planTestMemoryAdmission(machine, [], [scope("legacy", 40_960)], 8192).admitted, false);
  assert.equal(planTestMemoryAdmission({ ...machine, availableMemoryMiB: 20_000 }, [], [], 4096).admitted, false);
  assert.throws(() => planTestMemoryAdmission(machine, [], [], 45_057), /16 GiB/u);
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

test("C-0244 overrides only physical headroom for the exact 20 GiB Q109 census", () => {
  const pressured = { ...machine, availableMemoryMiB: 32_154 };
  const exception = { decisionId: "C-0244", jobId: "Q109-C238-first-ring-census-r2" };
  assert.equal(planTestMemoryAdmission(pressured, [], [], 20_480).admitted, false, "ordinary jobs retain headroom");
  const admitted = planTestMemoryAdmission(pressured, [scope("watcher", 512)], [], 20_480, exception);
  assert.equal(admitted.admitted, true);
  assert.equal(admitted.reserveMiB, 16_384, "the aggregate reserve and capacity are unchanged");
  assert.equal(admitted.reservedMiB, 512, "every existing reservation remains counted");
  assert.equal(admitted.headroomException.actualAvailableMemoryMiB, 32_154, "the actual machine reading is not forged");
  assert.equal(admitted.headroomException.normallyRequiredMemoryMiB, 36_864);
  assert.equal(admitted.headroomException.deficitMiB, 4710);
  assert.equal(admitted.headroomException.decisionId, "C-0244");
  assert.equal(admitted.headroomException.applied, true);
  assert.equal(planTestMemoryAdmission(pressured, [scope("large", 24_577)], [], 20_480, exception).admitted, false,
    "C244 does not override aggregate admitted capacity");
  for (const invalid of [
    { ...exception, decisionId: "C-0245" }, { ...exception, jobId: "another-job" }, {},
  ]) assert.throws(() => planTestMemoryAdmission(pressured, [], [], 20_480, invalid), /restricted/u);
  assert.throws(() => planTestMemoryAdmission(pressured, [], [], 4096, exception), /restricted/u);
  assert.throws(() => planTestMemoryAdmission(pressured, [{ ...scope("already-running", 20_480),
    headroomException: admitted.headroomException }], [], 20_480, exception), /single C-0244 census/u);
  assert.equal(planTestMemoryAdmission(machine, [], [], 20_480, exception).headroomException.applied, false,
    "an unnecessary exception is recorded honestly rather than claimed used");
});
