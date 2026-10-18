import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export function guardMeasurementSucceeded(measurement) {
  return measurement !== null && typeof measurement === "object" &&
    typeof measurement.controlGroup === "string" && measurement.controlGroup.startsWith("/") &&
    measurement.swapBytes === 0 && Number.isSafeInteger(measurement.oomBefore) &&
    measurement.oomBefore >= 0 && Number.isSafeInteger(measurement.oomAfter) &&
    measurement.oomAfter >= measurement.oomBefore && (measurement.oomAfter === measurement.oomBefore ||
      verifiedOomMeasurement(measurement));
}

function verifiedOomMeasurement(measurement) {
  const recovery = measurement.oomRecovery;
  if (recovery?.verified !== true || recovery.issue !== null || typeof recovery.evidencePath !== "string" ||
      !recovery.evidencePath.startsWith("/") || !Array.isArray(recovery.incidents) || recovery.incidents.length === 0 ||
      !Array.isArray(recovery.victimTaskIds) || new Set(recovery.victimTaskIds).size !== recovery.incidents.length ||
      recovery.accountedKills !== measurement.oomAfter - measurement.oomBefore) return false;
  return recovery.incidents.every(incident => typeof incident.task === "string" && incident.task.length > 0 &&
    recovery.victimTaskIds.includes(incident.task) && incident.first?.drained === true &&
    Number.isSafeInteger(incident.first.oomKills) && incident.first.oomKills > 0 &&
    incident.retry?.drained === true && incident.retry.oomKills === 0 && incident.retryStatus === 0 &&
    incident.retryCompleted === true && Number.isSafeInteger(incident.retryTests) && incident.retryTests > 0 &&
    Number.isSafeInteger(incident.firstWidth) && incident.firstWidth > 0 &&
    incident.retryWidth === Math.max(1, Math.floor(incident.firstWidth / 2)) &&
    typeof incident.retryResultPath === "string" && incident.retryResultPath.length > 0) &&
    recovery.incidents.reduce((total, incident) => total + incident.first.oomKills, 0) === recovery.accountedKills;
}

export function guardScopeResultAccepted(receipt) {
  if (!guardMeasurementSucceeded(receipt?.measurement)) return false;
  const allowed = receipt.exitCode === 0 ? [null, "success"]
    : receipt.exitCode === 1 ? [null, "success", "exit-code"] : [];
  if (receipt.measurement.oomAfter > receipt.measurement.oomBefore) allowed.push("oom-kill");
  return allowed.includes(receipt.scopeResult);
}

export function prepareTaskCgroups(group, pid = process.pid) {
  try {
    const runner = resolve(group, "runner");
    mkdirSync(runner, { recursive: true });
    writeFileSync(resolve(runner, "cgroup.procs"), String(pid));
    writeFileSync(resolve(group, "cgroup.subtree_control"), "+memory");
    return { root: group, issue: null };
  } catch (error) {
    return { root: null, issue: `OOM victim attribution unavailable: ${error.message}` };
  }
}

export function createTaskCgroup(root, name) {
  if (root === undefined || root === null) return { path: null, issue: "OOM victim attribution unavailable" };
  if (!/^task-[A-Za-z0-9-]+$/u.test(name)) throw new Error("Invalid task cgroup name.");
  const path = resolve(root, name);
  try {
    mkdirSync(path);
    if (readFileSync(resolve(path, "memory.max"), "utf8").trim() !== "max") {
      throw new Error("A task child must not reserve or impose a memory limit.");
    }
    const initial = readTaskCgroup(path);
    if (initial.oomKills !== 0 || !initial.drained) throw new Error("A new task child must be empty with no prior OOM.");
    return { path, issue: null };
  } catch (error) {
    return { path: null, issue: `OOM victim attribution unavailable: ${error.message}` };
  }
}

export function readTaskCgroup(path) {
  const fields = file => Object.fromEntries(readFileSync(resolve(path, file), "utf8").trim().split("\n").map(line => line.trim().split(/\s+/u)));
  const events = fields("memory.events.local");
  const population = fields("cgroup.events");
  const peak = readFileSync(resolve(path, "memory.peak"), "utf8").trim();
  const processes = readFileSync(resolve(path, "cgroup.procs"), "utf8").trim();
  if (!/^\d+$/u.test(events.oom_kill ?? "") || !/^\d+$/u.test(peak) ||
      !["0", "1"].includes(population.populated) ||
      (processes !== "" && !/^\d+(?:\s+\d+)*$/u.test(processes)) ||
      !Number.isSafeInteger(Number(events.oom_kill)) || !Number.isSafeInteger(Number(peak))) {
    throw new Error("Invalid exact task cgroup measurements.");
  }
  return { path, oomKills: Number(events.oom_kill), memoryPeakBytes: Number(peak),
    populated: Number(population.populated), processIds: processes === "" ? [] : processes.split(/\s+/u),
    drained: population.populated === "0" && processes === "", observedAt: new Date().toISOString(), issue: null };
}

