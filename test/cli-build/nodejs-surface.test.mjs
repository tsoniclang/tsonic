import { assert, cliPath, existsSync, readFile, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "./harness.mjs";

test("CLI emits node:path and bare path joins from selected NodeJS provider-package provider facts", async () => {
  const projectDirectory = resolve(tempRoot, "nodejs-path-join-surface");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          surfaces: ["js"],
          packages: ["nodejs"],
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
  assert.match(generatedProject, /Tsonic\.CSharp\.Runtime\.csproj/);
  assert.match(generatedProject, /Tsonic\.CSharp\.Js\.csproj/);
  assert.match(generatedProject, /Tsonic\.CSharp\.Node\.csproj/);

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
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          surfaces: ["js"],
          packages: ["nodejs"],
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
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          surfaces: ["js"],
          packages: ["nodejs"],
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
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          surfaces: ["js"],
          packages: ["nodejs"],
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


test("CLI rejects node:path imports when NodeJS provider package is not selected", async () => {
  const projectDirectory = resolve(tempRoot, "nodejs-path-no-surface");
  await writeProject(projectDirectory, {
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

test("CLI builds and runs existing Node-style code when NodeJS provider package is selected", async () => {
  const projectDirectory = resolve(tempRoot, "existing-node-style-surface-code");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          surfaces: ["js"],
          packages: ["nodejs"],
          options: {
            namespace: "Smoke.Generated",
            assemblyName: "SmokeGeneratedExistingNodeStyleSurfaceCode",
            outputType: "Exe",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { Console } from \"@tsonic/dotnet/System.js\";",
      "import { existsSync, statSync } from \"node:fs\";",
      "import { basename, extname, join, resolve } from \"node:path\";",
      "import * as nodeProcess from \"node:process\";",
      "import * as nodeOs from \"node:os\";",
      "import { Buffer, transcode } from \"node:buffer\";",
      "import { randomUUID } from \"node:crypto\";",
      "",
      "export function fileReady(path: string): boolean {",
      "  return existsSync(path) && statSync(path).isFile();",
      "}",
      "",
      "export function assetName(root: string, name: string): string {",
      "  const fullPath = join(root, name);",
      "  return basename(fullPath) + extname(fullPath);",
      "}",
      "",
      "export function cwdAsset(name: string): string {",
      "  return resolve(nodeProcess.cwd(), name);",
      "}",
      "",
      "export function encoded(value: string): string {",
      "  return Buffer.from(value).toString();",
      "}",
      "",
      "export function runId(): string {",
      "  return randomUUID();",
      "}",
      "",
      "export function firstArg(): string {",
      "  return nodeProcess.argv[0];",
      "}",
      "",
      "export function platformLine(): string {",
      "  return nodeOs.platform() + nodeOs.EOL;",
      "}",
      "",
      "Console.writeLine(`${assetName(\"root\", \"file.txt\")}|${encoded(\"ok\")}|${runId().length}|${firstArg().length > 0 ? \"argv\" : \"missing\"}|${platformLine().trim().length > 0 ? \"platform\" : \"missing\"}`);",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedProject = await readFile(resolve(projectDirectory, "out/csharp/SmokeGeneratedExistingNodeStyleSurfaceCode.csproj"), "utf8");
  assert.match(generatedProject, /Tsonic\.CSharp\.Runtime\.csproj/);
  assert.match(generatedProject, /Tsonic\.CSharp\.Js\.csproj/);
  assert.match(generatedProject, /Tsonic\.CSharp\.Node\.csproj/);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.fs\.existsSync\(path\) && Tsonic\.CSharp\.Node\.fs\.statSync\(path\)\.IsFile\(\);/);
  assert.match(generatedSource, /string fullPath = Tsonic\.CSharp\.Node\.path\.join\(root, name\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.path\.basename\(fullPath\) \+ Tsonic\.CSharp\.Node\.path\.extname\(fullPath\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.path\.resolve\(Tsonic\.CSharp\.Node\.process\.cwd\(\), name\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.Buffer\.from\(value\)\.toString\(\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.crypto\.randomUUID\(\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.process\.argv\[0\];/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.os\.platform\(\) \+ Tsonic\.CSharp\.Node\.os\.EOL;/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.path\.basename\(fullPath\) \+ Tsonic\.CSharp\.Node\.path\.extname\(fullPath\)/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.String\.trim\(platformLine\(\)\)/);
  assert.doesNotMatch(generatedSource, /return existsSync\(/);
  assert.doesNotMatch(generatedSource, /return Buffer\./);
  assert.doesNotMatch(generatedSource, /return randomUUID\(/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedExistingNodeStyleSurfaceCode.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
  assert.equal(runGeneratedProject(projectDirectory, "SmokeGeneratedExistingNodeStyleSurfaceCode"), "file.txt.txt|ok|36|argv|platform\n");
});

test("CLI rejects Node-style builtins when NodeJS provider package is unselected", async () => {
  const projectDirectory = resolve(tempRoot, "existing-node-style-code-without-nodejs-surface");
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
            assemblyName: "SmokeGeneratedExistingNodeStyleCodeWithoutNodejsSurface",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { existsSync } from \"node:fs\";",
      "",
      "export function fileReady(path: string): boolean {",
      "  return existsSync(path);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /TSTS_DIAGNOSTIC/);
  assert.match(build.stderr, /Cannot find name 'node:fs'/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedExistingNodeStyleCodeWithoutNodejsSurface.csproj")), false);
});

test("CLI emits fs promises operations from selected NodeJS provider-package facts", async () => {
  const projectDirectory = resolve(tempRoot, "nodejs-fs-promises-provider-package");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          surfaces: ["js"],
          packages: ["nodejs"],
          options: {
            namespace: "Smoke.Generated",
            assemblyName: "SmokeGeneratedNodeFsPromises",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { Buffer } from \"node:buffer\";",
      "import { appendFile, chmod, cp, mkdir, readFile, readdir, readlink, realpath, rename, rm, rmdir, stat, symlink, unlink, writeFile } from \"node:fs/promises\";",
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
      "  await writeFile(source, \"hello\", \"utf8\");",
      "  await writeFile(binary, Buffer.from(\"ok\", \"utf8\"));",
      "  await appendFile(binary, Buffer.from(\"!\", \"utf8\"));",
      "  const text = await readFile(source, \"utf8\");",
      "  const bytes = await readFile(source);",
      "  const binaryBytes = await readFile(binary);",
      "  await rename(source, renamed);",
      "  await cp(renamed, copied, false);",
      "  const entries = await readdir(directory);",
      "  const kind = (await stat(copied)).isFile() ? \"file\" : \"other\";",
      "  await unlink(binary);",
      "  await unlink(renamed);",
      "  await rm(copied, false);",
      "  await rm(directory, true);",
      "  return `${text}:${bytes.length}:${binaryBytes.length}:${entries.length}:${kind}`;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /return await Tsonic\.CSharp\.Node\.fs_promises\.readFile\(path, "utf8"\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.Buffer bytes = await Tsonic\.CSharp\.Node\.fs_promises\.readFile\(source\);/);
  assert.match(generatedSource, /await Tsonic\.CSharp\.Node\.fs_promises\.writeFile\(path, text, "utf8"\);/);
  assert.match(generatedSource, /await Tsonic\.CSharp\.Node\.fs_promises\.writeFile\(binary, Tsonic\.CSharp\.Node\.Buffer\.from\("ok", "utf8"\)\);/);
  assert.match(generatedSource, /await Tsonic\.CSharp\.Node\.fs_promises\.appendFile\(binary, Tsonic\.CSharp\.Node\.Buffer\.from\("!", "utf8"\)\);/);
  assert.match(generatedSource, /await Tsonic\.CSharp\.Node\.fs_promises\.stat\(path\);/);
  assert.match(generatedSource, /await Tsonic\.CSharp\.Node\.fs_promises\.unlink\(path\);/);
  assert.match(generatedSource, /await Tsonic\.CSharp\.Node\.fs_promises\.mkdir\(directory, true\);/);
  assert.match(generatedSource, /string\[\] entries = await Tsonic\.CSharp\.Node\.fs_promises\.readdir\(directory\);/);
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
  assert.equal(stdout, "hello:5:3:3:file\n");
});

test("CLI rejects unsupported NodeJS provider-package modules without fallback", async () => {
  const projectDirectory = resolve(tempRoot, "unsupported-nodejs-provider-package-module-import");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          surfaces: ["js"],
          packages: ["nodejs"],
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import \"node:vm\";",
      "",
      "export function loaded(): number {",
      "  return 1;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /node:vm/);
  assert.doesNotMatch(build.stderr, /Reflection|dynamic|GetMethod|GetProperty/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
});

test("CLI rejects unsupported historical NodeJS alias imports without fallback", async () => {
  const projectDirectory = resolve(tempRoot, "unsupported-nodejs-historical-alias-imports");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          surfaces: ["js"],
          packages: ["nodejs"],
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import * as assert from \"node:assert\";",
      "import * as buffer from \"node:buffer\";",
      "import * as child_process from \"node:child_process\";",
      "import * as dgram from \"node:dgram\";",
      "import * as dns from \"node:dns\";",
      "import * as events from \"node:events\";",
      "import * as http from \"node:http\";",
      "import type { IncomingMessage, ServerResponse } from \"node:http\";",
      "import * as net from \"node:net\";",
      "import * as process from \"node:process\";",
      "import * as querystring from \"node:querystring\";",
      "import * as readline from \"node:readline\";",
      "import * as stream from \"node:stream\";",
      "import * as timers from \"node:timers\";",
      "import * as tls from \"node:tls\";",
      "import * as url from \"node:url\";",
      "import * as util from \"node:util\";",
      "import * as zlib from \"node:zlib\";",
      "import { join } from \"node:path\";",
      "",
      "export type Handler = (req: IncomingMessage, res: ServerResponse) => void;",
      "",
      "export function loaded(): number {",
      "  void assert;",
      "  void buffer;",
      "  void process;",
      "  void url;",
      "  void util;",
      "  void join;",
      "  return 1;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  for (const moduleSpecifier of [
    "node:child_process",
    "node:dgram",
    "node:dns",
    "node:events",
    "node:http",
    "node:net",
    "node:querystring",
    "node:readline",
    "node:stream",
    "node:timers",
    "node:tls",
    "node:zlib",
  ]) {
    assert.match(build.stderr, new RegExp(moduleSpecifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(build.stderr, /tsts\.extension-host:TS9000022/);
  assert.match(build.stderr, /Required provider module pattern/);
  assert.doesNotMatch(build.stderr, /Reflection|dynamic|GetMethod|GetProperty/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
});

test("CLI rejects unsupported historical NodeJS type-only alias imports without fallback", async () => {
  const projectDirectory = resolve(tempRoot, "unsupported-nodejs-type-only-alias-imports");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          surfaces: ["js"],
          packages: ["nodejs"],
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { IncomingMessage, ServerResponse } from \"node:http\";",
      "",
      "export type Handler = (req: IncomingMessage, res: ServerResponse) => void;",
      "",
      "export function loaded(): number {",
      "  return 1;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /node:http/);
  assert.match(build.stderr, /tsts\.extension-host:TS9000022/);
  assert.match(build.stderr, /Required provider module pattern/);
  assert.doesNotMatch(build.stderr, /Reflection|dynamic|GetMethod|GetProperty/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
});

test("CLI emits NodeJS namespace imports from selected surface provider facts", async () => {
  const projectDirectory = resolve(tempRoot, "nodejs-module-graph-surface");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          surfaces: ["js"],
          packages: ["nodejs"],
          options: {
            namespace: "Smoke.Generated",
            assemblyName: "SmokeGeneratedNodeModules",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import * as fs from \"fs\";",
      "import * as crypto from \"crypto\";",
      "import * as os from \"os\";",
      "import * as process from \"process\";",
      "",
      "export function pathExists(path: string): boolean {",
      "  return fs.existsSync(path);",
      "}",
      "",
      "export function randomId(): string {",
      "  return crypto.randomUUID();",
      "}",
      "",
      "export function home(): string {",
      "  return os.homedir();",
      "}",
      "",
      "export function osPlatform(): string {",
      "  return os.platform();",
      "}",
      "",
      "export function currentDirectory(): string {",
      "  return process.cwd();",
      "}",
      "",
      "export function processPlatform(): string {",
      "  return process.platform;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.fs\.existsSync\(path\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.crypto\.randomUUID\(\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.os\.homedir\(\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.os\.platform\(\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.process\.cwd\(\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.process\.platform;/);
  assert.doesNotMatch(generatedSource, /return fs\./);
  assert.doesNotMatch(generatedSource, /return crypto\./);
  assert.doesNotMatch(generatedSource, /return os\./);
  assert.doesNotMatch(generatedSource, /return process\./);
  assert.doesNotMatch(generatedSource, /__unsupported/);
});

test("CLI emits NodeJS default imports from selected provider-package module object facts", async () => {
  const projectDirectory = resolve(tempRoot, "nodejs-default-module-provider-package");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          surfaces: ["js"],
          packages: ["nodejs"],
          options: {
            namespace: "Smoke.Generated",
            assemblyName: "SmokeGeneratedNodeDefaultModules",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import fs from \"node:fs\";",
      "import path from \"node:path\";",
      "import process from \"node:process\";",
      "import crypto from \"node:crypto\";",
      "import os from \"node:os\";",
      "import util from \"node:util\";",
      "import url from \"node:url\";",
      "",
      "export function defaultNodePath(name: string): string {",
      "  return path.join(process.cwd(), util.toUSVString(name)) + os.EOL + crypto.randomUUID();",
      "}",
      "",
      "export function defaultNodeExists(name: string): boolean {",
      "  return fs.existsSync(path.resolve(name));",
      "}",
      "",
      "export function defaultNodeFileHref(name: string): string {",
      "  return url.pathToFileURL(name).href;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedProject = await readFile(resolve(projectDirectory, "out/csharp/SmokeGeneratedNodeDefaultModules.csproj"), "utf8");
  assert.match(generatedProject, /Tsonic\.CSharp\.Runtime\.csproj/);
  assert.match(generatedProject, /Tsonic\.CSharp\.Js\.csproj/);
  assert.match(generatedProject, /Tsonic\.CSharp\.Node\.csproj/);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.path\.join\(Tsonic\.CSharp\.Node\.process\.cwd\(\), Tsonic\.CSharp\.Node\.util\.toUSVString\(name\)\) \+ Tsonic\.CSharp\.Node\.os\.EOL \+ Tsonic\.CSharp\.Node\.crypto\.randomUUID\(\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.fs\.existsSync\(Tsonic\.CSharp\.Node\.path\.resolve\(name\)\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.url\.pathToFileURL\(name\)\.href;/);
  assert.doesNotMatch(generatedSource, /return fs\./);
  assert.doesNotMatch(generatedSource, /return path\./);
  assert.doesNotMatch(generatedSource, /return process\./);
  assert.doesNotMatch(generatedSource, /return crypto\./);
  assert.doesNotMatch(generatedSource, /return os\./);
  assert.doesNotMatch(generatedSource, /return util\./);
  assert.doesNotMatch(generatedSource, /return url\./);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedNodeDefaultModules.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI runs NodeJS provider-package runtime operations from selected facts", async () => {
  const assemblyName = "SmokeGeneratedNodeProviderRuntime";
  const projectDirectory = resolve(tempRoot, "nodejs-provider-package-runtime");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          surfaces: ["js"],
          packages: ["nodejs"],
          options: {
            namespace: "Smoke.Generated",
            assemblyName,
            outputType: "Exe",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { Console } from \"@tsonic/dotnet/System.js\";",
      "import { Buffer } from \"node:buffer\";",
      "import { createHash, randomUUID } from \"node:crypto\";",
      "import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync } from \"node:fs\";",
      "import os from \"node:os\";",
      "import path from \"node:path\";",
      "import process from \"node:process\";",
      "import { URL, fileURLToPath, pathToFileURL } from \"node:url\";",
      "import { toUSVString } from \"node:util\";",
      "",
      "const filePath = path.join(process.cwd(), \"tsonic-slice8-node-provider-runtime.txt\");",
      "writeFileSync(filePath, \"hello\", \"utf8\");",
      "const text = readFileSync(filePath, \"utf8\");",
      "const directoryPath = path.join(process.cwd(), \"tsonic-slice8-node-provider-runtime-dir\");",
      "mkdirSync(directoryPath, true);",
      "const firstPath = path.join(directoryPath, \"first.txt\");",
      "const secondPath = path.join(directoryPath, \"second.txt\");",
      "writeFileSync(firstPath, \"a\", \"utf8\");",
      "appendFileSync(firstPath, \"b\", \"utf8\");",
      "copyFileSync(firstPath, secondPath);",
      "const renamedPath = path.join(directoryPath, \"renamed.txt\");",
      "renameSync(secondPath, renamedPath);",
      "const directoryEntries = readdirSync(directoryPath);",
      "const directoryListText = directoryEntries.length > 0 ? \"listed\" : \"empty\";",
      "const bytes = Buffer.from(text, \"utf8\");",
      "const fileUrl = pathToFileURL(filePath);",
      "const roundTrip = fileURLToPath(fileUrl);",
      "const hash = createHash(\"sha256\").update(text).digest(\"hex\");",
      "const existsText = existsSync(filePath) ? \"exists\" : \"missing\";",
      "const kindText = statSync(filePath).isFile() ? \"file\" : \"other\";",
      "const osText = os.platform().length > 0 ? \"platform\" : \"missing-platform\";",
      "const parsed = new URL(\"https://example.com/path?foo=bar\");",
      "parsed.searchParams.append(\"baz\", \"qux\");",
      "parsed.search = \"?answer=42\";",
      "parsed.searchParams.delete(\"answer\");",
      "const urlText = parsed.href === \"https://example.com/path\" ? \"url-live\" : parsed.href;",
      "const fsSyncText = `${readFileSync(firstPath, \"utf8\")}:${existsSync(renamedPath) ? \"renamed\" : \"missing\"}:${directoryListText}`;",
      "Console.writeLine(`${path.basename(roundTrip)}|${text}|${bytes.toString()}|${hash.length}|${randomUUID().length}|${existsText}|${kindText}|${osText}|${toUSVString(\"ok\")}|${urlText}|${fsSyncText}`);",
      "unlinkSync(filePath);",
      "rmSync(directoryPath, true);",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedProject = await readFile(resolve(projectDirectory, `out/csharp/${assemblyName}.csproj`), "utf8");
  assert.match(generatedProject, /Tsonic\.CSharp\.Runtime\.csproj/);
  assert.match(generatedProject, /Tsonic\.CSharp\.Js\.csproj/);
  assert.match(generatedProject, /Tsonic\.CSharp\.Node\.csproj/);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.fs\.writeFileSync\(filePath, "hello", "utf8"\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.fs\.readFileSync\(filePath, "utf8"\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.fs\.mkdirSync\(directoryPath, true\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.fs\.appendFileSync\(firstPath, "b", "utf8"\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.fs\.copyFileSync\(firstPath, secondPath\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.fs\.renameSync\(secondPath, renamedPath\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.fs\.readdirSync\(directoryPath\);/);
  assert.match(generatedSource, /directoryEntries\.Length > 0/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.Buffer\.from\(text, "utf8"\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.url\.pathToFileURL\(filePath\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.url\.fileURLToPath\(fileUrl\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.crypto\.createHash\("sha256"\)\.update\(text\)\.digest\("hex"\);/);
  assert.match(generatedSource, /new Tsonic\.CSharp\.Node\.URL\("https:\/\/example\.com\/path\?foo=bar"\);/);
  assert.match(generatedSource, /parsed\.searchParams\.append\("baz", "qux"\);/);
  assert.match(generatedSource, /parsed\.search = "\?answer=42";/);
  assert.match(generatedSource, /parsed\.searchParams\.delete\("answer"\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.fs\.unlinkSync\(filePath\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.fs\.rmSync\(directoryPath, true\);/);
  assert.doesNotMatch(generatedSource, /\bdynamic\b|System\.Reflection|GetMethod|GetProperty|MethodInfo\.Invoke|Assembly\.Load/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  assert.equal(
    runGeneratedProject(projectDirectory, assemblyName),
    "tsonic-slice8-node-provider-runtime.txt|hello|hello|64|36|exists|file|platform|ok|url-live|ab:renamed:listed\n",
  );
});

test("CLI emits expanded process operations from selected NodeJS provider package facts", async () => {
  const projectDirectory = resolve(tempRoot, "nodejs-process-expanded-surface");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          surfaces: ["js"],
          packages: ["nodejs"],
          options: {
            namespace: "Smoke.Generated",
            assemblyName: "SmokeGeneratedNodeProcessExpanded",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import * as process from \"node:process\";",
      "",
      "export function processInfo(): string {",
      "  const pathValue = process.env[\"PATH\"] ?? \"\";",
      "  const usage = process.memoryUsage();",
      "  return process.arch + process.argv0 + process.execPath + process.platform + process.version + process.versions.node + process.versions.dotnet + pathValue + process.pid + process.ppid + process.uptime() + usage.rss + usage.heapUsed;",
      "}",
      "",
      "export function currentExitCode(): number | null {",
      "  return process.exitCode;",
      "}",
      "",
      "export function changeDirectory(directory: string): void {",
      "  process.chdir(directory);",
      "}",
      "",
      "export function terminate(code?: number): void {",
      "  process.exit(code);",
      "}",
      "",
      "export function signalSelf(): boolean {",
      "  return process.kill(process.pid, 0);",
      "}",
      "",
      "export function memoryCeiling(): number {",
      "  return process.availableMemory() + process.constrainedMemory();",
      "}",
      "",
      "export function timingParts(): number {",
      "  const parts = process.hrtime();",
      "  return parts[0] + parts[1];",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.process\.env\["PATH"\] \?\? ""/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.process\.arch/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.process\.argv0/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.process\.execPath/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.process\.platform/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.process\.version/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.process\.versions\.node/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.process\.versions\.dotnet/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.process\.pid/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.process\.ppid/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.MemoryUsage usage = Tsonic\.CSharp\.Node\.process\.memoryUsage\(\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.process\.uptime\(\)/);
  assert.match(generatedSource, /usage\.rss/);
  assert.match(generatedSource, /usage\.heapUsed/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.process\.exitCode;/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.process\.chdir\(directory\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.process\.exit\(code\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.process\.kill\(Tsonic\.CSharp\.Node\.process\.pid, 0\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.process\.availableMemory\(\) \+ Tsonic\.CSharp\.Node\.process\.constrainedMemory\(\);/);
  assert.match(generatedSource, /double\[\] parts = Tsonic\.CSharp\.Node\.process\.hrtime\(\);/);
  assert.match(generatedSource, /return parts\[0\] \+ parts\[1\];/);
  assert.doesNotMatch(generatedSource, /return process\./);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedNodeProcessExpanded.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI rejects unsupported process stream properties without fallback", async () => {
  const projectDirectory = resolve(tempRoot, "nodejs-process-streams-unsupported");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          surfaces: ["js"],
          packages: ["nodejs"],
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import process from \"node:process\";",
      "",
      "export function streams(): void {",
      "  void process.stdin;",
      "  void process.stdout;",
      "  void process.stderr;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  for (const memberName of ["stdin", "stdout", "stderr"]) {
    assert.match(build.stderr, new RegExp(`hard-rejected selected property 'node:process' export 'NodeProcessModule' member '${memberName}'`));
    assert.match(build.stderr, new RegExp(`unsupported:Tsonic\\.CSharp\\.Node\\.process\\.${memberName}`));
  }
  assert.match(build.stderr, /diagnostic\.unsupported-selected-surface-operation/);
  assert.doesNotMatch(build.stderr, /Reflection|dynamic|GetMethod|GetProperty|MethodInfo\.Invoke/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
});

test("CLI rejects unsupported process nextTick without fallback", async () => {
  const projectDirectory = resolve(tempRoot, "nodejs-process-nexttick-unsupported");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          surfaces: ["js"],
          packages: ["nodejs"],
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import process from \"node:process\";",
      "",
      "export function tick(): void {",
      "  process.nextTick(() => {});",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /hard-rejected selected property 'node:process' export 'NodeProcessModule' member 'nextTick'/);
  assert.match(build.stderr, /hard-rejected selected call 'node:process' export 'NodeProcessModule' member 'nextTick'/);
  assert.match(build.stderr, /unsupported:Tsonic\.CSharp\.Node\.process\.nextTick\(Function,System\.Object\[\]\)/);
  assert.match(build.stderr, /diagnostic\.unsupported-selected-surface-operation/);
  assert.doesNotMatch(build.stderr, /Reflection|dynamic|GetMethod|GetProperty|MethodInfo\.Invoke/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
});


test("CLI emits Buffer and crypto operations from selected NodeJS declaration facts", async () => {
  const projectDirectory = resolve(tempRoot, "nodejs-buffer-crypto-surface");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          surfaces: ["js"],
          packages: ["nodejs"],
          options: {
            namespace: "Smoke.Generated",
            assemblyName: "SmokeGeneratedNodeBufferCrypto",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { Buffer, transcode } from \"node:buffer\";",
      "import { createHash, createHmac, getHashes, randomBytes, randomFillSync, randomInt, timingSafeEqual } from \"node:crypto\";",
      "",
      "export function bufferText(): string {",
      "  return Buffer.from(\"hello\").toString();",
      "}",
      "",
      "export function bufferLength(): number {",
      "  return Buffer.alloc(3).length;",
      "}",
      "",
      "export function byteLength(): number {",
      "  return Buffer.byteLength(\"hello\");",
      "}",
      "",
      "export function validEncoding(): boolean {",
      "  return Buffer.isEncoding(\"utf8\");",
      "}",
      "",
      "export function validEncodingText(): string {",
      "  return Buffer.isEncoding(\"utf8\").toString();",
      "}",
      "",
      "export function recognizedBuffer(): boolean {",
      "  return Buffer.isBuffer(Buffer.from(\"x\"));",
      "}",
      "",
      "export function poolSizeValue(): number {",
      "  return Buffer.poolSize;",
      "}",
      "",
      "export function transcodedText(): string {",
      "  return transcode(Buffer.from(\"hello\"), \"utf8\", \"utf8\").toString();",
      "}",
      "",
      "export function copiedBufferCount(): number {",
      "  const source = Buffer.from(\"abc\");",
      "  const target = Buffer.alloc(8);",
      "  return source.copy(target) + target.write(\"z\") + Buffer.from(source).compare(source);",
      "}",
      "",
      "export function boundedRandom(): number {",
      "  return randomInt(10);",
      "}",
      "",
      "export function rangedRandom(): number {",
      "  return randomInt(1, 10);",
      "}",
      "",
      "export function firstHash(): string {",
      "  return getHashes()[0];",
      "}",
      "",
      "export function randomBufferLength(): number {",
      "  return randomBytes(4).length;",
      "}",
      "",
      "export function filledBufferLength(): number {",
      "  return randomFillSync(Buffer.alloc(4)).length;",
      "}",
      "",
      "export function digestHex(input: string): string {",
      "  return createHash(\"sha256\").update(input).digest(\"hex\");",
      "}",
      "",
      "export function digestBufferLength(input: string): number {",
      "  return createHash(\"sha256\").update(Buffer.from(input)).digest().length;",
      "}",
      "",
      "export function hmacHex(key: string, value: string): string {",
      "  return createHmac(\"sha256\", Buffer.from(key)).update(value).digest(\"hex\");",
      "}",
      "",
      "export function sameBuffer(): boolean {",
      "  return timingSafeEqual(Buffer.from(\"aa\"), Buffer.from(\"aa\"));",
      "}",
      "",
      "export function numericRoundTrip(): string {",
      "  const ints = Buffer.alloc(8);",
      "  ints.writeUInt16LE(4660, 0);",
      "  ints.writeInt16BE(-2, 2);",
      "  ints.writeUInt32BE(16909060, 4);",
      "  const floats = Buffer.alloc(12);",
      "  floats.writeFloatLE(1.5, 0);",
      "  floats.writeDoubleBE(2.5, 4);",
      "  return `${ints.readUInt16LE(0)}:${ints.readInt16BE(2)}:${ints.readUInt32BE(4)}:${floats.readFloatLE(0)}:${floats.readDoubleBE(4)}`;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.Buffer\.from\("hello"\)\.toString\(\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.Buffer\.alloc\(3\)\.length;/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.Buffer\.byteLength\("hello"\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.Buffer\.isEncoding\("utf8"\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.BooleanOps\.toString\(Tsonic\.CSharp\.Node\.Buffer\.isEncoding\("utf8"\)\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.Buffer\.isBuffer\(Tsonic\.CSharp\.Node\.Buffer\.from\("x"\)\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.Buffer\.poolSize;/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.buffer\.transcode\(Tsonic\.CSharp\.Node\.Buffer\.from\("hello"\), "utf8", "utf8"\)\.toString\(\);/);
  assert.match(generatedSource, /return source\.copy\(target\) \+ target\.write\("z"\) \+ Tsonic\.CSharp\.Node\.Buffer\.from\(source\)\.compare\(source\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.crypto\.randomInt\(10\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.crypto\.randomInt\(1, 10\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.crypto\.getHashes\(\)\[0\];/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.crypto\.randomBytesBuffer\(4\)\.length;/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.crypto\.randomFillSync\(Tsonic\.CSharp\.Node\.Buffer\.alloc\(4\)\)\.length;/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.crypto\.createHash\("sha256"\)\.update\(input\)\.digest\("hex"\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.crypto\.createHash\("sha256"\)\.update\(Tsonic\.CSharp\.Node\.Buffer\.from\(input\)\)\.digestBuffer\(\)\.length;/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.crypto\.createHmac\("sha256", Tsonic\.CSharp\.Node\.Buffer\.from\(key\)\)\.update\(value\)\.digest\("hex"\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.crypto\.timingSafeEqual\(Tsonic\.CSharp\.Node\.Buffer\.from\("aa"\), Tsonic\.CSharp\.Node\.Buffer\.from\("aa"\)\);/);
  assert.match(generatedSource, /ints\.writeUInt16LE\(4660, 0\);/);
  assert.match(generatedSource, /ints\.writeInt16BE\(-2, 2\);/);
  assert.match(generatedSource, /ints\.writeUInt32BE\(16909060, 4\);/);
  assert.match(generatedSource, /floats\.writeFloatLE\(1\.5F, 0\);/);
  assert.match(generatedSource, /floats\.writeDoubleBE\(2\.5, 4\);/);
  assert.match(generatedSource, /ints\.readUInt16LE\(0\)/);
  assert.match(generatedSource, /ints\.readInt16BE\(2\)/);
  assert.match(generatedSource, /ints\.readUInt32BE\(4\)/);
  assert.match(generatedSource, /floats\.readFloatLE\(0\)/);
  assert.match(generatedSource, /floats\.readDoubleBE\(4\)/);
  assert.doesNotMatch(generatedSource, /return Buffer\./);
  assert.doesNotMatch(generatedSource, /return randomInt\(/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedNodeBufferCrypto.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);

  const stdout = await runGeneratedCsharpRunner(projectDirectory, "SmokeGeneratedNodeBufferCrypto", [
    "using System;",
    "",
    "public static class Program",
    "{",
    "    public static void Main()",
    "    {",
    "        Console.WriteLine(Smoke.Generated.Index.numericRoundTrip());",
    "    }",
    "}",
    "",
  ]);
  assert.equal(stdout, "4660:-2:16909060:1.5:2.5\n");
});

test("CLI emits fs.statSync and path object operations from selected NodeJS declarations", async () => {
  const projectDirectory = resolve(tempRoot, "nodejs-fs-path-object-surface");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          surfaces: ["js"],
          packages: ["nodejs"],
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

test("CLI emits fs Stats Date members through selected NodeJS and JS surface facts", async () => {
  const projectDirectory = resolve(tempRoot, "nodejs-fs-stats-date-surface");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          surfaces: ["js"],
          packages: ["nodejs"],
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
  assert.match(generatedProject, /Tsonic\.CSharp\.Runtime\.csproj/);
  assert.match(generatedProject, /Tsonic\.CSharp\.Js\.csproj/);
  assert.match(generatedProject, /Tsonic\.CSharp\.Node\.csproj/);

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

test("CLI rejects fs Stats Date chains when NodeJS provider package is not selected", async () => {
  const projectDirectory = resolve(tempRoot, "nodejs-fs-stats-date-no-nodejs-surface");
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
            assemblyName: "SmokeGeneratedNodeFsStatsDateNoNodejsSurface",
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
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedNodeFsStatsDateNoNodejsSurface.csproj")), false);
});


test("CLI emits closed node:util string operations from selected NodeJS declarations", async () => {
  const projectDirectory = resolve(tempRoot, "nodejs-util-string-surface");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          surfaces: ["js"],
          packages: ["nodejs"],
          options: {
            namespace: "Smoke.Generated",
            assemblyName: "SmokeGeneratedNodeUtil",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { convertProcessSignalToExitCode, getSystemErrorMessage, getSystemErrorName, stripVTControlCharacters, styleText, toUSVString } from \"node:util\";",
      "import { stripVTControlCharacters as bareStrip } from \"util\";",
      "",
      "export function clean(input: string): string {",
      "  return stripVTControlCharacters(input);",
      "}",
      "",
      "export function normalize(input: string): string {",
      "  return toUSVString(input);",
      "}",
      "",
      "export function cleanBare(input: string): string {",
      "  return bareStrip(input);",
      "}",
      "",
      "export function styledError(input: string): string {",
      "  return styleText(\"red\", input) + getSystemErrorName(2) + getSystemErrorMessage(2);",
      "}",
      "",
      "export function signalExitCode(): number {",
      "  return convertProcessSignalToExitCode(\"SIGINT\");",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.util\.stripVTControlCharacters\(input\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.util\.toUSVString\(input\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.util\.styleText\("red", input\) \+ Tsonic\.CSharp\.Node\.util\.getSystemErrorName\(2\) \+ Tsonic\.CSharp\.Node\.util\.getSystemErrorMessage\(2\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.util\.convertProcessSignalToExitCode\("SIGINT"\);/);
  assert.doesNotMatch(generatedSource, /return stripVTControlCharacters\(/);
  assert.doesNotMatch(generatedSource, /return bareStrip\(/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedNodeUtil.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI rejects open-carrier node:util format operations without fallback", async () => {
  const projectDirectory = resolve(tempRoot, "nodejs-util-format-unsupported");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          surfaces: ["js"],
          packages: ["nodejs"],
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { format } from \"node:util\";",
      "",
      "export function render(value: unknown): string {",
      "  return format(\"%o\", value);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /C# NodeJS provider package hard-rejected selected call 'node:util' export 'format'/);
  assert.match(build.stderr, /System\.Object/);
  assert.doesNotMatch(build.stderr, /Reflection|dynamic|GetMethod|GetProperty/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
});

test("CLI rejects default node:util format operations without fallback", async () => {
  const projectDirectory = resolve(tempRoot, "nodejs-default-util-format-unsupported");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          surfaces: ["js"],
          packages: ["nodejs"],
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import util from \"node:util\";",
      "",
      "export function render(value: unknown): string {",
      "  return util.format(\"%o\", value);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /C# NodeJS provider package hard-rejected selected call 'node:util' export 'NodeUtilModule' member 'format'/);
  assert.match(build.stderr, /node:util\.format\(System\.Object,System\.Object\[\]\)/);
  assert.doesNotMatch(build.stderr, /Reflection|dynamic|GetMethod|GetProperty/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
});

test("CLI rejects other open-carrier node:util operations without fallback", async () => {
  const projectDirectory = resolve(tempRoot, "nodejs-util-open-carrier-unsupported");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          surfaces: ["js"],
          packages: ["nodejs"],
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { debuglog, deprecate, formatWithOptions, inspect, isDeepStrictEqual } from \"node:util\";",
      "",
      "export function render(value: unknown): boolean {",
      "  formatWithOptions({}, \"%o\", value);",
      "  inspect(value);",
      "  isDeepStrictEqual(value, value);",
      "  debuglog(\"demo\");",
      "  deprecate(() => {}, \"deprecated\");",
      "  return true;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /C# NodeJS provider package hard-rejected selected call 'node:util' export '(formatWithOptions|inspect|isDeepStrictEqual|debuglog|deprecate)'/);
  assert.doesNotMatch(build.stderr, /Reflection|dynamic|GetMethod|GetProperty|JsonSerializer|GetType/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
});

test("CLI emits closed node:url operations from selected NodeJS declarations", async () => {
  const projectDirectory = resolve(tempRoot, "nodejs-url-closed-surface");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          surfaces: ["js"],
          packages: ["nodejs"],
          options: {
            namespace: "Smoke.Generated",
            assemblyName: "SmokeGeneratedNodeUrl",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { URL, URLSearchParams, domainToASCII, fileURLToPath, format, pathToFileURL } from \"node:url\";",
      "import { resolve as bareResolve } from \"url\";",
      "",
      "export function href(input: string): string {",
      "  const parsed = new URL(input);",
      "  return parsed.href;",
      "}",
      "",
      "export function host(input: string): string {",
      "  return new URL(input).host;",
      "}",
      "",
      "export function accepts(input: string): boolean {",
      "  return URL.canParse(input);",
      "}",
      "",
      "export function acceptsRelative(input: string): boolean {",
      "  const parsed = new URL(input);",
      "  return URL.canParse(\"child\", parsed);",
      "}",
      "",
      "export function childHost(input: string): string {",
      "  const parsed = new URL(input);",
      "  return new URL(\"child\", parsed).host;",
      "}",
      "",
      "export function formatted(input: string): string {",
      "  const parsed = new URL(input);",
      "  return format(parsed);",
      "}",
      "",
      "export function roundTrip(path: string): string {",
      "  return fileURLToPath(pathToFileURL(path));",
      "}",
      "",
      "export function ascii(domain: string): string {",
      "  return domainToASCII(domain);",
      "}",
      "",
      "export function joined(from: string, to: string): string {",
      "  return bareResolve(from, to);",
      "}",
      "",
      "export function queryValue(input: string): string {",
      "  const params = new URLSearchParams(\"a=1\");",
      "  params.append(\"b\", input);",
      "  params.set(\"a\", \"2\");",
      "  return (params.get(\"a\") ?? \"\") + params.getAll(\"a\")[0] + params.toString();",
      "}",
      "",
      "export function querySize(): number {",
      "  return new URLSearchParams(\"a=1\").size;",
      "}",
      "",
      "export function liveQueryValue(input: string): string {",
      "  const parsed = new URL(\"https://example.com/?q=\" + input);",
      "  parsed.searchParams.append(\"page\", \"1\");",
      "  return parsed.searchParams.get(\"page\") ?? \"\";",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /new Tsonic\.CSharp\.Node\.URL\(input\)/);
  assert.match(generatedSource, /return parsed\.href;/);
  assert.match(generatedSource, /return new Tsonic\.CSharp\.Node\.URL\(input\)\.host;/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.URL\.canParse\(input\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.URL\.canParse\("child", parsed\);/);
  assert.match(generatedSource, /return new Tsonic\.CSharp\.Node\.URL\("child", parsed\)\.host;/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.url\.format\(parsed\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.url\.fileURLToPath\(Tsonic\.CSharp\.Node\.url\.pathToFileURL\(path\)\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.url\.domainToASCII\(domain\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.url\.resolve\(from, to\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.URLSearchParams @?params = new Tsonic\.CSharp\.Node\.URLSearchParams\("a=1"\);/);
  assert.match(generatedSource, /@?params\.append\("b", input\);/);
  assert.match(generatedSource, /@?params\.set\("a", "2"\);/);
  assert.match(generatedSource, /@?params\.get\("a"\) \?\? ""/);
  assert.match(generatedSource, /@?params\.getAll\("a"\)\[0\]/);
  assert.match(generatedSource, /@?params\.ToString\(\)/);
  assert.match(generatedSource, /return new Tsonic\.CSharp\.Node\.URLSearchParams\("a=1"\)\.size;/);
  assert.match(generatedSource, /parsed\.searchParams\.append\("page", "1"\);/);
  assert.match(generatedSource, /return parsed\.searchParams\.get\("page"\) \?\? "";/);
  assert.doesNotMatch(generatedSource, /return URL\./);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedNodeUrl.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);

  const stdout = await runGeneratedCsharpRunner(projectDirectory, "SmokeGeneratedNodeUrl", [
    "using System;",
    "using System.IO;",
    "",
    "public static class Program",
    "{",
    "    public static void Main()",
    "    {",
    "        const string input = \"https://example.com/a?b=1\";",
    "        var ascii = Smoke.Generated.Index.ascii(\"mañana.com\").StartsWith(\"xn--\") ? \"ascii\" : \"bad-ascii\";",
    "        var roundTrip = Smoke.Generated.Index.roundTrip(Path.Combine(Environment.CurrentDirectory, \"sample.txt\")).EndsWith(\"sample.txt\") ? \"round\" : \"bad-round\";",
    "        Console.WriteLine(string.Join(\"|\", new[]",
    "        {",
    "            Smoke.Generated.Index.href(input),",
    "            Smoke.Generated.Index.host(input),",
    "            Smoke.Generated.Index.accepts(input).ToString(),",
    "            Smoke.Generated.Index.acceptsRelative(input).ToString(),",
    "            Smoke.Generated.Index.childHost(input),",
    "            Smoke.Generated.Index.formatted(input),",
    "            ascii,",
    "            Smoke.Generated.Index.joined(\"https://example.com/a/\", \"../b\"),",
    "            roundTrip,",
    "            Smoke.Generated.Index.queryValue(\"x\"),",
    "            Smoke.Generated.Index.querySize().ToString(),",
    "            Smoke.Generated.Index.liveQueryValue(\"next\"),",
    "        }));",
    "    }",
    "}",
    "",
  ]);
  assert.equal(stdout, "https://example.com/a?b=1|example.com|True|True|example.com|https://example.com/a?b=1|ascii|https://example.com/b|round|22a=2&b=x|1|1\n");
});

test("CLI rejects open-object node:url format operations without fallback", async () => {
  const projectDirectory = resolve(tempRoot, "nodejs-url-format-unsupported");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          surfaces: ["js"],
          packages: ["nodejs"],
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { format } from \"node:url\";",
      "",
      "export function render(input: string): string {",
      "  return format({ href: input });",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /C# NodeJS provider package hard-rejected selected call 'node:url' export 'format'/);
  assert.match(build.stderr, /node:url|format|selected target signature fact|target binding/);
  assert.doesNotMatch(build.stderr, /Reflection|dynamic|GetMethod|GetProperty/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
});

test("CLI rejects unsupported node:url URLPattern operations without fallback", async () => {
  const projectDirectory = resolve(tempRoot, "nodejs-url-pattern-unsupported");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          surfaces: ["js"],
          packages: ["nodejs"],
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { URLPattern } from \"node:url\";",
      "",
      "export function accepts(input: string): boolean {",
      "  const pattern = new URLPattern(\"/books/:id\");",
      "  return pattern.test(input);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /C# NodeJS provider package hard-rejected selected call 'node:url' export 'URLPattern' member 'constructor'/);
  assert.match(build.stderr, /URLPattern\.constructor/);
  assert.doesNotMatch(build.stderr, /Reflection|dynamic|GetMethod|GetProperty/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
});

test("CLI rejects unsupported selected NodeJS provider operations without fallback", async () => {
  const projectDirectory = resolve(tempRoot, "nodejs-unsupported-selected-operation");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          surfaces: ["js"],
          packages: ["nodejs"],
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { watchFile } from \"node:fs\";",
      "",
      "export function watch(path: string): void {",
      "  watchFile(path, () => {});",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /C# NodeJS provider package hard-rejected selected call 'node:fs' export 'watchFile'/);
  assert.match(build.stderr, /node:fs\.watchFile/);
  assert.doesNotMatch(build.stderr, /watchFile is not a function/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
});

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
