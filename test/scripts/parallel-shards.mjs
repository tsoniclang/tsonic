import { readFileSync, existsSync } from "node:fs";
import { relative, resolve } from "node:path";
import { discoverTestFiles } from "./node-test-files.mjs";
import { testPath, testTaskName, testScopeRepositoryKeys } from "./workspace-layout.mjs";
import { createDotnetTestShards, extractDotnetTestClasses, groupFilesByDirectory, listDotnetTestFiles } from "./parallel-dotnet.mjs";

export function scopeToRepoKey(scope) {
  const key = testScopeRepositoryKeys[scope];
  if (key === undefined) throw new Error(`Unknown scope: ${scope}`);
  return key;
}

export function createParallelShardPlan(suiteDefinition, repos, { statusRoot, tsonicRoot }) {
  const shards = buildShards();
  validateShardCoverage(shards);
  return { shards, inventory: createInventory(shards) };

  function buildShards() {
    return [
      ...suiteDefinition.nodeSuites.flatMap((testSuite) =>
        (testSuite.recursive === false
          ? discoverTestFiles(testSuite.directory, testSuite.suffix, testSuite.maxDepth ?? 0)
          : discoverTestFiles(testSuite.directory, testSuite.suffix))
          .filter((file) => !isIntentionallySkipped(testSuite, file))
          .map((file) => {
            const metadata = testSuite.fileMetadata?.[testPath(relative(repos[scopeToRepoKey(testSuite.scope)], file))] ?? {};
            return nodeTestShard(testSuite.scope, metadata.group ?? testSuite.group, file,
              testSuite.compiledDirectory === undefined ? file : resolve(testSuite.compiledDirectory, relative(testSuite.directory, file).replace(/\.ts$/u, ".js")),
              { ...testSuite.resources, ...metadata, preRunIds: metadata.preRunIds ?? testSuite.preRunIds }, testSuite.nodeArguments);
          })
      ),
      ...suiteDefinition.architectureSuites.flatMap((testSuite) =>
        listExecutableArchitectureTests(testSuite.directory)
          .map((file) => nodeTestShard(testSuite.scope, testSuite.group, file, file,
            { ...testSuite.resources, preRunIds: testSuite.preRunIds }, testSuite.nodeArguments))
      ),
      ...suiteDefinition.dotnetSuites.flatMap((testSuite) =>
        createDotnetTestShards(testSuite, { statusRoot })
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
    const representedGroups = new Set(shardsToValidate.map((shard) => shard.group));
    for (const [group, limit] of Object.entries(
      suiteDefinition.groupWorkerLimits ?? {},
    )) {
      if (!representedGroups.has(group)) {
        failures.push(`parallel worker limit references unknown group: ${group}`);
      }
      if (!Number.isSafeInteger(limit) || limit <= 0) {
        failures.push(
          `parallel worker limit for '${group}' must be a positive safe integer`,
        );
      }
    }
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
    for (const testSuite of suiteDefinition.dotnetSuites) {
      validateDotnetSuite(testSuite);
    }
    for (const testRoot of suiteDefinition.testRoots ?? []) {
      const repoKey = scopeToRepoKey(testRoot.scope);
      for (const file of discoverTestFiles(testRoot.directory, ".test.mjs")) {
        const relativeFile = testPath(relative(repos[repoKey], file));
        if (!representedFiles.has(`${testRoot.scope}:${relativeFile}`)) {
          failures.push(`${testRoot.scope} test file has no owning suite root: ${relativeFile}`);
        }
      }
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
      for (const file of discoverTestFiles(testSuite.directory, testSuite.suffix)) {
        const relativeFile = testPath(relative(repos[repoKey], file));
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
        const relativeFile = testPath(relative(repos[repoKey], file));
        validateNoDisabledOrFocusedTests(file, relativeFile);
        if (!representedFiles.has(`${testSuite.scope}:${relativeFile}`)) {
          failures.push(`${testSuite.scope} architecture test module has no parallel task: ${relativeFile}`);
        }
      }
    }

    function validateDotnetSuite(testSuite) {
      if (!existsSync(testSuite.projectOrSolution)) {
        failures.push(`${testSuite.scope} dotnet project/solution does not exist: ${testPath(testSuite.projectOrSolution)}`);
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
        const relativeFile = testPath(relative(testSuite.cwd, file));
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

  function nodeTestShard(scope, group, file, executableFile = file, resources, nodeArguments = []) {
    const id = `${scope}:${testPath(relative(repos[scopeToRepoKey(scope)], file))}`;
    const resultPath = resolve(statusRoot, `${testTaskName(id)}.results.jsonl`);
    return {
      id,
      scope,
      group,
      file,
      files: [file],
      preRunIds: resources?.preRunIds ?? [],
      memoryMiB: resources?.memoryMiB,
      heapMiB: resources?.heapMiB,
      childJobs: resources?.childJobs,
      cwd: repos[scopeToRepoKey(scope)],
      command: process.execPath,
      resultPath,
      resultFormat: "node",
      args: [...nodeArguments, "--test", "--test-concurrency=1", "--test-reporter=tap", "--test-reporter-destination=stdout",
        `--test-reporter=${resolve(tsonicRoot, "test/scripts/test-result-reporter.mjs")}`,
        `--test-reporter-destination=${resultPath}`,
        testPath(relative(repos[scopeToRepoKey(scope)], executableFile))],
    };
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

  function repoForFile(file) {
    const normalized = testPath(file);
    const matches = Object.entries(repos)
      .filter(([_key, repoPath]) => normalized === testPath(repoPath) || normalized.startsWith(`${testPath(repoPath)}/`))
      .sort((left, right) => right[1].length - left[1].length);
    return matches[0]?.[1] ?? tsonicRoot;
  }

  function inventoryFileKey(scope, file) {
    return `${scope}:${testPath(relative(repoForFile(file), file))}`;
  }

  function isIntentionallySkipped(testSuite, file) {
    if (testSuite.intentionallySkipped === undefined) {
      return false;
    }
    const relativeFile = testPath(relative(repos[scopeToRepoKey(testSuite.scope)], file));
    return testSuite.intentionallySkipped.has(relativeFile);
  }

  function createInventory(shardsToInventory) {
    const files = new Map();
    for (const shard of shardsToInventory) {
      for (const file of shard.files ?? (shard.file === undefined ? [] : [shard.file])) {
        const repoPath = repoForFile(file);
        const relativeFile = testPath(relative(repoPath, file));
        const existing = files.get(`${shard.scope}:${relativeFile}`);
        const entry = {
          scope: shard.scope,
          group: shard.group,
          exclusive: shard.exclusive === true,
          path: relativeFile,
          taskId: shard.id,
          preRunIds: shard.preRunIds ?? [],
          runner: shard.command === "dotnet" ? "dotnet" : "node",
          memoryMiB: shard.memoryMiB,
          heapMiB: shard.heapMiB,
          childJobs: shard.childJobs,
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
        memoryMiB: entry.memoryMiB,
        heapMiB: entry.heapMiB,
        childJobs: entry.childJobs,
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
        cwd: testPath(preRun.cwd),
        command: preRun.command,
        args: preRun.args,
      })),
      filesByScope,
      filesByGroup,
      files: entries,
    };
  }

  function listExecutableArchitectureTests(directory) {
    return discoverTestFiles(directory, ".mjs")
      .filter((file) => readFileSync(file, "utf8").includes("node:test"));
  }

  function unescapeJsString(value) {
    return value
      .replaceAll(/\\"/g, "\"")
      .replaceAll(/\\'/g, "'")
      .replaceAll(/\\\\/g, "\\");
  }

}
