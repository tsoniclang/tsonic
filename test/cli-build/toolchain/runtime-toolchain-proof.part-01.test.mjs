import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { assert, assertRuntimeProjectReference, assertNoRuntimeReference, assertNoInstalledAssemblyReference, cliPath, existsSync, readFile, resolve, run, runGeneratedProject, runNode, tempRoot, test, testRepositoryRoots, writeProject } from "../helpers/harness.mjs";
import { assertCsharpSourceClosure } from "../helpers/csharp-source-guard.mjs";
import { assertRuntimeReferences, targetCsharpNodejsPackageJson, currentDotnetRuntimeIdentifier, assertGeneratedOutputHasNoReflectionSemantics, collectGeneratedFiles, collectFiles } from "./runtime-toolchain-proof.split-fixtures.mjs";

test("CLI runs generated JS surface executable without NodeJS runtime", async () => {
  const assemblyName = "SmokeGeneratedJsRuntimeExecution";
  const projectDirectory = resolve(tempRoot, "js-runtime-execution");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          surfaces: ["js"],
          options: {
            namespace: "Smoke.Generated",
            assemblyName,
            outputType: "Exe",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "console.log(Math.trunc(Math.abs(-42.9)));",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedProjectPath = resolve(projectDirectory, `out/csharp/${assemblyName}.csproj`);
  const generatedProject = await readFile(generatedProjectPath, "utf8");
  assertRuntimeReferences(generatedProject, { runtime: true, js: true, nodejs: false });
  assert.equal(runGeneratedProject(projectDirectory, assemblyName), "42\n");
});

test("CLI emits NodeJS runtime references with transitive JS runtime only when NodeJS is selected", async () => {
  const assemblyName = "SmokeGeneratedNodeRuntimeReferences";
  const projectDirectory = resolve(tempRoot, "nodejs-runtime-references");
  await writeProject(projectDirectory, {
    "package.json": targetCsharpNodejsPackageJson(projectDirectory),
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          options: {
            namespace: "Smoke.Generated",
            assemblyName,
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { join } from \"node:path\";",
      "",
      "export function tenantPath(tenantId: string): string {",
      "  return join(\"uploads\", tenantId, \"events.json\");",
      "}",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedProjectPath = resolve(projectDirectory, `out/csharp/${assemblyName}.csproj`);
  const generatedProject = await readFile(generatedProjectPath, "utf8");
  assert.match(generatedProject, /<OutputType>Library<\/OutputType>/);
  assertRuntimeReferences(generatedProject, { runtime: true, js: true, nodejs: true });

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.path\.join\("uploads", tenantId, "events\.json"\);/);
  assert.doesNotMatch(generatedSource, /return join\(/);
  await assertGeneratedOutputHasNoReflectionSemantics(projectDirectory);

  const dotnet = run("dotnet", ["build", generatedProjectPath, "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});
