import { assert, cliPath, dotnetOutputAssemblyPath, existsSync, readFile, repoRoot, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "./harness.mjs";

async function readGeneratedModuleSource(projectDirectory) {
  return readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
}

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

test("CLI emits provider-owned params-array arguments from reflected target facts", async () => {
  const libraryDirectory = resolve(tempRoot, "provider-params-array-library");
  await writeProject(libraryDirectory, {
    "Acme.Params.csproj": [
      "<Project Sdk=\"Microsoft.NET.Sdk\">",
      "  <PropertyGroup>",
      "    <TargetFramework>net10.0</TargetFramework>",
      "    <ImplicitUsings>disable</ImplicitUsings>",
      "    <Nullable>enable</Nullable>",
      "  </PropertyGroup>",
      "</Project>",
      "",
    ].join("\n"),
    "ParamsSource.cs": [
      "namespace Acme.Params;",
      "",
      "public static class ParamsSource",
      "{",
      "    public static string Join(string prefix, params int[] values)",
      "        => prefix + \":\" + string.Join(\",\", values);",
      "}",
      "",
    ].join("\n"),
  });
  const libraryBuild = run("dotnet", ["build", resolve(libraryDirectory, "Acme.Params.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(libraryBuild.status, 0, libraryBuild.stdout + libraryBuild.stderr);
  const libraryAssembly = dotnetOutputAssemblyPath(libraryDirectory, "Acme.Params");
  assert.equal(existsSync(libraryAssembly), true);

  const projectDirectory = resolve(tempRoot, "provider-params-array");
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
            assemblyName: "SmokeGeneratedProviderParamsArray",
            references: {
              assemblies: [{ include: "Acme.Params", hintPath: libraryAssembly }],
            },
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { ParamsSource } from \"@tsonic/dotnet/Acme.Params.js\";",
      "import type { int } from \"@tsonic/csharp/types.js\";",
      "",
      "export function joined(first: int, second: int): string {",
      "  return ParamsSource.Join(\"n\", first, second);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readGeneratedModuleSource(projectDirectory);
  assert.match(generatedSource, /return Acme\.Params\.ParamsSource\.Join\("n", first, second\);/);
  assert.doesNotMatch(generatedSource, /ParamsSource\.join|__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedProviderParamsArray.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits unique nested CLR type imports from provider declarations", async () => {
  const projectDirectory = resolve(tempRoot, "provider-system-nested-enum");
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
            assemblyName: "SmokeGeneratedProviderNestedEnum",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { Environment, SpecialFolder } from \"@tsonic/dotnet/System.js\";",
      "",
      "export function desktopPath(): string {",
      "  return Environment.GetFolderPath(SpecialFolder.Desktop);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readGeneratedModuleSource(projectDirectory);
  assert.match(generatedSource, /return System\.Environment\.GetFolderPath\(System\.Environment\.SpecialFolder\.Desktop\);/);
  assert.doesNotMatch(generatedSource, /SpecialFolder\.desktop|__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedProviderNestedEnum.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits provider-owned byref-like System span operations from .NET virtual modules", async () => {
  const projectDirectory = resolve(tempRoot, "provider-system-span");
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
            assemblyName: "SmokeGeneratedProviderSpan",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { MemoryExtensions, ReadOnlySpan } from \"@tsonic/dotnet/System.js\";",
      "import type { char } from \"@tsonic/csharp/types.js\";",
      "",
      "export function tailLength(value: string): number {",
      "  const span: ReadOnlySpan<char> = MemoryExtensions.AsSpan(value, 1);",
      "  return span.Length;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readGeneratedModuleSource(projectDirectory);
  assert.match(generatedSource, /public static double tailLength\(string value\)/);
  assert.match(generatedSource, /System\.ReadOnlySpan<char> span = System\.MemoryExtensions\.AsSpan\(value, 1\);/);
  assert.match(generatedSource, /return span\.Length;/);
  assert.doesNotMatch(generatedSource, /\(\(System\.ReadOnlySpan<char>\)span\)\.Length/);
  assert.doesNotMatch(generatedSource, /MemoryExtensions\.asSpan|__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedProviderSpan.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits provider-owned System.IO calls from .NET virtual modules", async () => {
  const projectDirectory = resolve(tempRoot, "provider-system-io");
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
            assemblyName: "SmokeGeneratedProviderSystemIO",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { File, Path } from \"@tsonic/dotnet/System.IO.js\";",
      "",
      "export function combine(root: string, name: string): string {",
      "  return Path.Combine(root, name);",
      "}",
      "",
      "export function exists(root: string, name: string): boolean {",
      "  return File.Exists(Path.Combine(root, name));",
      "}",
      "",
      "export function read(path: string): string {",
      "  return File.ReadAllText(path);",
      "}",
      "",
      "export function write(path: string, contents: string): void {",
      "  File.WriteAllText(path, contents);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readGeneratedModuleSource(projectDirectory);
  assert.match(generatedSource, /return System\.IO\.Path\.Combine\(root, name\);/);
  assert.match(generatedSource, /return System\.IO\.File\.Exists\(System\.IO\.Path\.Combine\(root, name\)\);/);
  assert.match(generatedSource, /return System\.IO\.File\.ReadAllText\(path\);/);
  assert.match(generatedSource, /System\.IO\.File\.WriteAllText\(path, contents\);/);
  assert.doesNotMatch(generatedSource, /File\.exists|Path\.combine|File\.readAllText|File\.writeAllText|__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedProviderSystemIO.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits provider-owned cross-namespace .NET constructor signatures", async () => {
  const projectDirectory = resolve(tempRoot, "provider-system-io-external-source-ref");
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
            assemblyName: "SmokeGeneratedProviderSystemIOExternalSourceRef",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { byte, int } from \"@tsonic/csharp/types.js\";",
      "import { BinaryReader, MemoryStream } from \"@tsonic/dotnet/System.IO.js\";",
      "import { Encoding } from \"@tsonic/dotnet/System.Text.js\";",
      "",
      "export function readFirst(bytes: byte[]): int {",
      "  const stream: MemoryStream = new MemoryStream(bytes);",
      "  const reader: BinaryReader = new BinaryReader(stream, Encoding.UTF8);",
      "  return reader.Read();",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readGeneratedModuleSource(projectDirectory);
  assert.match(generatedSource, /public static int readFirst\(byte\[\] bytes\)/);
  assert.match(generatedSource, /System\.IO\.MemoryStream stream = new System\.IO\.MemoryStream\(bytes\);/);
  assert.match(generatedSource, /System\.IO\.BinaryReader reader = new System\.IO\.BinaryReader\(stream, System\.Text\.Encoding\.UTF8\);/);
  assert.match(generatedSource, /return reader\.Read\(\);/);
  assert.doesNotMatch(generatedSource, /Encoding\.uTF8|BinaryReader\(stream, Encoding|__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedProviderSystemIOExternalSourceRef.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});
