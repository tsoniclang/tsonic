import { assert, assertRuntimeProjectReference, cliPath, existsSync, readFile, resolve, run, runGeneratedCsharpRunner, runGeneratedProject, runNode, targetCsharpNodejsPackageJson, targetCsharpOnlyPackageJson, tempRoot, test, writeProject } from "../../helpers/harness.mjs";

test("CLI emits fs.statSync and path object operations from selected Node provider-package declarations", async () => {
  const projectDirectory = resolve(tempRoot, "nodejs-fs-path-object-provider-package");
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
            assemblyName: "SmokeGeneratedNodeFsPathObjects",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { Buffer } from \"node:buffer\";",
      "import { fstatSync, openSync, readFileSync, readSync, statSync, writeFileSync, writeSync } from \"node:fs\";",
      "import { format, parse } from \"node:path\";",
      "import * as nodePath from \"node:path\";",
      "import * as nodeOs from \"node:os\";",
      "import * as nodeProcess from \"node:process\";",
      "",
      "export function parsedExt(path: string): string {",
      "  return parse(path).ext;",
      "}",
      "",
      "export function formattedPath(path: string): string {",
      "  return format(parse(path));",
      "}",
      "",
      "export function statKind(path: string): boolean {",
      "  const stat = statSync(path);",
      "  return stat.isFile() || stat.isDirectory() || stat.size > 0;",
      "}",
      "",
      "export function readText(path: string): string {",
      "  return readFileSync(path, \"utf8\");",
      "}",
      "",
      "export function readBytes(path: string): string {",
      "  return readFileSync(path).toString();",
      "}",
      "",
      "export function writeBytes(path: string): void {",
      "  writeFileSync(path, Buffer.from(\"x\"));",
      "}",
      "",
      "export function descriptorSize(path: string): number {",
      "  const fd = openSync(path, \"r\");",
      "  return fstatSync(fd).size;",
      "}",
      "",
      "export function descriptorRoundTrip(fd: number): number {",
      "  const buffer = Buffer.alloc(8);",
      "  writeSync(fd, \"x\");",
      "  return readSync(fd, buffer, 0, 1, 0) + writeSync(fd, buffer, 0, 1, 0);",
      "}",
      "",
      "export function processId(): number {",
      "  return nodeProcess.pid;",
      "}",
      "",
      "export function firstArgument(): string {",
      "  return nodeProcess.argv[0];",
      "}",
      "",
      "export function surfaceSeparators(): string {",
      "  return nodePath.sep + nodeOs.EOL;",
      "}",
      "",
      "export function variantPath(): string {",
      "  return nodePath.posix.join(\"a\", \"b\") + nodePath.win32.sep;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.path\.parse\(path\)\.ext;/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.path\.format\(Tsonic\.CSharp\.Node\.path\.parse\(path\)\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.Stats stat = Tsonic\.CSharp\.Node\.fs\.statSync\(path\);/);
  assert.match(generatedSource, /return stat\.IsFile\(\) \|\| stat\.IsDirectory\(\) \|\| stat\.size > 0L;/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.fs\.readFileSync\(path, "utf8"\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.fs\.readFileSync\(path\)\.toString\(\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.fs\.writeFileSync\(path, Tsonic\.CSharp\.Node\.Buffer\.from\("x"\)\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.fs\.fstatSync\(fd\)\.size;/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.fs\.writeSync\(System\.Convert\.ToInt32\(fd\), "x"\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.fs\.readSync\(System\.Convert\.ToInt32\(fd\), buffer, 0, 1, 0L\) \+ Tsonic\.CSharp\.Node\.fs\.writeSync\(System\.Convert\.ToInt32\(fd\), buffer, 0, 1, 0L\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.process\.pid;/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.process\.argv\[0\];/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.path\.sep \+ Tsonic\.CSharp\.Node\.os\.EOL;/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.path\.posix\.join\("a", "b"\) \+ Tsonic\.CSharp\.Node\.path\.win32\.sep;/);
  assert.doesNotMatch(generatedSource, /return statSync\(/);
  assert.doesNotMatch(generatedSource, /return parse\(/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedNodeFsPathObjects.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

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
