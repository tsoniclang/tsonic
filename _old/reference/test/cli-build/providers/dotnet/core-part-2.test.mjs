import { assert, cliPath, dotnetOutputAssemblyPath, existsSync, readFile, repoRoot, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";
import { readGeneratedModuleSource } from './core-fixtures.mjs';

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
