import { assert, assertRuntimeProjectReference, cliPath, existsSync, readFile, resolve, run, runGeneratedProject, runNode, targetCsharpNodejsPackageJson, targetCsharpOnlyPackageJson, tempRoot, test, writeProject } from "../../helpers/harness.mjs";

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
  assertRuntimeProjectReference(generatedProject, "Tsonic.CSharp.Runtime");
  assertRuntimeProjectReference(generatedProject, "Tsonic.CSharp.Js");
  assertRuntimeProjectReference(generatedProject, "Tsonic.CSharp.Node");

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
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.String\.trim\(global::Smoke\.Generated\.Index\.platformLine\(\)\)/);
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

test("CLI rejects remaining unsupported historical NodeJS alias imports without fallback", async () => {
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
      "import * as dgram from \"node:dgram\";",
      "import * as querystring from \"node:querystring\";",
      "",
      "export function loaded(): number {",
      "  void dgram;",
      "  void querystring;",
      "  return 1;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  for (const moduleSpecifier of [
    "node:dgram",
    "node:querystring",
  ]) {
    assert.match(build.stderr, new RegExp(moduleSpecifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(build.stderr, /TSTS_DIAGNOSTIC/);
  assert.doesNotMatch(build.stderr, /Reflection|dynamic|GetMethod|GetProperty/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
});
