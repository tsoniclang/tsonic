import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { assert, cliPath, existsSync, readFile, repoRoot, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "./harness.mjs";

const bannedGeneratedRuntimeSemantics = [
  /\bdynamic\b/u,
  /\bSystem\.Reflection\b/u,
  /\bGetProperty\b/u,
  /\bGetProperties\b/u,
  /\bGetMethod\b/u,
  /\bGetMethods\b/u,
  /\bMethodInfo\.Invoke\b/u,
  /\bMakeGenericMethod\b/u,
  /\bActivator\.CreateInstance\b/u,
  /\bAssembly\.Load\b/u,
];



















test("CLI emits module-scope variables as C# static fields", async () => {
  const projectDirectory = resolve(tempRoot, "module-fields");
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
            assemblyName: "SmokeGeneratedModuleFields",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "let total = 1;",
      "",
      "export function bump(): number {",
      "  total = total + 1;",
      "  return total;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static double total;/);
  assert.match(generatedSource, /static Index\(\)/);
  assert.match(generatedSource, /total = 1;/);
  assert.match(generatedSource, /total = total \+ 1;/);
  assert.doesNotMatch(generatedSource, /public static void Main\(\)/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedModuleFields.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});
test("CLI emits module-scope const bindings as C# static readonly fields", async () => {
  const projectDirectory = resolve(tempRoot, "module-const-fields");
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
            assemblyName: "SmokeGeneratedModuleConstFields",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "const total = 1;",
      "",
      "export function read(): number {",
      "  return total;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static readonly double total;/);
  assert.match(generatedSource, /static Index\(\)/);
  assert.match(generatedSource, /total = 1;/);
  assert.doesNotMatch(generatedSource, /public static double total = 1;/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedModuleConstFields.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});
test("CLI erases source-local standalone export declarations", async () => {
  const projectDirectory = resolve(tempRoot, "standalone-export-declaration");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp" }],
    }, null, 2),
    "src/index.ts": [
      "const value = 1;",
      "export { value };",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static readonly double value;/);
  assert.match(generatedSource, /static Index\(\)/);
  assert.match(generatedSource, /value = 1;/);
  assert.doesNotMatch(generatedSource, /export|__unsupported/);
});
test("CLI emits cross-file source references from TSTS resolved symbols", async () => {
  const projectDirectory = resolve(tempRoot, "cross-file-source-reference");
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
            assemblyName: "SmokeGeneratedCrossFileReferences",
          },
        },
      ],
    }, null, 2),
    "src/math.ts": [
      "export const seed = 1;",
      "",
      "export function add(value: number): number {",
      "  return value + seed;",
      "}",
      "",
    ].join("\n"),
    "src/index.ts": [
      "import { add, seed } from \"./math.js\";",
      "",
      "export function read(): number {",
      "  return add(seed);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /return Math\.add\(Math\.seed\);/);
  assert.doesNotMatch(generatedSource, /return add\(seed\);/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedCrossFileReferences.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});
