import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const repoRoot = process.cwd();
const cliPath = resolve(repoRoot, "packages/cli/dist/src/index.js");
const tempRoot = resolve(repoRoot, ".temp/test-runs/cli-build", `${Date.now()}-${process.pid}`);

async function writeProject(projectDirectory, files) {
  const projectFiles = withDefaultPackage(projectDirectory, files);
  for (const [relativePath, text] of Object.entries(projectFiles)) {
    const outputPath = resolve(projectDirectory, relativePath);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, text, "utf8");
  }
  await linkInstalledTsonicPackages(projectDirectory, projectFiles);
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

function dotnetOutputAssemblyPath(projectDirectory, assemblyName) {
  if (existsSync(resolve(projectDirectory, `${assemblyName}.csproj`))) {
    return resolve(projectDirectory, "bin/Debug/net10.0", `${assemblyName}.dll`);
  }
  return resolve(projectDirectory, "out/csharp/bin/Debug/net10.0", `${assemblyName}.dll`);
}

function assertInstalledAssemblyReference(projectText, assemblyName) {
  assert.match(projectText, new RegExp(`<Reference Include="${escapeRegExp(assemblyName)}" HintPath="[^"]*/runtimes/net10\\.0/${escapeRegExp(assemblyName)}\\.dll" />`));
}

function assertNoInstalledAssemblyReference(projectText, assemblyName) {
  assert.doesNotMatch(projectText, new RegExp(`<Reference Include="${escapeRegExp(assemblyName)}"`));
}

function assertNoRuntimeProjectReference(projectText, assemblyName) {
  assert.doesNotMatch(projectText, new RegExp(`${escapeRegExp(assemblyName)}\\.csproj`));
}

function run(command, args) {
  return runInDirectory(repoRoot, command, args);
}

function runInDirectory(cwd, command, args) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
  });
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

function withDefaultPackage(projectDirectory, files) {
  if (files["package.json"] !== undefined || files["tsonic.json"] === undefined) {
    return files;
  }
  return {
    "package.json": JSON.stringify({
      name: `tsonic-test-${projectDirectory.split("/").at(-1)}`,
      type: "module",
      private: true,
      dependencies: {
        "@tsonic/target-csharp": "file:../../../../tsonic-csharp",
      },
    }, null, 2),
    ...files,
  };
}

async function linkInstalledTsonicPackages(projectDirectory, files) {
  if (files["package.json"] === undefined) {
    return;
  }
  const packageJson = JSON.parse(files["package.json"]);
  const dependencies = {
    ...(packageJson.dependencies ?? {}),
    ...(packageJson.devDependencies ?? {}),
    ...(packageJson.optionalDependencies ?? {}),
  };
  for (const packageName of Object.keys(dependencies)) {
    const repositoryPath = installedPackageRepositoryPath(packageName);
    if (repositoryPath === undefined) {
      continue;
    }
    const linkPath = resolve(projectDirectory, "node_modules", ...packageName.split("/"));
    await mkdir(dirname(linkPath), { recursive: true });
    await symlink(repositoryPath, linkPath, "dir").catch((error) => {
      if (error?.code !== "EEXIST") {
        throw error;
      }
    });
  }
}

function installedPackageRepositoryPath(packageName) {
  if (packageName === "@tsonic/target-csharp") {
    return resolve(repoRoot, "../tsonic-csharp");
  }
  if (packageName === "@tsonic/csharp-nodejs") {
    return resolve(repoRoot, "../csharp-nodejs");
  }
  return undefined;
}

function escapeRegExp(value) {
  return value.replace(/[\\^$.*+?()[\]{}|]/gu, "\\$&");
}

export {
  assert,
  assertInstalledAssemblyReference,
  assertNoInstalledAssemblyReference,
  assertNoRuntimeProjectReference,
  csharpProjectPath,
  dotnetOutputAssemblyPath,
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
