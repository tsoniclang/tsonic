import { assert, assertRuntimeProjectReference, cliPath, existsSync, readFile, resolve, run, runGeneratedCsharpRunner, runGeneratedProject, runNode, targetCsharpNodejsPackageJson, targetCsharpOnlyPackageJson, tempRoot, test, writeProject } from "../../helpers/harness.mjs";

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
  assert.doesNotMatch(generatedSource, /(?:Pathing|SystemInfo|FileState)\.__tsonic_module_init\(\);/);
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
