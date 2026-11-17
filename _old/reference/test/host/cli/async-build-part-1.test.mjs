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
