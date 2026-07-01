import { assert, cliPath, readFile, resolve, run, runNode, tempRoot, test, writeProject } from "./cli-build/harness.mjs";

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
  assert.match(generatedSource, /return await getData\(\);/);
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
  assert.match(generatedSource, /await tick\(\);/);
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
  assert.match(generatedSource, /return \(int x\) => x \* factor;/);
  assert.match(generatedSource, /public static async System\.Threading\.Tasks\.Task<Func<int, System\.Threading\.Tasks\.Task<int>>> createAsyncAdder\(int start\)/);
  assert.match(generatedSource, /return async \(int x\) => start \+ x;/);
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

async function readGeneratedModuleSource(projectDirectory) {
  return readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
}

async function runGeneratedCsharpRunner(projectDirectory, assemblyName, programLines) {
  const runnerDirectory = resolve(projectDirectory, "runner");
  const runnerProjectPath = resolve(runnerDirectory, "Runner.csproj");
  await writeProject(runnerDirectory, {
    "Runner.csproj": [
      "<Project Sdk=\"Microsoft.NET.Sdk\">",
      "  <PropertyGroup>",
      "    <OutputType>Exe</OutputType>",
      "    <TargetFramework>net10.0</TargetFramework>",
      "    <ImplicitUsings>disable</ImplicitUsings>",
      "    <Nullable>enable</Nullable>",
      "  </PropertyGroup>",
      "  <ItemGroup>",
      `    <ProjectReference Include=\"../out/csharp/${assemblyName}.csproj\" />`,
      "  </ItemGroup>",
      "</Project>",
      "",
    ].join("\n"),
    "Program.cs": programLines.join("\n"),
  });

  const build = run("dotnet", ["build", runnerProjectPath, "--nologo", "--v:minimal"]);
  assert.equal(build.status, 0, build.stdout + build.stderr);
  const executed = run("dotnet", ["run", "--project", runnerProjectPath, "--no-build", "--no-restore"]);
  assert.equal(executed.status, 0, executed.stdout + executed.stderr);
  return executed.stdout.replace(/\r\n/g, "\n");
}
