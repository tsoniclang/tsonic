import { assert, cliPath, existsSync, readFile, repoRoot, resolve, run, runNode, tempRoot, test, writeProject } from "./harness.mjs";

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
            properties: {
              LangVersion: "preview",
              CheckForOverflowUnderflow: true,
            },
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int32, int128, nativeInt, float64, float16, bool, char, decimal } from \"@tsonic/core/types.js\";",
      "",
      "export function choose(flag: bool, left: int32, right: int32): int32 {",
      "  return flag ? left : right;",
      "}",
      "",
      "export function scale(value: float64): float64 {",
      "  return value * 2;",
      "}",
      "",
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
      "export function keepInt128(value: int128): int128 {",
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
  assert.match(generatedSource, /public static double scale\(double value\)/);
  assert.match(generatedSource, /public static char firstChar\(char value\)/);
  assert.match(generatedSource, /public static decimal keepDecimal\(decimal value\)/);
  assert.match(generatedSource, /public static nint keepNative\(nint value\)/);
  assert.match(generatedSource, /public static Int128 keepInt128\(Int128 value\)/);
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

test("CLI emits pointer signatures from finalized source pointer facts", async () => {
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
      "import type { ptr } from \"@tsonic/core/lang.js\";",
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "export function accept(value: ptr<int32>): void {}",
      "",
      "export function accept2(value: ptr<ptr<int32>>): void {}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public unsafe static class Index/);
  assert.match(generatedSource, /public static void accept\(int\* value\)/);
  assert.match(generatedSource, /public static void accept2\(int\*\* value\)/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const generatedProject = await readFile(resolve(projectDirectory, "out/csharp/SmokeGeneratedPointerFacts.csproj"), "utf8");
  assert.match(generatedProject, /<AllowUnsafeBlocks>true<\/AllowUnsafeBlocks>/);

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
      "import type { int32, uint8, int16, int64, uint32, float32, decimal } from \"@tsonic/core/types.js\";",
      "",
      "class Animal {}",
      "class Dog extends Animal {}",
      "",
      "export const intFromLiteral: int32 = 1000;",
      "export const byteFromLiteral = 255 as uint8;",
      "export const shortFromLiteral = 1000 as int16;",
      "export const longFromLiteral = 1000000 as int64;",
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
  assert.match(generatedSource, /public static readonly int intFromLiteral;/);
  assert.match(generatedSource, /public static readonly byte byteFromLiteral;/);
  assert.match(generatedSource, /public static readonly short shortFromLiteral;/);
  assert.match(generatedSource, /public static readonly long longFromLiteral;/);
  assert.match(generatedSource, /public static readonly float floatFromLiteral;/);
  assert.match(generatedSource, /public static readonly double doubleFromLiteral;/);
  assert.match(generatedSource, /static Index\(\)/);
  assert.match(generatedSource, /intFromLiteral = 1000;/);
  assert.match(generatedSource, /byteFromLiteral = 255;/);
  assert.match(generatedSource, /shortFromLiteral = 1000;/);
  assert.match(generatedSource, /longFromLiteral = System\.Convert\.ToInt64\(1000000\);/);
  assert.match(generatedSource, /floatFromLiteral = 1\.5F;/);
  assert.match(generatedSource, /doubleFromLiteral = 1\.5;/);
  assert.match(generatedSource, /Dog dog = \(Dog\)animal;/);
  assert.match(generatedSource, /return System\.Convert\.ToByte\(value\);/);
  assert.match(generatedSource, /return System\.Convert\.ToInt16\(value\);/);
  assert.match(generatedSource, /return System\.Convert\.ToUInt32\(value\);/);
  assert.match(generatedSource, /return System\.Convert\.ToSingle\(value\);/);
  assert.match(generatedSource, /return System\.Convert\.ToDecimal\(value\);/);
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
  assert.match(build.stderr, /TypeScript object is a broad structural carrier/);
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
      "import { struct as neutralStruct, field, defaultof as neutralDefaultof } from \"@tsonic/core/lang.js\";",
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
      "import type { int } from \"@tsonic/csharp/types.js\";",
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
      "import { struct as csharpStruct } from \"@tsonic/csharp/lang.js\";",
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "import type { int } from \"@tsonic/csharp/types.js\";",
      "",
      "export const Point = struct({",
      "  x: field<int32>(),",
      "  y: field<int32>(),",
      "});",
      "",
      "export const Counter = csharpStruct({",
      "  value: field<int>(),",
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


test("CLI emits C# default expressions from neutral default facts and C# aliases", async () => {
  const projectDirectory = resolve(tempRoot, "default-value-facts");
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
            assemblyName: "SmokeGeneratedDefaults",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { defaultof } from \"@tsonic/core/lang.js\";",
      "import { defaultof as csharpDefaultof } from \"@tsonic/csharp/lang.js\";",
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "export function zero(): int32 {",
      "  return defaultof<int32>();",
      "}",
      "",
      "export function csharpZero(): int32 {",
      "  return csharpDefaultof<int32>();",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /return default\(int\);/);
  assert.match(generatedSource, /public static int csharpZero\(\)/);
  assert.doesNotMatch(generatedSource, /defaultof/);
  assert.doesNotMatch(generatedSource, /defaultof/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedDefaults.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});


test("CLI emits C# argument passing from neutral storage facts and C# aliases", async () => {
  const projectDirectory = resolve(tempRoot, "argument-passing-facts");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp" }],
    }, null, 2),
    "src/index.ts": [
      "import { out as writeonlyRef, ref as readwriteRef, inref as readonlyRef } from \"@tsonic/core/lang.js\";",
      "import { out, ref, inref } from \"@tsonic/csharp/lang.js\";",
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "export function consume(a: int32, b: int32, c: int32): void {",
      "}",
      "",
      "export function pass(value: int32): void {",
      "  consume(writeonlyRef(value), readwriteRef(value), readonlyRef(value));",
      "  consume(out(value), ref(value), inref(value));",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /consume\(out value, ref value, in value\);/);
  assert.doesNotMatch(generatedSource, /out\(value\)/);
  assert.doesNotMatch(generatedSource, /ref\(value\)/);
  assert.doesNotMatch(generatedSource, /inref\(value\)/);
  assert.doesNotMatch(generatedSource, /writeonlyRef/);
  assert.doesNotMatch(generatedSource, /readwriteRef/);
  assert.doesNotMatch(generatedSource, /readonlyRef/);
  assert.doesNotMatch(generatedSource, /__unsupported/);
});

test("CLI rejects byref source markers without finalized storage facts", async () => {
  const projectDirectory = resolve(tempRoot, "argument-passing-non-storage-rejected");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp" }],
    }, null, 2),
    "src/index.ts": [
      "import { out, ref, inref } from \"@tsonic/core/lang.js\";",
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "export function invalid(value: int32): void {",
      "  out(value + 1);",
      "  ref(value + 1);",
      "  inref(value + 1);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /TSTS_SOURCE_SEMANTICS_0001/);
  assert.match(build.stderr, /requires a storage expression/);
  assert.match(build.stderr, /out/u);
  assert.match(build.stderr, /ref/u);
  assert.match(build.stderr, /inref/u);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
});


