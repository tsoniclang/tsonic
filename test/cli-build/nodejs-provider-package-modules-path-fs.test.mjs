import { assert, cliPath, existsSync, readFile, resolve, run, runGeneratedCsharpRunner, runGeneratedProject, runNode, targetCsharpNodejsPackageJson, targetCsharpOnlyPackageJson, tempRoot, test, writeProject } from "./harness.mjs";

test("CLI emits node:path and bare path joins from selected Node provider-package provider facts", async () => {
  const projectDirectory = resolve(tempRoot, "nodejs-path-join-provider-package");
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
            assemblyName: "SmokeGeneratedNodePath",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { join } from \"node:path\";",
      "import { join as bareJoin } from \"path\";",
      "",
      "export function tenantPath(tenantId: string): string {",
      "  return join(\"uploads\", tenantId, \"events.json\");",
      "}",
      "",
      "export function bareTenantPath(tenantId: string): string {",
      "  return bareJoin(\"uploads\", tenantId, \"events.json\");",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedProject = await readFile(resolve(projectDirectory, "out/csharp/SmokeGeneratedNodePath.csproj"), "utf8");
  assert.match(generatedProject, /<Reference Include="Tsonic\.CSharp\.Runtime" HintPath="[^"]*Tsonic\.CSharp\.Runtime\.dll" \/>/);
  assert.match(generatedProject, /<Reference Include="Tsonic\.CSharp\.Js" HintPath="[^"]*Tsonic\.CSharp\.Js\.dll" \/>/);
  assert.match(generatedProject, /<Reference Include="Tsonic\.CSharp\.Node" HintPath="[^"]*Tsonic\.CSharp\.Node\.dll" \/>/);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.path\.join\("uploads", tenantId, "events\.json"\);/);
  assert.doesNotMatch(generatedSource, /return join\(/);
  assert.doesNotMatch(generatedSource, /bareJoin/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedNodePath.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI runs recovered NodeJS path posix fixture through provider-package facts", async () => {
  const assemblyName = "SmokeGeneratedNodePathPosixRecovered";
  const projectDirectory = resolve(tempRoot, "nodejs-path-posix-recovered");
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
            outputType: "Exe",
            namespace: "Smoke.Generated",
            assemblyName,
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import * as path from \"node:path\";",
      "",
      "console.log(path.posix.join(\"a\", \"b\", \"c\"));",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.path\.posix\.join\("a", "b", "c"\)/);
  assert.doesNotMatch(generatedSource, /return path\./);
  assert.doesNotMatch(generatedSource, /\bdynamic\b|System\.Reflection|GetMethod|GetProperty|__unsupported/);

  assert.equal(runGeneratedProject(projectDirectory, assemblyName), "a/b/c\n");
});

test("CLI runs recovered NodeJS default fs import fixture through provider-package facts", async () => {
  const assemblyName = "SmokeGeneratedNodeDefaultFsRecovered";
  const projectDirectory = resolve(tempRoot, "nodejs-default-fs-recovered");
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
            outputType: "Exe",
            namespace: "Smoke.Generated",
            assemblyName,
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import fs from \"node:fs\";",
      "",
      "console.log(fs.existsSync(\".\") ? \"true\" : \"false\");",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.fs\.existsSync\("\."\)/);
  assert.doesNotMatch(generatedSource, /return fs\./);
  assert.doesNotMatch(generatedSource, /\bdynamic\b|System\.Reflection|GetMethod|GetProperty|__unsupported/);

  assert.equal(runGeneratedProject(projectDirectory, assemblyName), "true\n");
});

