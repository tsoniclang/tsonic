import { chmodSync, existsSync, lstatSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { digest, sameCertificationInputs } from "./inputs.mjs";
import { hostReportCounts } from "./counts.mjs";
import { readTestResourceBudget } from "../../test/scripts/test-resource-budget.mjs";

export function describeEvidence(path, role) {
  const info = lstatSync(path);
  if (!info.isFile()) throw new Error(`Certification evidence is not a regular file: ${path}`);
  if (info.size > 128 * 1024 * 1024) throw new Error("Certification evidence exceeds its read bound.");
  const bytes = readFileSync(path);
  return { role, path: realpathSync(path), bytes: bytes.length, sha256: digest(bytes) };
}

export function writeImmutableJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx", mode: 0o444 });
  chmodSync(path, 0o444);
}

export function certificationRoot(hostRoot, repository) {
  return resolve(hostRoot, ".temp/certification", repository);
}

export function latestCertification(root) {
  if (!existsSync(root)) throw new Error("No certification records exist.");
  const entries = readdirSync(root, { withFileTypes: true });
  if (entries.some(entry => !entry.isDirectory() || !/^\d{8}T\d{9}Z-[a-f0-9-]{36}$/u.test(entry.name))) {
    throw new Error("Malformed certification record directory.");
  }
  const latest = entries.map(entry => entry.name).sort().at(-1);
  if (latest === undefined) throw new Error("No certification records exist.");
  if (entries.filter(entry => entry.name.slice(0, 19) === latest.slice(0, 19)).length !== 1) throw new Error("Ambiguous latest certification timestamp.");
  const path = resolve(root, latest, "record.json");
  if (!existsSync(path)) throw new Error("Latest certification did not finish.");
  if (!lstatSync(path).isFile()) throw new Error("Certification record is not a regular file.");
  return { path, record: readEvidenceJson(path) };
}

