import { assert, cliPath, existsSync, readFile, resolve, run, runNode, tempRoot, test, writeProject } from "./harness.mjs";

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

test("CLI compiles existing Node-style code when NodeJS provider package is selected", async () => {
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
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { existsSync, statSync } from \"node:fs\";",
      "import { basename, extname, join, resolve } from \"node:path\";",
      "import * as nodeProcess from \"node:process\";",
      "import * as nodeOs from \"node:os\";",
      "import { Buffer } from \"node:buffer\";",
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
  assert.doesNotMatch(generatedSource, /return existsSync\(/);
  assert.doesNotMatch(generatedSource, /return Buffer\./);
  assert.doesNotMatch(generatedSource, /return randomUUID\(/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedExistingNodeStyleSurfaceCode.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
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
      "import { readFile, stat, unlink, writeFile } from \"node:fs/promises\";",
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
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /return await Tsonic\.CSharp\.Node\.fs_promises\.readFile\(path, "utf8"\);/);
  assert.match(generatedSource, /await Tsonic\.CSharp\.Node\.fs_promises\.writeFile\(path, text, "utf8"\);/);
  assert.match(generatedSource, /await Tsonic\.CSharp\.Node\.fs_promises\.stat\(path\);/);
  assert.match(generatedSource, /await Tsonic\.CSharp\.Node\.fs_promises\.unlink\(path\);/);
  assert.doesNotMatch(generatedSource, /return readFile\(/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedNodeFsPromises.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
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
      "  return process.arch + process.argv0 + process.execPath + process.platform + process.version + process.versions.node + process.versions.dotnet + pathValue + process.pid + process.ppid;",
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
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.process\.exitCode;/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.process\.chdir\(directory\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.process\.exit\(code\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.process\.kill\(Tsonic\.CSharp\.Node\.process\.pid, 0\);/);
  assert.doesNotMatch(generatedSource, /return process\./);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedNodeProcessExpanded.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
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
      "import { Buffer } from \"node:buffer\";",
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
  assert.doesNotMatch(generatedSource, /return Buffer\./);
  assert.doesNotMatch(generatedSource, /return randomInt\(/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedNodeBufferCrypto.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
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
      "import { stripVTControlCharacters, toUSVString } from \"node:util\";",
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
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.util\.stripVTControlCharacters\(input\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.util\.toUSVString\(input\);/);
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
      "import { URL, domainToASCII, fileURLToPath, format, pathToFileURL } from \"node:url\";",
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
  assert.doesNotMatch(generatedSource, /return URL\./);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedNodeUrl.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
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