test("CLI rejects neutral borrow and move markers before C# output", async () => {
  const projectDirectory = resolve(tempRoot, "borrow-move-rejected");
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
            assemblyName: "SmokeGeneratedBorrowMoveRejected",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { borrow as sharedBorrow } from \"@tsonic/core/lang.js\";",
      "import * as CoreLang from \"@tsonic/core/lang.js\";",
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "export function use(value: int32): void {",
      "  sharedBorrow(value);",
      "  CoreLang.borrowMut(value);",
      "  CoreLang.move(value);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /TS9100135/);
  assert.match(build.stderr, /C# target does not implement source flow marker/);
  assert.match(build.stderr, /borrow/u);
  assert.match(build.stderr, /borrowMut/u);
  assert.match(build.stderr, /move/u);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedBorrowMoveRejected.csproj")), false);
});


test("CLI emits C# pointer and function-pointer types from source marker facts", async () => {
  const projectDirectory = resolve(tempRoot, "pointer-function-pointer-types");
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
            assemblyName: "SmokeGeneratedPointers",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "import type { ptr, fnptr } from \"@tsonic/core/lang.js\";",
      "",
      "export class NativeSlots {",
      "  current: ptr<int32>;",
      "  callback: fnptr<[int32], int32>;",
      "",
      "  constructor(current: ptr<int32>, callback: fnptr<[int32], int32>) {",
      "    this.current = current;",
      "    this.callback = callback;",
      "  }",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedProject = await readFile(resolve(projectDirectory, "out/csharp/SmokeGeneratedPointers.csproj"), "utf8");
  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedProject, /<AllowUnsafeBlocks>true<\/AllowUnsafeBlocks>/);
  assert.match(generatedSource, /public unsafe class NativeSlots/);
  assert.match(generatedSource, /public int\* current;/);
  assert.match(generatedSource, /public delegate\*<int, int> callback;/);
  assert.match(generatedSource, /public NativeSlots\(int\* current, delegate\*<int, int> callback\)/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedPointers.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});


test("CLI rejects any and unknown before they trickle into C# output", async () => {
  const projectDirectory = resolve(tempRoot, "reject-any-unknown");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp" }],
    }, null, 2),
    "src/index.ts": [
      "export function leakUnknown(value: unknown): unknown {",
      "  return value;",
      "}",
      "",
      "export function leakAny(value: any): any {",
      "  return value;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /any and unknown cannot trickle into generated C#/);
});
