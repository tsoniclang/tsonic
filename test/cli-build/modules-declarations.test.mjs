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

test("CLI preserves export-star module initialization before re-exported values are read", async () => {
  const projectDirectory = resolve(tempRoot, "export-star-module-init-order");
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
            assemblyName: "SmokeGeneratedExportStarModuleInitOrder",
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
      "export const sideValue = 1;",
      "",
    ].join("\n"),
    "src/barrel.ts": [
      "export * from \"./side.js\";",
      "",
    ].join("\n"),
    "src/index.ts": [
      "import { sideValue } from \"./barrel.js\";",
      "",
      "export function read(): number {",
      "  return sideValue;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const indexSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(indexSource, /return Side\.sideValue;/);
  assert.match(indexSource, /static Index\(\)/);
  assert.match(indexSource, /Barrel\.__tsonic_module_init\(\);/);
  assert.doesNotMatch(indexSource, /return sideValue;|__unsupported/);

  const barrelSource = await readFile(resolve(projectDirectory, "out/csharp/src/Barrel.cs"), "utf8");
  assert.match(barrelSource, /static Barrel\(\)/);
  assert.match(barrelSource, /Side\.__tsonic_module_init\(\);/);
  assert.doesNotMatch(barrelSource, /__unsupported/);

  const sideSource = await readFile(resolve(projectDirectory, "out/csharp/src/Side.cs"), "utf8");
  assert.match(sideSource, /State\.__tsonic_module_init\(\);[\s\S]*State\.append\("side;"\);[\s\S]*sideValue = 1;/);
  assert.doesNotMatch(sideSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedExportStarModuleInitOrder.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});


test("CLI rejects anonymous exported declarations instead of synthesizing C# names", async () => {
  const scenarios = [
    {
      name: "anonymous-default-function",
      source: [
        "export default function (): number {",
        "  return 1;",
        "}",
        "",
      ].join("\n"),
      diagnostic: /Function name must be present/,
    },
    {
      name: "anonymous-default-class",
      source: [
        "export default class {",
        "  value: number = 1;",
        "}",
        "",
      ].join("\n"),
      diagnostic: /Class name must be present/,
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
      "src/index.ts": scenario.source,
    });

    const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
    assert.equal(build.status, 1);
    assert.match(build.stderr, scenario.diagnostic);
    assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
  }
});


