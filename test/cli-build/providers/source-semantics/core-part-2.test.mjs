import { assert, cliPath, existsSync, readFile, repoRoot, resolve, run, runGeneratedCsharpRunner, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";

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
  assert.match(generatedSource, /floatFromLiteral = 1\.5F;/);
  assert.match(generatedSource, /doubleFromLiteral = 1\.5D;/);
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

test("CLI emits native checked object assertions and preserves nominal identity", async () => {
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
  assert.equal(build.status, 0, build.stdout + build.stderr);
  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static Animal fromObject\(object value\)\s*\{\s*return \(Animal\)value;\s*\}/u);
  assert.doesNotMatch(generatedSource, /CastDynamic|System\.Reflection|\bdynamic\b|__unsupported/u);
  const stdout = await runGeneratedCsharpRunner(projectDirectory, "TsonicGenerated", [
    "using System;",
    "public static class Program",
    "{",
    "    public static void Main()",
    "    {",
    "        var animal = new Tsonic.Generated.Animal();",
    "        Console.WriteLine(ReferenceEquals(animal, Tsonic.Generated.Index.fromObject(animal)));",
    "        try",
    "        {",
    "            Tsonic.Generated.Index.fromObject(new object());",
    "            Console.WriteLine(\"accepted wrong identity\");",
    "        }",
    "        catch (InvalidCastException)",
    "        {",
    "            Console.WriteLine(\"rejected wrong identity\");",
    "        }",
    "    }",
    "}",
    "",
  ]);
  assert.equal(stdout, "True\nrejected wrong identity\n");
});
