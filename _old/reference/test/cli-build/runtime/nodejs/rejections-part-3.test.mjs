import { assert, assertRuntimeProjectReference, cliPath, existsSync, readFile, resolve, run, runGeneratedProject, runNode, targetCsharpNodejsPackageJson, targetCsharpOnlyPackageJson, tempRoot, test, writeProject } from "../../helpers/harness.mjs";

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
  assertRuntimeProjectReference(generatedProject, "Tsonic.CSharp.Runtime");
  assertRuntimeProjectReference(generatedProject, "Tsonic.CSharp.Js");
  assertRuntimeProjectReference(generatedProject, "Tsonic.CSharp.Node");

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
