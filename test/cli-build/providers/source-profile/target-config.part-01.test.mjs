import { assert, cliPath, dotnetOutputAssemblyPath, existsSync, readFile, repoRoot, resolve, run, runGeneratedProject, runNode, runNodeInDirectory, tempRoot, test, writeProject } from "../../helpers/harness.mjs";

test("CLI does not use tsconfig path mapping as a hidden module-resolution fallback", async () => {
  const projectDirectory = resolve(tempRoot, "tsconfig-path-mapping-no-fallback");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp" }],
    }, null, 2),
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        baseUrl: ".",
        paths: {
          "@app/*": ["src/app/*"],
        },
      },
    }, null, 2),
    "src/index.ts": "import { value } from \"@app/value.js\";\nexport const result = value;\n",
    "src/app/value.ts": "export const value = 1;\n",
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /@app\/value\.js/);
  assert.doesNotMatch(build.stderr, /src\/app\/value\.ts/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
});

test("CLI rejects package-root imports instead of applying package-root shims", async () => {
  const projectDirectory = resolve(tempRoot, "package-root-shim-no-fallback");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp" }],
    }, null, 2),
    "src/index.ts": "import \"@tsonic/js\";\nexport const value = 1;\n",
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /@tsonic\/js/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
});

test("CLI never treats a declaration-only relative import as a runtime implementation", async () => {
  const projectDirectory = resolve(tempRoot, "generated-declaration-no-fallback");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp" }],
    }, null, 2),
    "src/index.ts": "import { value } from \"./generated.js\";\nexport const result = value;\n",
    "src/generated.d.ts": "export declare const value: number;\n",
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /Declaration\/provider identifier 'value' requires a selected target operation or type-position usage/u);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
});

test("CLI rejects provider metadata JSON as hidden module fallbacks", async () => {
  const projectDirectory = resolve(tempRoot, "provider-metadata-json-no-fallback");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp" }],
    }, null, 2),
    "src/index.ts": "import metadata from \"./provider.metadata.json\";\nexport const result = metadata;\n",
    "src/provider.metadata.json": JSON.stringify({ target: "csharp" }),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /provider\.metadata\.json/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
});

test("CLI rejects package exports subpaths as hidden package-discovery fallbacks", async () => {
  const projectDirectory = resolve(tempRoot, "package-exports-subpath-no-fallback");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp" }],
    }, null, 2),
    "src/index.ts": "import { value } from \"@demo/pkg/subpath.js\";\nexport const result = value;\n",
    "node_modules/@demo/pkg/package.json": JSON.stringify({
      name: "@demo/pkg",
      type: "module",
      exports: {
        "./subpath.js": "./subpath.d.ts",
      },
    }, null, 2),
    "node_modules/@demo/pkg/subpath.d.ts": "export declare const value: number;\n",
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /@demo\/pkg\/subpath\.js/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
});

test("CLI does not fall back from package export targets to same-named package files", async () => {
  const projectDirectory = resolve(tempRoot, "package-export-target-no-fallback");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "src/index.ts",
      rootDir: ".",
      outDir: "out",
      targets: [{ id: "csharp" }],
    }, null, 2),
    "src/index.ts": "import { value } from \"@demo/pkg/public.js\";\nexport const result = value;\n",
    "node_modules/@demo/pkg/package.json": JSON.stringify({
      name: "@demo/pkg",
      type: "module",
      exports: {
        "./public.js": "./src/missing.ts",
      },
    }, null, 2),
    "node_modules/@demo/pkg/public.ts": "export const value = 41;\n",
    "node_modules/@demo/pkg/src/public.ts": "export const value = 42;\n",
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /@demo\/pkg\/public\.js/);
  assert.doesNotMatch(build.stderr, /public\.ts/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
});

test("CLI emits package export target source files from the TSTS subpath graph", async () => {
  const projectDirectory = resolve(tempRoot, "package-export-source-subpath-emission");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: ".",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          surfaces: ["js"],
          options: {
            outputType: "Exe",
            namespace: "Smoke.Generated",
            assemblyName: "SmokeGeneratedPackageSourceSubpath",
          },
        },
      ],
    }, null, 2),
    "package.json": JSON.stringify({
      name: "package-export-source-subpath-emission",
      type: "module",
      dependencies: {
        "@demo/pkg": "1.0.0",
        "@tsonic/target-csharp": "file:../../../../tsonic-csharp",
        "@tsonic/csharp-runtime": "file:../../../../csharp-runtime",
        "@tsonic/csharp-js": "file:../../../../csharp-js",
      },
    }, null, 2),
    "index.ts": [
      "import { append, trace, value } from \"@demo/pkg/public.js\";",
      "append(\"index;\");",
      "console.log(trace);",
      "",
      "export function read(): number {",
      "  return value;",
      "}",
      "",
    ].join("\n"),
    "node_modules/@demo/pkg/package.json": JSON.stringify({
      name: "@demo/pkg",
      version: "1.0.0",
      type: "module",
      exports: {
        "./public.js": {
          types: "./src/public.ts",
          default: "./src/public.ts",
        },
      },
    }, null, 2),
    "node_modules/@demo/pkg/src/public.ts": [
      "import { append as appendState, trace } from \"./state.js\";",
      "appendState(\"public;\");",
      "export const value = 41;",
      "export { appendState as append, trace };",
      "",
    ].join("\n"),
    "node_modules/@demo/pkg/src/state.ts": [
      "export let trace = \"\";",
      "export function append(value: string): void {",
      "  trace = trace + value;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const indexSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  const publicSourcePath = resolve(projectDirectory, "out/csharp/src/node_modules/@demo/pkg/src/Node_modules_Demo_pkg_src_public.cs");
  const stateSourcePath = resolve(projectDirectory, "out/csharp/src/node_modules/@demo/pkg/src/Node_modules_Demo_pkg_src_state.cs");
  assert.equal(existsSync(publicSourcePath), true);
  assert.equal(existsSync(stateSourcePath), true);
  assert.match(indexSource, /Node_modules_Demo_pkg_src_public\.__tsonic_module_init\(\);[\s\S]*global::Smoke\.Generated\.Node_modules_Demo_pkg_src_state\.append\("index;"\);/);
  assert.match(indexSource, /return global::Smoke\.Generated\.Node_modules_Demo_pkg_src_public\.value;/);
  assert.doesNotMatch(indexSource, /return value;/);
  assert.doesNotMatch(indexSource, /__unsupported/);

  const publicSource = await readFile(publicSourcePath, "utf8");
  assert.match(publicSource, /Node_modules_Demo_pkg_src_state\.__tsonic_module_init\(\);[\s\S]*global::Smoke\.Generated\.Node_modules_Demo_pkg_src_state\.append\("public;"\);/);
  assert.doesNotMatch(publicSource, /__unsupported/);

  const output = runGeneratedProject(projectDirectory, "SmokeGeneratedPackageSourceSubpath");
  assert.equal(output, "public;index;\n");
});