export async function drainTaskCgroup(path) {
  let measurement = readTaskCgroup(path);
  if (!measurement.drained) {
    writeFileSync(resolve(path, "cgroup.kill"), "1");
    for (let attempt = 0; attempt < 100 && !measurement.drained; attempt += 1) {
      await new Promise(done => setTimeout(done, 50));
      measurement = readTaskCgroup(path);
    }
  }
  return measurement;
}

export function verifyOomRecoveries(group, reportPath, killedCount) {
  const empty = { verified: killedCount === 0, accountedKills: 0, incidents: [], victimTaskIds: [], evidencePath: reportPath ?? null, issue: null };
  if (reportPath === undefined || !existsSync(reportPath)) {
    return { ...empty, issue: killedCount === 0 ? null : "OOM victim attribution unavailable" };
  }
  const seen = new Set();
  const incidents = [];
  try {
    for (const line of readFileSync(reportPath, "utf8").split("\n").filter(Boolean)) {
      const incident = JSON.parse(line);
      for (const path of [incident.firstGroup, incident.retryGroup]) {
        if (typeof path !== "string" || resolve(path, "..") !== group || seen.has(path) ||
            !/^task-[A-Za-z0-9-]+$/u.test(path.slice(group.length + 1))) {
          throw new Error("A recovery must own two distinct task children of the bounded group.");
        }
        seen.add(path);
      }
      const first = readTaskCgroup(incident.firstGroup);
      const retry = readTaskCgroup(incident.retryGroup);
      if (!first.drained || !retry.drained || first.oomKills < 1 || retry.oomKills !== 0 ||
          incident.retryStatus !== 0 || incident.retryCompleted !== true ||
          !Number.isSafeInteger(incident.retryTests) || incident.retryTests < 1) {
        throw new Error("An OOM recovery requires exact victim evidence and a drained completed passing retry.");
      }
      incidents.push({ ...incident, first, retry });
    }
    const accountedKills = incidents.reduce((total, incident) => total + incident.first.oomKills, 0);
    if (accountedKills !== killedCount) throw new Error("Not every owned OOM kill has a proved passing one-time retry.");
    const recovery = { verified: true, accountedKills, incidents, victimTaskIds: incidents.map(incident => incident.task), evidencePath: reportPath, issue: null };
    if (killedCount > 0 && !verifiedOomMeasurement({ oomBefore: 0, oomAfter: killedCount, oomRecovery: recovery })) {
      throw new Error("OOM recovery lacks exact task identities, half-width or retry-result evidence.");
    }
    return recovery;
  } catch (error) {
    return { ...empty, verified: false, incidents, issue: error.message };
  }
}

export function guardReceiptHasOwnedMeasurements(receipt) {
  const measurement = receipt?.measurement;
  const admission = receipt?.admission;
  return receipt?.oomScope === "owned-cgroup" && receipt.scopeDrained === true &&
    guardMeasurementSucceeded(measurement) && receipt.oomBefore === measurement.oomBefore &&
    receipt.oomAfter === measurement.oomAfter && measurement.exitCode === receipt.exitCode &&
    Number.isSafeInteger(receipt.memoryMiB) && receipt.memoryMiB > 0 &&
    receipt.budget?.memoryMiB === receipt.memoryMiB && admission?.admitted === true &&
    admission.requestedMiB === receipt.memoryMiB && typeof admission.unit === "string" &&
    /^[A-Za-z0-9_.-]+\.scope$/u.test(admission.unit) &&
    measurement.controlGroup.endsWith(`/${admission.unit}`);
}

export function guardCgroupPath(membership) {
  const selected = membership.match(/^0::(\/.*)$/mu);
  if (selected === null) throw new Error("The bounded command requires its cgroup v2 membership.");
  const root = "/sys/fs/cgroup";
  const path = resolve(root, `.${selected[1]}`);
  if (path !== root && !path.startsWith(`${root}/`)) throw new Error("Invalid bounded command cgroup.");
  return path;
}

export function readGuardCounters(group) {
  const integer = (file) => {
    const text = readFileSync(resolve(group, file), "utf8").trim();
    if (!/^\d+$/u.test(text)) throw new Error(`Invalid cgroup counter ${file}.`);
    const value = Number(text);
    if (!Number.isSafeInteger(value)) throw new Error(`Unsafe cgroup counter ${file}.`);
    return value;
  };
  const fields = (file) => Object.fromEntries(readFileSync(resolve(group, file), "utf8").trim().split("\n").map(line => {
    const [key, text] = line.trim().split(/\s+/u);
    const value = Number(text);
    if (key === undefined || !/^\d+$/u.test(text ?? "") || !Number.isSafeInteger(value)) {
      throw new Error(`Invalid cgroup fields ${file}.`);
    }
    return [key, value];
  }));
  return {
    memoryPeakBytes: integer("memory.peak"),
    swapBytes: integer("memory.swap.current"),
    cpu: fields("cpu.stat"),
    memoryEvents: fields("memory.events"),
  };
}