test("CLI runs recovered NodeJS module graph fixture through provider-package facts", async () => {
  const assemblyName = "SmokeGeneratedNodeModuleGraphRecovered";
  const projectDirectory = resolve(tempRoot, "nodejs-module-graph-recovered");
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
            outputType: "Exe",
            namespace: "Smoke.Generated",
            assemblyName,
          },
        },
      ],
    }, null, 2),
    "src/pathing.ts": [
      "import { join } from \"node:path\";",
      "",
      "export function joinTenantPath(tenantId: string): string {",
      "  return join(\"uploads\", tenantId, \"events.json\");",
      "}",
      "",
    ].join("\n"),
    "src/system-info.ts": [
      "import * as os from \"node:os\";",
      "import * as process from \"node:process\";",
      "",
      "export function getSystemSummary(): string {",
      "  return os.homedir() + \"|\" + process.cwd();",
      "}",
      "",
    ].join("\n"),
    "src/file-state.ts": [
      "import * as fs from \"node:fs\";",
      "import * as crypto from \"node:crypto\";",
      "",
      "export function describeFileState(filePath: string): string {",
      "  const present = fs.existsSync(filePath);",
      "  const token = crypto.randomUUID();",
      "  return present ? `present:${token}` : `missing:${token}`;",
      "}",
      "",
    ].join("\n"),
    "src/index.ts": [
      "import { joinTenantPath } from \"./pathing.js\";",
      "import { getSystemSummary } from \"./system-info.js\";",
      "import { describeFileState } from \"./file-state.js\";",
      "",
      "export function main(): void {",
      "  const filePath = joinTenantPath(\"tenant-1\");",
      "  const sys = getSystemSummary();",
      "  const state = describeFileState(filePath);",
      "  console.log(filePath);",
      "  console.log(sys.length > 0 ? \"sys-ok\" : \"sys-empty\");",
      "  console.log(state.length > 0 ? \"state-ok\" : \"state-empty\");",
      "}",
      "",
      "main();",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /Pathing\.__tsonic_module_init\(\);/);
  assert.match(generatedSource, /SystemInfo\.__tsonic_module_init\(\);/);
  assert.match(generatedSource, /FileState\.__tsonic_module_init\(\);/);
  assert.match(generatedSource, /main\(\);/);
  assert.doesNotMatch(generatedSource, /\bdynamic\b|System\.Reflection|GetMethod|GetProperty|__unsupported/);

  assert.equal(runGeneratedProject(projectDirectory, assemblyName), "uploads/tenant-1/events.json\nsys-ok\nstate-ok\n");
});

