import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, symlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { testRepositoryRoots } from "../../scripts/workspace-layout.mjs";

const repoRoot = testRepositoryRoots.tsonic;
const cliPath = resolve(repoRoot, "packages/cli/dist/src/index.js");
const tempRoot = resolve(repoRoot, ".temp/test-runs/cli-build", `${Date.now()}-${process.pid}`);
const bannedGeneratedRuntimeSemantics = [
  /\bdynamic\b/u,
  /\bSystem\.Reflection\b/u,
  /\bGetProperty\b/u,
  /\bGetProperties\b/u,
  /\bGetMethod\b/u,
  /\bGetMethods\b/u,
  /\bMethodInfo\.Invoke\b/u,
  /\bMakeGenericMethod\b/u,
  /\bActivator\.CreateInstance\b/u,
  /\bAssembly\.Load\b/u,
];

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

async function runGeneratedCsharpRunner(projectDirectory, assemblyName, programLines) {
  const runnerDirectory = resolve(projectDirectory, "runner");
  const runnerProjectPath = resolve(runnerDirectory, "Runner.csproj");
  await writeProject(runnerDirectory, {
    "Runner.csproj": [
      "<Project Sdk=\"Microsoft.NET.Sdk\">",
      "  <PropertyGroup>",
      "    <OutputType>Exe</OutputType>",
      "    <TargetFramework>net10.0</TargetFramework>",
      "    <ImplicitUsings>disable</ImplicitUsings>",
      "    <Nullable>enable</Nullable>",
      "  </PropertyGroup>",
      "  <ItemGroup>",
      `    <ProjectReference Include=\"../out/csharp/${assemblyName}.csproj\" />`,
      "  </ItemGroup>",
      "</Project>",
      "",
    ].join("\n"),
    "Program.cs": programLines.join("\n"),
  });

  const build = run("dotnet", ["build", runnerProjectPath, "--nologo", "--v:minimal"]);
  assert.equal(build.status, 0, build.stdout + build.stderr);
  const executed = run("dotnet", ["run", "--project", runnerProjectPath, "--no-build", "--no-restore"]);
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
        "@tsonic/csharp-runtime": "file:../../../../csharp-runtime",
        "@tsonic/csharp-js": "file:../../../../csharp-js",
      },
    }, null, 2),
    ...files,
  };
}

function targetCsharpOnlyPackageJson(name) {
  return JSON.stringify({
    name: `tsonic-test-${name}`,
    type: "module",
    private: true,
    dependencies: {
      "@tsonic/target-csharp": "file:../../../../tsonic-csharp",
      "@tsonic/csharp-runtime": "file:../../../../csharp-runtime",
      "@tsonic/csharp-js": "file:../../../../csharp-js",
    },
  }, null, 2);
}

function targetCsharpNodejsPackageJson(projectDirectory) {
  const projectName = typeof projectDirectory === "string" && projectDirectory.includes("/")
    ? projectDirectory.split("/").at(-1)
    : projectDirectory;
  return JSON.stringify({
    name: `tsonic-test-${projectName}`,
    type: "module",
    private: true,
    dependencies: {
      "@tsonic/target-csharp": "file:../../../../tsonic-csharp",
      "@tsonic/csharp-runtime": "file:../../../../csharp-runtime",
      "@tsonic/csharp-js": "file:../../../../csharp-js",
      "@tsonic/csharp-nodejs": "file:../../../../csharp-nodejs",
    },
  }, null, 2);
}

async function assertGeneratedOutputHasNoReflectionSemantics(projectDirectory) {
  const files = await collectFiles(resolve(projectDirectory, "out/csharp"), (fileName) => fileName.endsWith(".cs"));
  assert.notEqual(files.length, 0);
  for (const file of files) {
    const text = await readFile(file, "utf8");
    for (const pattern of bannedGeneratedRuntimeSemantics) {
      assert.doesNotMatch(text, pattern, `${file} contains banned runtime semantic ${pattern}`);
    }
  }
}

async function collectFiles(directory, includeFile, result = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await collectFiles(path, includeFile, result);
    } else if (entry.isFile() && includeFile(path)) {
      result.push(path);
    }
  }
  return result;
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
    return testRepositoryRoots.tsonicCsharp;
  }
  if (packageName === "@tsonic/csharp-runtime") {
    return testRepositoryRoots.csharpRuntime;
  }
  if (packageName === "@tsonic/csharp-js") {
    return testRepositoryRoots.csharpJs;
  }
  if (packageName === "@tsonic/csharp-nodejs") {
    return testRepositoryRoots.csharpNodejs;
  }
  return undefined;
}

function escapeRegExp(value) {
  return value.replace(/[\\^$.*+?()[\]{}|]/gu, "\\$&");
}

export {
  assert,
  assertGeneratedOutputHasNoReflectionSemantics,
  assertInstalledAssemblyReference,
  assertNoInstalledAssemblyReference,
  assertNoRuntimeProjectReference,
  csharpProjectPath,
  dotnetOutputAssemblyPath,
  cliPath,
  existsSync,
  readFile,
  repoRoot,
  testRepositoryRoots,
  resolve,
  run,
  runGeneratedCsharpRunner,
  runNodeInDirectory,
  runGeneratedProject,
  runNode,
  targetCsharpNodejsPackageJson,
  targetCsharpOnlyPackageJson,
  tempRoot,
  test,
  writeProject,
};
