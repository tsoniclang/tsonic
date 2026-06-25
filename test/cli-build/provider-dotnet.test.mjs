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
      "import type { uint8 } from \"@tsonic/core/types.js\";",
      "",
      "export function toByte(value: number): uint8 {",
      "  return Convert.toByte(value);",
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
      "import type { uint8 } from \"@tsonic/core/types.js\";",
      "",
      "export function toByte(value: number): uint8 {",
      "  return Convert.toByte(value);",
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

test("CLI emits explicit provider-owned native .NET arrays without JS array surface semantics", async () => {
  const projectDirectory = resolve(tempRoot, "provider-native-dotnet-array");
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
            assemblyName: "SmokeGeneratedProviderNativeDotnetArray",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { Array as DotNetArray } from \"@tsonic/dotnet/System.js\";",
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "export function makeNativeArray(size: int32): DotNetArray<int32> {",
      "  const values = DotNetArray.create<int32>(size);",
      "  values[0] = 7;",
      "  return values;",
      "}",
      "",
      "export function nativeArrayLength(values: DotNetArray<int32>): int32 {",
      "  return values.length;",
      "}",
      "",
      "export function nativeArrayAt(values: DotNetArray<int32>, index: int32): int32 {",
      "  return values[index];",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readGeneratedModuleSource(projectDirectory);
  assert.match(generatedSource, /public static int\[\] makeNativeArray\(int size\)/);
  assert.match(generatedSource, /int\[\] values = new int\[size\];/);
  assert.match(generatedSource, /values\[0\] = 7;/);
  assert.match(generatedSource, /public static int nativeArrayLength\(int\[\] values\)/);
  assert.match(generatedSource, /return values\.Length;/);
  assert.match(generatedSource, /public static int nativeArrayAt\(int\[\] values, int index\)/);
  assert.match(generatedSource, /return values\[index\];/);
  assert.doesNotMatch(generatedSource, /JSArray/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedProviderNativeDotnetArray.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI rejects JS array mutators on explicit provider-owned native .NET arrays", async () => {
  const projectDirectory = resolve(tempRoot, "provider-native-dotnet-array-reject-mutator");
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
            assemblyName: "SmokeGeneratedProviderNativeDotnetArrayRejectMutator",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { Array as DotNetArray } from \"@tsonic/dotnet/System.js\";",
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "export function invalid(values: DotNetArray<int32>): void {",
      "  values.push(1);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.notEqual(build.status, 0);
  assert.match(build.stdout + build.stderr, /push|does not exist|CSHARP_TARGET_MEMBER_NOT_FOUND/u);
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
      "import type { int32, uint8 } from \"@tsonic/core/types.js\";",
      "",
      "export function toByte(value: int32): uint8 {",
      "  return Convert.toByte(value);",
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
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "export function twice(value: int32): int32 {",
      "  return Numbers.twice(value);",
      "}",
      "",
      "export function add(value: int32, next: int32): int32 {",
      "  const counter = new Counter(value);",
      "  return counter.add(next);",
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


test("CLI emits provider-owned static C# properties from selected TSTS target facts", async () => {
  const projectDirectory = resolve(tempRoot, "provider-static-properties");
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
            assemblyName: "SmokeGeneratedProviderStaticProperties",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { Environment } from \"@tsonic/dotnet/System.js\";",
      "",
      "export function newline(): string {",
      "  return Environment.newLine;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readGeneratedModuleSource(projectDirectory);
  assert.match(generatedSource, /public static string newline\(\)/);
  assert.match(generatedSource, /return System\.Environment\.NewLine;/);
  assert.doesNotMatch(generatedSource, /return Environment\.NewLine;/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedProviderStaticProperties.csproj"), "--nologo", "--v:minimal"]);
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
      "  Console.writeLine(Math.sqrt(value));",
      "}",
      "",
      "export function showText(value: string): void {",
      "  Console.write(value);",
      "  Console.writeLine();",
      "}",
      "",
      "export function read(): string {",
      "  return Console.readLine();",
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
  assert.match(generatedSource, /return System\.Console\.ReadLine\(\);/);
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
      "  ArgumentException.throwIfNullOrEmpty(value);",
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
      "  return Environment.getFolderPath(SpecialFolder.desktop);",
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
      "import type { char } from \"@tsonic/core/types.js\";",
      "",
      "export function tailLength(value: string): number {",
      "  const span: ReadOnlySpan<char> = MemoryExtensions.asSpan(value, 1);",
      "  return span.length;",
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
      "  return Path.combine(root, name);",
      "}",
      "",
      "export function exists(root: string, name: string): boolean {",
      "  return File.exists(Path.combine(root, name));",
      "}",
      "",
      "export function read(path: string): string {",
      "  return File.readAllText(path);",
      "}",
      "",
      "export function write(path: string, contents: string): void {",
      "  File.writeAllText(path, contents);",
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
      "import type { int32, uint8 } from \"@tsonic/core/types.js\";",
      "import { BinaryReader, MemoryStream } from \"@tsonic/dotnet/System.IO.js\";",
      "import { Encoding } from \"@tsonic/dotnet/System.Text.js\";",
      "",
      "export function readFirst(bytes: uint8[]): int32 {",
      "  const stream: MemoryStream = new MemoryStream(bytes);",
      "  const reader: BinaryReader = new BinaryReader(stream, Encoding.uTF8);",
      "  return reader.read();",
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


test("CLI rejects provider-owned identifiers outside selected target operations", async () => {
  const projectDirectory = resolve(tempRoot, "provider-identifier-value");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp" }],
    }, null, 2),
    "src/index.ts": [
      "import { Environment } from \"@tsonic/dotnet/System.js\";",
      "",
      "export const environment = Environment;",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /(Provider-owned|Declaration\/provider) identifier 'Environment' requires a selected target operation or type-position usage before C# emission/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
});


test("CLI emits provider-owned instance C# members from receiver type facts", async () => {
  const projectDirectory = resolve(tempRoot, "provider-instance-members");
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
            assemblyName: "SmokeGeneratedProviderInstanceMembers",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { Exception } from \"@tsonic/dotnet/System.js\";",
      "",
      "export function message(): string {",
      "  const ex = new Exception(\"boom\");",
      "  return ex.message;",
      "}",
      "",
      "export function describe(): string {",
      "  const ex = new Exception(\"boom\");",
      "  return ex.toString();",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readGeneratedModuleSource(projectDirectory);
  assert.match(generatedSource, /System\.Exception ex = new System\.Exception\("boom"\);/);
  assert.match(generatedSource, /return ex\.Message;/);
  assert.match(generatedSource, /return ex\.ToString\(\);/);
  assert.doesNotMatch(generatedSource, /ex\.message/);
  assert.doesNotMatch(generatedSource, /ex\.toString/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedProviderInstanceMembers.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});


test("CLI emits provider-owned List initializers for primitive, string, and source class elements", async () => {
  const projectDirectory = resolve(tempRoot, "provider-generic-list-initializer");
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
            assemblyName: "SmokeGeneratedProviderGenericListInitializer",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "import { List } from \"@tsonic/dotnet/System.Collections.Generic.js\";",
      "",
      "export class User {",
      "  name: string;",
      "",
      "  constructor(name: string) {",
      "    this.name = name;",
      "  }",
      "}",
      "",
      "export function makeInts(): List<int32> {",
      "  return new List<int32>([1, 2, 3]);",
      "}",
      "",
      "export function makeStrings(): List<string> {",
      "  return new List<string>([\"a\", \"b\"]);",
      "}",
      "",
      "export function makeUsers(): List<User> {",
      "  const ada = new User(\"Ada\");",
      "  const grace = new User(\"Grace\");",
      "  return new List<User>([ada, grace]);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readGeneratedModuleSource(projectDirectory);
  assert.match(generatedSource, /System\.Collections\.Generic\.List<int> makeInts\(\)/);
  assert.match(generatedSource, /return new System\.Collections\.Generic\.List<int>\(new int\[\] \{ 1, 2, 3 \}\);/);
  assert.match(generatedSource, /System\.Collections\.Generic\.List<string> makeStrings\(\)/);
  assert.match(generatedSource, /return new System\.Collections\.Generic\.List<string>\(new string\[\] \{ "a", "b" \}\);/);
  assert.match(generatedSource, /System\.Collections\.Generic\.List<User> makeUsers\(\)/);
  assert.match(generatedSource, /return new System\.Collections\.Generic\.List<User>\(new User\[\] \{ ada, grace \}\);/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedProviderGenericListInitializer.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits provider-owned generic collection constructors from virtual target modules", async () => {
  const projectDirectory = resolve(tempRoot, "provider-generic-list-constructor");
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
            assemblyName: "SmokeGeneratedProviderGenericList",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "import { List } from \"@tsonic/dotnet/System.Collections.Generic.js\";",
      "",
      "export function makeInts(): List<int32> {",
      "  return new List<int32>([1, 2, 3]);",
      "}",
      "",
      "export function countInts(): int32 {",
      "  const values = new List<int32>([1, 2, 3]);",
      "  return values.count;",
      "}",
      "",
      "export function mutateInts(): int32 {",
      "  const values = new List<int32>();",
      "  values.add(1);",
      "  values.add(2);",
      "  return values[0] + values.count;",
      "}",
      "",
      "export function replaceFirst(value: int32): int32 {",
      "  const values = new List<int32>([1, 2, 3]);",
      "  values[0] = value;",
      "  return values[0];",
      "}",
      "",
      "export function searchInts(): boolean {",
      "  const values = new List<int32>([1, 2, 3]);",
      "  return values.contains(2) && values.indexOf(1) === 0;",
      "}",
      "",
      "export function removeInts(): int32[] {",
      "  const values = new List<int32>([1, 2, 3]);",
      "  values.remove(2);",
      "  values.removeAt(0);",
      "  return values.toArray();",
      "}",
      "",
      "export function clearInts(): int32 {",
      "  const values = new List<int32>([1, 2, 3]);",
      "  values.clear();",
      "  return values.count;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readGeneratedModuleSource(projectDirectory);
  assert.match(generatedSource, /System\.Collections\.Generic\.List<int> makeInts\(\)/);
  assert.match(generatedSource, /return new System\.Collections\.Generic\.List<int>\(new int\[\] \{ 1, 2, 3 \}\);/);
  assert.match(generatedSource, /System\.Collections\.Generic\.List<int> values = new System\.Collections\.Generic\.List<int>\(new int\[\] \{ 1, 2, 3 \}\);/);
  assert.match(generatedSource, /return values\.Count;/);
  assert.match(generatedSource, /public static int mutateInts\(\)/);
  assert.match(generatedSource, /values\.Add\(1\);/);
  assert.match(generatedSource, /values\.Add\(2\);/);
  assert.match(generatedSource, /return values\[0\] \+ values\.Count;/);
  assert.match(generatedSource, /public static int replaceFirst\(int value\)/);
  assert.match(generatedSource, /values\[0\] = value;/);
  assert.match(generatedSource, /return values\[0\];/);
  assert.match(generatedSource, /public static bool searchInts\(\)/);
  assert.match(generatedSource, /return values\.Contains\(2\) && values\.IndexOf\(1\) == 0;/);
  assert.match(generatedSource, /public static int\[\] removeInts\(\)/);
  assert.match(generatedSource, /values\.Remove\(2\);/);
  assert.match(generatedSource, /values\.RemoveAt\(0\);/);
  assert.match(generatedSource, /return values\.ToArray\(\);/);
  assert.match(generatedSource, /public static int clearInts\(\)/);
  assert.match(generatedSource, /values\.Clear\(\);/);
  assert.doesNotMatch(generatedSource, /bindings\.json/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedProviderGenericList.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits JS Record dictionaries through provider-owned Dictionary indexers", async () => {
  const assemblyName = "SmokeGeneratedProviderRecordDictionary";
  const projectDirectory = resolve(tempRoot, "provider-record-dictionary");
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
            outputType: "Exe",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "import { Console } from \"@tsonic/dotnet/System.js\";",
      "",
      "export function getStringDict(): Record<string, number> {",
      "  return {};",
      "}",
      "",
      "export function getNumberDict(): Record<number, string> {",
      "  return {};",
      "}",
      "",
      "export function mutateStringKey(key: string, value: int32): int32 {",
      "  const values: Record<string, int32> = {};",
      "  values[key] = value;",
      "  return values[key];",
      "}",
      "",
      "export function lookupByNumber(dict: Record<number, string>, key: number): string | undefined {",
      "  return dict[key];",
      "}",
      "",
      "export function mutateNumberKey(key: number, value: string): string {",
      "  const values: Record<number, string> = {};",
      "  values[key] = value;",
      "  return values[key];",
      "}",
      "",
      "Console.writeLine(mutateStringKey(\"one\", 7));",
      "Console.writeLine(mutateNumberKey(2, \"two\"));",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readGeneratedModuleSource(projectDirectory);
  assert.match(generatedSource, /System\.Collections\.Generic\.Dictionary<string, double> getStringDict\(\)/);
  assert.match(generatedSource, /return new System\.Collections\.Generic\.Dictionary<string, double>\(\);/);
  assert.match(generatedSource, /System\.Collections\.Generic\.Dictionary<double, string> getNumberDict\(\)/);
  assert.match(generatedSource, /return new System\.Collections\.Generic\.Dictionary<double, string>\(\);/);
  assert.match(generatedSource, /System\.Collections\.Generic\.Dictionary<string, int> values = new System\.Collections\.Generic\.Dictionary<string, int>\(\);/);
  assert.match(generatedSource, /values\[key\] = value;/);
  assert.match(generatedSource, /return values\[key\];/);
  assert.match(generatedSource, /System\.Collections\.Generic\.Dictionary<double, string> values = new System\.Collections\.Generic\.Dictionary<double, string>\(\);/);
  assert.match(generatedSource, /return dict\[key\];/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  assert.equal(runGeneratedProject(projectDirectory, assemblyName), [
    "7",
    "two",
    "",
  ].join("\n"));
});


test("CLI emits provider-owned generic byref collection calls from virtual target modules", async () => {
  const projectDirectory = resolve(tempRoot, "provider-generic-dictionary-out");
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
            assemblyName: "SmokeGeneratedProviderGenericDictionaryOut",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { out } from \"@tsonic/core/lang.js\";",
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "import { Dictionary } from \"@tsonic/dotnet/System.Collections.Generic.js\";",
      "",
      "export function lookup(values: Dictionary<string, int32>, key: string): int32 {",
      "  let value: int32 = 0;",
      "  if (values.tryGetValue(key, out(value))) {",
      "    return value;",
      "  }",
      "  return -1;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readGeneratedModuleSource(projectDirectory);
  assert.match(generatedSource, /System\.Collections\.Generic\.Dictionary<string, int> values/);
  assert.match(generatedSource, /int value = 0;/);
  assert.match(generatedSource, /if \(values\.TryGetValue\(key, out value\)\)/);
  assert.match(generatedSource, /return value;/);
  assert.doesNotMatch(generatedSource, /tryGetValue|out\(value\)|__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedProviderGenericDictionaryOut.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});


test("CLI emits provider-owned delegate type annotations from .NET reflection", async () => {
  const projectDirectory = resolve(tempRoot, "provider-delegate-type-annotations");
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
            assemblyName: "SmokeGeneratedProviderDelegateTypes",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "import type { Predicate } from \"@tsonic/dotnet/System.js\";",
      "",
      "export function identityPredicate(predicate: Predicate<int32>): Predicate<int32> {",
      "  return predicate;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readGeneratedModuleSource(projectDirectory);
  assert.match(generatedSource, /public static System\.Predicate<int> identityPredicate\(System\.Predicate<int> predicate\)/);
  assert.match(generatedSource, /return predicate;/);
  assert.doesNotMatch(generatedSource, /bool identityPredicate\(bool predicate\)/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedProviderDelegateTypes.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});


test("CLI rejects attribute builder targets without provider target facts", async () => {
  const projectDirectory = resolve(tempRoot, "attribute-builder");
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
            assemblyName: "SmokeGeneratedAttributeBuilder",
          },
        },
      ],
    }, null, 2),
    "src/system-attributes.ts": [
      "export const CLSCompliantAttribute: object = {};",
      "",
    ].join("\n"),
    "src/index.ts": [
      "import { attribute as A } from \"@tsonic/core/lang.js\";",
      "import { CLSCompliantAttribute } from \"./system-attributes.js\";",
      "",
      "export class Annotated {",
      "  value: number = 1;",
      "",
      "  constructor(seed: number) {}",
      "",
      "  run(input: number): number {",
      "    return input;",
      "  }",
      "}",
      "",
      "A<Annotated>().add(CLSCompliantAttribute, true);",
      "A<Annotated>().constructor().add(CLSCompliantAttribute, true);",
      "A<Annotated>().constructor().parameter(\"seed\").add(CLSCompliantAttribute, false);",
      "A<Annotated>().property((target) => target.value).add(CLSCompliantAttribute, false);",
      "A<Annotated>().method((target) => target.run).add(CLSCompliantAttribute, true);",
      "A<Annotated>().method((target) => target.run).parameter(\"input\").add(CLSCompliantAttribute, false);",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /C# type expression emission requires a provider target binding or a project-source class\/interface declaration/);
});


test("CLI emits C# attributes from provider target identity facts", async () => {
  const projectDirectory = resolve(tempRoot, "provider-attribute-targets");
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
            assemblyName: "SmokeGeneratedProviderAttributes",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { attribute as A } from \"@tsonic/core/lang.js\";",
      "import { CLSCompliantAttribute } from \"@tsonic/dotnet/System.js\";",
      "",
      "export class Annotated {",
      "  value: number = 1;",
      "  get computed(): number {",
      "    return this.value;",
      "  }",
      "",
      "  constructor(seed: number) {}",
      "",
      "  run(input: number): number {",
      "    return input;",
      "  }",
      "}",
      "",
      "A<Annotated>().add(CLSCompliantAttribute, true);",
      "A<Annotated>().constructor().add(CLSCompliantAttribute, true);",
      "A<Annotated>().constructor().parameter(\"seed\").add(CLSCompliantAttribute, false);",
      "A<Annotated>().property((target) => target.value).target(\"field\").add(CLSCompliantAttribute, false);",
      "A<Annotated>().property((target) => target.computed).target(\"property\").add(CLSCompliantAttribute, true);",
      "A<Annotated>().method((target) => target.run).add(CLSCompliantAttribute, true);",
      "A<Annotated>().method((target) => target.run).target(\"return\").add(CLSCompliantAttribute, false);",
      "A<Annotated>().method((target) => target.run).parameter(\"input\").target(\"param\").add(CLSCompliantAttribute, false);",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readGeneratedModuleSource(projectDirectory);
  assert.match(generatedSource, /\[System\.CLSCompliantAttribute\(true\)\]\s+public class Annotated/);
  assert.match(generatedSource, /\[System\.CLSCompliantAttribute\(true\)\]\s+public Annotated\(\[System\.CLSCompliantAttribute\(false\)\] double seed\)/);
  assert.match(generatedSource, /\[field: System\.CLSCompliantAttribute\(false\)\]\s+public double value = 1;/);
  assert.match(generatedSource, /\[property: System\.CLSCompliantAttribute\(true\)\]\s+public double computed/);
  assert.match(generatedSource, /\[System\.CLSCompliantAttribute\(true\)\]\s+\[return: System\.CLSCompliantAttribute\(false\)\]\s+public double run\(\[param: System\.CLSCompliantAttribute\(false\)\] double input\)/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedProviderAttributes.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});


test("CLI rejects unsupported explicit attribute target specifiers from finalized facts", async () => {
  const projectDirectory = resolve(tempRoot, "provider-attribute-target-specifier-unsupported");
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
            assemblyName: "SmokeGeneratedProviderAttributeTargetSpecifierUnsupported",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { attribute as A } from \"@tsonic/core/lang.js\";",
      "import { CLSCompliantAttribute } from \"@tsonic/dotnet/System.js\";",
      "",
      "export class Annotated {",
      "  run(input: number): number {",
      "    return input;",
      "  }",
      "}",
      "",
      "A<Annotated>().method((target) => target.run).target(\"assembly\").add(CLSCompliantAttribute, true);",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /unsupported explicit target specifier 'assembly'/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/src/Index.cs")), false);
});


test("CLI rejects throw statements until provider exception facts are finalized", async () => {
  const projectDirectory = resolve(tempRoot, "throw-requires-provider-facts");
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
            assemblyName: "SmokeGeneratedThrowFacts",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function fail(): never {",
      "  throw 1;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /Throw statements require finalized TSTS\/provider exception-carrier facts/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedThrowFacts.csproj")), false);
});


test("CLI emits provider-backed C# exception throws", async () => {
  const projectDirectory = resolve(tempRoot, "provider-backed-exception-throw");
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
            assemblyName: "SmokeGeneratedProviderExceptionThrow",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { Exception } from \"@tsonic/dotnet/System.js\";",
      "",
      "export function fail(): never {",
      "  throw new Exception(\"failed\");",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readGeneratedModuleSource(projectDirectory);
  assert.match(generatedSource, /throw new System\.Exception\("failed"\);/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedProviderExceptionThrow.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});


test("CLI emits provider-backed C# catch variables", async () => {
  const projectDirectory = resolve(tempRoot, "provider-backed-catch-variable");
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
            assemblyName: "SmokeGeneratedCatchVariable",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function guarded(): number {",
      "  try {",
      "    return 1;",
      "  } catch (error) {",
      "    return 2;",
      "  }",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readGeneratedModuleSource(projectDirectory);
  assert.match(generatedSource, /catch \(System\.Exception error\)/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedCatchVariable.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});


test("CLI runs provider-backed exception throw, catch, and finally semantics", async () => {
  const assemblyName = "SmokeGeneratedProviderExceptionRuntime";
  const projectDirectory = resolve(tempRoot, "provider-backed-exception-runtime");
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
            outputType: "Exe",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { Console, Exception } from \"@tsonic/dotnet/System.js\";",
      "",
      "let cleanup = 0;",
      "",
      "function guarded(shouldThrow: boolean): string {",
      "  try {",
      "    if (shouldThrow) {",
      "      throw new Exception(\"boom\");",
      "    }",
      "    return \"ok\";",
      "  } catch (error) {",
      "    return \"boom\";",
      "  } finally {",
      "    cleanup++;",
      "  }",
      "}",
      "",
      "Console.writeLine(`throw: ${guarded(true)}`);",
      "Console.writeLine(`pass: ${guarded(false)}`);",
      "Console.writeLine(`cleanup: ${cleanup}`);",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readGeneratedModuleSource(projectDirectory);
  assert.match(generatedSource, /throw new System\.Exception\("boom"\);/);
  assert.match(generatedSource, /catch \(System\.Exception error\)/);
  assert.match(generatedSource, /return "boom";/);
  assert.match(generatedSource, /finally/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  assert.equal(runGeneratedProject(projectDirectory, assemblyName), [
    "throw: boom",
    "pass: ok",
    "cleanup: 2",
    "",
  ].join("\n"));
});

test("CLI enforces provider-backed generic interface constraints through TSTS declarations", async () => {
  const libraryDirectory = resolve(tempRoot, "provider-generic-constraint-library");
  await writeProject(libraryDirectory, {
    "Acme.Constraints.csproj": [
      "<Project Sdk=\"Microsoft.NET.Sdk\">",
      "  <PropertyGroup>",
      "    <TargetFramework>net10.0</TargetFramework>",
      "    <ImplicitUsings>disable</ImplicitUsings>",
      "    <Nullable>enable</Nullable>",
      "  </PropertyGroup>",
      "</Project>",
      "",
    ].join("\n"),
    "Constraints.cs": [
      "namespace Acme.Constraints;",
      "",
      "public interface IMarker",
      "{",
      "    int Marker { get; }",
      "}",
      "",
      "public sealed class Marked : IMarker",
      "{",
      "    public Marked(int marker) => Marker = marker;",
      "    public int Marker { get; }",
      "}",
      "",
      "public sealed class Plain",
      "{",
      "    public Plain(int value) => Value = value;",
      "    public int Value { get; }",
      "}",
      "",
      "public sealed class Box<T> where T : IMarker",
      "{",
      "    public Box(T value) => Value = value;",
      "    public T Value { get; }",
      "    public int ReadMarker() => Value.Marker;",
      "}",
      "",
    ].join("\n"),
  });
  const libraryBuild = run("dotnet", ["build", resolve(libraryDirectory, "Acme.Constraints.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(libraryBuild.status, 0, libraryBuild.stdout + libraryBuild.stderr);
  const libraryAssembly = dotnetOutputAssemblyPath(libraryDirectory, "Acme.Constraints");
  assert.equal(existsSync(libraryAssembly), true);

  const validProjectDirectory = resolve(tempRoot, "provider-generic-constraint-valid");
  await writeProject(validProjectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          options: {
            namespace: "Smoke.Generated",
            assemblyName: "SmokeGeneratedProviderGenericConstraintValid",
            references: {
              assemblies: [{ include: "Acme.Constraints", hintPath: libraryAssembly }],
            },
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { Box, Marked } from \"@tsonic/dotnet/Acme.Constraints.js\";",
      "",
      "export function passBox(box: Box<Marked>): Box<Marked> {",
      "  return box;",
      "}",
      "",
    ].join("\n"),
  });

  const validBuild = runNode([cliPath, "build", "--project", resolve(validProjectDirectory, "tsonic.json")]);
  assert.equal(validBuild.status, 0, validBuild.stdout + validBuild.stderr);
  const validGeneratedSource = await readGeneratedModuleSource(validProjectDirectory);
  assert.match(validGeneratedSource, /public static Acme\.Constraints\.Box<Acme\.Constraints\.Marked> passBox\(Acme\.Constraints\.Box<Acme\.Constraints\.Marked> box\)/);
  assert.match(validGeneratedSource, /return box;/);
  assert.doesNotMatch(validGeneratedSource, /__unsupported/);

  const invalidProjectDirectory = resolve(tempRoot, "provider-generic-constraint-invalid");
  await writeProject(invalidProjectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          options: {
            namespace: "Smoke.Generated",
            assemblyName: "SmokeGeneratedProviderGenericConstraintInvalid",
            references: {
              assemblies: [{ include: "Acme.Constraints", hintPath: libraryAssembly }],
            },
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { Box, Plain } from \"@tsonic/dotnet/Acme.Constraints.js\";",
      "",
      "export function invalid(value: Plain): void {",
      "  const box: Box<Plain> = new Box(value);",
      "}",
      "",
    ].join("\n"),
  });

  const invalidBuild = runNode([cliPath, "build", "--project", resolve(invalidProjectDirectory, "tsonic.json")]);
  assert.notEqual(invalidBuild.status, 0);
  assert.match(invalidBuild.stdout + invalidBuild.stderr, /Plain|IMarker|constraint/u);
});
