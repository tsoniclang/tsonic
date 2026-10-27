import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { assert, cliPath, existsSync, readFile, repoRoot, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";

test("CLI emits module-scope variables as lazily initialized C# static properties", async () => {
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
  assert.match(generatedSource, /public static double total\s*\{\s*get;\s*internal set;\s*\} = default\(double\)!;/);
  assert.match(generatedSource, /private static object\? __tsonic_module_init_core\(\)/);
  assert.match(generatedSource, /total = 1;/);
  assert.match(generatedSource, /total = global::Smoke\.Generated\.Index\.total \+ 1;/);
  assert.doesNotMatch(generatedSource, /public static void Main\(\)/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedModuleFields.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits module-scope const bindings as lazily initialized C# static properties", async () => {
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
  assert.match(generatedSource, /public static int total\s*\{\s*get;\s*private set;\s*\} = default\(int\)!;/);
  assert.match(generatedSource, /private static object\? __tsonic_module_init_core\(\)/);
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
  assert.match(generatedSource, /public static int value\s*\{\s*get;\s*private set;\s*\} = default\(int\)!;/);
  assert.match(generatedSource, /private static object\? __tsonic_module_init_core\(\)/);
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
  assert.match(generatedSource, /return global::Smoke\.Generated\.Math\.add\(global::Smoke\.Generated\.Math\.seed\);/);
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
  assert.match(indexSource, /Tsonic\.CSharp\.Js\.console\.log\(global::Smoke\.Generated\.Used\.value\);/);
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
  assert.match(indexSource, /private static object\? __tsonic_module_init_core\(\)/);
  assert.match(indexSource, /Side\.__tsonic_module_init\(\);[\s\S]*State\.__tsonic_module_init\(\);[\s\S]*global::Smoke\.Generated\.State\.append\("index;"\);/);
  assert.doesNotMatch(indexSource, /__unsupported/);

  const sideSource = await readFile(resolve(projectDirectory, "out/csharp/src/Side.cs"), "utf8");
  assert.match(sideSource, /private static object\? __tsonic_module_init_core\(\)/);
  assert.match(sideSource, /State\.__tsonic_module_init\(\);[\s\S]*global::Smoke\.Generated\.State\.append\("side;"\);/);
  assert.doesNotMatch(sideSource, /__unsupported/);

  const stateSource = await readFile(resolve(projectDirectory, "out/csharp/src/State.cs"), "utf8");
  assert.match(stateSource, /public static string text\s*\{\s*get;\s*internal set;\s*\} = default\(string\)!;/);
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
  assert.match(indexSource, /marker = new MarkerShape_[a-f0-9]{12}/);
  assert.match(indexSource, /named = new NamedShape_[a-f0-9]{12}/);

  const typesSource = await readFile(resolve(projectDirectory, "out/csharp/src/Types.cs"), "utf8");
  assert.match(typesSource, /global::Smoke\.Generated\.State\.append\("types;"\);/);

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
  assert.match(generatedSource, /return global::Smoke\.Generated\.Math\.add\(global::Smoke\.Generated\.Math\.seed\);/);
  assert.doesNotMatch(generatedSource, /math\.add|math\.seed|__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedNamespaceImportReferences.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});
