import { assert, cliPath, existsSync, readFile, resolve, run, runGeneratedProject, runNode, targetCsharpNodejsPackageJson, targetCsharpOnlyPackageJson, tempRoot, test, writeProject } from "./harness.mjs";

test("CLI builds and runs existing Node-style code when Node provider package is selected", async () => {
  const projectDirectory = resolve(tempRoot, "existing-node-provider-package-code");
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
            assemblyName: "SmokeGeneratedExistingNodeProviderPackageCode",
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
      "Console.WriteLine(`${assetName(\"root\", \"file.txt\")}|${encoded(\"ok\")}|${runId().length}|${firstArg().length > 0 ? \"argv\" : \"missing\"}|${platformLine().trim().length > 0 ? \"platform\" : \"missing\"}`);",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedProject = await readFile(resolve(projectDirectory, "out/csharp/SmokeGeneratedExistingNodeProviderPackageCode.csproj"), "utf8");
  assert.match(generatedProject, /<Reference Include="Tsonic\.CSharp\.Runtime" HintPath="[^"]*Tsonic\.CSharp\.Runtime\.dll" \/>/);
  assert.match(generatedProject, /<Reference Include="Tsonic\.CSharp\.Js" HintPath="[^"]*Tsonic\.CSharp\.Js\.dll" \/>/);
  assert.match(generatedProject, /<Reference Include="Tsonic\.CSharp\.Node" HintPath="[^"]*Tsonic\.CSharp\.Node\.dll" \/>/);

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

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedExistingNodeProviderPackageCode.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
  assert.equal(runGeneratedProject(projectDirectory, "SmokeGeneratedExistingNodeProviderPackageCode"), "file.txt.txt|ok|36|argv|platform\n");
});

