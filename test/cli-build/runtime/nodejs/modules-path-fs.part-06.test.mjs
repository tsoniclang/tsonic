import { assert, assertRuntimeProjectReference, cliPath, existsSync, readFile, resolve, run, runGeneratedCsharpRunner, runGeneratedProject, runNode, targetCsharpNodejsPackageJson, targetCsharpOnlyPackageJson, tempRoot, test, writeProject } from "../../helpers/harness.mjs";

test("CLI emits fs Stats Date members through selected Node provider-package and JS surface facts", async () => {
  const projectDirectory = resolve(tempRoot, "nodejs-fs-stats-date-provider-package");
  await writeProject(projectDirectory, {
    "package.json": targetCsharpNodejsPackageJson(projectDirectory),
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
            assemblyName: "SmokeGeneratedNodeFsStatsDate",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { statSync } from \"node:fs\";",
      "",
      "export function mtimeIso(path: string): string {",
      "  const stats = statSync(path);",
      "  return stats.mtime.toISOString() + \":\" + stats.mtimeMs;",
      "}",
      "",
      "export function selectedMtimeIso(path: string, maybeDate: Date | undefined): string {",
      "  const resolved = maybeDate ?? statSync(path).mtime;",
      "  return resolved.toISOString();",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedProject = await readFile(resolve(projectDirectory, "out/csharp/SmokeGeneratedNodeFsStatsDate.csproj"), "utf8");
  assertRuntimeProjectReference(generatedProject, "Tsonic.CSharp.Runtime");
  assertRuntimeProjectReference(generatedProject, "Tsonic.CSharp.Js");
  assertRuntimeProjectReference(generatedProject, "Tsonic.CSharp.Node");

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.Stats stats = Tsonic\.CSharp\.Node\.fs\.statSync\(path\);/);
  assert.match(generatedSource, /return stats\.mtime\.toISOString\(\) \+ ":" \+ stats\.mtimeMs;/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.Date resolved = maybeDate \?\? Tsonic\.CSharp\.Node\.fs\.statSync\(path\)\.mtime;/);
  assert.match(generatedSource, /return resolved\.toISOString\(\);/);
  assert.doesNotMatch(generatedSource, /DateTime/);
  assert.doesNotMatch(generatedSource, /return statSync\(/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedNodeFsStatsDate.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI rejects fs Stats Date chains when Node provider package is not selected", async () => {
  const projectDirectory = resolve(tempRoot, "nodejs-fs-stats-date-no-node-provider-package");
  await writeProject(projectDirectory, {
    "package.json": targetCsharpOnlyPackageJson("nodejs-fs-stats-date-no-node-provider-package"),
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
            assemblyName: "SmokeGeneratedNodeFsStatsDateNoNodeProviderPackage",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { statSync } from \"node:fs\";",
      "",
      "export function mtimeIso(path: string): string {",
      "  return statSync(path).mtime.toISOString();",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /TSTS_DIAGNOSTIC/);
  assert.match(build.stderr, /Cannot find name 'node:fs'/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedNodeFsStatsDateNoNodeProviderPackage.csproj")), false);
});

test("CLI rejects unsupported selected Node fs provider-package operations without fallback", async () => {
  const projectDirectory = resolve(tempRoot, "nodejs-unsupported-selected-operation");
  await writeProject(projectDirectory, {
    "package.json": targetCsharpNodejsPackageJson(projectDirectory),
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          surfaces: ["js"],
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { readFile, writeFile } from \"node:fs\";",
      "",
      "export function unsupportedFs(path: string): void {",
      "  readFile(path, {}, () => {});",
      "  writeFile(path, \"x\", {}, () => {});",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /C# NodeJS provider package hard-rejected selected call 'node:fs' export 'readFile'/);
  assert.match(build.stderr, /node:fs\.readFile/);
  assert.match(build.stderr, /C# NodeJS provider package hard-rejected selected call 'node:fs' export 'writeFile'/);
  assert.match(build.stderr, /node:fs\.writeFile/);
  assert.doesNotMatch(build.stderr, /readFile is not a function|writeFile is not a function/);
  assert.doesNotMatch(build.stderr, /Reflection|dynamic|GetMethod|GetProperty/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
});