test("CLI emits standard JavaScript static class members", async () => {
  const projectDirectory = resolve(tempRoot, "static-class-members");
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
            assemblyName: "SmokeGeneratedStaticMembers",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export class MathBox {",
      "  static count: number = 1;",
      "",
      "  static add(left: number, right: number): number {",
      "    return left + right;",
      "  }",
      "}",
      "",
      "export function useStatic(): number {",
      "  return MathBox.add(MathBox.count, 2);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static double count = 1;/);
  assert.match(generatedSource, /public static double add\(double left, double right\)/);
  assert.match(generatedSource, /return MathBox\.add\(MathBox\.count, 2\);/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedStaticMembers.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});


test("CLI emits standard JavaScript class accessors as C# properties", async () => {
  const projectDirectory = resolve(tempRoot, "class-accessors");
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
            assemblyName: "SmokeGeneratedAccessors",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export class AccessorBox {",
      "  backing: number = 1;",
      "",
      "  get doubled(): number {",
      "    return this.backing * 2;",
      "  }",
      "",
      "  set doubled(next: number) {",
      "    this.backing = next / 2;",
      "  }",
      "}",
      "",
      "export function useAccessor(box: AccessorBox): number {",
      "  box.doubled = 10;",
      "  return box.doubled;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public double doubled/);
  assert.match(generatedSource, /get/);
  assert.match(generatedSource, /set/);
  assert.match(generatedSource, /return this\.backing \* 2;/);
  assert.match(generatedSource, /double next = value;/);
  assert.match(generatedSource, /this\.backing = next \/ 2;/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedAccessors.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI preserves JavaScript class field dispatch through C# properties", async () => {
  const projectDirectory = resolve(tempRoot, "class-field-dispatch-properties");
  const assemblyName = "SmokeGeneratedClassFieldDispatch";
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
            outputType: "Exe",
            assemblyName,
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { Console } from \"@tsonic/dotnet/System.js\";",
      "",
      "class Base {",
      "  value: string = \"base\";",
      "",
      "  print(): void {",
      "    Console.WriteLine(this.value);",
      "  }",
      "}",
      "",
      "class Derived extends Base {",
      "  value: string = \"derived\";",
      "}",
      "",
      "const box: Base = new Derived();",
      "box.print();",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public virtual string value\s*\{\s*get;\s*set;\s*\}\s*=\s*"base";/);
  assert.match(generatedSource, /public override string value\s*\{\s*get;\s*set;\s*\}\s*=\s*"derived";/);
  assert.doesNotMatch(generatedSource, /public string value;/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  assert.equal(runGeneratedProject(projectDirectory, assemblyName), "derived\n");
});


test("CLI emits standard JavaScript private identifiers as private C# members", async () => {
  const projectDirectory = resolve(tempRoot, "private-identifiers");
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
            assemblyName: "SmokeGeneratedPrivateIdentifiers",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export class PrivateBox {",
      "  #value: number = 1;",
      "",
      "  get value(): number {",
      "    return this.#value;",
      "  }",
      "",
      "  bump(): number {",
      "    this.#value++;",
      "    return this.#value;",
      "  }",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /private double _value = 1;/);
  assert.match(generatedSource, /public double value/);
  assert.match(generatedSource, /return this\._value;/);
  assert.match(generatedSource, /this\._value\+\+;/);
  assert.doesNotMatch(generatedSource, /#value/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedPrivateIdentifiers.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});


test("CLI rejects TypeScript-only runtime-shape modifiers before C# emission", async () => {
  const projectDirectory = resolve(tempRoot, "typescript-only-modifiers");
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
            assemblyName: "SmokeGeneratedTypeScriptOnlyModifiers",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export class Box {",
      "  public visible: number = 1;",
      "  private hidden: number = 2;",
      "  readonly id: number = 3;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /TypeScript-only modifier 'public'/);
  assert.match(build.stderr, /TypeScript-only modifier 'private'/);
  assert.match(build.stderr, /TypeScript-only modifier 'readonly'/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedTypeScriptOnlyModifiers.csproj")), false);
});


test("CLI emits C# generic declarations from TSTS generic AST", async () => {
  const projectDirectory = resolve(tempRoot, "generic-declarations");
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
            assemblyName: "SmokeGeneratedGenerics",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export class Box<T> {",
      "  value: T;",
      "",
      "  constructor(value: T) {",
      "    this.value = value;",
      "  }",
      "",
      "  get(): T {",
      "    return this.value;",
      "  }",
      "}",
      "",
      "export function identity<T>(value: T): T {",
      "  return value;",
      "}",
      "",
      "export function hold<T>(value: T): T {",
      "  const current = value;",
      "  return current;",
      "}",
      "",
      "export function sameBox<T>(box: Box<T>): Box<T> {",
      "  const current = box;",
      "  return current;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public class Box<T>/);
  assert.match(generatedSource, /public T value;/);
  assert.match(generatedSource, /public Box\(T value\)/);
  assert.match(generatedSource, /public T get\(\)/);
  assert.match(generatedSource, /public static T identity<T>\(T value\)/);
  assert.match(generatedSource, /public static T hold<T>\(T value\)/);
  assert.match(generatedSource, /T current = value;/);
  assert.match(generatedSource, /public static Box<T> sameBox<T>\(Box<T> box\)/);
  assert.match(generatedSource, /Box<T> current = box;/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedGenerics.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});


test("CLI rejects generic type-parameter operators without selected target facts", async () => {
  const projectDirectory = resolve(tempRoot, "generic-operator-facts");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp" }],
    }, null, 2),
    "src/index.ts": [
      "export function same<T>(left: T, right: T): boolean {",
      "  return left === right;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /C# operator '===' requires finalized provider operator facts for type-parameter operands/);
  assert.match(build.stderr, /type-parameter operands/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
});

test("CLI emits imported and re-exported generic source calls from TSTS-selected declarations", async () => {
  const projectDirectory = resolve(tempRoot, "generic-source-calls-across-modules");
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
            assemblyName: "SmokeGeneratedGenericSourceCallsAcrossModules",
          },
        },
      ],
    }, null, 2),
    "src/generics.ts": [
      "export class Box<T> {",
      "  value: T;",
      "",
      "  constructor(value: T) {",
      "    this.value = value;",
      "  }",
      "",
      "  get(): T {",
      "    return this.value;",
      "  }",
      "}",
      "",
      "export function identity<T>(value: T): T {",
      "  return value;",
      "}",
      "",
      "export function boxedValue<T>(box: Box<T>): T {",
      "  return box.get();",
      "}",
      "",
    ].join("\n"),
    "src/barrel.ts": [
      "export { Box, identity, boxedValue } from \"./generics.js\";",
      "",
    ].join("\n"),
    "src/index.ts": [
      "import type { int } from \"@tsonic/csharp/types.js\";",
      "import { Box, identity, boxedValue } from \"./barrel.js\";",
      "",
      "export function echoText(value: string): string {",
      "  return identity<string>(value);",
      "}",
      "",
      "export function echoNumber(value: int): int {",
      "  return identity<int>(value);",
      "}",
      "",
      "export function readBox(value: int): int {",
      "  const box = new Box<int>(value);",
      "  return boxedValue<int>(box);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static string echoText\(string value\)/);
  assert.match(generatedSource, /return Generics\.identity<string>\(value\);/);
  assert.match(generatedSource, /public static int echoNumber\(int value\)/);
  assert.match(generatedSource, /return Generics\.identity<int>\(value\);/);
  assert.match(generatedSource, /Box<int> box = new Box<int>\(value\);/);
  assert.match(generatedSource, /return Generics\.boxedValue<int>\(box\);/);
  assert.doesNotMatch(generatedSource, /Barrel\.identity|Barrel\.boxedValue|identity\(value\)|__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedGenericSourceCallsAcrossModules.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits contextual generic source call results from TSTS-selected call signatures", async () => {
  const projectDirectory = resolve(tempRoot, "contextual-generic-source-calls");
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
            assemblyName: "SmokeGeneratedContextualGenericSourceCalls",
          },
        },
      ],
    }, null, 2),
    "src/helpers.ts": [
      "export function apply<T, R>(fn: (value: T) => R, value: T): R {",
      "  return fn(value);",
      "}",
      "",
      "export function choose<T>(left: T, right: T): T {",
      "  return left;",
      "}",
      "",
    ].join("\n"),
    "src/index.ts": [
      "import type { int } from \"@tsonic/csharp/types.js\";",
      "import { apply, choose } from \"./helpers.js\";",
      "",
      "export function stringify(value: int): string {",
      "  return apply<int, string>((current: int): string => `${current}`, value);",
      "}",
      "",
      "export function pick(value: int): int {",
      "  const chosen: int = choose<int>(value, 7);",
      "  return chosen;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static string stringify\(int value\)/);
  assert.match(generatedSource, /return Helpers\.apply<int, string>\(\(int current\) => \$"\{current\}", value\);/);
  assert.match(generatedSource, /int chosen = Helpers\.choose<int>\(value, 7\);/);
  assert.doesNotMatch(generatedSource, /apply\(|choose\(|__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedContextualGenericSourceCalls.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});


test("CLI emits C# interfaces and class heritage from TSTS AST", async () => {
  const projectDirectory = resolve(tempRoot, "interfaces-and-heritage");
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
            assemblyName: "SmokeGeneratedInterfaces",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export interface Getter<T> {",
      "  get(): T;",
      "}",
      "",
      "export interface Named {",
      "  name: string;",
      "}",
      "",
      "export class Base {",
      "  start: number;",
      "",
      "  constructor(start: number) {",
      "    this.start = start;",
      "  }",
      "",
      "  value(): number {",
      "    return this.start;",
      "  }",
      "}",
      "",
      "export class Derived extends Base {",
      "  constructor(start: number) {",
      "    super(start);",
      "  }",
      "",
      "  extra(): number {",
      "    return super.value() + 1;",
      "  }",
      "}",
      "",
      "export class Box<T> implements Getter<T> {",
      "  value: T;",
      "",
      "  constructor(value: T) {",
      "    this.value = value;",
      "  }",
      "",
      "  get(): T {",
      "    return this.value;",
      "  }",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public interface Getter<T>/);
  assert.match(generatedSource, /T get\(\);/);
  assert.match(generatedSource, /public interface Named/);
  assert.match(generatedSource, /string name \{ get; \}/);
  assert.match(generatedSource, /public class Derived : Base/);
  assert.match(generatedSource, /public Derived\(double start\) : base\(start\)/);
  assert.match(generatedSource, /return base\.value\(\) \+ 1;/);
  assert.match(generatedSource, /public class Box<T> : Getter<T>/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedInterfaces.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});


test("CLI emits source-owned instanceof as C# is expressions", async () => {
  const projectDirectory = resolve(tempRoot, "source-owned-instanceof");
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
            assemblyName: "SmokeGeneratedInstanceOf",
          },
        },
      ],
    }, null, 2),
    "src/animal.ts": [
      "export class Animal {",
      "  name: string = \"\";",
      "}",
      "",
      "export class Dog extends Animal {",
      "}",
      "",
    ].join("\n"),
    "src/index.ts": [
      "import { Animal, Dog } from \"./animal.js\";",
      "",
      "export function isDog(value: Animal): boolean {",
      "  return value instanceof Dog;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static bool isDog\(Animal value\)/);
  assert.match(generatedSource, /return value is Dog;/);
  assert.doesNotMatch(generatedSource, /value is Animal\.Dog/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedInstanceOf.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});


test("CLI emits sanitized C# names through source-owned provider facts", async () => {
  const projectDirectory = resolve(tempRoot, "source-owned-sanitized-names");
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
            assemblyName: "SmokeGeneratedSanitizedNames",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export class KeywordBox {",
      "  default: number = 1;",
      "}",
      "",
      "export function read(box: KeywordBox): number {",
      "  return box.default;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public double @default = 1;/);
  assert.match(generatedSource, /return box\.@default;/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedSanitizedNames.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});


test("CLI emits TypeScript numeric enums as C# enums", async () => {
  const projectDirectory = resolve(tempRoot, "numeric-enums");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          options: {
            outputType: "Exe",
            namespace: "Smoke.Generated",
            assemblyName: "SmokeGeneratedEnums",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { Console } from \"@tsonic/dotnet/System.js\";",
      "",
      "export enum Direction {",
      "  Up = 1,",
      "  Down = 2,",
      "  Left = 4,",
      "  Right = Left << 1,",
      "}",
      "",
      "export function turn(direction: Direction): Direction {",
      "  return direction === Direction.Up ? Direction.Right : Direction.Up;",
      "}",
      "",
      "const selected = turn(Direction.Up) === Direction.Right ? \"right\" : \"bad\";",
      "Console.WriteLine(selected);",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public enum Direction/);
  assert.match(generatedSource, /Up = 1,/);
  assert.match(generatedSource, /Down = 2,/);
  assert.match(generatedSource, /Left = 4,/);
  assert.match(generatedSource, /Right = Left << 1/);
  assert.match(generatedSource, /public static Direction turn\(Direction direction\)/);
  assert.match(generatedSource, /return direction == Direction\.Up \? Direction\.Right : Direction\.Up;/);
  assert.match(generatedSource, /selected = turn\(Direction\.Up\) == Direction\.Right \? "right" : "bad";/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedEnums.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
  assert.equal(runGeneratedProject(projectDirectory, "SmokeGeneratedEnums"), "right\n");
});

test("CLI builds and runs source declarations without reflection or dynamic generated paths", async () => {
  const assemblyName = "SmokeGeneratedDeclarationRuntime";
  const projectDirectory = resolve(tempRoot, "declaration-runtime-proof");
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
            assemblyName,
          },
        },
      ],
    }, null, 2),
    "src/model.ts": [
      "export enum Rank {",
      "  Silver = 2,",
      "  Gold = 3,",
      "}",
      "",
      "export interface Receipt {",
      "  label: string;",
      "  points: number;",
      "  rank: Rank;",
      "}",
      "",
      "export class Entity {",
      "  static suffix: string = \"score\";",
      "  label: string;",
      "",
      "  constructor(label: string) {",
      "    this.label = label;",
      "  }",
      "",
      "  get title(): string {",
      "    return this.label + \"-\" + Entity.suffix;",
      "  }",
      "",
      "  baseScore(): number {",
      "    return 4;",
      "  }",
      "}",
      "",
      "export class ScoreCard extends Entity {",
      "  static bonus: number = 3;",
      "",
      "  static create(label: string, points: number): ScoreCard {",
      "    return new ScoreCard(label, points);",
      "  }",
      "",
      "  points: number;",
      "",
      "  get title(): string {",
      "    return this.label + \"-score:\" + this.points;",
      "  }",
      "",
      "  constructor(label: string, points: number) {",
      "    super(label);",
      "    this.points = points;",
      "  }",
      "",
      "  finalScore(): number {",
      "    return super.baseScore() + this.points + ScoreCard.bonus;",
      "  }",
      "}",
      "",
      "export function classify(points: number): Rank {",
      "  return points > 10 ? Rank.Gold : Rank.Silver;",
      "}",
      "",
      "export function makeReceipt(card: ScoreCard): Receipt {",
      "  const points = card.finalScore();",
      "  return { label: card.title, points, rank: classify(points) };",
      "}",
      "",
    ].join("\n"),
    "src/index.ts": [
      "import { Rank, ScoreCard, makeReceipt } from \"./model.js\";",
      "",
      "const card = ScoreCard.create(\"Ada\", 8);",
      "const receipt = makeReceipt(card);",
      "const rank = receipt.rank === Rank.Gold ? \"gold\" : \"silver\";",
      "console.log(receipt.label + \":\" + receipt.points + \":\" + rank);",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const modelSource = await readFile(resolve(projectDirectory, "out/csharp/src/Model.cs"), "utf8");
  assert.match(modelSource, /public enum Rank[\s\S]*Silver = 2,[\s\S]*Gold = 3/);
  assert.match(modelSource, /public interface Receipt[\s\S]*string label \{ get; \}[\s\S]*double points \{ get; \}[\s\S]*Rank rank \{ get; \}/);
  assert.match(modelSource, /public class Entity[\s\S]*public static string suffix = "score";[\s\S]*public Entity\(string label\)/);
  assert.match(modelSource, /public virtual string title[\s\S]*get[\s\S]*return this\.label \+ "-" \+ Entity\.suffix;/);
  assert.match(modelSource, /public override string title[\s\S]*get[\s\S]*return (?:this|\(\(Entity\)this\))\.label \+ "-score:" \+ this\.points;/);
  assert.match(modelSource, /public class ScoreCard : Entity[\s\S]*public static double bonus = 3;[\s\S]*public static ScoreCard create\(string label, double points\)/);
  assert.match(modelSource, /public ScoreCard\(string label, double points\) : base\(label\)/);
  assert.match(modelSource, /return base\.baseScore\(\) \+ this\.points \+ ScoreCard\.bonus;/);
  assert.match(modelSource, /public class __TsonicShape_Receipt_[A-Za-z0-9_]+ : Receipt[\s\S]*public string label[\s\S]*get;[\s\S]*set;[\s\S]*public double points[\s\S]*get;[\s\S]*set;[\s\S]*public Rank rank[\s\S]*get;[\s\S]*set;/);
  assert.match(modelSource, /return new __TsonicShape_Receipt_[A-Za-z0-9_]+[\s\S]*label = (?:card|\(\(Entity\)card\))\.title,[\s\S]*points = points,[\s\S]*rank = (?:Model\.)?classify\(points\)/);

  const indexSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(indexSource, /ScoreCard\.create\("Ada", 8\)/);
  assert.match(indexSource, /public static readonly string rank;/);
  assert.match(indexSource, /rank = receipt\.rank == Rank\.Gold \? "gold" : "silver";/);
  assert.match(indexSource, /Tsonic\.CSharp\.Js\.console\.log\(receipt\.label \+ ":" \+ receipt\.points \+ ":" \+ rank\);/);

  await assertGeneratedOutputHasNoReflectionSemantics(projectDirectory);
  assert.equal(runGeneratedProject(projectDirectory, assemblyName), "Ada-score:8:15:gold\n");
});


test("CLI rejects string enums until target enum-carrier facts are finalized", async () => {
  const projectDirectory = resolve(tempRoot, "reject-string-enums");
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
            assemblyName: "SmokeGeneratedStringEnums",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export enum Mode {",
      "  Read = \"read\",",
      "  Write = \"write\",",
      "}",
      "",
      "export function read(): Mode {",
      "  return Mode.Read;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.notEqual(build.status, 0);
  assert.match(build.stderr, /C# enum member initializers must be integer constants evaluated by TSTS/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedStringEnums.csproj")), false);
});


test("CLI rejects fractional numeric enum initializers before C# artifact generation", async () => {
  const projectDirectory = resolve(tempRoot, "reject-fractional-enums");
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
            assemblyName: "SmokeGeneratedFractionalEnums",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export enum Ratio {",
      "  Half = 0.5,",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.notEqual(build.status, 0);
  assert.match(build.stderr, /C# enum member initializers must be integer constants evaluated by TSTS/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedFractionalEnums.csproj")), false);
});

test("CLI rejects const enums as TypeScript-only runtime shape", async () => {
  const projectDirectory = resolve(tempRoot, "reject-const-enums");
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
            assemblyName: "SmokeGeneratedConstEnums",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export const enum Mode {",
      "  Read = 1,",
      "}",
      "",
      "export function read(): Mode {",
      "  return Mode.Read;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.notEqual(build.status, 0);
  assert.match(build.stderr, /TypeScript-only modifier 'const' on enum declaration is outside the native runtime-shape source subset/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedConstEnums.csproj")), false);
});


test("CLI emits interface index signatures as C# indexers", async () => {
  const projectDirectory = resolve(tempRoot, "interface-index-signature");
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
            assemblyName: "SmokeGeneratedIndexSignatures",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export interface Bag {",
      "  [key: string]: number;",
      "}",
      "",
      "export function read(bag: Bag, key: string): number {",
      "  return bag[key];",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public interface Bag/);
  assert.match(generatedSource, /double this\[string key\] \{ get; \}/);
  assert.match(generatedSource, /return bag\[key\];/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedIndexSignatures.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});


test("CLI emits finalized generic constraints as C# where clauses", async () => {
  const projectDirectory = resolve(tempRoot, "generic-constraints");
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
            assemblyName: "SmokeGeneratedGenericConstraints",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export interface Named {",
      "  name: string;",
      "}",
      "",
      "export interface Timestamped {",
      "  createdAt: string;",
      "}",
      "",
      "export function constrained<T extends Named & Timestamped>(value: T): string {",
      "  return `${value.name}:${value.createdAt}`;",
      "}",
      "",
      "export function referenceOnly<T extends object>(value: T): T {",
      "  return value;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static string constrained<T>\(T value\)/);
  assert.match(generatedSource, /where T : Named, Timestamped/);
  assert.match(generatedSource, /return \$"\{value\.name\}:\{value\.createdAt\}";/);
  assert.match(generatedSource, /public static T referenceOnly<T>\(T value\)/);
  assert.match(generatedSource, /where T : class/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedGenericConstraints.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});


test("CLI emits delegate function types and expression-bodied lambdas from TSTS AST", async () => {
  const projectDirectory = resolve(tempRoot, "delegate-lambdas");
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
            assemblyName: "SmokeGeneratedDelegateLambdas",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function apply(value: number, mapper: (input: number) => number): number {",
      "  return mapper(value);",
      "}",
      "",
      "export function useInline(): number {",
      "  return apply(3, (input) => input + 4);",
      "}",
      "",
      "export function useLocal(): number {",
      "  const mapper: (input: number) => number = (input) => input * 2;",
      "  return mapper(5);",
      "}",
      "",
      "export function useInferredLocal(): number {",
      "  const mapper = (input: number) => input + 3;",
      "  return mapper(8);",
      "}",
      "",
      "export function useBlock(): number {",
      "  const mapper: (input: number) => number = (input) => {",
      "    const next = input + 1;",
      "    return next;",
      "  };",
      "  return mapper(6);",
      "}",
      "",
      "export function useFunctionExpression(): number {",
      "  const mapper: (input: number) => number = function(input: number): number {",
      "    return input + 2;",
      "  };",
      "  return mapper(7);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static double apply\(double value, Func<double, double> mapper\)/);
  assert.match(generatedSource, /return apply\(3, \(double input\) => input \+ 4\);/);
  assert.match(generatedSource, /Func<double, double> mapper = \(double input\) => input \* 2;/);
  assert.match(generatedSource, /Func<double, double> mapper = \(double input\) => input \+ 3;/);
  assert.match(generatedSource, /Func<double, double> mapper = \(double input\) =>\n\s*\{/);
  assert.match(generatedSource, /Func<double, double> mapper = \(double input\) =>\n\s*\{/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedDelegateLambdas.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits module-scope arrow function values as C# Func fields", async () => {
  const projectDirectory = resolve(tempRoot, "module-arrow-function-values");
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
            assemblyName: "SmokeGeneratedModuleArrowValues",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "type NumberToNumber = (value: number) => number;",
      "type BinaryNumber = (left: number, right: number) => number;",
      "",
      "export const add: BinaryNumber = (left, right) => left + right;",
      "export const greet = (name: string): string => `Hello ${name}`;",
      "export const double: NumberToNumber = (value) => value * 2;",
      "export const triple = (value: number): number => value * 3;",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static readonly Func<double, double, double> add;/);
  assert.match(generatedSource, /public static readonly Func<string, string> greet;/);
  assert.match(generatedSource, /public static readonly Func<double, double> @double;/);
  assert.match(generatedSource, /public static readonly Func<double, double> triple;/);
  assert.match(generatedSource, /add = \(double left, double right\) => left \+ right;/);
  assert.match(generatedSource, /greet = \(string name\) => \$"Hello \{name\}";/);
  assert.match(generatedSource, /@double = \(double value\) => value \* 2;/);
  assert.match(generatedSource, /triple = \(double value\) => value \* 3;/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedModuleArrowValues.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits generic Action and Func delegate signatures from TSTS callable types", async () => {
  const projectDirectory = resolve(tempRoot, "action-func-delegates");
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
            assemblyName: "SmokeGeneratedActionFuncDelegates",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int } from \"@tsonic/csharp/types.js\";",
      "",
      "export function runAction(action: () => void): void {",
      "  action();",
      "}",
      "",
      "export function runActionWithArg(action: (value: int) => void, value: int): void {",
      "  action(value);",
      "}",
      "",
      "export function applyFunc<T, R>(fn: (arg: T) => R, value: T): R {",
      "  return fn(value);",
      "}",
      "",
      "export function applyFunc2<T1, T2, R>(fn: (left: T1, right: T2) => R, left: T1, right: T2): R {",
      "  return fn(left, right);",
      "}",
      "",
      "export function compose<A, B, C>(f: (value: A) => B, g: (value: B) => C): (value: A) => C {",
      "  return (value: A): C => g(f(value));",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static void runAction\(Action action\)/);
  assert.match(generatedSource, /action\(\);/);
  assert.match(generatedSource, /public static void runActionWithArg\(Action<int> action, int value\)/);
  assert.match(generatedSource, /public static R applyFunc<T, R>\(Func<T, R> fn, T value\)/);
  assert.match(generatedSource, /public static R applyFunc2<T1, T2, R>\(Func<T1, T2, R> fn, T1 left, T2 right\)/);
  assert.match(generatedSource, /public static Func<A, C> compose<A, B, C>\(Func<A, B> f, Func<B, C> g\)/);
  assert.match(generatedSource, /return \(A value\) => g\(f\(value\)\);/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedActionFuncDelegates.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits higher-order callable returns and generic function type aliases", async () => {
  const projectDirectory = resolve(tempRoot, "higher-order-callables");
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
            assemblyName: "SmokeGeneratedHigherOrderCallables",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int } from \"@tsonic/csharp/types.js\";",
      "",
      "type Predicate<T> = (value: T) => boolean;",
      "type Transform<T, U> = (value: T) => U;",
      "type Comparer<T> = (left: T, right: T) => int;",
      "",
      "export function add(left: int): (right: int) => int {",
      "  return (right: int): int => left + right;",
      "}",
      "",
      "export function makeRepeater(value: string): () => string {",
      "  return (): string => value;",
      "}",
      "",
      "export function createNested(): () => () => string {",
      "  return (): (() => string) => (): string => \"deeply nested\";",
      "}",
      "",
      "export function test<T>(value: T, predicate: Predicate<T>): boolean {",
      "  return predicate(value);",
      "}",
      "",
      "export function transform<T, U>(value: T, fn: Transform<T, U>): U {",
      "  return fn(value);",
      "}",
      "",
      "export function compare<T>(left: T, right: T, comparer: Comparer<T>): int {",
      "  return comparer(left, right);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static Func<int, int> add\(int left\)/);
  assert.match(generatedSource, /return \(int right\) => left \+ right;/);
  assert.match(generatedSource, /public static Func<string> makeRepeater\(string value\)/);
  assert.match(generatedSource, /return \(\) => value;/);
  assert.match(generatedSource, /public static Func<Func<string>> createNested\(\)/);
  assert.match(generatedSource, /return \(\) => \(\) => "deeply nested";/);
  assert.match(generatedSource, /public static bool test<T>\(T value, Func<T, bool> predicate\)/);
  assert.match(generatedSource, /public static U transform<T, U>\(T value, Func<T, U> fn\)/);
  assert.match(generatedSource, /public static int compare<T>\(T left, T right, Func<T, T, int> comparer\)/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedHigherOrderCallables.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits closure-capturing returned lambdas from TSTS callable facts", async () => {
  const projectDirectory = resolve(tempRoot, "closure-returned-lambdas");
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
            assemblyName: "SmokeGeneratedClosureReturnedLambdas",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function makeCounter(): () => number {",
      "  let count = 0;",
      "  return (): number => {",
      "    count++;",
      "    return count;",
      "  };",
      "}",
      "",
      "export function makeAdder(left: number): (right: number) => number {",
      "  return (right: number): number => left + right;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static Func<double> makeCounter\(\)/);
  assert.match(generatedSource, /double count = 0;/);
  assert.match(generatedSource, /return \(\) =>\n\s*\{/);
  assert.match(generatedSource, /count\+\+;/);
  assert.match(generatedSource, /return count;/);
  assert.match(generatedSource, /public static Func<double, double> makeAdder\(double left\)/);
  assert.match(generatedSource, /return \(double right\) => left \+ right;/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedClosureReturnedLambdas.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits arrays and interfaces containing callable target types", async () => {
  const projectDirectory = resolve(tempRoot, "callable-containers");
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
            assemblyName: "SmokeGeneratedCallableContainers",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int } from \"@tsonic/csharp/types.js\";",
      "",
      "export type Operation = (left: int, right: int) => int;",
      "",
      "export const operations: Operation[] = [",
      "  (left, right) => left + right,",
      "  (left, right) => left - right,",
      "  (left, right) => left * right,",
      "];",
      "",
      "export interface OperationMap {",
      "  add: Operation;",
      "  subtract: Operation;",
      "  multiply: Operation;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static readonly Func<int, int, int>\[\] operations;/);
  assert.match(generatedSource, /operations = new Func<int, int, int>\[\] \{ \(int left, int right\) => left \+ right, \(int left, int right\) => left - right, \(int left, int right\) => left \* right \};/);
  assert.match(generatedSource, /public interface OperationMap/);
  assert.match(generatedSource, /Func<int, int, int> add \{ get; \}/);
  assert.match(generatedSource, /Func<int, int, int> subtract \{ get; \}/);
  assert.match(generatedSource, /Func<int, int, int> multiply \{ get; \}/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedCallableContainers.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits optional callback parameters and nullable callable unions from finalized C# carriers", async () => {
  const projectDirectory = resolve(tempRoot, "optional-callback-delegates");
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
            assemblyName: "SmokeGeneratedOptionalCallbacks",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int } from \"@tsonic/csharp/types.js\";",
      "",
      "export type Callback = (result: int) => void;",
      "",
      "export function compute(value: int, callback?: Callback): int {",
      "  const result = value * 2;",
      "  if (callback !== undefined) {",
      "    callback(result);",
      "  }",
      "  return result;",
      "}",
      "",
      "export function maybeTransform(value: int, transform: ((x: int) => int) | null): int {",
      "  if (transform !== null) {",
      "    return transform(value);",
      "  }",
      "  return value;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static int compute\(int value, Action<int>\? callback = null\)/);
  assert.match(generatedSource, /if \(callback != null\)/);
  assert.match(generatedSource, /callback\(result\);/);
  assert.match(generatedSource, /public static int maybeTransform\(int value, Func<int, int>\? transform\)/);
  assert.match(generatedSource, /if \(transform != null\)/);
  assert.match(generatedSource, /return transform\(value\);/);
  assert.doesNotMatch(generatedSource, /Func<double, double>|undefined|__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedOptionalCallbacks.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});


test("CLI emits standard JavaScript class static blocks as C# static constructors", async () => {
  const projectDirectory = resolve(tempRoot, "class-static-blocks");
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
            assemblyName: "SmokeGeneratedStaticBlocks",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export class Counter {",
      "  static value: number = 0;",
      "  static {",
      "    Counter.value = 3;",
      "  }",
      "}",
      "",
      "export function read(): number {",
      "  return Counter.value;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static double value = 0;/);
  assert.match(generatedSource, /static Counter\(\)\n\s*\{\n\s*Counter\.value = 3;/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedStaticBlocks.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

async function assertGeneratedOutputHasNoReflectionSemantics(projectDirectory) {
  const generatedRoot = resolve(projectDirectory, "out/csharp");
  const files = await collectFiles(generatedRoot, (fileName) => fileName.endsWith(".cs"));
  assert.notEqual(files.length, 0);
  for (const file of files) {
    const text = await readFile(file, "utf8");
    for (const pattern of bannedGeneratedRuntimeSemantics) {
      assert.doesNotMatch(text, pattern, `${file} contains banned generated runtime semantic mechanism ${pattern}`);
    }
  }
}

async function collectFiles(directory, predicate) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(absolutePath, predicate));
    } else if (entry.isFile() && predicate(entry.name)) {
      files.push(absolutePath);
    }
  }
  return files;
}
