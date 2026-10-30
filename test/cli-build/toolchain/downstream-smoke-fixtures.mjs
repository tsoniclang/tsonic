import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { assert, cliPath, existsSync, readFile, resolve, run, runGeneratedProject, runNode, tempRoot, test, testRepositoryRoots, writeProject } from "../helpers/harness.mjs";
import { assertCsharpSourceClosure } from "../helpers/csharp-source-guard.mjs";

async function assertGeneratedOutputHasNoReflectionSemantics(projectDirectory) {
  const files = await collectFiles(resolve(projectDirectory, "out/csharp"), (fileName) => fileName.endsWith(".cs"));
  assertCsharpSourceClosure(files);
}

async function assertRuntimePackagesHaveNoReflectionSemantics() {
  const runtimeSourceDirectories = [
    resolve(testRepositoryRoots.csharpRuntime, "src"),
    resolve(testRepositoryRoots.csharpJs, "src"),
    resolve(testRepositoryRoots.csharpNodejs, "csharp/src"),
  ];
  const files = (await Promise.all(runtimeSourceDirectories.map((directory) =>
    collectFiles(directory, (fileName) => fileName.endsWith(".cs"))
  ))).flat();
  assertCsharpSourceClosure(files);
}

function targetCsharpNodejsPackageJson(name) {
  return JSON.stringify({
    name: `tsonic-test-${name}`,
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

export { assertGeneratedOutputHasNoReflectionSemantics, assertRuntimePackagesHaveNoReflectionSemantics, targetCsharpNodejsPackageJson, collectFiles };
