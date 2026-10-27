import { assert, cliPath, existsSync, readFile, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../cli-build/helpers/harness.mjs";
import { readGeneratedModuleSource, runGeneratedCsharpRunner } from './async-build-fixtures.mjs';

test("CLI emits and executes async functions from TSTS Promise carriers", async () => {
  const assemblyName = "SmokeGeneratedAsyncFunctions";
  const projectDirectory = resolve(tempRoot, "async-functions");
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
            assemblyName,
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export async function getData(): Promise<string> {",
      "  return \"ready\";",
      "}",
      "",
      "export async function fetchData(): Promise<string> {",
      "  return await getData();",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readGeneratedModuleSource(projectDirectory);
  assert.match(generatedSource, /public static async System\.Threading\.Tasks\.Task<string> getData\(\)/);
  assert.match(generatedSource, /public static async System\.Threading\.Tasks\.Task<string> fetchData\(\)/);
  assert.match(generatedSource, /return await global::Smoke\.Generated\.Index\.getData\(\);/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const stdout = await runGeneratedCsharpRunner(projectDirectory, assemblyName, [
    "using System;",
    "using System.Threading.Tasks;",
    "",
    "public static class Program",
    "{",
    "    public static async Task Main()",
    "    {",
    "        Console.WriteLine(await Smoke.Generated.Index.fetchData());",
    "    }",
    "}",
    "",
  ]);
  assert.equal(stdout, "ready\n");
});

test("CLI emits and executes Promise<void> as non-generic Task await statements", async () => {
  const assemblyName = "SmokeGeneratedAsyncVoidTasks";
  const projectDirectory = resolve(tempRoot, "async-void-tasks");
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
            assemblyName,
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export async function tick(): Promise<void> {",
      "  return;",
      "}",
      "",
      "export async function run(): Promise<string> {",
      "  await tick();",
      "  return \"done\";",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readGeneratedModuleSource(projectDirectory);
  assert.match(generatedSource, /public static async System\.Threading\.Tasks\.Task tick\(\)/);
  assert.match(generatedSource, /public static async System\.Threading\.Tasks\.Task<string> run\(\)/);
  assert.match(generatedSource, /await global::Smoke\.Generated\.Index\.tick\(\);/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const stdout = await runGeneratedCsharpRunner(projectDirectory, assemblyName, [
    "using System;",
    "using System.Threading.Tasks;",
    "",
    "public static class Program",
    "{",
    "    public static async Task Main()",
    "    {",
    "        Console.WriteLine(await Smoke.Generated.Index.run());",
    "    }",
    "}",
    "",
  ]);
  assert.equal(stdout, "done\n");
});

test("CLI emits Promise parameters as C# Task interop carriers", async () => {
  const assemblyName = "SmokeGeneratedAsyncTaskInterop";
  const projectDirectory = resolve(tempRoot, "async-task-interop");
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
            assemblyName,
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "export async function identity(value: Promise<int32>): Promise<int32> {",
      "  return await value;",
      "}",
      "",
      "export async function after(done: Promise<void>): Promise<string> {",
      "  await done;",
      "  return \"after\";",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readGeneratedModuleSource(projectDirectory);
  assert.match(generatedSource, /public static async System\.Threading\.Tasks\.Task<int> identity\(System\.Threading\.Tasks\.Task<int> value\)/);
  assert.match(generatedSource, /return await value;/);
  assert.match(generatedSource, /public static async System\.Threading\.Tasks\.Task<string> after\(System\.Threading\.Tasks\.Task done\)/);
  assert.match(generatedSource, /await done;/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const stdout = await runGeneratedCsharpRunner(projectDirectory, assemblyName, [
    "using System;",
    "using System.Threading.Tasks;",
    "",
    "public static class Program",
    "{",
    "    public static async Task Main()",
    "    {",
    "        Console.WriteLine(await Smoke.Generated.Index.identity(Task.FromResult(42)));",
    "        Console.WriteLine(await Smoke.Generated.Index.after(Task.CompletedTask));",
    "    }",
    "}",
    "",
  ]);
  assert.equal(stdout, [
    "42",
    "after",
    "",
  ].join("\n"));
});

test("CLI emits and executes async higher-order function carriers", async () => {
  const assemblyName = "SmokeGeneratedAsyncHigherOrder";
  const projectDirectory = resolve(tempRoot, "async-higher-order-functions");
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
            assemblyName,
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "export async function createMultiplier(factor: int32): Promise<(x: int32) => int32> {",
      "  return (x: int32): int32 => x * factor;",
      "}",
      "",
      "export async function createAsyncAdder(start: int32): Promise<(x: int32) => Promise<int32>> {",
      "  return async (x: int32): Promise<int32> => start + x;",
      "}",
      "",
      "export async function withAsyncCallback<T>(",
      "  value: T,",
      "  callback: (x: T) => Promise<string>",
      "): Promise<string> {",
      "  return await callback(value);",
      "}",
      "",
      "export async function stringifyInt(value: int32): Promise<string> {",
      "  return `value:${value}`;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readGeneratedModuleSource(projectDirectory);
  assert.match(generatedSource, /public static async System\.Threading\.Tasks\.Task<Func<int, int>> createMultiplier\(int factor\)/);
  assert.match(generatedSource, /int (?<callable>__tsonic_callable_\d+)\(int x\)\s*\{\s*return x \* factor;\s*\}\s*return new Func<int, int>\(\k<callable>\);/);
  assert.match(generatedSource, /public static async System\.Threading\.Tasks\.Task<Func<int, System\.Threading\.Tasks\.Task<int>>> createAsyncAdder\(int start\)/);
  assert.match(generatedSource, /async System\.Threading\.Tasks\.Task<int> (?<callable>__tsonic_callable_\d+)\(int x\)\s*\{\s*return start \+ x;\s*\}\s*return new Func<int, System\.Threading\.Tasks\.Task<int>>\(\k<callable>\);/);
  assert.match(generatedSource, /public static async System\.Threading\.Tasks\.Task<string> withAsyncCallback<T>\(T value, Func<T, System\.Threading\.Tasks\.Task<string>> callback\)/);
  assert.match(generatedSource, /return await callback\(value\);/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const stdout = await runGeneratedCsharpRunner(projectDirectory, assemblyName, [
    "using System;",
    "using System.Threading.Tasks;",
    "",
    "public static class Program",
    "{",
    "    public static async Task Main()",
    "    {",
    "        var multiplier = await Smoke.Generated.Index.createMultiplier(3);",
    "        Console.WriteLine(multiplier(4));",
    "        var adder = await Smoke.Generated.Index.createAsyncAdder(5);",
    "        Console.WriteLine(await adder(7));",
    "        Console.WriteLine(await Smoke.Generated.Index.withAsyncCallback<int>(9, Smoke.Generated.Index.stringifyInt));",
    "    }",
    "}",
    "",
  ]);
  assert.equal(stdout, [
    "12",
    "12",
    "value:9",
    "",
  ].join("\n"));
});

test("CLI emits and executes async structural object returns from finalized Promise carriers", async () => {
  const assemblyName = "SmokeGeneratedAsyncObjectReturns";
  const projectDirectory = resolve(tempRoot, "async-object-returns");
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
            assemblyName,
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "type AsyncBox = { value: int32; label: string };",
      "",
      "export async function make(value: int32): Promise<AsyncBox> {",
      "  return { value, label: `box:${value}` };",
      "}",
      "",
      "export async function read(): Promise<string> {",
      "  const box = await make(7);",
      "  return `${box.label}:${box.value}`;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readGeneratedModuleSource(projectDirectory);
  const generatedObjectShapes = await readFile(
    resolve(projectDirectory, "out/csharp/generated/TsonicObjectShapes.cs"),
    "utf8",
  );
  assert.doesNotMatch(generatedSource, /public class [A-Za-z][A-Za-z0-9_]*Shape_[a-f0-9]{12}/);
  assert.match(generatedObjectShapes, /public class [A-Za-z][A-Za-z0-9_]*Shape_[a-f0-9]{12}/);
  assert.match(generatedSource, /public static async System\.Threading\.Tasks\.Task<[A-Za-z][A-Za-z0-9_]*Shape_[a-f0-9]{12}<string, int>> make\(int value\)/);
  assert.match(generatedSource, /return new [A-Za-z][A-Za-z0-9_]*Shape_[a-f0-9]{12}\s*\{\s*value = value,\s*label = \$"box:\{value\}",\s*\};/);
  assert.match(generatedSource, /[A-Za-z][A-Za-z0-9_]*Shape_[a-f0-9]{12}<string, int> box = await global::Smoke\.Generated\.Index\.make\(7\);/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const stdout = await runGeneratedCsharpRunner(projectDirectory, assemblyName, [
    "using System;",
    "using System.Threading.Tasks;",
    "",
    "public static class Program",
    "{",
    "    public static async Task Main()",
    "    {",
    "        Console.WriteLine(await Smoke.Generated.Index.read());",
    "    }",
    "}",
    "",
  ]);
  assert.equal(stdout, "box:7:7\n");
});

test("CLI emits and executes async functions using selected JS Map carrier facts", async () => {
  const assemblyName = "SmokeGeneratedAsyncMapOps";
  const projectDirectory = resolve(tempRoot, "async-map-ops");
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
            namespace: "Smoke.Generated",
            assemblyName,
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "export async function total(): Promise<int32> {",
      "  const values = new Map<string, int32>();",
      "  values.set(\"a\", 1);",
      "  values.set(\"b\", 2);",
      "  return (values.get(\"a\") ?? 0) + (values.get(\"b\") ?? 0);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readGeneratedModuleSource(projectDirectory);
  assert.match(generatedSource, /public static async System\.Threading\.Tasks\.Task<int> total\(\)/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.Map<string, int> values = new Tsonic\.CSharp\.Js\.Map<string, int>\(\);/);
  assert.match(generatedSource, /values\.set\("a", 1\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.Map\.getValue<string, int>\(values, "a"\)/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const stdout = await runGeneratedCsharpRunner(projectDirectory, assemblyName, [
    "using System;",
    "using System.Threading.Tasks;",
    "",
    "public static class Program",
    "{",
    "    public static async Task Main()",
    "    {",
    "        Console.WriteLine(await Smoke.Generated.Index.total());",
    "    }",
    "}",
    "",
  ]);
  assert.equal(stdout, "3\n");
});

test("CLI emits and executes inferred async lambda statements", async () => {
  const assemblyName = "SmokeGeneratedAsyncLambdaRejected";
  const projectDirectory = resolve(tempRoot, "async-lambda-missing-delegate");
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
            assemblyName,
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function bare(): void {",
      "  (async () => 1);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);
  const generatedSource = await readGeneratedModuleSource(projectDirectory);
  assert.match(generatedSource, /public static void bare\(\)\s*\{\s*\}/u);
  assert.doesNotMatch(generatedSource, /__unsupported|System\.Reflection|\bdynamic\b/u);
  const stdout = await runGeneratedCsharpRunner(projectDirectory, assemblyName, [
    "using System;",
    "public static class Program",
    "{",
    "    public static void Main()",
    "    {",
    "        Smoke.Generated.Index.bare();",
    "        Console.WriteLine(\"completed\");",
    "    }",
    "}",
    "",
  ]);
  assert.equal(stdout, "completed\n");
});
