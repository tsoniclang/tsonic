#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { availableParallelism, cpus } from "node:os";
import { relative, resolve, sep } from "node:path";
import { createParallelSuiteDefinition } from "./suite-definition.mjs";

const tsonicRoot = resolve(new URL("../..", import.meta.url).pathname);
const options = parseArgs(process.argv.slice(2));
const runId = `parallel-${timestamp()}-${process.pid}`;
const runRoot = resolve(tsonicRoot, ".temp/test-runs/parallel-runs", runId);
const logRoot = resolve(runRoot, "logs");
const statusRoot = resolve(runRoot, "status");
mkdirSync(logRoot, { recursive: true });
mkdirSync(statusRoot, { recursive: true });

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
  csharpRuntime: resolve(tsonicRoot, "../csharp-runtime"),
};
const suiteDefinition = createParallelSuiteDefinition(repos);

const allShards = buildShards();
validateShardCoverage(allShards);
const inventory = createInventory(allShards);

const shards = allShards.filter((shard) =>
  (options.scopes.size === 0 || options.scopes.has(shard.scope)) &&
  (options.matches.length === 0 || options.matches.some((match) => shard.id.includes(match)))
);
if (shards.length === 0) {
  console.error("FAIL: no parallel test tasks selected.");
  process.exit(2);
}

if (options.list) {
  console.log(`parallel-run: tasks=${shards.length}`);
  for (const shard of shards) {
    console.log(`${shard.group}\t${shard.scope}\t${shard.exclusive === true ? "exclusive" : "parallel"}\t${shard.id}`);
  }
  process.exit(0);
}
if (options.inventory) {
  console.log(JSON.stringify(inventory, null, 2));
  process.exit(0);
}

const exclusiveShardCount = shards.filter((shard) => shard.exclusive === true).length;
console.log(`parallel-run: tasks=${shards.length} concurrency=${options.concurrency} exclusive=${exclusiveShardCount}`);

const startedAt = Date.now();
const preRunResults = options.withPreruns ? runPreRuns(requiredPreRuns(shards)) : [];
const progress = createProgressTracker(shards, options.progressIntervalMs);
progress.start();
let results;
try {
  results = await runShards(shards, options.concurrency);
} finally {
  progress.stop();
}
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
  inventory,
  progress: progress.summary(),
  preRuns: preRunResults,
  durationMs,
  taskCounts: {
    total: results.length,
    passed: results.length - failures.length,
    failed: failures.length,
  },
  testCounts,
  testCountReporting: {
    required: results.length,
    reported: testCounts.reportedShards,
    missing: missingTestCountResults.length,
    missingTasks: missingTestCountResults.map((result) => ({
      id: result.shard.id,
      group: result.shard.group,
      scope: result.shard.scope,
      log: toPosix(relative(tsonicRoot, result.logPath)),
    })),
  },
  failuresByGroup: groupFailures(failures),
  slowestTasks: [...results]
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

console.log(`parallel-run: tasksPassed=${report.taskCounts.passed} tasksFailed=${report.taskCounts.failed} durationMs=${durationMs}`);
if (testCounts.reportedShards > 0) {
  console.log(`parallel-run: reportedTests=${testCounts.total} passed=${testCounts.passed} failed=${testCounts.failed} skipped=${testCounts.skipped} reportingTasks=${testCounts.reportedShards}`);
}
if (missingTestCountResults.length > 0) {
  console.log(`parallel-run: missingTestCountTasks=${missingTestCountResults.length}`);
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
console.log("slowest-tasks:");
for (const shard of report.slowestTasks) {
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
    ...suiteDefinition.dotnetSuites.flatMap((testSuite) =>
      dotnetTestShards(testSuite)
    ),
  ];
}

