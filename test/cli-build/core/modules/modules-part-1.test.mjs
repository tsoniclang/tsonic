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
