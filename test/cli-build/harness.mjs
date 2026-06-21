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
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
  });
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
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
  runGeneratedProject,
  runNode,
  tempRoot,
  test,
  writeProject,
};
