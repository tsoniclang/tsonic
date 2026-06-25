import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const repoRoot = process.cwd();
const cliPath = resolve(repoRoot, "packages/cli/dist/src/index.js");
const tempRoot = resolve(repoRoot, ".temp/test-runs/cli-build", `${Date.now()}-${process.pid}`);

async function writeProject(projectDirectory, files) {
  for (const [relativePath, text] of Object.entries(files)) {
    const outputPath = resolve(projectDirectory, relativePath);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, text, "utf8");
  }
}

function runNode(args) {
  return run(process.execPath, args);
}

function runNodeInDirectory(cwd, args) {
  return runInDirectory(cwd, process.execPath, args);
}

function csharpProjectPath(projectDirectory, assemblyName) {
  return resolve(projectDirectory, `out/csharp/${assemblyName}.csproj`);
}

function runGeneratedProject(projectDirectory, assemblyName) {
  const build = run("dotnet", ["build", csharpProjectPath(projectDirectory, assemblyName), "--nologo", "--v:minimal"]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const executed = run("dotnet", ["run", "--project", csharpProjectPath(projectDirectory, assemblyName), "--no-build", "--no-restore"]);
  assert.equal(executed.status, 0, executed.stdout + executed.stderr);
  return executed.stdout.replace(/\r\n/g, "\n");
}

function run(command, args) {
  return runInDirectory(repoRoot, command, args);
}

function runInDirectory(cwd, command, args) {
  const normalizedArgs = command === "dotnet"
    ? dotnetArgsWithIsolatedArtifacts(cwd, args)
    : args;
  const result = spawnSync(command, normalizedArgs, {
    cwd,
    encoding: "utf8",
  });
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

function dotnetArgsWithIsolatedArtifacts(cwd, args) {
  if (args.some((arg) => arg.startsWith("/p:OutputPath=") || arg.startsWith("-p:OutputPath="))) {
    return args;
  }
  const projectPath = dotnetProjectPath(cwd, args);
  if (projectPath === undefined) {
    return args;
  }
  const artifactsPath = resolve(dirname(projectPath), ".dotnet-test-artifacts");
  const delimiterIndex = args.indexOf("--");
  const propertyArg = `/p:OutputPath=${resolve(artifactsPath, "bin")}/`;
  return delimiterIndex === -1
    ? [...args, propertyArg]
    : [
        ...args.slice(0, delimiterIndex),
        propertyArg,
        ...args.slice(delimiterIndex),
      ];
}

function dotnetProjectPath(cwd, args) {
  if (args[0] === "run") {
    const projectFlagIndex = args.findIndex((arg) => arg === "--project");
    const projectPath = projectFlagIndex === -1 ? undefined : args[projectFlagIndex + 1];
    return projectPath === undefined ? undefined : resolve(cwd, projectPath);
  }
  const projectPath = args.find((arg, index) =>
    index > 0 &&
    !arg.startsWith("-") &&
    !arg.startsWith("/p:") &&
    !arg.startsWith("/property:") &&
    (arg.endsWith(".csproj") || arg.endsWith(".sln"))
  );
  return projectPath === undefined ? undefined : resolve(cwd, projectPath);
}

export {
  assert,
  csharpProjectPath,
  cliPath,
  existsSync,
  readFile,
  repoRoot,
  resolve,
  run,
  runNodeInDirectory,
  runGeneratedProject,
  runNode,
  tempRoot,
  test,
  writeProject,
};
