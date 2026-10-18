import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readTestHostResources } from "./test-resource-budget.mjs";
import { guardCgroupPath } from "./guard-cgroup.mjs";

export function planTestMemoryAdmission(machine, reservations, scopes, requestedMiB, exception) {
  const positive = value => Number.isSafeInteger(value) && value > 0;
  if (!positive(requestedMiB) || !positive(machine.totalMemoryMiB) || !positive(machine.availableMemoryMiB)) {
    throw new Error("Memory admission requires positive finite machine and job sizes.");
  }
  const reserveMiB = 16_384;
  if (exception !== undefined && (exception.decisionId !== "C-0244" ||
    exception.jobId !== "Q109-C238-first-ring-census-r2" || requestedMiB !== 20_480)) {
    throw new Error("The C-0244 headroom exception is restricted to Q109's 20 GiB census r2.");
  }
  if (exception !== undefined && reservations.some(claim => claim.headroomException?.decisionId === "C-0244")) {
    throw new Error("The single C-0244 census already has a memory reservation.");
  }
  const capacityMiB = machine.totalMemoryMiB - reserveMiB;
  if (requestedMiB > capacityMiB) throw new Error("The job cannot fit alongside the 16 GiB memory reserve.");
  const claims = new Map();
  for (const claim of reservations) {
    if (typeof claim.unit !== "string" || !positive(claim.memoryMiB) || claims.has(claim.unit)) {
      throw new Error("Invalid or duplicate memory reservation.");
    }
    claims.set(claim.unit, claim.memoryMiB);
  }
  for (const scope of scopes) {
    if (typeof scope.unit !== "string" || !positive(scope.memoryMiB)) throw new Error("An active test scope is unbounded.");
    const reserved = claims.get(scope.unit);
    if (reserved !== undefined && reserved !== scope.memoryMiB) throw new Error("The test scope differs from its admitted MemoryMax.");
    claims.set(scope.unit, scope.memoryMiB);
  }
  const reservedMiB = [...claims.values()].reduce((total, size) => total + size, 0);
  const admitted = reservedMiB + requestedMiB <= capacityMiB &&
    (machine.availableMemoryMiB >= requestedMiB + reserveMiB || exception !== undefined);
  return Object.freeze({
    admitted, requestedMiB, reservedMiB, capacityMiB, reserveMiB,
    totalMemoryMiB: machine.totalMemoryMiB, availableMemoryMiB: machine.availableMemoryMiB,
    activeUnits: Object.freeze([...claims.keys()].sort()),
    headroomException: exception === undefined ? null : Object.freeze({
      decisionId: exception.decisionId, jobId: exception.jobId,
      actualAvailableMemoryMiB: machine.availableMemoryMiB,
      normallyRequiredMemoryMiB: requestedMiB + reserveMiB,
      deficitMiB: Math.max(0, requestedMiB + reserveMiB - machine.availableMemoryMiB),
      applied: machine.availableMemoryMiB < requestedMiB + reserveMiB,
    }),
  });
}

export function processStartIdentity(status) {
  const closing = status.lastIndexOf(")");
  const fields = closing < 0 ? [] : status.slice(closing + 1).trim().split(/\s+/u);
  if (!/^\d+$/u.test(fields[19] ?? "")) throw new Error("Cannot identify the reservation's owning process.");
  return fields[19];
}

export function reservationIsLive(reservation, scopes, readProcess, bootId) {
  if (scopes.some(scope => scope.unit === reservation.unit)) return true;
  if (reservation.bootId !== bootId) return false;
  if (reservation.phase === "pending") return true;
  const status = readProcess(reservation.pid);
  return status !== undefined && processStartIdentity(status) === reservation.processStart;
}

function checkedSystemctl(arguments_) {
  const result = spawnSync("systemctl", ["--user", ...arguments_], { encoding: "utf8", maxBuffer: 8_388_608 });
  if (result.status !== 0) throw new Error(`Cannot inventory bounded test scopes: ${(result.stderr ?? "").slice(0, 1024)}`);
  return result.stdout;
}

function runningTestScopes() {
  const listed = checkedSystemctl(["list-units", "--type=scope", "--state=active,activating,deactivating", "--plain", "--no-legend", "--full", "tsonic-*.scope"]);
  return listed.split("\n").filter(line => line.trim().length > 0).flatMap(line => {
    const unit = line.trim().split(/\s+/u)[0];
    if (!/^tsonic-[a-zA-Z0-9_-]+\.scope$/u.test(unit ?? "")) throw new Error("Invalid active test scope identity.");
    const properties = Object.fromEntries(checkedSystemctl([
      "show", unit, "--property=MemoryMax", "--property=ActiveState", "--property=LoadState", "--no-pager",
    ]).trim().split("\n").map(entry => {
      const separator = entry.indexOf("=");
      return [entry.slice(0, separator), entry.slice(separator + 1)];
    }));
    if (properties.LoadState === "not-found" || !["active", "activating", "deactivating"].includes(properties.ActiveState)) return [];
    const text = properties.MemoryMax ?? "";
    const bytes = Number(text);
    if (!/^\d+$/u.test(text) || !Number.isSafeInteger(bytes) || bytes <= 0 || bytes % 1_048_576 !== 0) {
      throw new Error(`Active test scope ${unit} has no exact finite MemoryMax.`);
    }
    return [{ unit, memoryMiB: bytes / 1_048_576 }];
  });
}

