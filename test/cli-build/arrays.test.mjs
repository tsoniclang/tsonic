import { assert, cliPath, existsSync, readFile, resolve, run, runNode, tempRoot, test, writeProject } from "./harness.mjs";

test("CLI emits typed, empty, nested, and spread array literals from finalized array facts", async () => {
  const projectDirectory = resolve(tempRoot, "arrays-typed-literals");
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
            assemblyName: "SmokeGeneratedArraysTypedLiterals",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { float32, int32 } from \"@tsonic/core/types.js\";",
      "",
      "function accepts(values: int32[]): int32 {",
      "  return values.length;",
      "}",
      "",
      "export function emptyLocal(): int32[] {",
      "  const values: int32[] = [];",
      "  return values;",
      "}",
      "",
      "export function emptyReturn(): int32[] {",
      "  return [];",
      "}",
      "",
      "export function emptyArgument(): int32 {",
      "  return accepts([]);",
      "}",
      "",
      "export function nestedEmptyAndSpread(): int32[][] {",
      "  return [[], [1, 2]];",
      "}",
      "",
      "export function nestedSpread(left: int32[], right: int32[]): int32[][] {",
      "  return [[...left], [0, ...right]];",
      "}",
      "",
      "export function compose(left: int32[], right: int32[]): int32[] {",
      "  return [0, ...left, ...right, 9];",
      "}",
      "",
      "export function typedFloat(): float32 {",
      "  const values: float32[] = [1.5, 2.5];",
      "  return values[0] + values[1];",
      "}",
      "",
      "export function numberForOf(): number {",
      "  let total = 0;",
      "  const values: number[] = [1, 2, 3];",
      "  for (const value of values) {",
      "    total += value;",
      "  }",
      "  return total;",
      "}",
      "",
      "export function int32ForOf(values: int32[]): int32 {",
      "  let total: int32 = 0;",
      "  for (const value of values) {",
      "    total += value;",
      "  }",
      "  return total;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /int\[\] values = new int\[\] \{ \};/);
  assert.match(generatedSource, /return new int\[\] \{ \};/);
  assert.match(generatedSource, /return accepts\(new int\[\] \{ \}\);/);
  assert.match(generatedSource, /return new int\[\]\[\] \{ new int\[\] \{ \}, new int\[\] \{ 1, 2 \} \};/);
  assert.match(generatedSource, /return new int\[\]\[\] \{ Tsonic\.CSharp\.Runtime\.ArrayHelpers\.Concat\(left\), Tsonic\.CSharp\.Runtime\.ArrayHelpers\.Concat\(new int\[\] \{ 0 \}, right\) \};/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Runtime\.ArrayHelpers\.Concat\(new int\[\] \{ 0 \}, left, right, new int\[\] \{ 9 \}\);/);
  assert.match(generatedSource, /float\[\] values = new float\[\] \{ 1.5F, 2.5F \};/);
  assert.match(generatedSource, /double\[\] values = new double\[\] \{ 1, 2, 3 \};/);
  assert.match(generatedSource, /foreach \(double value in values\)/);
  assert.match(generatedSource, /foreach \(int value in values\)/);
  assert.doesNotMatch(generatedSource, /__unsupported|InvalidExpression/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedArraysTypedLiterals.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits module-scope array spread constants from finalized expected array facts", async () => {
  const projectDirectory = resolve(tempRoot, "arrays-module-spread-constants");
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
            assemblyName: "SmokeGeneratedArraysModuleSpreadConstants",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "const source: int32[] = [1, 2, 3];",
      "export const withSpread: int32[] = [...source, 4, 5];",
      "",
      "const more: int32[] = [10, 20];",
      "export const multiSpread: int32[] = [...source, ...more, 100];",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static readonly int\[\] source = new int\[\] \{ 1, 2, 3 \};/);
  assert.match(generatedSource, /public static readonly int\[\] withSpread = Tsonic\.CSharp\.Runtime\.ArrayHelpers\.Concat\(source, new int\[\] \{ 4, 5 \}\);/);
  assert.match(generatedSource, /public static readonly int\[\] more = new int\[\] \{ 10, 20 \};/);
  assert.match(generatedSource, /public static readonly int\[\] multiSpread = Tsonic\.CSharp\.Runtime\.ArrayHelpers\.Concat\(source, more, new int\[\] \{ 100 \}\);/);
  assert.doesNotMatch(generatedSource, /__unsupported|InvalidExpression/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedArraysModuleSpreadConstants.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI rejects untyped empty array returns with a target diagnostic", async () => {
  const projectDirectory = resolve(tempRoot, "arrays-empty-return-requires-element-evidence");
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
            assemblyName: "SmokeGeneratedArraysEmptyReturnRequiresElementEvidence",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function f() {",
      "  return [];",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /array element type evidence/);
  assert.doesNotMatch(build.stderr, /resolvedTypeArguments|TypeError|Cannot read properties/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedArraysEmptyReturnRequiresElementEvidence.csproj")), false);
});

test("CLI emits native .NET array element access and JS-selected length facts", async () => {
  const projectDirectory = resolve(tempRoot, "arrays-native-provider");
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
            assemblyName: "SmokeGeneratedArraysNativeProvider",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "import { BinaryReader, MemoryStream } from \"@tsonic/dotnet/System.IO.js\";",
      "",
      "export function readFirstPlusLength(): int32 {",
      "  const stream = new MemoryStream([65, 66]);",
      "  const reader = new BinaryReader(stream);",
      "  const bytes = reader.readBytes(2);",
      "  return bytes[0] + bytes.length;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /new System\.IO\.MemoryStream\(new byte\[\] \{ 65, 66 \}\)/);
  assert.match(generatedSource, /byte\[\] bytes = reader\.ReadBytes\(2\);/);
  assert.match(generatedSource, /return bytes\[0\] \+ bytes\.Length;/);
  assert.doesNotMatch(generatedSource, /__unsupported|InvalidExpression/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedArraysNativeProvider.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI rejects native array length without selected JS or provider facts", async () => {
  const projectDirectory = resolve(tempRoot, "arrays-native-length-requires-facts");
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
            assemblyName: "SmokeGeneratedArraysNativeLengthRequiresFacts",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "import { BinaryReader, MemoryStream } from \"@tsonic/dotnet/System.IO.js\";",
      "",
      "export function readLength(): int32 {",
      "  const stream = new MemoryStream([65, 66]);",
      "  const reader = new BinaryReader(stream);",
      "  const bytes = reader.readBytes(2);",
      "  return bytes.length;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /C# property access 'length' must be selected by TSTS\/provider facts before emission/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedArraysNativeLengthRequiresFacts.csproj")), false);
});
