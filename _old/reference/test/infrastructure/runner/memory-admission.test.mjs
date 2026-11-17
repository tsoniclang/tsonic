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
    const pressured = { ...machine, availableMemoryMiB: requestedMiB + 8_191 };
    assert.equal(planTestMemoryAdmission(pressured, [], [], requestedMiB).admitted, false);
    assert.equal(planTestMemoryAdmission({ ...pressured, availableMemoryMiB: pressured.availableMemoryMiB + 1 },
      [], [], requestedMiB).admitted, true);
    assert.equal(planTestMemoryAdmission(machine, [scope("running", 45_057 - requestedMiB)], [], requestedMiB).admitted, false);
  }
  assert.throws(() => planTestMemoryAdmission(machine, [], [], 4096, { permitHeadroom: true }), /accepts only/u,
    "the removed extra-configuration signature cannot bypass admission");
});

test("an explicit group reserve changes admission once, never per test", () => {
  const explicitReserve = { ...machine, availableMemoryMiB: 32_768, reserveMiB: 20_480 };
  const admitted = planTestMemoryAdmission(explicitReserve, [], [], 24_576);
  assert.equal(admitted.admitted, true);
  assert.equal(admitted.reserveMiB, 20_480);
  assert.equal(admitted.reservedMiB, 0);
  assert.equal(planTestMemoryAdmission({ ...explicitReserve, availableMemoryMiB: 32_767 }, [], [], 24_576).admitted, false);
  assert.equal(planTestMemoryAdmission(explicitReserve, [scope("reserved", 16_384)], [], 24_576).admitted, true,
    "the explicit table reserve permits its exact aggregate capacity");
  assert.equal(planTestMemoryAdmission({ ...explicitReserve, reserveMiB: 24_576 }, [scope("reserved", 16_384)], [], 24_576).admitted, false,
    "a larger explicit table reserve refuses the same aggregate claim");
  for (const reserveMiB of [0, -1, 6144, 8191, NaN, Infinity]) {
    assert.throws(() => planTestMemoryAdmission({ ...explicitReserve, reserveMiB }, [], [], 24_576), /reserve/u);
  }
});

test("an explicit eight-GiB reserve floor preserves aggregate and physical headroom", () => {
  assert.equal(planTestMemoryAdmission({ ...machine, reserveMiB: 8192 }, [], [], 4096).reserveMiB, 8192);
  assert.equal(planTestMemoryAdmission(machine, [], [], 4096).reserveMiB, 16_384);
  const explicitReserve = { totalMemoryMiB: 62_154, availableMemoryMiB: 28_672, reserveMiB: 8906 };
  const running = [scope("bank", 30_720), scope("watcher", 64)];
  const admitted = planTestMemoryAdmission(explicitReserve, running, [], 20_480);
  assert.equal(admitted.admitted, true);
  assert.equal(admitted.capacityMiB, 53_248);
  assert.equal(admitted.reservedMiB, 30_784);
  assert.equal(planTestMemoryAdmission({ ...explicitReserve, availableMemoryMiB: 28_671 }, running, [], 20_480).admitted, false);
  assert.equal(planTestMemoryAdmission({ ...explicitReserve, availableMemoryMiB: 62_154 }, running, [], 22_465).admitted, false);
});

test("admission uses the smaller table remainder and live availability minus eight GiB", () => {
  for (const requestedMiB of [1, 2048, 8192, 14_336, 24_576]) {
    for (const tableDeltaMiB of [-1, 0, 1]) {
      for (const liveDeltaMiB of [-1, 0, 1]) {
        const reservedMiB = 45_770 - requestedMiB + tableDeltaMiB;
        const availableMemoryMiB = requestedMiB + 8_192 + liveDeltaMiB;
        const label = `request=${requestedMiB}, tableDelta=${tableDeltaMiB}, liveDelta=${liveDeltaMiB}`;
        const result = planTestMemoryAdmission({ totalMemoryMiB: 62_154, availableMemoryMiB },
          [scope("running", reservedMiB)], [], requestedMiB);
        assert.equal(result.admitted, tableDeltaMiB <= 0 && liveDeltaMiB >= 0, label);
        assert.equal(result.capacityMiB, 45_770, `${label}: sixteen-GiB table reserve`);
        assert.equal(result.reserveMiB, 16_384, `${label}: table reserve is not the live margin`);
        assert.equal(result.reservedMiB, reservedMiB, `${label}: entire MemoryMax remains reserved`);
      }
    }
  }
});
