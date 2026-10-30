import { assert, cliPath, dotnetOutputAssemblyPath, existsSync, readFile, repoRoot, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";
import { readGeneratedModuleSource } from './core-fixtures.mjs';

test("CLI resolves provider-owned modules from explicit target assembly references", async () => {
  const libraryDirectory = resolve(tempRoot, "provider-reference-library");
  await writeProject(libraryDirectory, {
    "Acme.Native.csproj": [
      "<Project Sdk=\"Microsoft.NET.Sdk\">",
      "  <PropertyGroup>",
      "    <TargetFramework>net10.0</TargetFramework>",
      "    <ImplicitUsings>disable</ImplicitUsings>",
      "    <Nullable>enable</Nullable>",
      "  </PropertyGroup>",
      "</Project>",
      "",
    ].join("\n"),
    "Numbers.cs": [
      "namespace Acme.Native;",
      "",
      "public static class Numbers",
      "{",
      "    public static int Twice(int value) => value * 2;",
      "}",
      "",
      "public sealed class Counter",
      "{",
      "    public int Value { get; }",
      "    public Counter(int value) => Value = value;",
      "    public int Add(int next) => Value + next;",
      "}",
      "",
    ].join("\n"),
  });
  const libraryBuild = run("dotnet", ["build", resolve(libraryDirectory, "Acme.Native.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(libraryBuild.status, 0, libraryBuild.stdout + libraryBuild.stderr);
  const libraryAssembly = dotnetOutputAssemblyPath(libraryDirectory, "Acme.Native");
  assert.equal(existsSync(libraryAssembly), true);

  const projectDirectory = resolve(tempRoot, "provider-explicit-assembly-reference");
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
            assemblyName: "SmokeGeneratedProviderExplicitAssembly",
            references: {
              assemblies: [{ include: "Acme.Native", hintPath: libraryAssembly }],
            },
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { Counter, Numbers } from \"@tsonic/dotnet/Acme.Native.js\";",
      "import type { int } from \"@tsonic/csharp/types.js\";",
      "",
      "export function twice(value: int): int {",
      "  return Numbers.Twice(value);",
      "}",
      "",
      "export function add(value: int, next: int): int {",
      "  const counter = new Counter(value);",
      "  return counter.Add(next);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readGeneratedModuleSource(projectDirectory);
  assert.match(generatedSource, /return Acme\.Native\.Numbers\.Twice\(value\);/);
  assert.match(generatedSource, /Counter counter = new Acme\.Native\.Counter\(value\);/);
  assert.match(generatedSource, /return counter\.Add\(next\);/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedProviderExplicitAssembly.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits provider-owned System.Console and System.Math calls from .NET virtual modules", async () => {
  const projectDirectory = resolve(tempRoot, "provider-system-console-math");
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
            assemblyName: "SmokeGeneratedProviderConsoleMath",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { Console, Math } from \"@tsonic/dotnet/System.js\";",
      "",
      "export function show(value: number): void {",
      "  Console.WriteLine(Math.Sqrt(value));",
      "}",
      "",
      "export function showText(value: string): void {",
      "  Console.Write(value);",
      "  Console.WriteLine();",
      "}",
      "",
      "export function read(): string {",
      "  return Console.ReadLine() ?? \"\";",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readGeneratedModuleSource(projectDirectory);
  assert.match(generatedSource, /public static void show\(double value\)/);
  assert.match(generatedSource, /System\.Console\.WriteLine\(System\.Math\.Sqrt\(value\)\);/);
  assert.match(generatedSource, /System\.Console\.Write\(value\);/);
  assert.match(generatedSource, /System\.Console\.WriteLine\(\);/);
  assert.match(generatedSource, /return System\.Console\.ReadLine\(\) \?\? \"\";/);
  assert.doesNotMatch(generatedSource, /return Console\.|Console\.write|Math\.sqrt|__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedProviderConsoleMath.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits provider-owned optional parameters only from reflected default facts", async () => {
  const projectDirectory = resolve(tempRoot, "provider-optional-parameter-default");
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
            assemblyName: "SmokeGeneratedProviderOptionalParameterDefault",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { ArgumentException } from \"@tsonic/dotnet/System.js\";",
      "",
      "export function validate(value: string): void {",
      "  ArgumentException.ThrowIfNullOrEmpty(value);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readGeneratedModuleSource(projectDirectory);
  assert.match(generatedSource, /System\.ArgumentException\.ThrowIfNullOrEmpty\(value\);/);
  assert.doesNotMatch(generatedSource, /throwIfNullOrEmpty|__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedProviderOptionalParameterDefault.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});
