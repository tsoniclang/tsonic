import { certificationRoot, latestCertification, validateCertification } from "./records.mjs";
import { snapshotCertificationInputs } from "./inputs.mjs";
import { runCertification } from "./run.mjs";
import { hostRoot } from "../release/npm-wave.mjs";
import { dirname } from "node:path";
import { focusedCertificationEntry, requiredCertificationChecks } from "./checks.mjs";

export function selectCertification(entries, options, inspect) {
  return entries.map(entry => {
    try {
      return { entry, action: "reuse", evidence: inspect(entry) };
    } catch (error) {
      if (options.check) throw new Error(`${entry.repository}: ${error.message} Certification needs execution; --check never runs tests.`, { cause: error });
      return { entry, action: "run", reason: error.message };
    }
  });
}

export function inspectCertification(entry, layout, { name = entry.repository, coveredPaths = [] } = {}) {
  const { path, record } = latestCertification(certificationRoot(hostRoot, name));
  const current = snapshotCertificationInputs(entry, layout);
  const counts = validateCertification(record, entry, current, dirname(path), Date.now(), coveredPaths);
  return { path, counts, record, current };
}

export function certifyWave(wave, options, {
  inspect = inspectCertification, run = runCertification, snapshot = snapshotCertificationInputs,
  write = message => process.stdout.write(message),
} = {}) {
  const entries = options.suites.length === 0 ? wave.certification : options.suites.map(repository => {
    const entry = wave.certification.find(entry => entry.repository === repository);
    if (entry === undefined) throw new Error(`Unknown certification suite '${repository}'.`);
    return entry;
  });
  for (const entry of entries) {
    if (snapshot(entry, wave.layout).repositories.some(repository => repository.dirty)) {
      throw new Error("Certification selection requires clean inputs; no tests were started.");
    }
  }
  const candidatePaths = wave.checks.flatMap(check => check.paths);
  const selected = selectCertification(entries, options, entry => {
    const evidence = inspect(entry, wave.layout, { coveredPaths: candidatePaths });
    return { ...evidence, checks: requiredCertificationChecks(evidence.record.after, evidence.current, wave.checks) };
  });
  const required = new Set(selected.flatMap(selection => selection.evidence?.checks ?? []));
  const verifiedPaths = [];
  for (const check of wave.checks.filter(check => required.has(check.name))) {
    const entry = focusedCertificationEntry(check, wave);
    const ignored = wave.checks.filter(other => other.name !== check.name).flatMap(other => other.paths);
    const inspectCheck = () => inspect(entry, wave.layout, { name: check.name, coveredPaths: ignored });
    const [selection] = selectCertification([entry], options, inspectCheck);
    if (selection.action === "run") {
      write(`Certifying ${check.name}: ${selection.reason}\n`);
      const { record, reusable } = run(entry, wave.layout, { name: check.name });
      if (record.exitCode !== 0 || !reusable) throw new Error(`${check.name} failed; no source bank was started.`);
    }
    const evidence = inspectCheck();
    verifiedPaths.push(...check.paths);
    write(`Certified ${check.name}: ${evidence.counts.passed} passed; ${selection.action === "reuse" ? "reused" : "fresh"} ${evidence.path}\n`);
  }
  for (const selection of selected) {
    const { entry } = selection;
    if (selection.action === "run") {
      write(`Certifying ${entry.repository}: ${selection.reason}\n`);
      const { record, reusable } = run(entry, wave.layout);
      if (record.exitCode !== 0 || !reusable) throw new Error(`${entry.repository} did not produce complete, current certification; no later suite was started.`);
    }
    const evidence = inspect(entry, wave.layout, { coveredPaths: verifiedPaths });
    write(`Certified ${entry.repository}: ${evidence.counts.passed} passed, ${evidence.counts.skipped} declared skips; ${selection.action === "reuse" ? "reused" : "fresh"} ${evidence.path}\n`);
  }
  for (const check of wave.checks.filter(check => required.has(check.name))) {
    inspect(focusedCertificationEntry(check, wave), wave.layout, {
      name: check.name, coveredPaths: wave.checks.filter(other => other.name !== check.name).flatMap(other => other.paths),
    });
  }
  for (const entry of entries) inspect(entry, wave.layout, { coveredPaths: verifiedPaths });
}
