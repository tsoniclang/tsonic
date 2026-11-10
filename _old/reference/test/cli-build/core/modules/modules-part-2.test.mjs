import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { assert, cliPath, existsSync, readFile, repoRoot, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";

test("CLI erases re-export declarations and uses TSTS symbols for re-exported source values", async () => {
  const projectDirectory = resolve(tempRoot, "re-export-declaration");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          options: {
            namespace: "Smoke.Generated",
            assemblyName: "SmokeGeneratedReExportReferences",
          },
        },
      ],
    }, null, 2),
    "src/other.ts": "export const value = 1;\n",
    "src/barrel.ts": [
      "export { value } from \"./other.js\";",
      "",
    ].join("\n"),
    "src/index.ts": [
      "import { value } from \"./barrel.js\";",
      "",
      "export function read(): number {",
      "  return value;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /return global::Smoke\.Generated\.Other\.value;/);
  assert.doesNotMatch(generatedSource, /return value;/);
  assert.doesNotMatch(generatedSource, /export|__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedReExportReferences.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits default export expression snapshots through TSTS module-export symbols", async () => {
  const projectDirectory = resolve(tempRoot, "default-export-expression");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          options: {
            namespace: "Smoke.Generated",
            assemblyName: "SmokeGeneratedDefaultExportExpression",
          },
        },
      ],
    }, null, 2),
    "src/other.ts": [
      "let value = 1;",
      "export default value;",
      "value = 2;",
      "",
    ].join("\n"),
    "src/index.ts": [
      "import value from \"./other.js\";",
      "",
      "export function read(): number {",
      "  return value;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const otherSource = await readFile(resolve(projectDirectory, "out/csharp/src/Other.cs"), "utf8");
  assert.match(otherSource, /public static double @default\s*\{\s*get;\s*private set;\s*\} = default\(double\)!;/);
  assert.match(otherSource, /value = 1;\s*@default = global::Smoke\.Generated\.Other\.value;\s*global::Smoke\.Generated\.Other\.value = 2;/);
  assert.doesNotMatch(otherSource, /__unsupported/);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /return global::Smoke\.Generated\.Other\.@default;/);
  assert.doesNotMatch(generatedSource, /return Other\.value;|return value;|__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedDefaultExportExpression.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits default function imports and default re-exports from TSTS module-export symbols", async () => {
  const projectDirectory = resolve(tempRoot, "default-function-re-export");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          options: {
            namespace: "Smoke.Generated",
            assemblyName: "SmokeGeneratedDefaultFunctionReExport",
          },
        },
      ],
    }, null, 2),
    "src/service.ts": [
      "export default function compute(value: number): number {",
      "  return value + 1;",
      "}",
      "",
    ].join("\n"),
    "src/barrel.ts": [
      "export { default as compute } from \"./service.js\";",
      "",
    ].join("\n"),
    "src/index.ts": [
      "import directCompute from \"./service.js\";",
      "import { compute } from \"./barrel.js\";",
      "",
      "export function read(): number {",
      "  return directCompute(1) + compute(2);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /return global::Smoke\.Generated\.Service\.compute\(1\) \+ global::Smoke\.Generated\.Service\.compute\(2\);/);
  assert.doesNotMatch(generatedSource, /(?:Service|Barrel)\.__tsonic_module_init\(\);/);
  assert.doesNotMatch(generatedSource, /directCompute|Barrel\.compute|__unsupported/);

  await assert.rejects(
    readFile(resolve(projectDirectory, "out/csharp/src/Barrel.cs"), "utf8"),
    { code: "ENOENT" },
  );

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedDefaultFunctionReExport.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits aliased star and namespace re-exports from TSTS module-export symbols", async () => {
  const projectDirectory = resolve(tempRoot, "module-export-forms");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          options: {
            namespace: "Smoke.Generated",
            assemblyName: "SmokeGeneratedModuleExportForms",
          },
        },
      ],
    }, null, 2),
    "src/other.ts": "export const value = 1;\n",
    "src/math.ts": [
      "export const seed = 2;",
      "export function add(value: number): number {",
      "  return value + seed;",
      "}",
      "",
    ].join("\n"),
    "src/barrel.ts": [
      "export { value as answer } from \"./other.js\";",
      "export * from \"./math.js\";",
      "export * as math from \"./math.js\";",
      "",
    ].join("\n"),
    "src/index.ts": [
      "import { answer, add, seed, math } from \"./barrel.js\";",
      "",
      "export function read(): number {",
      "  return answer + add(seed) + math.seed;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /return global::Smoke\.Generated\.Other\.value \+ global::Smoke\.Generated\.Math\.add\(global::Smoke\.Generated\.Math\.seed\) \+ global::Smoke\.Generated\.Math\.seed;/);
  assert.doesNotMatch(generatedSource, /answer|math\.seed|add\(seed\)|__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedModuleExportForms.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});
