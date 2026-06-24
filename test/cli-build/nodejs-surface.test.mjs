import { assert, cliPath, existsSync, readFile, resolve, run, runNode, tempRoot, test, writeProject } from "./harness.mjs";

test("CLI emits node:path and bare path joins from selected NodeJS surface provider facts", async () => {
  const projectDirectory = resolve(tempRoot, "nodejs-path-join-surface");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          surfaces: ["js", "nodejs"],
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


test("CLI rejects node:path imports when NodeJS surface is not selected", async () => {
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
          surfaces: ["js", "nodejs"],
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
          surfaces: ["js", "nodejs"],
          options: {
            namespace: "Smoke.Generated",
            assemblyName: "SmokeGeneratedNodeBufferCrypto",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { Buffer } from \"node:buffer\";",
      "import { randomInt, getHashes } from \"node:crypto\";",
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
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.Buffer\.from\("hello"\)\.toString\(\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.Buffer\.alloc\(3\)\.length;/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.Buffer\.byteLength\("hello"\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.Buffer\.isEncoding\("utf8"\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.crypto\.randomInt\(10\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.crypto\.randomInt\(1, 10\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.crypto\.getHashes\(\)\[0\];/);
  assert.doesNotMatch(generatedSource, /return Buffer\./);
  assert.doesNotMatch(generatedSource, /return randomInt\(/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedNodeBufferCrypto.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
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
          surfaces: ["js", "nodejs"],
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { watchFile } from \"node:fs\";",
      "",
      "export function watch(path: string): void {",
      "  watchFile(path);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /CSHARP_UNSUPPORTED_AST/);
  assert.match(build.stderr, /selected target signature fact|target binding/);
  assert.doesNotMatch(build.stderr, /watchFile is not a function/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
});
