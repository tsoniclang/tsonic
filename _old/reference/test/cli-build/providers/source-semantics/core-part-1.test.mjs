import { assert, cliPath, existsSync, readFile, repoRoot, resolve, run, runGeneratedCsharpRunner, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";

test("CLI resolves neutral source primitives through provider modules", async () => {
  const projectDirectory = resolve(tempRoot, "neutral-primitives");
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
            assemblyName: "SmokeGeneratedNeutral",
            targetFramework: "net10.0",
            outputType: "Library",
            publishAot: false,
            languageDialect: "csharp15-preview",
            properties: {
              CheckForOverflowUnderflow: true,
            },
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { bool, char, decimal, float16, float32, float64, int8, int16, int32, int64, int128, nativeInt, nativeUint, uint8, uint16, uint32, uint64, uint128 } from \"@tsonic/core/types.js\";",
      "",
      "export function choose(flag: bool, left: int32, right: int32): int32 {",
      "  return flag ? left : right;",
      "}",
      "",
      "export function keepInt8(value: int8): int8 { return value; }",
      "export function keepUint8(value: uint8): uint8 { return value; }",
      "export function keepInt16(value: int16): int16 { return value; }",
      "export function keepUint16(value: uint16): uint16 { return value; }",
      "export function keepInt32(value: int32): int32 { return value; }",
      "export function keepUint32(value: uint32): uint32 { return value; }",
      "export function keepInt64(value: int64): int64 { return value; }",
      "export function keepUint64(value: uint64): uint64 { return value; }",
      "export function scale(value: float64): float64 {",
      "  return value * 2;",
      "}",
      "",
      "export function keepFloat32(value: float32): float32 { return value; }",
      "export function firstChar(value: char): char {",
      "  return value;",
      "}",
      "",
      "export function keepDecimal(value: decimal): decimal {",
      "  return value;",
      "}",
      "",
      "export function keepNative(value: nativeInt): nativeInt {",
      "  return value;",
      "}",
      "",
      "export function keepNativeUnsigned(value: nativeUint): nativeUint {",
      "  return value;",
      "}",
      "",
      "export function keepInt128(value: int128): int128 {",
      "  return value;",
      "}",
      "",
      "export function keepUint128(value: uint128): uint128 {",
      "  return value;",
      "}",
      "",
      "export function keepFloat16(value: float16): float16 {",
      "  return value;",
      "}",
      "",
      "export function keepBig(value: bigint): bigint {",
      "  return value;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static int choose\(bool flag, int left, int right\)/);
  assert.match(generatedSource, /public static sbyte keepInt8\(sbyte value\)/);
  assert.match(generatedSource, /public static byte keepUint8\(byte value\)/);
  assert.match(generatedSource, /public static short keepInt16\(short value\)/);
  assert.match(generatedSource, /public static ushort keepUint16\(ushort value\)/);
  assert.match(generatedSource, /public static int keepInt32\(int value\)/);
  assert.match(generatedSource, /public static uint keepUint32\(uint value\)/);
  assert.match(generatedSource, /public static long keepInt64\(long value\)/);
  assert.match(generatedSource, /public static ulong keepUint64\(ulong value\)/);
  assert.match(generatedSource, /public static double scale\(double value\)/);
  assert.match(generatedSource, /public static float keepFloat32\(float value\)/);
  assert.match(generatedSource, /public static char firstChar\(char value\)/);
  assert.match(generatedSource, /public static decimal keepDecimal\(decimal value\)/);
  assert.match(generatedSource, /public static nint keepNative\(nint value\)/);
  assert.match(generatedSource, /public static nuint keepNativeUnsigned\(nuint value\)/);
  assert.match(generatedSource, /public static Int128 keepInt128\(Int128 value\)/);
  assert.match(generatedSource, /public static UInt128 keepUint128\(UInt128 value\)/);
  assert.match(generatedSource, /public static Half keepFloat16\(Half value\)/);
  assert.match(generatedSource, /public static System\.Numerics\.BigInteger keepBig\(System\.Numerics\.BigInteger value\)/);
  const generatedProject = await readFile(resolve(projectDirectory, "out/csharp/SmokeGeneratedNeutral.csproj"), "utf8");
  assert.match(generatedProject, /<OutputType>Library<\/OutputType>/);
  assert.match(generatedProject, /<PublishAot>false<\/PublishAot>/);
  assert.match(generatedProject, /<LangVersion>preview<\/LangVersion>/);
  assert.match(generatedProject, /<CheckForOverflowUnderflow>true<\/CheckForOverflowUnderflow>/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedNeutral.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits char string literals as C# char literals from expected TSTS type", async () => {
  const projectDirectory = resolve(tempRoot, "char-literals");
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
            assemblyName: "SmokeGeneratedChar16",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { char } from \"@tsonic/core/types.js\";",
      "",
      "export function letter(): char {",
      "  return \"x\";",
      "}",
      "",
      "export function newline(): char {",
      "  return \"\\n\";",
      "}",
      "",
      "export function choose(flag: boolean): char {",
      "  return flag ? \"a\" : `b`;",
      "}",
      "",
      "export function defaulted(value: char = \"q\"): char {",
      "  return value;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static char letter\(\)/);
  assert.match(generatedSource, /return 'x';/);
  assert.match(generatedSource, /return '\\n';/);
  assert.match(generatedSource, /return flag \? 'a' : 'b';/);
  assert.match(generatedSource, /public static char defaulted\(char\? __tsonic_param0 = null\)/);
  assert.match(generatedSource, /char value = __tsonic_param0 \?\? 'q';/);
  assert.doesNotMatch(generatedSource, /\bis char __tsonic_value\d+/);
  assert.doesNotMatch(generatedSource, /return "x";/);
  assert.doesNotMatch(generatedSource, /char value = "q"/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedChar16.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI rejects multi-code-unit string literals for char targets", async () => {
  const projectDirectory = resolve(tempRoot, "char-invalid-literal");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp" }],
    }, null, 2),
    "src/index.ts": [
      "import type { char } from \"@tsonic/core/types.js\";",
      "",
      "export function bad(): char {",
      "  return \"xy\";",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /char literals require exactly one UTF-16 code unit/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/Generated.csproj")), false);
});

test("CLI resolves TypeScript aliases through TSTS semantics before C# type rendering", async () => {
  const projectDirectory = resolve(tempRoot, "type-aliases");
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
            assemblyName: "SmokeGeneratedTypeAliases",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "type Count = int32;",
      "type Scalar = number;",
      "type Label = string;",
      "",
      "export function increment(value: Count): Count {",
      "  return value + 1;",
      "}",
      "",
      "export function scale(value: Scalar, label: Label): Scalar {",
      "  return value + label.length;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static int increment\(int value\)/);
  assert.match(generatedSource, /public static double scale\(double value, string label\)/);
  assert.match(generatedSource, /return value \+ label\.Length;/);
  assert.doesNotMatch(generatedSource, /\bCount\b/);
  assert.doesNotMatch(generatedSource, /\bScalar\b/);
  assert.doesNotMatch(generatedSource, /\bLabel\b/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedTypeAliases.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});