test("CLI emits only files reachable from the TSTS source module graph", async () => {
  const projectDirectory = resolve(tempRoot, "reachable-source-graph-only");
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
            outputType: "Exe",
            namespace: "Smoke.Generated",
            assemblyName: "SmokeGeneratedReachableSourceGraph",
          },
        },
      ],
    }, null, 2),
    "src/used.ts": [
      "export const value = 1;",
      "",
    ].join("\n"),
    "src/orphan.ts": [
      "console.log(\"orphan\");",
      "export const value = 99;",
      "",
    ].join("\n"),
    "src/index.ts": [
      "import { value } from \"./used.js\";",
      "console.log(value);",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/src/Index.cs")), true);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/src/Used.cs")), true);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/src/Orphan.cs")), false);

  const indexSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(indexSource, /Used\.__tsonic_module_init\(\);/);
  assert.match(indexSource, /Tsonic\.CSharp\.Js\.console\.log\(Used\.value\);/);
  assert.doesNotMatch(indexSource, /Orphan|__unsupported/);

  const output = runGeneratedProject(projectDirectory, "SmokeGeneratedReachableSourceGraph");
  assert.equal(output, "1\n");
});
test("CLI emits side-effect import initialization before importer top-level statements", async () => {
  const projectDirectory = resolve(tempRoot, "side-effect-import-order");
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
            outputType: "Exe",
            namespace: "Smoke.Generated",
            assemblyName: "SmokeGeneratedSideEffectImportOrder",
          },
        },
      ],
    }, null, 2),
    "src/state.ts": [
      "export let text = \"\";",
      "export function append(value: string): void {",
      "  text = text + value;",
      "}",
      "",
    ].join("\n"),
    "src/side.ts": [
      "import { append } from \"./state.js\";",
      "append(\"side;\");",
      "",
    ].join("\n"),
    "src/index.ts": [
      "import \"./side.js\";",
      "import { append, text } from \"./state.js\";",
      "append(\"index;\");",
      "console.log(text);",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const indexSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(indexSource, /static Index\(\)/);
  assert.match(indexSource, /Side\.__tsonic_module_init\(\);[\s\S]*State\.__tsonic_module_init\(\);[\s\S]*State\.append\("index;"\);/);
  assert.doesNotMatch(indexSource, /__unsupported/);

  const sideSource = await readFile(resolve(projectDirectory, "out/csharp/src/Side.cs"), "utf8");
  assert.match(sideSource, /static Side\(\)/);
  assert.match(sideSource, /State\.__tsonic_module_init\(\);[\s\S]*State\.append\("side;"\);/);
  assert.doesNotMatch(sideSource, /__unsupported/);

  const stateSource = await readFile(resolve(projectDirectory, "out/csharp/src/State.cs"), "utf8");
  assert.match(stateSource, /public static string text;/);
  assert.match(stateSource, /text = "";/);
  assert.doesNotMatch(stateSource, /__unsupported/);

  const output = runGeneratedProject(projectDirectory, "SmokeGeneratedSideEffectImportOrder");
  assert.equal(output, "side;index;\n");
});
test("CLI rejects invalid TSTS module export and import bindings before artifact emission", async () => {
  const scenarios = [
    {
      name: "missing-named-import",
      files: {
        "src/module.ts": "export const value = 1;\n",
        "src/index.ts": "import { missing } from \"./module.js\";\nexport const result = missing;\n",
      },
      diagnostic: /missing/u,
    },
    {
      name: "missing-default-import",
      files: {
        "src/module.ts": "export const value = 1;\n",
        "src/index.ts": "import value from \"./module.js\";\nexport const result = value;\n",
      },
      diagnostic: /default/u,
    },
    {
      name: "missing-reexport",
      files: {
        "src/module.ts": "export const value = 1;\n",
        "src/index.ts": "export { missing } from \"./module.js\";\n",
      },
      diagnostic: /missing/u,
    },
    {
      name: "type-only-import-used-as-value",
      files: {
        "src/types.ts": "export interface Marker { value: number; }\n",
        "src/index.ts": "import type { Marker } from \"./types.js\";\nexport const result = Marker;\n",
      },
      diagnostic: /Marker/u,
    },
  ];

  for (const scenario of scenarios) {
    const projectDirectory = resolve(tempRoot, scenario.name);
    await writeProject(projectDirectory, {
      "tsonic.json": JSON.stringify({
        entryPoint: "index.ts",
        rootDir: "src",
        outDir: "out",
        targets: [{ id: "csharp" }],
      }, null, 2),
      ...scenario.files,
    });

    const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
    assert.equal(build.status, 1, scenario.name);
    assert.match(build.stderr, /TSTS_DIAGNOSTIC/u, scenario.name);
    assert.match(build.stderr, scenario.diagnostic, scenario.name);
    assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false, scenario.name);
  }
});
test("CLI does not run type-only module dependencies during initialization", async () => {
  const projectDirectory = resolve(tempRoot, "type-only-import-order");
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
            outputType: "Exe",
            namespace: "Smoke.Generated",
            assemblyName: "SmokeGeneratedTypeOnlyImportOrder",
          },
        },
      ],
    }, null, 2),
    "src/state.ts": [
      "export let text = \"\";",
      "export function append(value: string): void {",
      "  text = text + value;",
      "}",
      "",
    ].join("\n"),
    "src/types.ts": [
      "import { append } from \"./state.js\";",
      "append(\"types;\");",
      "export interface Marker {",
      "  value: number;",
      "}",
      "export interface Named {",
      "  name: string;",
      "}",
      "",
    ].join("\n"),
    "src/index.ts": [
      "import { append, text } from \"./state.js\";",
      "import type { Marker } from \"./types.js\";",
      "import { type Named } from \"./types.js\";",
      "const marker: Marker = { value: 1 };",
      "const named: Named = { name: \"item\" };",
      "append(`index:${marker.value}:${named.name};`);",
      "console.log(text);",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const indexSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(indexSource, /State\.__tsonic_module_init\(\);/);
  assert.doesNotMatch(indexSource, /Types\.__tsonic_module_init\(\);/);
  assert.match(indexSource, /__TsonicShape_Marker_[A-Za-z0-9_]+/);
  assert.match(indexSource, /__TsonicShape_Named_[A-Za-z0-9_]+/);

  const typesSource = await readFile(resolve(projectDirectory, "out/csharp/src/Types.cs"), "utf8");
  assert.match(typesSource, /State\.append\("types;"\);/);

  const output = runGeneratedProject(projectDirectory, "SmokeGeneratedTypeOnlyImportOrder");
  assert.equal(output, "index:1:item;\n");
});
test("CLI emits namespace-import source references from TSTS resolved symbols", async () => {
  const projectDirectory = resolve(tempRoot, "namespace-import-source-reference");
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
            assemblyName: "SmokeGeneratedNamespaceImportReferences",
          },
        },
      ],
    }, null, 2),
    "src/math.ts": [
      "export const seed = 1;",
      "",
      "export function add(value: number): number {",
      "  return value + seed;",
      "}",
      "",
    ].join("\n"),
    "src/index.ts": [
      "import * as math from \"./math.js\";",
      "",
      "export function read(): number {",
      "  return math.add(math.seed);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /return Math\.add\(Math\.seed\);/);
  assert.doesNotMatch(generatedSource, /math\.add|math\.seed|__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedNamespaceImportReferences.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});
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
  assert.match(generatedSource, /return Other\.value;/);
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
  assert.match(otherSource, /public static readonly double @default = value;/);
  assert.doesNotMatch(otherSource, /__unsupported/);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /return Other\.@default;/);
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
  assert.match(generatedSource, /return Service\.compute\(1\) \+ Service\.compute\(2\);/);
  assert.match(generatedSource, /Service\.__tsonic_module_init\(\);[\s\S]*Barrel\.__tsonic_module_init\(\);/);
  assert.doesNotMatch(generatedSource, /directCompute|Barrel\.compute|__unsupported/);

  const barrelSource = await readFile(resolve(projectDirectory, "out/csharp/src/Barrel.cs"), "utf8");
  assert.match(barrelSource, /Service\.__tsonic_module_init\(\);/);
  assert.doesNotMatch(barrelSource, /compute|__unsupported/);

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
  assert.match(generatedSource, /return Other\.value \+ Math\.add\(Math\.seed\) \+ Math\.seed;/);
  assert.doesNotMatch(generatedSource, /answer|math\.seed|add\(seed\)|__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedModuleExportForms.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});