test("CLI rejects Node-style builtins when Node provider package is unselected", async () => {
  const projectDirectory = resolve(tempRoot, "existing-node-style-code-without-node-provider-package");
  await writeProject(projectDirectory, {
    "package.json": targetCsharpOnlyPackageJson("existing-node-style-code-without-node-provider-package"),
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

test("CLI rejects unsupported Node provider-package modules without fallback", async () => {
  const projectDirectory = resolve(tempRoot, "unsupported-nodejs-provider-package-module-import");
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
    "node:net",
    "node:querystring",
    "node:readline",
    "node:stream",
    "node:tls",
    "node:zlib",
  ]) {
    assert.match(build.stderr, new RegExp(moduleSpecifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(build.stderr, /TSTS_DIAGNOSTIC/);
  assert.match(build.stderr, /Cannot find name 'node:child_process'/);
  assert.doesNotMatch(build.stderr, /Reflection|dynamic|GetMethod|GetProperty/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
});

test("CLI accepts provider-owned Node type imports without adding a runtime reference", async () => {
  const projectDirectory = resolve(tempRoot, "unsupported-nodejs-type-only-alias-imports");
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
  assert.equal(build.status, 0, build.stdout + build.stderr);
  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static double loaded\(\)[\s\S]*return 1;/u);
  assert.doesNotMatch(generatedSource, /IncomingMessage|ServerResponse|Reflection|dynamic|GetMethod|GetProperty/u);
  const generatedProject = await readFile(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj"), "utf8");
  assert.doesNotMatch(generatedProject, /Tsonic\.CSharp\.Node/u);
  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits NodeJS namespace imports from selected provider-package facts", async () => {
  const projectDirectory = resolve(tempRoot, "nodejs-module-graph-provider-package");
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
  assert.match(generatedProject, /<Reference Include="Tsonic\.CSharp\.Runtime" HintPath="[^"]*Tsonic\.CSharp\.Runtime\.dll" \/>/);
  assert.match(generatedProject, /<Reference Include="Tsonic\.CSharp\.Js" HintPath="[^"]*Tsonic\.CSharp\.Js\.dll" \/>/);
  assert.match(generatedProject, /<Reference Include="Tsonic\.CSharp\.Node" HintPath="[^"]*Tsonic\.CSharp\.Node\.dll" \/>/);

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

test("CLI runs Node provider-package runtime operations from selected facts", async () => {
  const assemblyName = "SmokeGeneratedNodeProviderRuntime";
  const projectDirectory = resolve(tempRoot, "nodejs-provider-package-runtime");
  const runtimeRoot = JSON.stringify(projectDirectory);
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
      "import { accessSync, appendFileSync, chmodSync, copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, readlinkSync, realpathSync, renameSync, rmSync, rmdirSync, statSync, symlinkSync, truncateSync, unlinkSync, writeFileSync } from \"node:fs\";",
      "import os from \"node:os\";",
      "import path from \"node:path\";",
      "import process from \"node:process\";",
      "import { URL, fileURLToPath, pathToFileURL } from \"node:url\";",
      "import { toUSVString } from \"node:util\";",
      "",
      `const runtimeRoot = ${runtimeRoot};`,
      "const filePath = path.join(runtimeRoot, \"tsonic-slice8-node-provider-runtime.txt\");",
      "writeFileSync(filePath, \"hello\", \"utf8\");",
      "const text = readFileSync(filePath, \"utf8\");",
      "const directoryPath = path.join(runtimeRoot, \"tsonic-slice8-node-provider-runtime-dir\");",
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
      "accessSync(filePath);",
      "chmodSync(filePath, 420);",
      "const descriptorPath = path.join(directoryPath, \"descriptor.txt\");",
      "writeFileSync(descriptorPath, \"Zlong\", \"utf8\");",
      "truncateSync(descriptorPath, 1);",
      "const descriptorText = readFileSync(descriptorPath, \"utf8\");",
      "const emptyDir = path.join(directoryPath, \"empty\");",
      "mkdirSync(emptyDir, true);",
      "rmdirSync(emptyDir, true);",
      "const linkPath = path.join(directoryPath, \"descriptor-link.txt\");",
      "symlinkSync(descriptorPath, linkPath);",
      "const linkText = readlinkSync(linkPath).length > 0 && realpathSync(linkPath).length > 0 ? \"link\" : \"missing-link\";",
      "const copyDirectoryPath = path.join(runtimeRoot, \"tsonic-slice8-node-provider-runtime-copy\");",
      "cpSync(directoryPath, copyDirectoryPath, true);",
      "const copiedDescriptorText = readFileSync(path.join(copyDirectoryPath, \"descriptor.txt\"), \"utf8\");",
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
      "Console.WriteLine(`${path.basename(roundTrip)}|${text}|${bytes.toString()}|${hash.length}|${randomUUID().length}|${existsText}|${kindText}|${osText}|${toUSVString(\"ok\")}|${urlText}|${fsSyncText}|${descriptorText}:${copiedDescriptorText}:${linkText}`);",
      "unlinkSync(filePath);",
      "rmSync(copyDirectoryPath, true);",
      "rmSync(directoryPath, true);",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedProject = await readFile(resolve(projectDirectory, `out/csharp/${assemblyName}.csproj`), "utf8");
  assert.match(generatedProject, /<Reference Include="Tsonic\.CSharp\.Runtime" HintPath="[^"]*Tsonic\.CSharp\.Runtime\.dll" \/>/);
  assert.match(generatedProject, /<Reference Include="Tsonic\.CSharp\.Js" HintPath="[^"]*Tsonic\.CSharp\.Js\.dll" \/>/);
  assert.match(generatedProject, /<Reference Include="Tsonic\.CSharp\.Node" HintPath="[^"]*Tsonic\.CSharp\.Node\.dll" \/>/);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.fs\.writeFileSync\(filePath, "hello", "utf8"\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.fs\.readFileSync\(filePath, "utf8"\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.fs\.mkdirSync\(directoryPath, true\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.fs\.appendFileSync\(firstPath, "b", "utf8"\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.fs\.copyFileSync\(firstPath, secondPath\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.fs\.renameSync\(secondPath, renamedPath\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.fs\.readdirSync\(directoryPath\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.fs\.accessSync\(filePath\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.fs\.chmodSync\(filePath, 420\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.fs\.truncateSync\(descriptorPath, 1\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.fs\.rmdirSync\(emptyDir, true\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.fs\.symlinkSync\(descriptorPath, linkPath\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.fs\.readlinkSync\(linkPath\)/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.fs\.realpathSync\(linkPath\)/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.fs\.cpSync\(directoryPath, copyDirectoryPath, true\);/);
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
    "tsonic-slice8-node-provider-runtime.txt|hello|hello|64|36|exists|file|platform|ok|url-live|ab:renamed:listed|Z:Z:link\n",
  );
});