export function validateCertification(record, entry, current, root, now = Date.now()) {
  if (record?.schemaVersion !== 1 || JSON.stringify(record.suite) !== JSON.stringify(entry)) {
    throw new Error("Certification suite, command or dependency closure changed.");
  }
  const started = Date.parse(record.startedAt);
  const finished = Date.parse(record.finishedAt);
  if (!Number.isFinite(started) || !Number.isFinite(finished) || finished < started || finished > now ||
      new Date(started).toISOString() !== record.startedAt || new Date(finished).toISOString() !== record.finishedAt) {
    throw new Error("Invalid certification timestamps.");
  }
  for (const inputs of [record.before, record.after, current]) {
    if (!Array.isArray(inputs?.repositories) || inputs.repositories.length !== entry.inputs.length ||
        inputs.repositories.some((repository, index) => repository.repository !== entry.inputs[index] ||
          repository.dirty !== false || !/^[a-f0-9]{40,64}$/u.test(repository.tree) ||
          !/^[a-f0-9]{40,64}$/u.test(repository.head))) {
      throw new Error("Certification requires the complete clean repository closure.");
    }
  }
  if (!sameCertificationInputs(record.before, record.after) || !sameCertificationInputs(record.after, current)) {
    throw new Error("Certification source, dependency, toolchain or environment is stale.");
  }
  if (record.exitCode !== 0 || record.complete !== true || !Array.isArray(record.counts) || record.counts.length === 0) {
    throw new Error("Certification is failed, partial or missing counts.");
  }
  let total = 0;
  let skipped = 0;
  for (const counts of record.counts) {
    for (const key of ["total", "passed", "failed", "skipped", "todo", "cancelled", "filtered"]) {
      if (!Number.isSafeInteger(counts[key]) || counts[key] < 0) throw new Error("Invalid certification counts.");
    }
    if (counts.failed !== 0 || counts.todo !== 0 || counts.cancelled !== 0 || counts.filtered !== 0 ||
        counts.total !== counts.passed + counts.skipped) throw new Error("Certification has failures or omitted tests.");
    total += counts.total;
    skipped += counts.skipped;
  }
  if (total === 0 || skipped !== entry.skipped) throw new Error("Certification test/skip inventory is inconsistent.");
  const guard = record.guard;
  if (guard?.exitCode !== 0 || guard.calibration !== false || guard.swapMax !== 0 ||
      !Number.isSafeInteger(guard.oomBefore) || guard.oomBefore < 0 || guard.oomAfter !== guard.oomBefore ||
      guard.scopeResult === "oom-kill") throw new Error("Certification lacks a successful resource guard.");
  for (const key of ["memoryMiB", "tasksMax", "timeoutSeconds", "logMaxBytes"]) {
    if (!Number.isSafeInteger(guard[key]) || guard[key] <= 0) throw new Error("Invalid certification resource bounds.");
  }
  const budget = readTestResourceBudget({ TSONIC_TEST_RESOURCE_BUDGET: JSON.stringify(guard.budget) }, entry.profile);
  if (budget.memoryMiB !== guard.memoryMiB) throw new Error("Certification resource budget disagrees with its guard.");
  if (!Array.isArray(record.evidence) || record.evidence.length < 2) throw new Error("Missing certification evidence.");
  const paths = new Set();
  const roles = [];
  const observedCounts = [];
  const banks = [];
  for (const evidence of record.evidence) {
    const within = relative(root, evidence.path);
    if (evidence.role !== "log" && (isAbsolute(within) || within === ".." || within.startsWith(`..${sep}`)) || paths.has(evidence.path)) {
      throw new Error("Relocated or duplicate certification evidence.");
    }
    paths.add(evidence.path);
    if (JSON.stringify(describeEvidence(evidence.path, evidence.role)) !== JSON.stringify(evidence)) {
      throw new Error("Certification evidence changed.");
    }
    roles.push(evidence.role);
    if (evidence.role === "guard") {
      if (evidence.path !== resolve(root, "guard.json") || JSON.stringify(readEvidenceJson(evidence.path)) !== JSON.stringify(guard)) throw new Error("Resource evidence is inconsistent.");
    } else if (evidence.role === "log") {
      const repositoryRoot = current.repositories.find(input => input.repository === entry.repository).root;
      const logPath = relative(resolve(repositoryRoot, ".temp/test-runs"), evidence.path);
      if (!/^\d{8}T\d{6}Z-\d+\.log$/u.test(logPath) || evidence.path !== guard.log || evidence.bytes > guard.logMaxBytes) throw new Error("Relocated or oversized certification log.");
    } else if (evidence.role === "host") {
      if (evidence.path !== resolve(root, "suite.json")) throw new Error("Relocated host report.");
      observedCounts.push(...hostReportCounts(readEvidenceJson(evidence.path)));
      banks.push("host");
    } else if (evidence.role === "counts") {
      const bank = readEvidenceJson(evidence.path);
      if (bank.exitCode !== 0 || !new RegExp(`^counts[\\\\/]${bank.kind}-[a-f0-9-]{36}\\.json$`, "u").test(within)) throw new Error("Invalid test bank evidence.");
      banks.push(bank.kind);
      observedCounts.push(...bank.counts);
    } else throw new Error("Unknown certification evidence role.");
  }
  if (roles.filter(role => role === "guard").length !== 1 || roles.filter(role => role === "log").length !== 1 ||
      JSON.stringify(banks.sort()) !== JSON.stringify([...entry.banks].sort()) ||
      JSON.stringify(observedCounts) !== JSON.stringify(record.counts)) throw new Error("Certification evidence does not match its complete test bank inventory.");
  return { total, passed: total - skipped, skipped };
}

function readEvidenceJson(path) {
  if (lstatSync(path).size > 4 * 1024 * 1024) throw new Error("Certification metadata exceeds its size bound.");
  return JSON.parse(readFileSync(path, "utf8"));
}
