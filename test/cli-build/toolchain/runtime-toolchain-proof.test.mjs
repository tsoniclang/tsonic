import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { assert, assertRuntimeProjectReference, assertNoRuntimeReference, assertNoInstalledAssemblyReference, cliPath, existsSync, readFile, resolve, run, runGeneratedProject, runNode, tempRoot, test, testRepositoryRoots, writeProject } from "../helpers/harness.mjs";
import { assertCsharpSourceClosure } from "../helpers/csharp-source-guard.mjs";
import { assertRuntimeReferences, targetCsharpNodejsPackageJson, currentDotnetRuntimeIdentifier, assertGeneratedOutputHasNoReflectionSemantics, collectGeneratedFiles, collectFiles } from "./runtime-toolchain-proof.split-fixtures.mjs";

test("C# runtime packages do not contain reflection or dynamic language semantics", async () => {
  const runtimeSourceDirectories = [
    resolve(testRepositoryRoots.csharpRuntime, "src"),
    resolve(testRepositoryRoots.csharpJs, "src"),
    resolve(testRepositoryRoots.csharpNodejs, "csharp/src"),
  ];
  const files = (await Promise.all(runtimeSourceDirectories.map((directory) =>
    collectFiles(directory, (fileName) => fileName.endsWith(".cs"))
  ))).flat();
  assertCsharpSourceClosure(files);
});

test("CLI emits configured C# library projects with closed base runtime references", async () => {
  const assemblyName = "SmokeGeneratedRuntimeOnlyLibrary";
  const projectDirectory = resolve(tempRoot, "runtime-only-library");
  await writeProject(projectDirectory, {
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
            outputType: "Library",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function add(left: number, right: number): number {",
      "  return left + right;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedProjectPath = resolve(projectDirectory, `out/csharp/${assemblyName}.csproj`);
  const generatedProject = await readFile(generatedProjectPath, "utf8");
  assert.match(generatedProject, /<OutputType>Library<\/OutputType>/);
  assertRuntimeReferences(generatedProject, { runtime: true, js: false, nodejs: false });
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/generated/TsonicEntrypoint.cs")), false);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static double add\(double left, double right\)/);
  assert.doesNotMatch(generatedSource, /public static void Main\(/);
  await assertGeneratedOutputHasNoReflectionSemantics(projectDirectory);

  const dotnet = run("dotnet", ["build", generatedProjectPath, "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits JS runtime references without NodeJS runtime when only the JS surface is selected", async () => {
  const assemblyName = "SmokeGeneratedJsRuntimeReferences";
  const projectDirectory = resolve(tempRoot, "js-runtime-references");
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
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function normalize(value: number): number {",
      "  return Math.trunc(Math.abs(value));",
      "}",
      "",
      "export function serialize(value: string): string {",
      "  return JSON.stringify(value);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedProjectPath = resolve(projectDirectory, `out/csharp/${assemblyName}.csproj`);
  const generatedProject = await readFile(generatedProjectPath, "utf8");
  assert.match(generatedProject, /<OutputType>Library<\/OutputType>/);
  assertRuntimeReferences(generatedProject, { runtime: true, js: true, nodejs: false });

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Math\.trunc\(Tsonic\.CSharp\.Js\.Math\.abs\(value\)\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.JSON\.stringify\(value\);/);
  assert.doesNotMatch(generatedSource, /Tsonic\.CSharp\.Node/);
  await assertGeneratedOutputHasNoReflectionSemantics(projectDirectory);

  const dotnet = run("dotnet", ["build", generatedProjectPath, "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});