function validateShardCoverage(shardsToValidate) {
  const representedFileCounts = new Map();
  for (const shard of shardsToValidate) {
    for (const file of shard.files ?? (shard.file === undefined ? [] : [shard.file])) {
      const key = inventoryFileKey(shard.scope, file);
      representedFileCounts.set(key, (representedFileCounts.get(key) ?? 0) + 1);
    }
  }
  const representedFiles = new Set(representedFileCounts.keys());
  const failures = [];
  for (const [file, count] of representedFileCounts.entries()) {
    if (count !== 1) {
      failures.push(`test file is represented by ${count} parallel tasks: ${file}`);
    }
  }
  for (const testSuite of suiteDefinition.nodeSuites) {
    validateNodeSuiteCoverage(testSuite);
  }
  for (const testSuite of suiteDefinition.architectureSuites) {
    validateDirectArchitectureCoverage(testSuite);
  }
  for (const contract of suiteDefinition.aggregateImportContracts) {
    validateAggregateImportContract(contract);
  }
  for (const testSuite of suiteDefinition.dotnetSuites) {
    validateDotnetSuite(testSuite);
  }

  if (failures.length > 0) {
    console.error("FAIL: parallel test task coverage validation failed.");
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
      if (!representedFiles.has(`${testSuite.scope}:${relativeFile}`)) {
        failures.push(`${testSuite.scope} test file has no parallel task: ${relativeFile}`);
      }
    }
  }

  function validateDirectArchitectureCoverage(testSuite) {
    const repoKey = scopeToRepoKey(testSuite.scope);
    for (const file of listExecutableArchitectureTests(testSuite.directory)) {
      const relativeFile = toPosix(relative(repos[repoKey], file));
      validateNoDisabledOrFocusedTests(file, relativeFile);
      if (!representedFiles.has(`${testSuite.scope}:${relativeFile}`)) {
        failures.push(`${testSuite.scope} architecture test module has no parallel task: ${relativeFile}`);
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
      failures.push(`${aggregateRelativeFile} must be import-only for direct parallel task equivalence`);
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

  function validateDotnetSuite(testSuite) {
    if (!existsSync(testSuite.projectOrSolution)) {
      failures.push(`${testSuite.scope} dotnet project/solution does not exist: ${toPosix(testSuite.projectOrSolution)}`);
      return;
    }
    const files = listDotnetTestFiles(testSuite.directory);
    const exclusiveGroups = testSuite.exclusiveGroups ?? [];
    if (exclusiveGroups.length > 0 && testSuite.taskMode !== "directory") {
      failures.push(`${testSuite.scope} dotnet exclusive groups require directory task mode`);
    }
    const availableGroups = new Set(groupFilesByDirectory(testSuite.directory, files).keys());
    const seenExclusiveGroups = new Set();
    for (const group of exclusiveGroups) {
      if (typeof group !== "string" || group.length === 0) {
        failures.push(`${testSuite.scope} dotnet exclusive group must be a non-empty string`);
      } else if (!availableGroups.has(group)) {
        failures.push(`${testSuite.scope} dotnet exclusive group has no test task: ${group}`);
      } else if (seenExclusiveGroups.has(group)) {
        failures.push(`${testSuite.scope} dotnet exclusive group is duplicated: ${group}`);
      }
      seenExclusiveGroups.add(group);
    }
    for (const file of files) {
      const relativeFile = toPosix(relative(testSuite.cwd, file));
      if (extractDotnetTestClasses(file).length === 0) {
        failures.push(`${testSuite.scope} dotnet test file has no test class task: ${relativeFile}`);
      }
      if (!representedFiles.has(`${testSuite.scope}:${relativeFile}`)) {
        failures.push(`${testSuite.scope} dotnet test file has no parallel task: ${relativeFile}`);
      }
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
  return [nodeTestShard(scope, group, file)];
}

function nodeTestShard(scope, group, file) {
  return {
    id: `${scope}:${toPosix(relative(repos[scopeToRepoKey(scope)], file))}`,
    scope,
    group,
    file,
    files: [file],
    preRunIds: preRunsForTask(scope, group),
    cwd: repos[scopeToRepoKey(scope)],
    command: process.execPath,
    args: ["--test", "--test-reporter=tap", toPosix(relative(repos[scopeToRepoKey(scope)], file))],
  };
}

function dotnetTestShards(testSuite) {
  const files = listDotnetTestFiles(testSuite.directory);
  if (testSuite.taskMode === "assembly") {
    return [dotnetTestShard(testSuite, "assembly", files, undefined)];
  }
  if (testSuite.taskMode === "directory") {
    return [...groupFilesByDirectory(testSuite.directory, files).entries()]
      .map(([directory, directoryFiles]) => {
        const classNames = directoryFiles.flatMap((file) => extractDotnetTestClasses(file));
        return dotnetTestShard(testSuite, directory, directoryFiles, classNames);
      });
  }
  throw new Error(`Unknown dotnet test task mode: ${testSuite.taskMode}`);
}

function dotnetTestShard(testSuite, groupName, files, classNames) {
  const relativeGroup = groupName === "assembly" ? "assembly" : toPosix(groupName);
  return {
    id: `${testSuite.scope}:dotnet:${relativeGroup}`,
    scope: testSuite.scope,
    group: testSuite.group,
    exclusive: testSuite.exclusiveGroups?.includes(relativeGroup) === true,
    files,
    preRunIds: preRunsForTask(testSuite.scope, testSuite.group),
    cwd: testSuite.cwd,
    command: "dotnet",
    args: dotnetTestArgs(testSuite.projectOrSolution, classNames),
  };
}

function preRunsForTask(scope, group) {
  switch (scope) {
    case "tsonic":
      return [
        "tsonic.build",
        "tsonic-csharp.build",
        "csharp-runtime.build",
        "csharp-js.build",
        "csharp-nodejs.install",
        "csharp-nodejs.build",
        "csharp-nodejs.test-build",
      ];
    case "tsonic-csharp":
      return group === "csharp-provider"
        ? ["tsonic.build", "tsonic-csharp.build", "tsonic-csharp.provider-fixtures"]
        : ["tsonic.build", "tsonic-csharp.build"];
    case "csharp-js":
      return ["csharp-runtime.build", "csharp-js.build"];
    case "csharp-runtime":
      return ["csharp-runtime.build"];
    case "csharp-nodejs":
      return [
        "tsonic.build",
        "tsonic-csharp.build",
        "csharp-runtime.build",
        "csharp-js.build",
        "csharp-nodejs.install",
        "csharp-nodejs.build",
        "csharp-nodejs.test-build",
      ];
    default:
      throw new Error(`Unknown pre-run scope: ${scope}`);
  }
}

function dotnetTestArgs(projectOrSolution, classNames) {
  const args = [
    "test",
    projectOrSolution,
    "--no-build",
    "--no-restore",
    "--verbosity",
    "minimal",
  ];
  if (classNames !== undefined && classNames.length > 0) {
    args.push("--filter", classNames.map((className) => `FullyQualifiedName~${className}`).join("|"));
  }
  return args;
}

function groupFilesByDirectory(rootDirectory, files) {
  const groups = new Map();
  for (const file of files) {
    const relativeFile = toPosix(relative(rootDirectory, file));
    const slash = relativeFile.lastIndexOf("/");
    const group = slash === -1 ? "." : relativeFile.slice(0, slash);
    const groupFiles = groups.get(group) ?? [];
    groupFiles.push(file);
    groups.set(group, groupFiles);
  }
  return new Map([...groups.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

function listDotnetTestFiles(directory) {
  return listFilesRecursive(directory, ".cs")
    .filter((file) => {
      const text = readFileSync(file, "utf8");
      return /\[(?:Fact|Theory|Test)\]/u.test(text);
    });
}

function extractDotnetTestClasses(file) {
  const text = readFileSync(file, "utf8");
  const namespaceName =
    text.match(/^\s*namespace\s+(?<name>[A-Za-z_][A-Za-z0-9_.]*)\s*;/mu)?.groups.name ??
    text.match(/^\s*namespace\s+(?<name>[A-Za-z_][A-Za-z0-9_.]*)\s*\{/mu)?.groups.name;
  const classes = [];
  const classPattern = /\b(?:public\s+|internal\s+)?(?:sealed\s+|abstract\s+|partial\s+)*class\s+(?<name>[A-Za-z_][A-Za-z0-9_]*)\b/gu;
  for (const match of text.matchAll(classPattern)) {
    classes.push(namespaceName === undefined ? match.groups.name : `${namespaceName}.${match.groups.name}`);
  }
  return classes;
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
    case "csharp-js":
      return "csharpJs";
    case "csharp-nodejs":
      return "csharpNodejs";
    case "csharp-runtime":
      return "csharpRuntime";
    default:
      throw new Error(`Unknown scope: ${scope}`);
  }
}

function repoForFile(file) {
  const normalized = toPosix(file);
  const matches = Object.entries(repos)
    .filter(([_key, repoPath]) => normalized === toPosix(repoPath) || normalized.startsWith(`${toPosix(repoPath)}/`))
    .sort((left, right) => right[1].length - left[1].length);
  return matches[0]?.[1] ?? tsonicRoot;
}

function inventoryFileKey(scope, file) {
  return `${scope}:${toPosix(relative(repoForFile(file), file))}`;
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

function createInventory(shardsToInventory) {
  const files = new Map();
  for (const shard of shardsToInventory) {
    for (const file of shard.files ?? (shard.file === undefined ? [] : [shard.file])) {
      const repoPath = repoForFile(file);
      const relativeFile = toPosix(relative(repoPath, file));
      const existing = files.get(`${shard.scope}:${relativeFile}`);
      const entry = {
        scope: shard.scope,
        group: shard.group,
        exclusive: shard.exclusive === true,
        path: relativeFile,
        taskId: shard.id,
        preRunIds: shard.preRunIds ?? [],
        runner: shard.command === "dotnet" ? "dotnet" : "node",
      };
      if (existing !== undefined) {
        existing.tasks.push(entry);
      } else {
        files.set(`${shard.scope}:${relativeFile}`, { ...entry, tasks: [entry] });
      }
    }
  }
  const entries = [...files.values()]
    .map((entry) => ({
      scope: entry.scope,
      group: entry.group,
      exclusive: entry.exclusive,
      path: entry.path,
      runner: entry.runner,
      taskIds: entry.tasks.map((task) => task.taskId).sort(),
      preRunIds: [...new Set(entry.tasks.flatMap((task) => task.preRunIds))].sort(),
    }))
    .sort((left, right) => `${left.scope}:${left.path}`.localeCompare(`${right.scope}:${right.path}`));
  const filesByScope = {};
  const filesByGroup = {};
  for (const entry of entries) {
    filesByScope[entry.scope] = (filesByScope[entry.scope] ?? 0) + 1;
    filesByGroup[entry.group] = (filesByGroup[entry.group] ?? 0) + 1;
  }
  return {
    fileCount: entries.length,
    taskCount: shardsToInventory.length,
    preRuns: suiteDefinition.preRuns.map((preRun) => ({
      id: preRun.id,
      dependsOn: preRun.dependsOn ?? [],
      cwd: toPosix(preRun.cwd),
      command: preRun.command,
      args: preRun.args,
    })),
    filesByScope,
    filesByGroup,
    files: entries,
  };
}

function requiredPreRuns(shardsToRun) {
  const byId = new Map(suiteDefinition.preRuns.map((preRun) => [preRun.id, preRun]));
  const required = new Set();
  for (const shard of shardsToRun) {
    for (const id of shard.preRunIds ?? []) {
      addWithDependencies(id);
    }
  }
  return suiteDefinition.preRuns.filter((preRun) => required.has(preRun.id));

  function addWithDependencies(id) {
    if (required.has(id)) {
      return;
    }
    const preRun = byId.get(id);
    if (preRun === undefined) {
      throw new Error(`Unknown pre-run id: ${id}`);
    }
    for (const dependency of preRun.dependsOn ?? []) {
      addWithDependencies(dependency);
    }
    required.add(id);
  }
}

function runPreRuns(preRuns) {
  const results = [];
  for (const preRun of preRuns) {
    const startedAt = Date.now();
    const logPath = resolve(logRoot, `${safeName(`prerun:${preRun.id}`)}.log`);
    console.log(`PRERUN ${preRun.id}`);
    const result = spawnSync(preRun.command, preRun.args, {
      cwd: preRun.cwd,
      env: { ...env, ...(preRun.env ?? {}) },
      encoding: "utf8",
    });
    writeFileSync(logPath, `${result.stdout ?? ""}${result.stderr ?? ""}`);
    const durationMs = Date.now() - startedAt;
    const status = result.status ?? 1;
    const entry = {
      id: preRun.id,
      status,
      durationMs,
      command: preRun.command,
      args: preRun.args,
      cwd: toPosix(preRun.cwd),
      log: toPosix(relative(tsonicRoot, logPath)),
    };
    results.push(entry);
    console.log(`${status === 0 ? "PRERUN PASS" : "PRERUN FAIL"} ${preRun.id} ${durationMs}ms log=${entry.log}`);
    if (status !== 0) {
      writeFileSync(resolve(runRoot, "report.json"), `${JSON.stringify({
        runId,
        createdAt: new Date().toISOString(),
        command: {
          cwd: toPosix(tsonicRoot),
          argv: process.argv.slice(1),
        },
        repos: repoSnapshot(),
        preRuns: results,
        taskCounts: {
          total: shards.length,
          passed: 0,
          failed: shards.length,
        },
      }, null, 2)}\n`);
      process.exit(status);
    }
  }
  return results;
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
  const results = [];
  for (const group of orderedGroups(allShards)) {
    const groupShards = allShards.filter((shard) => shard.group === group);
    const parallelShards = groupShards.filter((shard) => shard.exclusive !== true);
    const exclusiveShards = groupShards.filter((shard) => shard.exclusive === true);
    console.log(`parallel-group: start group=${group} tasks=${groupShards.length} parallel=${parallelShards.length} exclusive=${exclusiveShards.length}`);
    results.push(...await runShardQueue(parallelShards, concurrency));
    for (const shard of exclusiveShards) {
      results.push(await runShard(shard));
    }
    const failed = results.filter((result) => result.shard.group === group && result.status !== 0).length;
    console.log(`parallel-group: done group=${group} failed=${failed}`);
  }
  return results.sort((left, right) => left.shard.id.localeCompare(right.shard.id));
}

function orderedGroups(allShards) {
  const groups = new Set(allShards.map((shard) => shard.group));
  const ordered = [];
  for (const group of suiteDefinition.groupOrder ?? []) {
    if (groups.delete(group)) {
      ordered.push(group);
    }
  }
  return [...ordered, ...[...groups].sort()];
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
    const shardSafeName = safeName(shard.id);
    const logPath = resolve(logRoot, `${shardSafeName}.log`);
    const statusPath = resolve(statusRoot, `${shardSafeName}.json`);
    const logStream = createWriteStream(logPath, { flags: "w" });
    writeShardStatus(statusPath, {
      id: shard.id,
      group: shard.group,
      scope: shard.scope,
      status: "running",
      startedAt: new Date(startedAt).toISOString(),
      command: shard.command,
      args: shard.args,
      cwd: toPosix(shard.cwd),
      log: toPosix(relative(tsonicRoot, logPath)),
    });
    progress.startShard(shard, startedAt);
    const child = spawn(shard.command, shard.args, {
      cwd: shard.cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const chunks = [];
    child.stdout.on("data", (chunk) => {
      chunks.push(chunk);
      logStream.write(chunk);
    });
    child.stderr.on("data", (chunk) => {
      chunks.push(chunk);
      logStream.write(chunk);
    });
    child.on("close", (status) => {
      const durationMs = Date.now() - startedAt;
      const logText = Buffer.concat(chunks).toString("utf8");
      const normalizedStatus = status ?? 1;
      writeShardStatus(statusPath, {
        id: shard.id,
        group: shard.group,
        scope: shard.scope,
        status: normalizedStatus === 0 ? "passed" : "failed",
        exitStatus: normalizedStatus,
        startedAt: new Date(startedAt).toISOString(),
        endedAt: new Date().toISOString(),
        durationMs,
        command: shard.command,
        args: shard.args,
        cwd: toPosix(shard.cwd),
        log: toPosix(relative(tsonicRoot, logPath)),
        testCounts: parseTestCounts(logText),
      });
      console.log(`${normalizedStatus === 0 ? "PASS" : "FAIL"} ${shard.id} ${durationMs}ms`);
      progress.finishShard(shard, normalizedStatus, durationMs);
      logStream.end(() => {
        resolveResult({ shard, status: normalizedStatus, durationMs, logPath, statusPath, testCounts: parseTestCounts(logText) });
      });
    });
  });
}

function writeShardStatus(statusPath, status) {
  writeFileSync(statusPath, `${JSON.stringify(status, null, 2)}\n`);
}

function createProgressTracker(allShards, progressIntervalMs) {
  const running = new Map();
  const samples = [];
  const cpuSampler = createCpuSampler();
  const state = {
    total: allShards.length,
    completed: 0,
    passed: 0,
    failed: 0,
    startedAt: Date.now(),
  };
  let interval;
  return {
    start() {
      emitProgress("start");
      if (progressIntervalMs > 0) {
        interval = setInterval(() => emitProgress("interval"), progressIntervalMs);
      }
    },
    stop() {
      if (interval !== undefined) {
        clearInterval(interval);
      }
      emitProgress("final");
    },
    startShard(shard, startedAt) {
      running.set(shard.id, {
        id: shard.id,
        group: shard.group,
        scope: shard.scope,
        startedAt,
      });
      console.log(`START ${shard.id}`);
    },
    finishShard(shard, status) {
      running.delete(shard.id);
      state.completed += 1;
      if (status === 0) {
        state.passed += 1;
      } else {
        state.failed += 1;
      }
    },
    summary() {
      return {
        intervalMs: progressIntervalMs,
        samples,
      };
    },
  };

  function emitProgress(reason) {
    const now = Date.now();
    const cpu = cpuSampler.sample();
    const runningShards = [...running.values()]
      .map((entry) => ({
        id: entry.id,
        group: entry.group,
        scope: entry.scope,
        elapsedMs: now - entry.startedAt,
      }))
      .sort((left, right) => right.elapsedMs - left.elapsedMs);
    const sample = {
      reason,
      timestamp: new Date(now).toISOString(),
      elapsedMs: now - state.startedAt,
      total: state.total,
      completed: state.completed,
      passed: state.passed,
      failed: state.failed,
      running: runningShards.length,
      queued: Math.max(0, state.total - state.completed - runningShards.length),
      cpuAllCoresPercent: cpu?.allCoresPercent,
      longestRunning: runningShards.slice(0, 10),
    };
    samples.push(sample);
    const cpuText = sample.cpuAllCoresPercent === undefined ? "unknown" : `${sample.cpuAllCoresPercent.toFixed(1)}%`;
    console.log(
      `parallel-progress: reason=${reason} completed=${sample.completed}/${sample.total} ` +
        `passed=${sample.passed} failed=${sample.failed} running=${sample.running} queued=${sample.queued} ` +
        `cpu=${cpuText} elapsedMs=${sample.elapsedMs}`,
    );
    for (const shard of runningShards.slice(0, 5)) {
      console.log(`  running ${shard.elapsedMs}ms ${shard.id}`);
    }
  }
}

function createCpuSampler() {
  let previous = readCpuSnapshot();
  return {
    sample() {
      const current = readCpuSnapshot();
      if (previous === undefined || current === undefined) {
        previous = current;
        return undefined;
      }
      const totalDelta = current.total - previous.total;
      const idleDelta = current.idle - previous.idle;
      previous = current;
      if (totalDelta <= 0) {
        return undefined;
      }
      return {
        allCoresPercent: (1 - idleDelta / totalDelta) * 100,
      };
    },
  };
}

function readCpuSnapshot() {
  try {
    const cpuLine = readFileSync("/proc/stat", "utf8").split("\n")[0]?.trim();
    if (cpuLine === undefined || !cpuLine.startsWith("cpu ")) {
      return undefined;
    }
    const values = cpuLine.split(/\s+/u).slice(1).map((value) => Number(value));
    if (values.some((value) => !Number.isFinite(value))) {
      return undefined;
    }
    const idle = (values[3] ?? 0) + (values[4] ?? 0);
    const total = values.reduce((sum, value) => sum + value, 0);
    return { idle, total };
  } catch {
    return undefined;
  }
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
  let inventory = false;
  let withPreruns = false;
  let concurrency = Math.max(1, Math.ceil((typeof availableParallelism === "function" ? availableParallelism() : cpus().length) * 0.75));
  let progressIntervalMs = Number(process.env.TSONIC_TEST_PROGRESS_INTERVAL_MS ?? 180_000);
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--concurrency") {
      concurrency = Number(args[++index]);
    } else if (arg === "--progress-interval-ms") {
      progressIntervalMs = Number(args[++index]);
    } else if (arg === "--scope") {
      scopes.add(args[++index]);
    } else if (arg === "--match") {
      matches.push(args[++index]);
    } else if (arg === "--list") {
      list = true;
    } else if (arg === "--inventory") {
      inventory = true;
    } else if (arg === "--with-preruns") {
      withPreruns = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log("Usage: scripts/test/run-parallel.mjs [--concurrency <n>] [--progress-interval-ms <ms>] [--scope <name>] [--match <task-substring>] [--list] [--inventory] [--with-preruns]");
      process.exit(0);
    } else {
      console.error(`FAIL: unknown argument: ${arg}`);
      process.exit(2);
    }
  }
  if (!Number.isInteger(concurrency) || concurrency <= 0) {
    concurrency = 1;
  }
  if (!Number.isFinite(progressIntervalMs) || progressIntervalMs < 0) {
    progressIntervalMs = 180_000;
  }
  return { concurrency, progressIntervalMs, scopes, matches, list, inventory, withPreruns };
}

function safeName(value) {
  return value.replaceAll(/[^A-Za-z0-9._-]+/g, "-");
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
