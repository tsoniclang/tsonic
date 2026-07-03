#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { availableParallelism, cpus } from "node:os";
import { relative, resolve, sep } from "node:path";
import { createPreparedSuiteDefinition } from "./suite-definition.mjs";

const tsonicRoot = resolve(new URL("../..", import.meta.url).pathname);
const defaultManifestPath = resolve(tsonicRoot, ".temp/test-runs/prepared/latest-manifest.json");
const options = parseArgs(process.argv.slice(2));
const manifestPath = resolve(options.manifest ?? defaultManifestPath);

if (!existsSync(manifestPath)) {
  console.error(`FAIL: prepared manifest not found: ${manifestPath}`);
  console.error("Run scripts/test/prepare.sh before scripts/test/run-prepared.mjs.");
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
validatePreparedManifest(manifest);
const runId = `${manifest.runId ?? "prepared"}-run-${timestamp()}-${process.pid}`;
const runRoot = resolve(tsonicRoot, ".temp/test-runs/prepared-runs", runId);
const logRoot = resolve(runRoot, "logs");
mkdirSync(logRoot, { recursive: true });

const env = {
  ...process.env,
  TSONIC_TEST_PREPARED: "1",
  TSONIC_PREPARED_MANIFEST: manifestPath,
  TSONIC_TEST_RUN_ID: runId,
  NUGET_PACKAGES: process.env.NUGET_PACKAGES ?? resolve(tsonicRoot, ".temp/test-runs/nuget/packages"),
};

const repos = {
  tsonic: tsonicRoot,
  tsonicCsharp: resolve(tsonicRoot, "../tsonic-csharp"),
  csharpJs: resolve(tsonicRoot, "../csharp-js"),
  csharpNodejs: resolve(tsonicRoot, "../csharp-nodejs"),
};
const suiteDefinition = createPreparedSuiteDefinition(repos);

const allShards = buildShards();
validateShardCoverage(allShards);

const shards = allShards.filter((shard) =>
  (options.scopes.size === 0 || options.scopes.has(shard.scope)) &&
  (options.matches.length === 0 || options.matches.some((match) => shard.id.includes(match)))
);
if (shards.length === 0) {
  console.error("FAIL: no prepared test shards selected.");
  process.exit(2);
}

if (options.list) {
  console.log(`prepared-run: manifest=${toPosix(relative(tsonicRoot, manifestPath))}`);
  console.log(`prepared-run: shards=${shards.length}`);
  for (const shard of shards) {
    console.log(`${shard.group}\t${shard.scope}\t${shard.id}`);
  }
  process.exit(0);
}

console.log(`prepared-run: manifest=${toPosix(relative(tsonicRoot, manifestPath))}`);
console.log(`prepared-run: shards=${shards.length} concurrency=${options.concurrency}`);

const startedAt = Date.now();
const results = await runShards(shards, options.concurrency);
const durationMs = Date.now() - startedAt;
const failures = results.filter((result) => result.status !== 0);
const testCounts = aggregateTestCounts(results);
const missingTestCountResults = results.filter((result) => result.testCounts === undefined);
const report = {
  runId,
  manifestPath: toPosix(manifestPath),
  durationMs,
  shardCounts: {
    total: results.length,
    passed: results.length - failures.length,
    failed: failures.length,
  },
  testCounts,
  testCountReporting: {
    required: results.length,
    reported: testCounts.reportedShards,
    missing: missingTestCountResults.length,
    missingShards: missingTestCountResults.map((result) => ({
      id: result.shard.id,
      group: result.shard.group,
      scope: result.shard.scope,
      log: toPosix(relative(tsonicRoot, result.logPath)),
    })),
  },
  failuresByGroup: groupFailures(failures),
  slowestShards: [...results]
    .sort((left, right) => right.durationMs - left.durationMs)
    .slice(0, 20)
    .map((result) => ({
      id: result.shard.id,
      group: result.shard.group,
      scope: result.shard.scope,
      durationMs: result.durationMs,
      status: result.status,
      log: toPosix(relative(tsonicRoot, result.logPath)),
    })),
};
writeFileSync(resolve(runRoot, "report.json"), `${JSON.stringify(report, null, 2)}\n`);

console.log(`prepared-run: shardsPassed=${report.shardCounts.passed} shardsFailed=${report.shardCounts.failed} durationMs=${durationMs}`);
if (testCounts.reportedShards > 0) {
  console.log(`prepared-run: reportedTests=${testCounts.total} passed=${testCounts.passed} failed=${testCounts.failed} skipped=${testCounts.skipped} reportingShards=${testCounts.reportedShards}`);
}
if (missingTestCountResults.length > 0) {
  console.log(`prepared-run: missingTestCountShards=${missingTestCountResults.length}`);
  for (const result of missingTestCountResults) {
    console.log(`  ${result.shard.id} log=${toPosix(relative(tsonicRoot, result.logPath))}`);
  }
}
if (failures.length > 0) {
  for (const [group, entries] of Object.entries(report.failuresByGroup)) {
    console.log(`failure-group: ${group}`);
    for (const entry of entries) {
      console.log(`  ${entry.id} status=${entry.status} log=${entry.log}`);
    }
  }
}
console.log("slowest-shards:");
for (const shard of report.slowestShards) {
  console.log(`  ${shard.durationMs}ms ${shard.status === 0 ? "PASS" : "FAIL"} ${shard.id} (${shard.log})`);
}
console.log(`prepared-run: report=${toPosix(relative(tsonicRoot, resolve(runRoot, "report.json")))}`);

process.exitCode = failures.length === 0 && missingTestCountResults.length === 0 ? 0 : 1;

function buildShards() {
  return [
    ...suiteDefinition.nodeSuites.flatMap((testSuite) =>
      listFiles(testSuite.directory, testSuite.suffix, testSuite.maxDepth)
        .filter((file) => !isIntentionallySkipped(testSuite, file))
        .flatMap((file) => nodeTestShards(testSuite.scope, groupForSuiteFile(testSuite, file), file))
    ),
    ...suiteDefinition.architectureSuites.flatMap((testSuite) =>
      listExecutableArchitectureTests(testSuite.directory)
        .flatMap((file) => nodeTestShards(testSuite.scope, testSuite.group, file))
    ),
    ...suiteDefinition.dotnetShards.map((shard) => ({ ...shard })),
  ];
}

function validateShardCoverage(shardsToValidate) {
  const representedFiles = new Set(
    shardsToValidate
      .filter((shard) => shard.file)
      .map((shard) => toPosix(relative(shard.cwd, shard.file)))
  );
  const failures = [];
  for (const testSuite of suiteDefinition.nodeSuites) {
    validateNodeSuiteCoverage(testSuite);
  }
  for (const testSuite of suiteDefinition.architectureSuites) {
    validateDirectArchitectureCoverage(testSuite);
  }
  for (const contract of suiteDefinition.aggregateImportContracts) {
    validateAggregateImportContract(contract);
  }
  validateTitleShardContracts();
  for (const shard of suiteDefinition.dotnetShards) {
    validateDotnetShard(shard);
  }

  if (failures.length > 0) {
    console.error("FAIL: prepared test shard coverage validation failed.");
    for (const failure of failures) {
      console.error(`  - ${failure}`);
    }
    process.exit(2);
  }

  function validateNodeSuiteCoverage(testSuite) {
    const repoKey = scopeToRepoKey(testSuite.scope);
    for (const file of listFilesRecursive(testSuite.directory, testSuite.suffix)) {
      const relativeFile = toPosix(relative(repos[repoKey], file));
      if (testSuite.intentionallySkipped?.has(relativeFile) === true) {
        continue;
      }
      if (!representedFiles.has(relativeFile)) {
        failures.push(`${testSuite.scope} test file has no prepared shard: ${relativeFile}`);
      }
    }
  }

  function validateDirectArchitectureCoverage(testSuite) {
    const repoKey = scopeToRepoKey(testSuite.scope);
    for (const file of listExecutableArchitectureTests(testSuite.directory)) {
      const relativeFile = toPosix(relative(repos[repoKey], file));
      if (!representedFiles.has(relativeFile)) {
        failures.push(`${testSuite.scope} architecture test module has no prepared shard: ${relativeFile}`);
      }
    }
  }

  function validateAggregateImportContract(contract) {
    const repoKey = scopeToRepoKey(contract.scope);
    const aggregateRelativeFile = toPosix(relative(repos[repoKey], contract.aggregateFile));
    const aggregateText = readFileSync(contract.aggregateFile, "utf8");
    const stripped = aggregateText
      .replaceAll(/^\s*import\s+(?<quote>["'])(?<specifier>\.\/[^"']+)\k<quote>\s*;\s*$/gmu, "")
      .trim();
    if (stripped.length > 0) {
      failures.push(`${aggregateRelativeFile} must be import-only for prepared direct-shard equivalence`);
    }
    const importedFiles = new Set();
    const importPattern = /^\s*import\s+(?<quote>["'])(?<specifier>\.\/[^"']+)\k<quote>\s*;\s*$/gmu;
    for (const match of aggregateText.matchAll(importPattern)) {
      importedFiles.add(toPosix(resolve(repos[repoKey], "test", match.groups.specifier)));
    }
    const directFiles = new Set(listFiles(contract.directDirectory, contract.suffix, 0).map((file) => toPosix(file)));
    for (const file of directFiles) {
      if (!importedFiles.has(file)) {
        failures.push(`${aggregateRelativeFile} does not import direct CLI-build test: ${toPosix(relative(repos[repoKey], file))}`);
      }
    }
    for (const file of importedFiles) {
      if (!directFiles.has(file)) {
        failures.push(`${aggregateRelativeFile} imports non-direct CLI-build test: ${toPosix(relative(repos[repoKey], file))}`);
      }
    }
  }

  function validateTitleShardContracts() {
    for (const shard of shardsToValidate) {
      if (shard.title === undefined || shard.file === undefined) {
        continue;
      }
      const file = shard.file;
      const repoRoot = shard.cwd;
      const relativeFile = toPosix(relative(repoRoot, file));
        const titles = extractTestTitles(file);
        const staticTestCount = countTopLevelTestInvocations(file);
        if (titles.length !== staticTestCount) {
          failures.push(`${toPosix(relative(repoRoot, file))} is title-sharded but has ${staticTestCount} test(...) calls and ${titles.length} static literal titles`);
        }
        const uniqueTitles = new Set(titles);
        if (uniqueTitles.size !== titles.length) {
          failures.push(`${toPosix(relative(repoRoot, file))} is title-sharded but has duplicate test titles`);
        }
    }
  }

  function validateDotnetShard(shard) {
    if (!existsSync(shard.projectOrSolution)) {
      failures.push(`${shard.id} project/solution does not exist: ${toPosix(shard.projectOrSolution)}`);
      return;
    }
    if (!shardsToValidate.some((candidate) => candidate.id === shard.id)) {
      failures.push(`${shard.id} dotnet shard is not registered`);
    }
  }
}

function nodeTestShards(scope, group, file) {
  const repoKey = scopeToRepoKey(scope);
  const relativeFile = toPosix(relative(repos[repoKey], file));
  const titles = extractTestTitles(file);
  const staticTestCount = countTopLevelTestInvocations(file);
  if (!suiteDefinition.shouldTitleShard({ scope, file, relativeFile, staticTestCount, literalTitleCount: titles.length })) {
    return [nodeTestShard(scope, group, file)];
  }
  return titles.map((title, index) => ({
    id: `${scope}:${relativeFile}::${String(index + 1).padStart(3, "0")}-${slug(title)}`,
    scope,
    group,
    file,
    cwd: repos[repoKey],
    command: process.execPath,
    args: [
      "--test",
      "--test-reporter=tap",
      `--test-name-pattern=^${escapeRegExp(title)}$`,
      relativeFile,
    ],
    title,
  }));
}

function nodeTestShard(scope, group, file) {
  return {
    id: `${scope}:${toPosix(relative(repos[scopeToRepoKey(scope)], file))}`,
    scope,
    group,
    file,
    cwd: repos[scopeToRepoKey(scope)],
    command: process.execPath,
    args: ["--test", "--test-reporter=tap", toPosix(relative(repos[scopeToRepoKey(scope)], file))],
  };
}

function extractTestTitles(file) {
  const text = readFileSync(file, "utf8");
  const titles = [];
  const pattern = /(?:^|\n)\s*test\(\s*(["'])(?<title>(?:\\.|(?!\1).)+)\1\s*,/gu;
  for (const match of text.matchAll(pattern)) {
    titles.push(unescapeJsString(match.groups.title));
  }
  return titles;
}

function countTopLevelTestInvocations(file) {
  const text = readFileSync(file, "utf8");
  return [...text.matchAll(/(?:^|\n)\s*test\(\s*/gu)].length;
}

function scopeToRepoKey(scope) {
  switch (scope) {
    case "tsonic":
      return "tsonic";
    case "tsonic-csharp":
      return "tsonicCsharp";
    case "csharp-nodejs":
      return "csharpNodejs";
    default:
      throw new Error(`Unknown scope: ${scope}`);
  }
}

function isIntentionallySkipped(testSuite, file) {
  if (testSuite.intentionallySkipped === undefined) {
    return false;
  }
  const relativeFile = toPosix(relative(repos[scopeToRepoKey(testSuite.scope)], file));
  return testSuite.intentionallySkipped.has(relativeFile);
}

function groupForSuiteFile(testSuite, file) {
  if (testSuite.groupForFile !== undefined) {
    return testSuite.groupForFile(file);
  }
  return testSuite.group;
}

function listFiles(directory, suffix, maxDepth) {
  if (!existsSync(directory)) {
    return [];
  }
  const output = [];
  walk(directory, 0);
  return output.sort();

  function walk(current, depth) {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = resolve(current, entry.name);
      if (entry.isDirectory() && depth < maxDepth) {
        walk(path, depth + 1);
      } else if (entry.isFile() && path.endsWith(suffix)) {
        output.push(path);
      }
    }
  }
}

function listFilesRecursive(directory, suffix) {
  if (!existsSync(directory)) {
    return [];
  }
  const output = [];
  walk(directory);
  return output.sort();

  function walk(current) {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = resolve(current, entry.name);
      if (entry.isDirectory()) {
        walk(path);
      } else if (entry.isFile() && path.endsWith(suffix)) {
        output.push(path);
      }
    }
  }
}

function listExecutableArchitectureTests(directory) {
  return listFilesRecursive(directory, ".mjs")
    .filter((file) => readFileSync(file, "utf8").includes("node:test"));
}

async function runShards(allShards, concurrency) {
  const queue = [...allShards];
  const results = [];
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length > 0) {
      const shard = queue.shift();
      results.push(await runShard(shard));
    }
  });
  await Promise.all(workers);
  return results.sort((left, right) => left.shard.id.localeCompare(right.shard.id));
}

function runShard(shard) {
  return new Promise((resolveResult) => {
    const startedAt = Date.now();
    const logPath = resolve(logRoot, `${safeName(shard.id)}.log`);
    const child = spawn(shard.command, shard.args, {
      cwd: shard.cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const chunks = [];
    child.stdout.on("data", (chunk) => chunks.push(chunk));
    child.stderr.on("data", (chunk) => chunks.push(chunk));
    child.on("close", (status) => {
      const durationMs = Date.now() - startedAt;
      const logText = Buffer.concat(chunks).toString("utf8");
      writeFileSync(logPath, logText);
      const normalizedStatus = status ?? 1;
      console.log(`${normalizedStatus === 0 ? "PASS" : "FAIL"} ${shard.id} ${durationMs}ms`);
      resolveResult({ shard, status: normalizedStatus, durationMs, logPath, testCounts: parseTestCounts(logText) });
    });
  });
}

function groupFailures(failures) {
  const groups = {};
  for (const failure of failures) {
    const group = failure.shard.group;
    groups[group] ??= [];
    groups[group].push({
      id: failure.shard.id,
      status: failure.status,
      durationMs: failure.durationMs,
      log: toPosix(relative(tsonicRoot, failure.logPath)),
    });
  }
  return groups;
}

function validatePreparedManifest(value) {
  const failures = [];
  if (!isRecord(value)) {
    console.error("FAIL: prepared manifest is not an object.");
    process.exit(2);
  }
  if (value.status !== "passed") {
    failures.push(`manifest status is '${String(value.status)}', expected 'passed'`);
  }
  if (!isRecord(value.artifacts)) {
    failures.push("manifest artifacts must be an object");
  } else {
    for (const [key, artifact] of Object.entries(value.artifacts)) {
      if (!isRecord(artifact)) {
        failures.push(`${key}: artifact entry is not an object`);
        continue;
      }
      if (artifact.required === true && artifact.exists !== true) {
        failures.push(`${key}: required prepared artifact was missing at prepare time`);
        continue;
      }
      if (artifact.exists !== true) {
        continue;
      }
      if (typeof artifact.path !== "string") {
        failures.push(`${key}: artifact path must be a string`);
        continue;
      }
      const current = fingerprintPath(artifact.path);
      if (!sameFingerprint(artifact, current)) {
        failures.push(`${key}: prepared artifact fingerprint changed or is missing: ${artifact.path}`);
      }
    }
  }
  if (failures.length > 0) {
    console.error("FAIL: prepared manifest validation failed.");
    for (const failure of failures) {
      console.error(`  - ${failure}`);
    }
    process.exit(2);
  }
}

function sameFingerprint(left, right) {
  return left.exists === right.exists &&
    left.kind === right.kind &&
    left.bytes === right.bytes &&
    left.files === right.files &&
    left.sha256 === right.sha256;
}

function fingerprintPath(path) {
  if (!existsSync(path)) {
    return { path: toPosix(path), exists: false };
  }
  const stats = statSync(path);
  if (stats.isFile()) {
    return {
      path: toPosix(path),
      exists: true,
      kind: "file",
      bytes: stats.size,
      sha256: createHash("sha256").update(readFileSync(path)).digest("hex"),
    };
  }
  const hash = createHash("sha256");
  let files = 0;
  let bytes = 0;
  for (const filePath of walkFiles(path).sort()) {
    const relativePath = toPosix(relative(path, filePath));
    const fileStats = statSync(filePath);
    const content = readFileSync(filePath);
    files += 1;
    bytes += fileStats.size;
    hash.update(relativePath);
    hash.update("\0");
    hash.update(String(fileStats.size));
    hash.update("\0");
    hash.update(createHash("sha256").update(content).digest("hex"));
    hash.update("\n");
  }
  return {
    path: toPosix(path),
    exists: true,
    kind: "directory",
    files,
    bytes,
    sha256: hash.digest("hex"),
  };
}

function walkFiles(directory, output = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const filePath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      walkFiles(filePath, output);
    } else if (entry.isFile()) {
      output.push(filePath);
    }
  }
  return output;
}

function parseTestCounts(logText) {
  const nodeCounts = parseNodeTestCounts(logText);
  if (nodeCounts !== undefined) {
    return nodeCounts;
  }
  return parseDotnetTestCounts(logText);
}

function parseNodeTestCounts(logText) {
  const counts = {};
  for (const key of ["tests", "pass", "fail", "skipped"]) {
    const matches = [...logText.matchAll(new RegExp(`^# ${key} (\\d+)\\s*$`, "gmu"))];
    if (matches.length > 0) {
      counts[key] = Number(matches.at(-1)[1]);
    }
  }
  if (counts.tests === undefined && counts.pass === undefined && counts.fail === undefined) {
    return undefined;
  }
  return {
    total: counts.tests ?? 0,
    passed: counts.pass ?? 0,
    failed: counts.fail ?? 0,
    skipped: counts.skipped ?? 0,
    source: "node",
  };
}

function parseDotnetTestCounts(logText) {
  const match = [...logText.matchAll(/Failed:\s*(\d+),\s*Passed:\s*(\d+),\s*Skipped:\s*(\d+),\s*Total:\s*(\d+)/gu)].at(-1);
  if (match === undefined) {
    return undefined;
  }
  return {
    total: Number(match[4]),
    passed: Number(match[2]),
    failed: Number(match[1]),
    skipped: Number(match[3]),
    source: "dotnet",
  };
}

function aggregateTestCounts(results) {
  return results.reduce((counts, result) => {
    if (result.testCounts === undefined) {
      return counts;
    }
    return {
      reportedShards: counts.reportedShards + 1,
      total: counts.total + result.testCounts.total,
      passed: counts.passed + result.testCounts.passed,
      failed: counts.failed + result.testCounts.failed,
      skipped: counts.skipped + result.testCounts.skipped,
    };
  }, { reportedShards: 0, total: 0, passed: 0, failed: 0, skipped: 0 });
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseArgs(args) {
  const scopes = new Set();
  const matches = [];
  let list = false;
  let manifest;
  let concurrency = Math.max(1, Math.ceil((typeof availableParallelism === "function" ? availableParallelism() : cpus().length) * 0.75));
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--manifest") {
      manifest = args[++index];
    } else if (arg === "--concurrency") {
      concurrency = Number(args[++index]);
    } else if (arg === "--scope") {
      scopes.add(args[++index]);
    } else if (arg === "--match") {
      matches.push(args[++index]);
    } else if (arg === "--list") {
      list = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log("Usage: scripts/test/run-prepared.mjs [--manifest <path>] [--concurrency <n>] [--scope <name>] [--match <shard-substring>] [--list]");
      process.exit(0);
    } else {
      console.error(`FAIL: unknown argument: ${arg}`);
      process.exit(2);
    }
  }
  if (!Number.isInteger(concurrency) || concurrency <= 0) {
    concurrency = 1;
  }
  return { manifest, concurrency, scopes, matches, list };
}

function safeName(value) {
  return value.replaceAll(/[^A-Za-z0-9._-]+/g, "-");
}

function slug(value) {
  return value
    .slice(0, 80)
    .replaceAll(/[^A-Za-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "")
    .toLowerCase() || "test";
}

function escapeRegExp(value) {
  return value.replace(/[\\^$.*+?()[\]{}|]/gu, "\\$&");
}

function unescapeJsString(value) {
  return value
    .replaceAll(/\\"/g, "\"")
    .replaceAll(/\\'/g, "'")
    .replaceAll(/\\\\/g, "\\");
}

function timestamp() {
  const now = new Date();
  return [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    String(now.getUTCDate()).padStart(2, "0"),
    "-",
    String(now.getUTCHours()).padStart(2, "0"),
    String(now.getUTCMinutes()).padStart(2, "0"),
    String(now.getUTCSeconds()).padStart(2, "0"),
  ].join("");
}

function toPosix(path) {
  return path.split(sep).join("/");
}
