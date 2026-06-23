import { assert, cliPath, existsSync, readFile, resolve, run, runNode, tempRoot, test, writeProject } from "./harness.mjs";

test("CLI emits node:path join from selected NodeJS surface provider facts", async () => {
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
      "",
      "export function tenantPath(tenantId: string): string {",
      "  return join(\"uploads\", tenantId, \"events.json\");",
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
      "import * as fs from \"node:fs\";",
      "import * as crypto from \"node:crypto\";",
      "import * as os from \"node:os\";",
      "import * as process from \"node:process\";",
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
