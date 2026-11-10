import { assert, cliPath, dotnetOutputAssemblyPath, existsSync, readFile, repoRoot, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";
import { readGeneratedModuleSource } from './core-fixtures.mjs';

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

test("CLI rejects omitted provider optional parameters without reflected default facts", async () => {
  const libraryDirectory = resolve(tempRoot, "provider-optional-without-default-library");
  await writeProject(libraryDirectory, {
    "Acme.OptionalDefaults.csproj": [
      "<Project Sdk=\"Microsoft.NET.Sdk\">",
      "  <PropertyGroup>",
      "    <TargetFramework>net10.0</TargetFramework>",
      "    <ImplicitUsings>disable</ImplicitUsings>",
      "    <Nullable>enable</Nullable>",
      "  </PropertyGroup>",
      "</Project>",
      "",
    ].join("\n"),
    "OptionalSource.cs": [
      "using System.Runtime.InteropServices;",
      "",
      "namespace Acme.OptionalDefaults;",
      "",
      "public static class OptionalSource",
      "{",
      "    public static void OptionalWithoutDefault([Optional] string value) { }",
      "}",
      "",
    ].join("\n"),
  });
  const libraryBuild = run("dotnet", ["build", resolve(libraryDirectory, "Acme.OptionalDefaults.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(libraryBuild.status, 0, libraryBuild.stdout + libraryBuild.stderr);
  const libraryAssembly = dotnetOutputAssemblyPath(libraryDirectory, "Acme.OptionalDefaults");
  assert.equal(existsSync(libraryAssembly), true);

  const projectDirectory = resolve(tempRoot, "provider-optional-without-default-reject");
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
            assemblyName: "SmokeGeneratedProviderOptionalWithoutDefaultReject",
            references: {
              assemblies: [{ include: "Acme.OptionalDefaults", hintPath: libraryAssembly }],
            },
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { OptionalSource } from \"@tsonic/dotnet/Acme.OptionalDefaults.js\";",
      "",
      "export function invalid(): void {",
      "  OptionalSource.optionalWithoutDefault();",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.notEqual(build.status, 0);
  assert.match(build.stdout + build.stderr, /CSHARP_TARGET_MEMBER_NOT_FOUND|optional|default/u);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedProviderOptionalWithoutDefaultReject.csproj")), false);
});
