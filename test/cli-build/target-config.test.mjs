import { assert, cliPath, existsSync, readFile, repoRoot, resolve, run, runGeneratedProject, runNode, runNodeInDirectory, tempRoot, test, writeProject } from "./harness.mjs";

test("CLI lists built-in target packs", () => {
  const result = runNode([cliPath, "targets"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^csharp\tC#$/m);
});

test("CLI prints current architecture help without legacy command aliases", () => {
  for (const helpArg of [undefined, "help", "--help", "-h"]) {
    const args = helpArg === undefined ? [cliPath] : [cliPath, helpArg];
    const result = runNode(args);
    assert.equal(result.status, 0, helpArg ?? "default");
    assert.match(result.stdout, /tsonic build --project <tsonic\.json>/);
    assert.match(result.stdout, /TSTS owns TypeScript parse\/bind\/check\/flow\/narrowing/);
    assert.doesNotMatch(result.stdout, /\badd\b|\brestore\b|\btest-command\b/);
  }
});

test("CLI rejects unknown commands instead of routing legacy command shims", () => {
  for (const command of ["add", "restore", "test", "run", "unknown"]) {
    const result = runNode([cliPath, command]);
    assert.equal(result.status, 2, command);
    assert.match(result.stderr, new RegExp(`Unknown command '${command}'`, "u"));
    assert.match(result.stderr, /tsonic build --project <tsonic\.json>/);
  }
});

test("CLI reports missing project path argument before project loading", () => {
  for (const flag of ["--project", "-p"]) {
    const missing = runNode([cliPath, "build", flag]);
    assert.equal(missing.status, 1, flag);
    assert.match(missing.stderr, /Expected a path after --project/);

    const optionLike = runNode([cliPath, "build", flag, "--other"]);
    assert.equal(optionLike.status, 1, flag);
    assert.match(optionLike.stderr, /Expected a path after --project/);
  }
});

test("CLI build uses tsonic.json in the current directory when --project is omitted", async () => {
  const projectDirectory = resolve(tempRoot, "default-project-path");
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
            assemblyName: "SmokeGeneratedDefaultProject",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": "export function value(): number { return 1; }\n",
  });

  const build = runNodeInDirectory(projectDirectory, [cliPath, "build"]);
  assert.equal(build.status, 0, build.stderr);
  assert.match(build.stdout, /Entry: index\.ts/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedDefaultProject.csproj")), true);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/src/Index.cs")), true);
});


test("CLI rejects duplicate target ids before compiling", async () => {
  const projectDirectory = resolve(tempRoot, "duplicate-targets");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp" }, { id: "csharp" }],
    }, null, 2),
    "src/index.ts": "export function value(): number { return 1; }\n",
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /target 'csharp' is declared more than once/);
});

test("CLI rejects unsafe target and surface ids before output path creation", async () => {
  const cases = [
    {
      name: "unsafe-target-id",
      target: { id: "../csharp" },
      expected: /Target at index 0 id '\.\.\/csharp' must match/,
    },
    {
      name: "unsafe-surface-id",
      target: { id: "csharp", surfaces: ["../js"] },
      expected: /Target 'csharp' surface '\.\.\/js' must match/,
    },
  ];

  for (const { name, target, expected } of cases) {
    const projectDirectory = resolve(tempRoot, name);
    await writeProject(projectDirectory, {
      "tsonic.json": JSON.stringify({
        entryPoint: "index.ts",
        rootDir: "src",
        outDir: "out",
        targets: [target],
      }, null, 2),
      "src/index.ts": "export const value = 1;\n",
    });

    const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
    assert.equal(build.status, 1, name);
    assert.match(build.stderr, expected, name);
    assert.equal(existsSync(resolve(projectDirectory, "out")), false, name);
  }
});

test("CLI rejects non-final entrypoint source extensions before compiling", async () => {
  const projectDirectory = resolve(tempRoot, "unsupported-entry-extension");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.cts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp" }],
    }, null, 2),
    "src/index.cts": "export function value(): number { return 1; }\n",
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /entryPoint must use a final ESM TypeScript source extension: \.ts or \.mts/);
});

