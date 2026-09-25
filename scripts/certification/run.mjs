import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { hostRoot, loadNpmWave, resolveWaveLayout } from "../release/npm-wave.mjs";
import { snapshotCertificationInputs } from "./inputs.mjs";
import { hostReportCounts } from "./counts.mjs";
import { certificationRoot, describeEvidence, validateCertification, writeImmutableJson } from "./records.mjs";

export function runCertification(entry, layout, { environment = process.env } = {}) {
  const startedAt = new Date().toISOString();
  const root = resolve(certificationRoot(hostRoot, entry.repository), `${startedAt.replaceAll(/[-:.]/gu, "")}-${randomUUID()}`);
  mkdirSync(root, { recursive: true });
  const before = snapshotCertificationInputs(entry, layout, environment);
  writeImmutableJson(resolve(root, "started.json"), { suite: entry, startedAt, before });
  const guardPath = resolve(root, "guard.json");
  const countsRoot = resolve(root, "counts");
  mkdirSync(countsRoot);
  const reportPath = resolve(root, "suite.json");
  const result = spawnSync("bash", [resolve(hostRoot, "test/scripts/bounded-run.sh"), entry.profile, ...entry.worker], {
    cwd: layout.repositoryRoots.get(entry.repository), stdio: "inherit",
    env: {
      ...environment,
      TSONIC_ROOT: hostRoot,
      TSONICLANG_WORKSPACE_ROOT: layout.workspaceRoot,
      TSONIC_TEST_GUARD_REPORT: guardPath,
      TSONIC_TEST_COUNT_DIRECTORY: countsRoot,
      TSONIC_TEST_SUITE_REPORT: reportPath,
    },
  });
  const after = snapshotCertificationInputs(entry, layout, environment);
  const guard = existsSync(guardPath) ? JSON.parse(readFileSync(guardPath, "utf8")) : null;
  const evidence = [];
  let counts = [];
  let complete = false;
  let diagnostic;
  try {
    if (guard === null) throw new Error("Bounded runner did not finish its resource report.");
    evidence.push(describeEvidence(guardPath, "guard"), describeEvidence(guard.log, "log"));
    if (existsSync(reportPath)) {
      if (JSON.stringify(entry.banks) !== '["host"]') throw new Error("Unexpected host report.");
      counts = hostReportCounts(JSON.parse(readFileSync(reportPath, "utf8")));
      evidence.push(describeEvidence(reportPath, "host"));
    } else {
      const paths = readdirSync(countsRoot).sort().map(file => resolve(countsRoot, file));
      if (paths.length === 0) throw new Error("No completed test banks reported counts.");
      const banks = [];
      for (const path of paths) {
        const bank = JSON.parse(readFileSync(path, "utf8"));
        if (bank.exitCode !== 0) throw new Error("A test bank failed.");
        banks.push(bank.kind);
        counts.push(...bank.counts);
        evidence.push(describeEvidence(path, "counts"));
      }
      if (JSON.stringify(banks.sort()) !== JSON.stringify([...entry.banks].sort())) throw new Error("Test bank inventory is incomplete.");
    }
    complete = true;
  } catch (error) {
    diagnostic = error.message;
  }
  const record = {
    schemaVersion: 1, suite: entry, startedAt, finishedAt: new Date().toISOString(),
    before, after, exitCode: result.status === 0 && !complete ? 1 : result.status ?? 1, complete, counts, guard, evidence,
    ...(diagnostic === undefined ? {} : { diagnostic }),
  };
  writeImmutableJson(resolve(root, "record.json"), record);
  let reusable = false;
  try {
    validateCertification(record, entry, after, root);
    reusable = true;
  } catch (error) {
    process.stdout.write(`Certification is not reusable: ${error.message}\n`);
  }
  process.stdout.write(`Certification record: ${resolve(root, "record.json")}\n`);
  return { record, reusable };
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [repository, ...extra] = process.argv.slice(2);
  const wave = loadNpmWave();
  const manifest = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8"));
  const expectedName = repository === "tsonic"
    ? JSON.parse(readFileSync(resolve(hostRoot, "package.json"), "utf8")).name
    : wave.packages.find(entry => entry.repository === repository && entry.directory === ".")?.name;
  if (manifest.name !== expectedName) throw new Error("Complete certification must run from the selected repository.");
  const layout = resolveWaveLayout(wave, {
    workspaceRoot: process.env.TSONICLANG_WORKSPACE_ROOT ?? dirname(process.cwd()),
    repositoryRoots: new Map([[repository, process.cwd()]]),
  });
  const entry = layout.certification.find(entry => entry.repository === repository);
  if (entry === undefined || extra.length !== 0) throw new Error("Select one declared complete certification suite.");
  const { record } = runCertification(entry, layout);
  process.exitCode = record.exitCode;
}
