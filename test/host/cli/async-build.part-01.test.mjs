import { assert, cliPath, existsSync, readFile, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../cli-build/helpers/harness.mjs";
import { readGeneratedModuleSource, runGeneratedCsharpRunner } from './async-build-fixtures.mjs';

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