test("CLI rejects unsupported top-level project config fields before compiling", async () => {
  const projectDirectory = resolve(tempRoot, "unsupported-project-config-field");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      output: {
        type: "Library",
      },
      targets: [{ id: "csharp" }],
    }, null, 2),
    "src/index.ts": "export function value(): number { return 1; }\n",
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /Project config has unsupported field 'output'/);
});

test("CLI rejects TypeScript path-mapping config fields instead of ignoring them", async () => {
  const projectDirectory = resolve(tempRoot, "unsupported-path-mapping-config");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      compilerOptions: {
        baseUrl: ".",
        paths: {
          "@app/*": ["app/*"],
        },
      },
      targets: [{ id: "csharp" }],
    }, null, 2),
    "src/index.ts": "export function value(): number { return 1; }\n",
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /Project config field 'compilerOptions' is not supported/);
  assert.doesNotMatch(build.stderr, /Cannot find module/);
});

test("CLI rejects top-level path-mapping aliases before module resolution", async () => {
  const cases = [
    {
      name: "unsupported-base-url",
      config: { baseUrl: "." },
      expected: /Project config field 'baseUrl' is not supported/,
    },
    {
      name: "unsupported-paths",
      config: { paths: { "@app/*": ["src/app/*"] } },
      expected: /Project config field 'paths' is not supported/,
    },
    {
      name: "unsupported-tsconfig-link",
      config: { tsconfig: "tsconfig.json" },
      expected: /Project config field 'tsconfig' is not supported/,
    },
    {
      name: "unsupported-project-references",
      config: { references: [{ path: "../shared" }] },
      expected: /Project config field 'references' is not supported/,
    },
  ];

  for (const { name, config, expected } of cases) {
    const projectDirectory = resolve(tempRoot, name);
    await writeProject(projectDirectory, {
      "tsonic.json": JSON.stringify({
        entryPoint: "index.ts",
        rootDir: "src",
        outDir: "out",
        ...config,
        targets: [{ id: "csharp" }],
      }, null, 2),
      "src/index.ts": "import { value } from \"@app/value.js\";\nexport const result = value;\n",
      "src/app/value.ts": "export const value = 1;\n",
    });

    const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
    assert.equal(build.status, 1, name);
    assert.match(build.stderr, expected, name);
    assert.doesNotMatch(build.stderr, /Cannot find module/, name);
  }
});

test("CLI rejects unsupported target entry fields outside target options", async () => {
  const projectDirectory = resolve(tempRoot, "unsupported-target-config-field");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          namespace: "Bad.Legacy",
        },
      ],
    }, null, 2),
    "src/index.ts": "export function value(): number { return 1; }\n",
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /Target at index 0 has unsupported field 'namespace'/);
});

test("CLI rejects unsupported C# target options instead of ignoring them", async () => {
  const projectDirectory = resolve(tempRoot, "unsupported-csharp-target-option");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          options: {
            rootNamespace: "Legacy.Generated",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": "export function value(): number { return 1; }\n",
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /C# target option 'options\.rootNamespace' is not supported/);
});

test("CLI rejects duplicate configured surfaces before target composition", async () => {
  const projectDirectory = resolve(tempRoot, "duplicate-configured-surfaces");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          surfaces: ["js", "js"],
        },
      ],
    }, null, 2),
    "src/index.ts": "export function value(): number { return 1; }\n",
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /Target 'csharp' surface 'js' is declared more than once/);
});

test("CLI clean rebuild removes stale target artifacts before writing current outputs", async () => {
  const projectDirectory = resolve(tempRoot, "clean-rebuild-stale-output");
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
            assemblyName: "SmokeGeneratedCleanRebuild",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": "export function value(): number { return 1; }\n",
    "out/csharp/src/Stale.cs": "public static class Stale {}\n",
    "out/csharp/runtime/stale.txt": "stale\n",
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/src/Index.cs")), true);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/src/Stale.cs")), false);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/runtime/stale.txt")), false);
});

