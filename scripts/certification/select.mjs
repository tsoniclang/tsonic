import { certificationRoot, latestCertification, validateCertification } from "./records.mjs";
import { snapshotCertificationInputs } from "./inputs.mjs";
import { runCertification } from "./run.mjs";
import { hostRoot } from "../release/npm-wave.mjs";
import { dirname } from "node:path";

export function selectCertification(entries, options, inspect) {
  return entries.map(entry => {
    if (!options.reuse) return { entry, action: "run", reason: "fresh certification requested" };
    try {
      return { entry, action: "reuse", evidence: inspect(entry) };
    } catch (error) {
      if (!options.force) throw new Error(`${entry.repository}: ${error.message} Use --reuse-certification --force to rerun invalid evidence.`, { cause: error });
      return { entry, action: "run", reason: error.message };
    }
  });
}

export function inspectCertification(entry, layout) {
  const { path, record } = latestCertification(certificationRoot(hostRoot, entry.repository));
  const counts = validateCertification(record, entry, snapshotCertificationInputs(entry, layout), dirname(path));
  return { path, counts };
}

export function certifyWave(wave, options) {
  const entries = options.suites.length === 0 ? wave.certification : options.suites.map(repository => {
    const entry = wave.certification.find(entry => entry.repository === repository);
    if (entry === undefined) throw new Error(`Unknown certification suite '${repository}'.`);
    return entry;
  });
  const selected = selectCertification(entries, options, entry => inspectCertification(entry, wave.layout));
  for (const selection of selected) {
    const { entry } = selection;
    if (selection.action === "run") {
      process.stdout.write(`Certifying ${entry.repository}: ${selection.reason}\n`);
      const { record, reusable } = runCertification(entry, wave.layout);
      if (record.exitCode !== 0 || !reusable) throw new Error(`${entry.repository} did not produce complete, current certification; no later suite was started.`);
    }
    const evidence = inspectCertification(entry, wave.layout);
    process.stdout.write(`Certified ${entry.repository}: ${evidence.counts.passed} passed, ${evidence.counts.skipped} declared skips; ${selection.action === "reuse" ? "reused" : "fresh"} ${evidence.path}\n`);
  }
  for (const entry of entries) inspectCertification(entry, wave.layout);
}
