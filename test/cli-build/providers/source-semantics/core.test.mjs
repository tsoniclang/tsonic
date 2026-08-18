import { assert, cliPath, existsSync, readFile, repoRoot, resolve, run, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";






























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
  assert.match(generatedSource, /public static char defaulted\(char value = 'q'\)/);
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
test("CLI emits typed-location signatures from finalized source pointer facts", async () => {
  const projectDirectory = resolve(tempRoot, "pointer-source-semantics");
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
            assemblyName: "SmokeGeneratedPointerFacts",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { Pointer } from \"@tsonic/core/types.js\";",
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "export function accept(value: Pointer<int32>): void {}",
      "",
      "export function accept2(value: Pointer<Pointer<int32>>): void {}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static class Index/);
  assert.match(generatedSource, /public static void accept\(Tsonic\.CSharp\.Runtime\.Location<int> value\)/);
  assert.match(generatedSource, /public static void accept2\(Tsonic\.CSharp\.Runtime\.Location<Tsonic\.CSharp\.Runtime\.Location<int>> value\)/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const generatedProject = await readFile(resolve(projectDirectory, "out/csharp/SmokeGeneratedPointerFacts.csproj"), "utf8");
  assert.doesNotMatch(generatedProject, /<AllowUnsafeBlocks>true<\/AllowUnsafeBlocks>/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedPointerFacts.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});
test("CLI emits reference type assertions through finalized C# conversion facts", async () => {
  const projectDirectory = resolve(tempRoot, "type-assertion-conversions");
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
            assemblyName: "SmokeGeneratedTypeAssertions",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int32, uint8, int16, int64, uint64, int128, uint128, uint32, float32, decimal } from \"@tsonic/core/types.js\";",
      "",
      "class Animal {}",
      "class Dog extends Animal {}",
      "",
      "export const intFromLiteral: int32 = 1000;",
      "export const byteFromLiteral = 255 as uint8;",
      "export const shortFromLiteral = 1000 as int16;",
      "export const longFromLiteral = 1000000n as int64;",
      "export const ulongFromLiteral = 18446744073709551615n as uint64;",
      "export const int128FromLiteral = -170141183460469231731687303715884105728n as int128;",
      "export const uint128FromLiteral = 340282366920938463463374607431768211455n as uint128;",
      "export const floatFromLiteral = 1.5 as float32;",
      "export const doubleFromLiteral = 1.5 as number;",
      "",
      "export function downcast(animal: Animal): Dog {",
      "  const dog = animal as Dog;",
      "  return dog;",
      "}",
      "",
      "export function byteValue(value: int32): uint8 {",
      "  return value as uint8;",
      "}",
      "",
      "export function shortValue(value: int32): int16 {",
      "  return value as int16;",
      "}",
      "",
      "export function uintValue(value: int32): uint32 {",
      "  return value as uint32;",
      "}",
      "",
      "export function singleValue(value: int32): float32 {",
      "  return value as float32;",
      "}",
      "",
      "export function decimalValue(value: int32): decimal {",
      "  return value as decimal;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static int intFromLiteral\s*\{\s*get;\s*private set;\s*\} = default\(int\)!;/u);
  assert.match(generatedSource, /public static byte byteFromLiteral\s*\{\s*get;\s*private set;\s*\} = default\(byte\)!;/u);
  assert.match(generatedSource, /public static short shortFromLiteral\s*\{\s*get;\s*private set;\s*\} = default\(short\)!;/u);
  assert.match(generatedSource, /public static long longFromLiteral\s*\{\s*get;\s*private set;\s*\} = default\(long\)!;/u);
  assert.match(generatedSource, /public static ulong ulongFromLiteral\s*\{\s*get;\s*private set;\s*\} = default\(ulong\)!;/u);
  assert.match(generatedSource, /public static Int128 int128FromLiteral\s*\{\s*get;\s*private set;\s*\} = default\(Int128\)!;/u);
  assert.match(generatedSource, /public static UInt128 uint128FromLiteral\s*\{\s*get;\s*private set;\s*\} = default\(UInt128\)!;/u);
  assert.match(generatedSource, /public static float floatFromLiteral\s*\{\s*get;\s*private set;\s*\} = default\(float\)!;/u);
  assert.match(generatedSource, /public static double doubleFromLiteral\s*\{\s*get;\s*private set;\s*\} = default\(double\)!;/u);
  assert.match(generatedSource, /private static object\? __tsonic_module_init_core\(\)/u);
  assert.match(generatedSource, /intFromLiteral = 1000;/);
  assert.match(generatedSource, /byteFromLiteral = \(byte\)255;/);
  assert.match(generatedSource, /shortFromLiteral = \(short\)1000;/);
  assert.match(generatedSource, /longFromLiteral = 1000000L;/);
  assert.match(generatedSource, /ulongFromLiteral = 18446744073709551615UL;/u);
  assert.match(generatedSource, /int128FromLiteral = new Int128\(9223372036854775808UL, 0UL\);/u);
  assert.match(generatedSource, /uint128FromLiteral = new UInt128\(18446744073709551615UL, 18446744073709551615UL\);/u);
  assert.match(generatedSource, /floatFromLiteral = \(float\)1\.5;/);
  assert.match(generatedSource, /doubleFromLiteral = 1\.5;/);
  assert.match(generatedSource, /Dog dog = \(Dog\)animal;/);
  assert.match(generatedSource, /return \(byte\)value;/);
  assert.match(generatedSource, /return \(short\)value;/);
  assert.match(generatedSource, /return \(uint\)value;/);
  assert.match(generatedSource, /public static float singleValue\(int value\)[\s\S]*return value;/u);
  assert.match(generatedSource, /public static decimal decimalValue\(int value\)[\s\S]*return value;/u);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedTypeAssertions.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});
test("CLI rejects broad object assertions without finalized carrier facts", async () => {
  const projectDirectory = resolve(tempRoot, "object-type-assertion-rejected");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp" }],
    }, null, 2),
    "src/index.ts": [
      "class Animal {}",
      "",
      "export function fromObject(value: object): Animal {",
      "  return value as Animal;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /CSHARP_UNSUPPORTED_AST index\.ts:3:35: C# type policy could not resolve source node kind 'KindObjectKeyword' to a closed target type\./u);
  assert.match(build.stderr, /C# conversion requires closed source and target representations\./u);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
});
test("CLI keeps neutral and C# source semantics in separate virtual modules", async () => {
  const projectDirectory = resolve(tempRoot, "source-semantics-split");
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
            assemblyName: "SmokeGeneratedSourceSemantics",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { struct as neutralStruct, field, defaultValue as neutralDefaultValue } from \"@tsonic/core/lang.js\";",
      "import { struct, attribute, defaultof } from \"@tsonic/csharp/lang.js\";",
      "",
      "export function smoke(): number {",
      "  return 1;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static double smoke\(\)/);
  assert.doesNotMatch(generatedSource, /__unsupported/);
});
test("CLI maps configured primitive aliases only from their provider modules", async () => {
  const projectDirectory = resolve(tempRoot, "configured-primitive-aliases");
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
            assemblyName: "SmokeGeneratedConfiguredPrimitiveAliases",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "import type { bool, byte, char, decimal, double, float, int, long, nint, nuint, sbyte, short, uint, ulong, ushort } from \"@tsonic/csharp/types.js\";",
      "",
      "type LocalInt = number;",
      "",
      "export function neutral(value: int32): int32 {",
      "  return value;",
      "}",
      "",
      "export function csharpAlias(value: int): int {",
      "  return value;",
      "}",
      "",
      "export function alias_bool(value: bool): bool { return value; }",
      "export function alias_byte(value: byte): byte { return value; }",
      "export function alias_char(value: char): char { return value; }",
      "export function alias_decimal(value: decimal): decimal { return value; }",
      "export function alias_double(value: double): double { return value; }",
      "export function alias_float(value: float): float { return value; }",
      "export function alias_long(value: long): long { return value; }",
      "export function alias_nint(value: nint): nint { return value; }",
      "export function alias_nuint(value: nuint): nuint { return value; }",
      "export function alias_sbyte(value: sbyte): sbyte { return value; }",
      "export function alias_short(value: short): short { return value; }",
      "export function alias_uint(value: uint): uint { return value; }",
      "export function alias_ulong(value: ulong): ulong { return value; }",
      "export function alias_ushort(value: ushort): ushort { return value; }",
      "",
      "export function localAlias(value: LocalInt): LocalInt {",
      "  return value;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static int neutral\(int value\)/);
  assert.match(generatedSource, /public static int csharpAlias\(int value\)/);
  assert.match(generatedSource, /public static bool alias_bool\(bool value\)/);
  assert.match(generatedSource, /public static byte alias_byte\(byte value\)/);
  assert.match(generatedSource, /public static char alias_char\(char value\)/);
  assert.match(generatedSource, /public static decimal alias_decimal\(decimal value\)/);
  assert.match(generatedSource, /public static double alias_double\(double value\)/);
  assert.match(generatedSource, /public static float alias_float\(float value\)/);
  assert.match(generatedSource, /public static long alias_long\(long value\)/);
  assert.match(generatedSource, /public static nint alias_nint\(nint value\)/);
  assert.match(generatedSource, /public static nuint alias_nuint\(nuint value\)/);
  assert.match(generatedSource, /public static sbyte alias_sbyte\(sbyte value\)/);
  assert.match(generatedSource, /public static short alias_short\(short value\)/);
  assert.match(generatedSource, /public static uint alias_uint\(uint value\)/);
  assert.match(generatedSource, /public static ulong alias_ulong\(ulong value\)/);
  assert.match(generatedSource, /public static ushort alias_ushort\(ushort value\)/);
  assert.match(generatedSource, /public static double localAlias\(double value\)/);
  assert.doesNotMatch(generatedSource, /\bLocalInt\b/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedConfiguredPrimitiveAliases.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});
test("CLI rejects C# source aliases imported from neutral core modules", async () => {
  const projectDirectory = resolve(tempRoot, "source-semantics-wrong-module");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp" }],
    }, null, 2),
    "src/index.ts": [
      "import type { int } from \"@tsonic/core/types.js\";",
      "",
      "export function smoke(value: int): int {",
      "  return value;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /TSTS_DIAGNOSTIC/);
});
test("CLI emits C# structs from neutral value-type facts and C# aliases", async () => {
  const projectDirectory = resolve(tempRoot, "value-type-facts");
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
            assemblyName: "SmokeGeneratedValueTypes",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { struct, field } from \"@tsonic/core/lang.js\";",
      "import { struct as csharpStruct, field as csharpField } from \"@tsonic/csharp/lang.js\";",
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "import type { int } from \"@tsonic/csharp/types.js\";",
      "",
      "export const Point = struct({",
      "  x: field<int32>(),",
      "  y: field<int32>(),",
      "});",
      "",
      "export const Counter = csharpStruct({",
      "  value: csharpField<int>(),",
      "});",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public struct Point/);
  assert.match(generatedSource, /public int x;/);
  assert.match(generatedSource, /public int y;/);
  assert.match(generatedSource, /public struct Counter/);
  assert.match(generatedSource, /public int value;/);
  assert.doesNotMatch(generatedSource, /struct\(/);
  assert.doesNotMatch(generatedSource, /struct\(/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedValueTypes.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});