test("CLI clean rebuild removes stale target artifacts when diagnostics stop emission", async () => {
  const projectDirectory = resolve(tempRoot, "clean-rebuild-diagnostic-only-target");
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
            assemblyName: "SmokeGeneratedCleanDiagnostic",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export abstract class Base {",
      "  abstract run(): string;",
      "}",
      "",
    ].join("\n"),
    "out/csharp/SmokeGeneratedCleanDiagnostic.csproj": "<Project />\n",
    "out/csharp/src/Stale.cs": "public static class Stale {}\n",
    "out/csharp/runtime/stale.txt": "stale\n",
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /CSHARP_UNSUPPORTED_AST/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedCleanDiagnostic.csproj")), false);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/src/Stale.cs")), false);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/runtime/stale.txt")), false);
});

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

test("CLI rejects generated declaration files as hidden module fallbacks", async () => {
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
  assert.match(build.stderr, /generated\.js/);
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
  assert.match(indexSource, /Node_modules_Demo_pkg_src_public\.__tsonic_module_init\(\);[\s\S]*Node_modules_Demo_pkg_src_state\.append\("index;"\);/);
  assert.match(indexSource, /return Node_modules_Demo_pkg_src_public\.value;/);
  assert.doesNotMatch(indexSource, /return value;/);
  assert.doesNotMatch(indexSource, /__unsupported/);

  const publicSource = await readFile(publicSourcePath, "utf8");
  assert.match(publicSource, /Node_modules_Demo_pkg_src_state\.__tsonic_module_init\(\);[\s\S]*Node_modules_Demo_pkg_src_state\.append\("public;"\);/);
  assert.doesNotMatch(publicSource, /__unsupported/);

  const output = runGeneratedProject(projectDirectory, "SmokeGeneratedPackageSourceSubpath");
  assert.equal(output, "public;index;\n");
});

test("CLI emits C# source project from TSTS semantics and compiles with dotnet", async () => {
  const projectDirectory = resolve(tempRoot, "wide-csharp");
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
            assemblyName: "SmokeGeneratedWide",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int } from \"@tsonic/csharp/types.js\";",
      "",
      "export class Counter {",
      "  value: int = 0;",
      "  history: int[] = [];",
      "",
      "  constructor(initial: int) {",
      "    this.value = initial;",
      "  }",
      "",
      "  inc(delta: int): int {",
      "    for (let i: int = 0; i < delta; i++) {",
      "      this.value = this.value + i;",
      "    }",
      "    do {",
      "      this.value--;",
      "    } while (this.value > 10);",
      "    return this.value % 2 === 0 ? this.value : this.value + 1;",
      "  }",
      "}",
      "",
      "export function sum(values: number[]): number {",
      "  let total = 0;",
      "  let seen: number[] = [];",
      "  for (const value of values) {",
      "    total = total + value;",
      "  }",
      "  return total;",
      "}",
      "",
      "export function control(value: int): int {",
      "  let result: int = 0;",
      "  while (result < value) {",
      "    result++;",
      "    if (result === 2) continue;",
      "    if (result > 5) break;",
      "  }",
      "  switch (value) {",
      "    case 0:",
      "      result = 10;",
      "      break;",
      "    case 1:",
      "      result = 20;",
      "      break;",
      "    default:",
      "      result = 30;",
      "      break;",
      "  }",
      "  try {",
      "    result = result + 1;",
      "  } catch {",
      "    result = 40;",
      "  } finally {",
      "    result = result + 1;",
      "  }",
      "  done: result = result + 1;",
      "  debugger;",
      "  return result;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSourcePath = resolve(projectDirectory, "out/csharp/src/Index.cs");
  const generatedSource = await readFile(generatedSourcePath, "utf8");
  assert.match(generatedSource, /public static double sum\(double\[\] values\)/);
  assert.match(generatedSource, /public int\[\] history = new int\[\] \{ \};/);
  assert.match(generatedSource, /double\[\] seen = new double\[\] \{ \};/);
  assert.match(generatedSource, /foreach \(double value in values\)/);
  assert.match(generatedSource, /public static int control\(int value\)/);
  assert.match(generatedSource, /public Counter\(int initial\)/);
  assert.match(generatedSource, /for \(int i = 0; i < delta; i\+\+\)/);
  assert.match(generatedSource, /switch \(value\)/);
  assert.match(generatedSource, /case 0:/);
  assert.match(generatedSource, /continue;/);
  assert.match(generatedSource, /break;/);
  assert.match(generatedSource, /try/);
  assert.match(generatedSource, /catch/);
  assert.match(generatedSource, /finally/);
  assert.match(generatedSource, /done:/);
  assert.match(generatedSource, /System\.Diagnostics\.Debugger\.Break\(\);/);
  assert.match(generatedSource, /return this\.value % 2 == 0 \? this\.value : this\.value \+ 1;/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedWide.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});


