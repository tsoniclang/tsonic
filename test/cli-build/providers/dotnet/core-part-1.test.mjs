import { assert, cliPath, dotnetOutputAssemblyPath, existsSync, readFile, repoRoot, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";
import { readGeneratedModuleSource } from './core-fixtures.mjs';

test("CLI emits provider-owned static C# calls from selected TSTS target facts", async () => {
  const projectDirectory = resolve(tempRoot, "provider-static-calls");
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
            assemblyName: "SmokeGeneratedProviderStaticCalls",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { Convert } from \"@tsonic/dotnet/System.js\";",
      "import type { byte } from \"@tsonic/csharp/types.js\";",
      "",
      "export function toByte(value: number): byte {",
      "  return Convert.ToByte(value);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readGeneratedModuleSource(projectDirectory);
  assert.match(generatedSource, /public static byte toByte\(double value\)/);
  assert.match(generatedSource, /return System\.Convert\.ToByte\(value\);/);
  assert.doesNotMatch(generatedSource, /return Convert\.ToByte\(value\);/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedProviderStaticCalls.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI does not fall back to file-backed packages for provider-owned .NET modules", async () => {
  const projectDirectory = resolve(tempRoot, "provider-file-backed-shadow");
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
            assemblyName: "SmokeGeneratedProviderFileBackedShadow",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { Convert } from \"@tsonic/dotnet/System.js\";",
      "import type { byte } from \"@tsonic/csharp/types.js\";",
      "",
      "export function toByte(value: number): byte {",
      "  return Convert.ToByte(value);",
      "}",
      "",
    ].join("\n"),
    "node_modules/@tsonic/dotnet/package.json": JSON.stringify({
      name: "@tsonic/dotnet",
      type: "module",
      exports: {
        "./System.js": "./System.ts",
      },
    }, null, 2),
    "node_modules/@tsonic/dotnet/System.ts": [
      "export const Convert = {",
      "  toByte(value: number): number {",
      "    return 255;",
      "  },",
      "};",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readGeneratedModuleSource(projectDirectory);
  assert.match(generatedSource, /return System\.Convert\.ToByte\(value\);/);
  assert.doesNotMatch(generatedSource, /255|node_modules|Convert\.toByte|__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedProviderFileBackedShadow.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI accepts provider-owned overloads discovered from .NET reflection", async () => {
  const projectDirectory = resolve(tempRoot, "provider-static-call-reflection-overload");
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
            assemblyName: "SmokeGeneratedProviderStaticCallReflectionOverload",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { Convert } from \"@tsonic/dotnet/System.js\";",
      "import type { byte, int } from \"@tsonic/csharp/types.js\";",
      "",
      "export function toByte(value: int): byte {",
      "  return Convert.ToByte(value);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readGeneratedModuleSource(projectDirectory);
  assert.match(generatedSource, /public static byte toByte\(int value\)/);
  assert.match(generatedSource, /return System\.Convert\.ToByte\(value\);/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedProviderStaticCallReflectionOverload.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

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
