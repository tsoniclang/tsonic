import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { assert, assertRuntimeProjectReference, assertNoRuntimeReference, assertNoInstalledAssemblyReference, cliPath, existsSync, readFile, resolve, run, runGeneratedProject, runNode, tempRoot, test, testRepositoryRoots, writeProject } from "../helpers/harness.mjs";
import { assertCsharpSourceClosure } from "../helpers/csharp-source-guard.mjs";

function assertRuntimeReferences(projectText, expected) {
  for (const [key, name] of [["runtime", "Runtime"], ["js", "Js"], ["nodejs", "Node"]]) {
    const assemblyName = `Tsonic.CSharp.${name}`;
    assertNoInstalledAssemblyReference(projectText, assemblyName);
    if (expected[key]) assertRuntimeProjectReference(projectText, assemblyName);
    else assertNoRuntimeReference(projectText, assemblyName);
  }
}

function targetCsharpNodejsPackageJson(projectDirectory) {
  return JSON.stringify({
    name: `tsonic-test-${projectDirectory.split("/").at(-1)}`,
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

function currentDotnetRuntimeIdentifier() {
  if (process.platform === "linux" && process.arch === "x64") {
    return "linux-x64";
  }
  if (process.platform === "linux" && process.arch === "arm64") {
    return "linux-arm64";
  }
  if (process.platform === "darwin" && process.arch === "x64") {
    return "osx-x64";
  }
  if (process.platform === "darwin" && process.arch === "arm64") {
    return "osx-arm64";
  }
  if (process.platform === "win32" && process.arch === "x64") {
    return "win-x64";
  }
  if (process.platform === "win32" && process.arch === "arm64") {
    return "win-arm64";
  }
  return undefined;
}

async function assertGeneratedOutputHasNoReflectionSemantics(projectDirectory) {
  const files = await collectGeneratedFiles(resolve(projectDirectory, "out/csharp"));
  assertCsharpSourceClosure(files);
}

async function collectGeneratedFiles(directory) {
  return collectFiles(directory, (fileName) => fileName.endsWith(".cs") || fileName.endsWith(".csproj"));
}

async function collectFiles(directory, predicate) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(fullPath, predicate));
    } else if (entry.isFile() && predicate(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

export { assertRuntimeReferences, targetCsharpNodejsPackageJson, currentDotnetRuntimeIdentifier, assertGeneratedOutputHasNoReflectionSemantics, collectGeneratedFiles, collectFiles };