test("CLI emits explicit C# target .NET references without host inference", async () => {
  const projectDirectory = resolve(tempRoot, "target-references");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          options: {
            assemblyName: "SmokeGeneratedReferences",
            references: {
              projects: ["../csharp-runtime/src/Tsonic.CSharp.Runtime/Tsonic.CSharp.Runtime.csproj"],
              packages: [{ include: "Tsonic.CSharp.Runtime", version: "0.0.1" }],
              frameworks: ["Microsoft.AspNetCore.App"],
              assemblies: [{ include: "Example.Assembly", hintPath: "../lib/Example.Assembly.dll" }],
            },
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function value(): number {",
      "  return 1;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedProject = await readFile(resolve(projectDirectory, "out/csharp/SmokeGeneratedReferences.csproj"), "utf8");
  assert.match(generatedProject, /<ProjectReference Include="\.\.\/csharp-runtime\/src\/Tsonic\.CSharp\.Runtime\/Tsonic\.CSharp\.Runtime\.csproj" \/>/);
  assert.match(generatedProject, /<PackageReference Include="Tsonic\.CSharp\.Runtime" Version="0\.0\.1" \/>/);
  assert.match(generatedProject, /<FrameworkReference Include="Microsoft\.AspNetCore\.App" \/>/);
  assert.match(generatedProject, /<Reference Include="Example\.Assembly" HintPath="\.\.\/lib\/Example\.Assembly\.dll" \/>/);
});


test("CLI escapes TypeScript identifiers that are C# reserved words", async () => {
  const projectDirectory = resolve(tempRoot, "csharp-keyword-identifiers");
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
            assemblyName: "SmokeGeneratedCsharpKeywordIdentifiers",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "let event = 1;",
      "",
      "export function read(operator: number): number {",
      "  let params = operator + event;",
      "  return params;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static double @event;/);
  assert.match(generatedSource, /static Index\(\)/);
  assert.match(generatedSource, /@event = 1;/);
  assert.match(generatedSource, /public static double read\(double @operator\)/);
  assert.match(generatedSource, /double @params = @operator \+ @event;/);
  assert.match(generatedSource, /return @params;/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedCsharpKeywordIdentifiers.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});


test("CLI validates and escapes C# target namespace segments", async () => {
  const projectDirectory = resolve(tempRoot, "csharp-keyword-namespace");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          options: {
            namespace: "event.operator",
            assemblyName: "SmokeGeneratedCsharpKeywordNamespace",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function read(): number {",
      "  return 1;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /namespace @event\.@operator/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedCsharpKeywordNamespace.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});


test("CLI rejects invalid C# target namespace segments", async () => {
  const projectDirectory = resolve(tempRoot, "csharp-invalid-namespace");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          options: {
            namespace: "Smoke.Bad-Name",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function read(): number {",
      "  return 1;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /C# target option 'namespace' must be a dot-separated C# identifier path/);
});


test("CLI rejects non-string C# target namespace option", async () => {
  const projectDirectory = resolve(tempRoot, "csharp-invalid-namespace-type");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          options: {
            namespace: 42,
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function read(): number {",
      "  return 1;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /C# target option 'namespace' must be a non-empty string/);
});


test("CLI rejects invalid C# target assembly name", async () => {
  const projectDirectory = resolve(tempRoot, "csharp-invalid-assembly-name");
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
            assemblyName: "../Bad",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function read(): number {",
      "  return 1;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /C# target option 'assemblyName' must be a file-safe \.NET assembly name/);
});


test("CLI does not emit target artifacts when TSTS rejects the source program", async () => {
  const projectDirectory = resolve(tempRoot, "tsts-diagnostic-stop");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp" }],
    }, null, 2),
    "src/index.ts": [
      "export function invalid(): number {",
      "  return \"not a number\";",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /TSTS_DIAGNOSTIC/);
  assert.doesNotMatch(build.stdout, /Artifacts: [1-9]/);
});