function readProcess(pid) {
  try {
    return readFileSync(`/proc/${pid}/stat`, "utf8");
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ESRCH") return undefined;
    throw error;
  }
}

function readState(path) {
  if (!existsSync(path)) return { schemaVersion: 1, reservations: [] };
  const state = JSON.parse(readFileSync(path, "utf8"));
  if (state.schemaVersion !== 1 || !Array.isArray(state.reservations)) throw new Error("Invalid memory reservation state.");
  for (const entry of state.reservations) {
    if (!/^tsonic-[a-zA-Z0-9_-]+\.scope$/u.test(entry.unit ?? "") ||
      !Number.isSafeInteger(entry.pid) || entry.pid < 1 || !/^\d+$/u.test(entry.processStart ?? "") ||
      !Number.isSafeInteger(entry.memoryMiB) || entry.memoryMiB < 1 ||
      !["pending", "active"].includes(entry.phase) || typeof entry.bootId !== "string") throw new Error("Invalid memory reservation entry.");
  }
  return state;
}

function writeState(path, state) {
  const temporary = `${path}.${process.pid}`;
  writeFileSync(temporary, JSON.stringify(state) + "\n", { flag: "wx", mode: 0o600 });
  renameSync(temporary, path);
}

function memoryAdmissionCommand(arguments_) {
  const [action, statePath, unit, pidText, memoryText, queuedAtText] = arguments_;
  const pid = Number(pidText);
  if (!["acquire", "activate", "release"].includes(action) || !Number.isSafeInteger(pid) || pid < 1 ||
    !/^tsonic-[a-zA-Z0-9_-]+\.scope$/u.test(unit ?? "")) throw new Error("Invalid memory admission command.");
  const state = readState(statePath);
  if (action === "activate") {
    const owned = state.reservations.find(entry => entry.unit === unit);
    const group = guardCgroupPath(readFileSync("/proc/self/cgroup", "utf8"));
    if (owned === undefined || owned.pid !== pid || !group.endsWith(`/${unit}`) ||
      Number(readFileSync(resolve(group, "memory.max"), "utf8")) !== owned.memoryMiB * 1_048_576) {
      throw new Error("The running test scope differs from its pending memory reservation.");
    }
    writeState(statePath, { ...state, reservations: state.reservations.map(entry => entry.unit === unit ? { ...entry, phase: "active" } : entry) });
    return 0;
  }
  if (action === "release") {
    const owned = state.reservations.find(entry => entry.unit === unit);
    if (owned !== undefined && owned.pid !== pid) throw new Error("Cannot release another test job's reservation.");
    const properties = Object.fromEntries(checkedSystemctl(["show", unit,
      "--property=LoadState", "--property=ControlGroup", "--property=ActiveState", "--no-pager",
    ]).trim().split("\n").map(line => { const separator = line.indexOf("="); return [line.slice(0, separator), line.slice(separator + 1)]; }));
    const group = properties.ControlGroup;
    const empty = typeof group === "string" && group.length > 0
      ? existsSync(`/sys/fs/cgroup${group}/cgroup.events`) &&
        /^populated 0$/mu.test(readFileSync(`/sys/fs/cgroup${group}/cgroup.events`, "utf8"))
      : properties.LoadState === "not-found" && properties.ActiveState === "inactive";
    if (!empty) throw new Error("Cannot release memory before the owned test scope is proven empty.");
    writeState(statePath, { ...state, reservations: state.reservations.filter(entry => entry.unit !== unit) });
    return 0;
  }
  const scopes = runningTestScopes();
  const bootId = readFileSync("/proc/sys/kernel/random/boot_id", "utf8").trim();
  const retained = state.reservations.filter(entry => reservationIsLive(entry, scopes, readProcess, bootId));
  if (retained.some(entry => entry.unit === unit)) throw new Error("A test job cannot reserve memory twice.");
  const decisionId = process.env.TSONIC_TEST_HEADROOM_DECISION;
  const jobId = process.env.TSONIC_TEST_HEADROOM_JOB;
  const exception = decisionId === undefined && jobId === undefined ? undefined : { decisionId, jobId };
  const result = planTestMemoryAdmission(readTestHostResources(), retained, scopes, Number(memoryText), exception);
  if (!result.admitted) {
    writeState(statePath, { ...state, reservations: retained });
    return 75;
  }
  const status = readProcess(pid);
  if (status === undefined) throw new Error("The memory reservation has no living owner.");
  if (!/^\d+$/u.test(queuedAtText ?? "")) throw new Error("Invalid monotonic admission timestamp.");
  const queuedAt = BigInt(queuedAtText);
  const waited = process.hrtime.bigint() - queuedAt;
  if (waited < 0n) throw new Error("Invalid monotonic admission timestamp.");
  const admittedAt = new Date().toISOString();
  writeState(statePath, { ...state, reservations: [...retained, {
    unit, pid, processStart: processStartIdentity(status), memoryMiB: Number(memoryText), admittedAt, phase: "pending", bootId,
    headroomException: result.headroomException,
  }] });
  console.log(JSON.stringify({ ...result, unit, admittedAt, waitSeconds: Number(waited) / 1_000_000_000 }));
  return 0;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = memoryAdmissionCommand(process.argv.slice(2));
}