test("CLI rejects node:path imports when Node provider package is not selected", async () => {
  const projectDirectory = resolve(tempRoot, "nodejs-path-no-provider-package");
  await writeProject(projectDirectory, {
    "package.json": targetCsharpOnlyPackageJson("nodejs-path-no-provider-package"),
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
      "import { join } from \"node:path\";",
      "",
      "export function tenantPath(tenantId: string): string {",
      "  return join(\"uploads\", tenantId, \"events.json\");",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /Cannot find module 'node:path'|node:path/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
});

test("CLI emits fs promises operations from selected Node provider-package facts", async () => {
  const projectDirectory = resolve(tempRoot, "nodejs-fs-promises-provider-package");
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
            assemblyName: "SmokeGeneratedNodeFsPromises",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { Buffer } from \"node:buffer\";",
      "import { access, appendFile, chmod, copyFile, cp, mkdir, readFile, readdir, readlink, realpath, rename, rm, rmdir, stat, symlink, truncate, unlink, writeFile } from \"node:fs/promises\";",
      "",
      "export async function readText(path: string): Promise<string> {",
      "  return await readFile(path, \"utf8\");",
      "}",
      "",
      "export async function writeText(path: string, text: string): Promise<void> {",
      "  await writeFile(path, text, \"utf8\");",
      "}",
      "",
      "export async function statPath(path: string): Promise<void> {",
      "  await stat(path);",
      "}",
      "",
      "export async function deletePath(path: string): Promise<void> {",
      "  await unlink(path);",
      "}",
      "",
      "export async function linkRoundTrip(sourcePath: string, linkPath: string): Promise<string> {",
      "  await symlink(sourcePath, linkPath);",
      "  await chmod(linkPath, 420);",
      "  await cp(sourcePath, linkPath + \".copy\", true);",
      "  await rmdir(linkPath + \".dir\", true);",
      "  return (await readlink(linkPath)) + (await realpath(linkPath));",
      "}",
      "",
      "export async function runFileRoundTrip(root: string): Promise<string> {",
      "  const directory = root + \"/promises\";",
      "  await mkdir(directory, true);",
      "  const source = directory + \"/source.txt\";",
      "  const binary = directory + \"/binary.bin\";",
      "  const renamed = directory + \"/renamed.txt\";",
      "  const copied = directory + \"/copied.txt\";",
      "  const copiedDirect = directory + \"/copied-direct.txt\";",
      "  await writeFile(source, \"hello\", \"utf8\");",
      "  await access(source);",
      "  await writeFile(binary, Buffer.from(\"ok\", \"utf8\"));",
      "  await appendFile(binary, Buffer.from(\"!\", \"utf8\"));",
      "  const text = await readFile(source, \"utf8\");",
      "  const bytes = await readFile(source);",
      "  const binaryBytes = await readFile(binary);",
      "  await rename(source, renamed);",
      "  await cp(renamed, copied, false);",
      "  await copyFile(renamed, copiedDirect);",
      "  await truncate(copiedDirect, 2);",
      "  const truncatedText = await readFile(copiedDirect, \"utf8\");",
      "  const entries = await readdir(directory);",
      "  const kind = (await stat(copied)).isFile() ? \"file\" : \"other\";",
      "  await unlink(binary);",
      "  await unlink(renamed);",
      "  await rm(copied, false);",
      "  await rm(copiedDirect, false);",
      "  await rm(directory, true);",
      "  return `${text}:${bytes.length}:${binaryBytes.length}:${entries.length}:${kind}:${truncatedText}`;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /return await Tsonic\.CSharp\.Node\.fs_promises\.readFile\(path, "utf8"\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.Buffer bytes = await Tsonic\.CSharp\.Node\.fs_promises\.readFile\(source\);/);
  assert.match(generatedSource, /await Tsonic\.CSharp\.Node\.fs_promises\.access\(source\);/);
  assert.match(generatedSource, /await Tsonic\.CSharp\.Node\.fs_promises\.writeFile\(path, text, "utf8"\);/);
  assert.match(generatedSource, /await Tsonic\.CSharp\.Node\.fs_promises\.writeFile\(binary, Tsonic\.CSharp\.Node\.Buffer\.from\("ok", "utf8"\)\);/);
  assert.match(generatedSource, /await Tsonic\.CSharp\.Node\.fs_promises\.appendFile\(binary, Tsonic\.CSharp\.Node\.Buffer\.from\("!", "utf8"\)\);/);
  assert.match(generatedSource, /await Tsonic\.CSharp\.Node\.fs_promises\.stat\(path\);/);
  assert.match(generatedSource, /await Tsonic\.CSharp\.Node\.fs_promises\.unlink\(path\);/);
  assert.match(generatedSource, /await Tsonic\.CSharp\.Node\.fs_promises\.mkdir\(directory, true\);/);
  assert.match(generatedSource, /string\[\] entries = await Tsonic\.CSharp\.Node\.fs_promises\.readdir\(directory\);/);
  assert.match(generatedSource, /await Tsonic\.CSharp\.Node\.fs_promises\.copyFile\(renamed, copiedDirect\);/);
  assert.match(generatedSource, /await Tsonic\.CSharp\.Node\.fs_promises\.truncate\(copiedDirect, System\.Convert\.ToInt64\(2\)\);/);
  assert.match(generatedSource, /entries\.Length/);
  assert.match(generatedSource, /await Tsonic\.CSharp\.Node\.fs_promises\.symlink\(sourcePath, linkPath\);/);
  assert.match(generatedSource, /await Tsonic\.CSharp\.Node\.fs_promises\.chmod\(linkPath, 420\);/);
  assert.match(generatedSource, /await Tsonic\.CSharp\.Node\.fs_promises\.cp\(sourcePath, linkPath \+ "\.copy", true\);/);
  assert.match(generatedSource, /await Tsonic\.CSharp\.Node\.fs_promises\.rmdir\(linkPath \+ "\.dir", true\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.fs_promises\.readlink\(linkPath\)/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.fs_promises\.realpath\(linkPath\)/);
  assert.doesNotMatch(generatedSource, /return readFile\(/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedNodeFsPromises.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);

  const stdout = await runGeneratedCsharpRunner(projectDirectory, "SmokeGeneratedNodeFsPromises", [
    "using System;",
    "using System.Threading.Tasks;",
    "",
    "public static class Program",
    "{",
    "    public static async Task Main()",
    "    {",
    "        Console.WriteLine(await Smoke.Generated.Index.runFileRoundTrip(Environment.CurrentDirectory));",
    "    }",
    "}",
    "",
  ]);
  assert.equal(stdout, "hello:5:3:4:file:he\n");
});

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
  assert.match(generatedSource, /return stat\.IsFile\(\) \|\| stat\.IsDirectory\(\) \|\| stat\.size > 0;/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.fs\.readFileSync\(path, "utf8"\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.fs\.readFileSync\(path\)\.toString\(\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.fs\.writeFileSync\(path, Tsonic\.CSharp\.Node\.Buffer\.from\("x"\)\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.fs\.fstatSync\(fd\)\.size;/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.fs\.writeSync\(System\.Convert\.ToInt32\(fd\), "x"\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.fs\.readSync\(System\.Convert\.ToInt32\(fd\), buffer, 0, 1, 0\) \+ Tsonic\.CSharp\.Node\.fs\.writeSync\(System\.Convert\.ToInt32\(fd\), buffer, 0, 1, 0\);/);
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
  assert.match(generatedProject, /<Reference Include="Tsonic\.CSharp\.Runtime" HintPath="[^"]*Tsonic\.CSharp\.Runtime\.dll" \/>/);
  assert.match(generatedProject, /<Reference Include="Tsonic\.CSharp\.Js" HintPath="[^"]*Tsonic\.CSharp\.Js\.dll" \/>/);
  assert.match(generatedProject, /<Reference Include="Tsonic\.CSharp\.Node" HintPath="[^"]*Tsonic\.CSharp\.Node\.dll" \/>/);

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
      "import fs, { createReadStream, readFile, watch, watchFile, writeFile } from \"node:fs\";",
      "",
      "export function unsupportedFs(path: string): void {",
      "  readFile(path, {}, () => {});",
      "  writeFile(path, \"x\", {}, () => {});",
      "  watch(path, {}, () => {});",
      "  watchFile(path, () => {});",
      "  createReadStream(path);",
      "  fs.watchFile(path, () => {});",
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
  assert.match(build.stderr, /C# NodeJS provider package hard-rejected selected call 'node:fs' export 'watch'/);
  assert.match(build.stderr, /node:fs\.watch/);
  assert.match(build.stderr, /C# NodeJS provider package hard-rejected selected call 'node:fs' export 'watchFile'/);
  assert.match(build.stderr, /node:fs\.watchFile/);
  assert.match(build.stderr, /C# NodeJS provider package hard-rejected selected call 'node:fs' export 'createReadStream'/);
  assert.match(build.stderr, /node:fs\.createReadStream/);
  assert.doesNotMatch(build.stderr, /readFile is not a function|writeFile is not a function|watch is not a function|createReadStream is not a function/);
  assert.doesNotMatch(build.stderr, /watchFile is not a function/);
  assert.doesNotMatch(build.stderr, /Reflection|dynamic|GetMethod|GetProperty/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
});
