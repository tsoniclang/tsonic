#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { availableParallelism, cpus } from "node:os";
import { relative, resolve, sep } from "node:path";
import { createParallelSuiteDefinition } from "./suite-definition.mjs";

const tsonicRoot = resolve(new URL("../..", import.meta.url).pathname);
const options = parseArgs(process.argv.slice(2));
const runId = `parallel-${timestamp()}-${process.pid}`;
const runRoot = resolve(tsonicRoot, ".temp/test-runs/parallel-runs", runId);
const logRoot = resolve(runRoot, "logs");
mkdirSync(logRoot, { recursive: true });

const env = {
  ...process.env,
  TSONIC_TEST_RUN_ID: runId,
  NUGET_PACKAGES: process.env.NUGET_PACKAGES ?? resolve(tsonicRoot, ".temp/test-runs/nuget/packages"),
};

const repos = {
  tsonic: tsonicRoot,
  tsonicCsharp: resolve(tsonicRoot, "../tsonic-csharp"),
  csharpJs: resolve(tsonicRoot, "../csharp-js"),
  csharpNodejs: resolve(tsonicRoot, "../csharp-nodejs"),
};
const suiteDefinition = createParallelSuiteDefinition(repos);

const allShards = buildShards();
validateShardCoverage(allShards);

const shards = allShards.filter((shard) =>
  (options.scopes.size === 0 || options.scopes.has(shard.scope)) &&
  (options.matches.length === 0 || options.matches.some((match) => shard.id.includes(match)))
);
if (shards.length === 0) {
  console.error("FAIL: no parallel test shards selected.");
  process.exit(2);
}

if (options.list) {
  console.log(`parallel-run: shards=${shards.length}`);
  for (const shard of shards) {
    console.log(`${shard.group}\t${shard.scope}\t${shard.id}`);
  }
  process.exit(0);
}

const exclusiveShardCount = shards.filter((shard) => shard.exclusive === true).length;
console.log(`parallel-run: shards=${shards.length} concurrency=${options.concurrency} exclusive=${exclusiveShardCount}`);

const startedAt = Date.now();
const results = await runShards(shards, options.concurrency);
const durationMs = Date.now() - startedAt;
const failures = results.filter((result) => result.status !== 0);
const testCounts = aggregateTestCounts(results);
const missingTestCountResults = results.filter((result) => result.testCounts === undefined);
const report = {
  runId,
  createdAt: new Date().toISOString(),
  command: {
    cwd: toPosix(tsonicRoot),
    argv: process.argv.slice(1),
  },
  host: {
    platform: process.platform,
    arch: process.arch,
    cpus: typeof availableParallelism === "function" ? availableParallelism() : cpus().length,
  },
  repos: repoSnapshot(),
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

console.log(`parallel-run: shardsPassed=${report.shardCounts.passed} shardsFailed=${report.shardCounts.failed} durationMs=${durationMs}`);
if (testCounts.reportedShards > 0) {
  console.log(`parallel-run: reportedTests=${testCounts.total} passed=${testCounts.passed} failed=${testCounts.failed} skipped=${testCounts.skipped} reportingShards=${testCounts.reportedShards}`);
}
if (missingTestCountResults.length > 0) {
  console.log(`parallel-run: missingTestCountShards=${missingTestCountResults.length}`);
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
console.log(`parallel-run: report=${toPosix(relative(tsonicRoot, resolve(runRoot, "report.json")))}`);

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
    console.error("FAIL: parallel test shard coverage validation failed.");
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
      validateNoDisabledOrFocusedTests(file, relativeFile);
      if (!representedFiles.has(relativeFile)) {
        failures.push(`${testSuite.scope} test file has no parallel shard: ${relativeFile}`);
      }
    }
  }

  function validateDirectArchitectureCoverage(testSuite) {
    const repoKey = scopeToRepoKey(testSuite.scope);
    for (const file of listExecutableArchitectureTests(testSuite.directory)) {
      const relativeFile = toPosix(relative(repos[repoKey], file));
      validateNoDisabledOrFocusedTests(file, relativeFile);
      if (!representedFiles.has(relativeFile)) {
        failures.push(`${testSuite.scope} architecture test module has no parallel shard: ${relativeFile}`);
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
      failures.push(`${aggregateRelativeFile} must be import-only for direct parallel shard equivalence`);
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

  function validateNoDisabledOrFocusedTests(file, relativeFile) {
    const bannedTestModifiers = extractBannedTestModifiers(file);
    if (bannedTestModifiers.length > 0) {
      failures.push(`${relativeFile} contains disabled/focused tests: ${bannedTestModifiers.join(", ")}`);
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
  return [...text.matchAll(/(?:^|\n)\s*test(?:\.(?:todo|skip|only))?\(\s*/gu)].length;
}

function extractBannedTestModifiers(file) {
  const text = readFileSync(file, "utf8");
  const modifiers = [];
  const pattern = /(?:^|\n)\s*test\.(?<modifier>todo|skip|only)\(\s*(["'])(?<title>(?:\\.|(?!\2).)+)\2/gu;
  for (const match of text.matchAll(pattern)) {
    modifiers.push(`${match.groups.modifier}:${unescapeJsString(match.groups.title)}`);
  }
  return modifiers;
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
  const parallelShards = allShards.filter((shard) => shard.exclusive !== true);
  const exclusiveShards = allShards.filter((shard) => shard.exclusive === true);
  const results = await runShardQueue(parallelShards, concurrency);
  for (const shard of exclusiveShards) {
    results.push(await runShard(shard));
  }
  return results.sort((left, right) => left.shard.id.localeCompare(right.shard.id));
}

async function runShardQueue(allShards, concurrency) {
  const queue = [...allShards];
  const results = [];
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length > 0) {
      const shard = queue.shift();
      results.push(await runShard(shard));
    }
  });
  await Promise.all(workers);
  return results;
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

function repoSnapshot() {
  return Object.fromEntries(Object.entries(repos).map(([name, repoPath]) => [
    name,
    {
      path: toPosix(repoPath),
      head: commandOutput(repoPath, "git", ["rev-parse", "HEAD"]),
      branch: commandOutput(repoPath, "git", ["branch", "--show-current"]),
      dirty: (commandOutput(repoPath, "git", ["status", "--porcelain"]) ?? "").length > 0,
    },
  ]));
}

function commandOutput(cwd, command, args) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    return undefined;
  }
  return result.stdout.trim();
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

function parseArgs(args) {
  const scopes = new Set();
  const matches = [];
  let list = false;
  let concurrency = Math.max(1, Math.ceil((typeof availableParallelism === "function" ? availableParallelism() : cpus().length) * 0.75));
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--concurrency") {
      concurrency = Number(args[++index]);
    } else if (arg === "--scope") {
      scopes.add(args[++index]);
    } else if (arg === "--match") {
      matches.push(args[++index]);
    } else if (arg === "--list") {
      list = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log("Usage: scripts/test/run-parallel.mjs [--concurrency <n>] [--scope <name>] [--match <shard-substring>] [--list]");
      process.exit(0);
    } else {
      console.error(`FAIL: unknown argument: ${arg}`);
      process.exit(2);
    }
  }
  if (!Number.isInteger(concurrency) || concurrency <= 0) {
    concurrency = 1;
  }
  return { concurrency, scopes, matches, list };
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
