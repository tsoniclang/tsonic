import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export function guardMeasurementSucceeded(measurement) {
  return measurement !== null && typeof measurement === "object" &&
    typeof measurement.controlGroup === "string" && measurement.controlGroup.startsWith("/") &&
    measurement.swapBytes === 0 && Number.isSafeInteger(measurement.oomBefore) &&
    measurement.oomBefore >= 0 && measurement.oomAfter === measurement.oomBefore;
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
