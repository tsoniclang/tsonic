import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { discoverTestFiles } from "./node-test-files.mjs";
import { testPath, testTaskName } from "./workspace-layout.mjs";

export function createDotnetTestShards(testSuite, { statusRoot, tsonicRoot }) {
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

  function dotnetTestShard(testSuite, groupName, files, classNames) {
    const relativeGroup = groupName === "assembly" ? "assembly" : testPath(groupName);
    const id = `${testSuite.scope}:dotnet:${relativeGroup}`;
    const resultPath = resolve(statusRoot, `${testTaskName(id)}.trx`);
    return {
      id,
      scope: testSuite.scope,
      group: testSuite.group,
      exclusive: testSuite.exclusiveGroups?.includes(relativeGroup) === true,
      files,
      preRunIds: testSuite.preRunIds,
      cwd: testSuite.cwd,
      command: "dotnet",
      memoryMiB: testSuite.resources?.memoryMiB,
      heapMiB: testSuite.resources?.heapMiB,
      childJobs: testSuite.childJobs,
      resultPath,
      resultFormat: "dotnet",
      args: [...dotnetTestArgs(testSuite.projectOrSolution, classNames), "--logger", `trx;LogFileName=${resultPath}`],
    };
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

export function groupFilesByDirectory(rootDirectory, files) {
  const groups = new Map();
  for (const file of files) {
    const relativeFile = testPath(relative(rootDirectory, file));
    const slash = relativeFile.lastIndexOf("/");
    const group = slash === -1 ? "." : relativeFile.slice(0, slash);
    const groupFiles = groups.get(group) ?? [];
    groupFiles.push(file);
    groups.set(group, groupFiles);
  }
  return new Map([...groups.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

export function listDotnetTestFiles(directory) {
  return discoverTestFiles(directory, ".cs")
    .filter((file) => {
      const text = readFileSync(file, "utf8");
      return /\[(?:Fact|Theory|Test)\]/u.test(text);
    });
}

export function extractDotnetTestClasses(file) {
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
