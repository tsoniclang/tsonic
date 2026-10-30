import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { assert, cliPath, existsSync, readFile, repoRoot, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";

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
