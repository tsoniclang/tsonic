import { assert, cliPath, existsSync, readFile, repoRoot, resolve, run, runGeneratedCsharpRunner, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";

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
      "import { struct as neutralStruct, field, defaultvalue as neutralDefaultValue } from \"@tsonic/core/lang.js\";",
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
