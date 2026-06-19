import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const repoRoot = process.cwd();
const cliPath = resolve(repoRoot, "packages/cli/dist/src/index.js");
const tempRoot = resolve(repoRoot, ".temp/test-runs/cli-build");

test("CLI lists built-in target packs", () => {
  const result = runNode([cliPath, "targets"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^csharp\tC#$/m);
});

test("CLI emits C# source project from TSTS semantics and compiles with dotnet", async () => {
  const projectDirectory = resolve(tempRoot, "wide-csharp");
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
            assemblyName: "SmokeGeneratedWide",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int } from \"@tsonic/csharp/types.js\";",
      "",
      "export class Counter {",
      "  value: int = 0;",
      "  history: int[] = [];",
      "",
      "  constructor(initial: int) {",
      "    this.value = initial;",
      "  }",
      "",
      "  inc(delta: int): int {",
      "    for (let i: int = 0; i < delta; i++) {",
      "      this.value = this.value + i;",
      "    }",
      "    do {",
      "      this.value--;",
      "    } while (this.value > 10);",
      "    return this.value % 2 === 0 ? this.value : this.value + 1;",
      "  }",
      "}",
      "",
      "export function pick(values: int[]): int {",
      "  return values[1];",
      "}",
      "",
      "export function sum(values: number[]): number {",
      "  let total = 0;",
      "  let seen: number[] = [];",
      "  for (const value of values) {",
      "    total = total + value;",
      "  }",
      "  return total;",
      "}",
      "",
      "export function control(value: int): int {",
      "  let result: int = 0;",
      "  while (result < value) {",
      "    result++;",
      "    if (result === 2) continue;",
      "    if (result > 5) break;",
      "  }",
      "  switch (value) {",
      "    case 0:",
      "      result = 10;",
      "      break;",
      "    case 1:",
      "      result = 20;",
      "      break;",
      "    default:",
      "      result = 30;",
      "      break;",
      "  }",
      "  try {",
      "    result = result + 1;",
      "  } catch {",
      "    result = 40;",
      "  } finally {",
      "    result = result + 1;",
      "  }",
      "  done: result = result + 1;",
      "  debugger;",
      "  return result;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSourcePath = resolve(projectDirectory, "out/csharp/src/Index.cs");
  const generatedSource = await readFile(generatedSourcePath, "utf8");
  assert.match(generatedSource, /public static int pick\(int\[\] values\)/);
  assert.match(generatedSource, /public static double sum\(double\[\] values\)/);
  assert.match(generatedSource, /public int\[\] history = new int\[\] \{ \};/);
  assert.match(generatedSource, /double\[\] seen = new double\[\] \{ \};/);
  assert.match(generatedSource, /foreach \(double value in values\)/);
  assert.match(generatedSource, /public static int control\(int value\)/);
  assert.match(generatedSource, /public Counter\(int initial\)/);
  assert.match(generatedSource, /for \(int i = 0; i < delta; i\+\+\)/);
  assert.match(generatedSource, /switch \(value\)/);
  assert.match(generatedSource, /case 0:/);
  assert.match(generatedSource, /continue;/);
  assert.match(generatedSource, /break;/);
  assert.match(generatedSource, /try/);
  assert.match(generatedSource, /catch/);
  assert.match(generatedSource, /finally/);
  assert.match(generatedSource, /done:/);
  assert.match(generatedSource, /System\.Diagnostics\.Debugger\.Break\(\);/);
  assert.match(generatedSource, /return this\.value % 2 == 0 \? this\.value : this\.value \+ 1;/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedWide.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

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
      "import type { int32, int128, nativeInt, float64, float16, bool, char16, decimal128 } from \"@tsonic/core/types.js\";",
      "",
      "export function choose(flag: bool, left: int32, right: int32): int32 {",
      "  return flag ? left : right;",
      "}",
      "",
      "export function scale(value: float64): float64 {",
      "  return value * 2;",
      "}",
      "",
      "export function firstChar(value: char16): char16 {",
      "  return value;",
      "}",
      "",
      "export function keepDecimal(value: decimal128): decimal128 {",
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
  const generatedProject = await readFile(resolve(projectDirectory, "out/csharp/SmokeGeneratedNeutral.csproj"), "utf8");
  assert.match(generatedProject, /<OutputType>Library<\/OutputType>/);
  assert.match(generatedProject, /<PublishAot>false<\/PublishAot>/);
  assert.match(generatedProject, /<LangVersion>preview<\/LangVersion>/);
  assert.match(generatedProject, /<CheckForOverflowUnderflow>true<\/CheckForOverflowUnderflow>/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedNeutral.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
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
      "import { valueType, field, defaultValue } from \"@tsonic/core/lang.js\";",
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
      "import { attribute, out } from \"@tsonic/core/lang.js\";",
      "",
      "export function smoke(): number {",
      "  return 1;",
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
      "import { valueType, field } from \"@tsonic/core/lang.js\";",
      "import { struct } from \"@tsonic/csharp/lang.js\";",
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "import type { int } from \"@tsonic/csharp/types.js\";",
      "",
      "export const Point = valueType({",
      "  x: field<int32>(),",
      "  y: field<int32>(),",
      "});",
      "",
      "export const Counter = struct({",
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
  assert.doesNotMatch(generatedSource, /valueType/);
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
      "import { defaultValue } from \"@tsonic/core/lang.js\";",
      "import { defaultof } from \"@tsonic/csharp/lang.js\";",
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "export function zero(): int32 {",
      "  return defaultValue<int32>();",
      "}",
      "",
      "export function csharpZero(): int32 {",
      "  return defaultof<int32>();",
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
  assert.doesNotMatch(generatedSource, /defaultValue/);
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
      "import { writeonlyRef, readwriteRef, readonlyRef } from \"@tsonic/core/lang.js\";",
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

test("CLI emits C# string literals and template expressions from TSTS AST", async () => {
  const projectDirectory = resolve(tempRoot, "template-expressions");
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
            assemblyName: "SmokeGeneratedTemplates",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function plain(): string {",
      "  return `plain`;",
      "}",
      "",
      "export function greet(name: string, count: number): string {",
      "  return `hello ${name} ${count}`;",
      "}",
      "",
      "export function escaped(name: string): string {",
      "  return `hello {${name}}`;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /return "plain";/);
  assert.match(generatedSource, /return \$"hello \{name\} \{count\}";/);
  assert.match(generatedSource, /return \$"hello \{\{\{name\}\}\}";/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedTemplates.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI erases TypeScript-only expression wrappers after TSTS validation", async () => {
  const projectDirectory = resolve(tempRoot, "erased-expression-wrappers");
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
            assemblyName: "SmokeGeneratedErasedWrappers",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function asValue(value: number): number {",
      "  return value as number;",
      "}",
      "",
      "export function satisfiesValue(value: number): number {",
      "  return value satisfies number;",
      "}",
      "",
      "export function nonNullValue(value: number): number {",
      "  return value!;",
      "}",
      "",
      "export function typeAssertionValue(value: number): number {",
      "  return <number>value;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static double asValue\(double value\)/);
  assert.match(generatedSource, /public static double satisfiesValue\(double value\)/);
  assert.match(generatedSource, /public static double nonNullValue\(double value\)/);
  assert.match(generatedSource, /public static double typeAssertionValue\(double value\)/);
  assert.match(generatedSource, /return value;/);
  assert.doesNotMatch(generatedSource, /satisfies number/);
  assert.doesNotMatch(generatedSource, / as number/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedErasedWrappers.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits direct C# bitwise and compound operators from TSTS AST", async () => {
  const projectDirectory = resolve(tempRoot, "direct-operators");
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
            assemblyName: "SmokeGeneratedOperators",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "export function operators(value: int32, shift: int32): int32 {",
      "  let result: int32 = value;",
      "  result += 1;",
      "  result -= 1;",
      "  result *= 2;",
      "  result /= 2;",
      "  result %= 2;",
      "  result <<= shift;",
      "  result >>= shift;",
      "  result >>>= shift;",
      "  result &= 7;",
      "  result |= 8;",
      "  result ^= 3;",
      "  return (~result & value) | (value ^ shift) | (value << shift) | (value >> shift) | (value >>> shift);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /result \+= 1;/);
  assert.match(generatedSource, /result >>>= shift;/);
  assert.match(generatedSource, /return \(~result & value\) \| \(value \^ shift\) \| \(value << shift\) \| \(value >> shift\) \| \(value >>> shift\);/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedOperators.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits TypeScript rest parameters as C# params arrays", async () => {
  const projectDirectory = resolve(tempRoot, "rest-parameters");
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
            assemblyName: "SmokeGeneratedRestParameters",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function sum(...values: number[]): number {",
      "  let total = 0;",
      "  for (const value of values) {",
      "    total = total + value;",
      "  }",
      "  return total;",
      "}",
      "",
      "export function callSum(): number {",
      "  return sum(1, 2, 3);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static double sum\(params double\[\] values\)/);
  assert.match(generatedSource, /foreach \(double value in values\)/);
  assert.match(generatedSource, /return sum\(1, 2, 3\);/);
  assert.doesNotMatch(generatedSource, /object values/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedRestParameters.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits standard JavaScript static class members", async () => {
  const projectDirectory = resolve(tempRoot, "static-class-members");
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
            assemblyName: "SmokeGeneratedStaticMembers",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export class MathBox {",
      "  static count: number = 1;",
      "",
      "  static add(left: number, right: number): number {",
      "    return left + right;",
      "  }",
      "}",
      "",
      "export function useStatic(): number {",
      "  return MathBox.add(MathBox.count, 2);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static double count = 1;/);
  assert.match(generatedSource, /public static double add\(double left, double right\)/);
  assert.match(generatedSource, /return MathBox\.add\(MathBox\.count, 2\);/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedStaticMembers.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits standard JavaScript class accessors as C# properties", async () => {
  const projectDirectory = resolve(tempRoot, "class-accessors");
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
            assemblyName: "SmokeGeneratedAccessors",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export class AccessorBox {",
      "  backing: number = 1;",
      "",
      "  get doubled(): number {",
      "    return this.backing * 2;",
      "  }",
      "",
      "  set doubled(next: number) {",
      "    this.backing = next / 2;",
      "  }",
      "}",
      "",
      "export function useAccessor(box: AccessorBox): number {",
      "  box.doubled = 10;",
      "  return box.doubled;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public double doubled/);
  assert.match(generatedSource, /get/);
  assert.match(generatedSource, /set/);
  assert.match(generatedSource, /return this\.backing \* 2;/);
  assert.match(generatedSource, /double next = value;/);
  assert.match(generatedSource, /this\.backing = next \/ 2;/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedAccessors.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits standard JavaScript private identifiers as private C# members", async () => {
  const projectDirectory = resolve(tempRoot, "private-identifiers");
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
            assemblyName: "SmokeGeneratedPrivateIdentifiers",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export class PrivateBox {",
      "  #value: number = 1;",
      "",
      "  get value(): number {",
      "    return this.#value;",
      "  }",
      "",
      "  bump(): number {",
      "    this.#value++;",
      "    return this.#value;",
      "  }",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /private double _value = 1;/);
  assert.match(generatedSource, /public double value/);
  assert.match(generatedSource, /return this\._value;/);
  assert.match(generatedSource, /this\._value\+\+;/);
  assert.doesNotMatch(generatedSource, /#value/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedPrivateIdentifiers.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI lowers deterministic local destructuring from TSTS binding patterns", async () => {
  const projectDirectory = resolve(tempRoot, "local-destructuring");
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
            assemblyName: "SmokeGeneratedDestructuring",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export class Point {",
      "  x: number = 1;",
      "  y: number = 2;",
      "  values: number[] = [];",
      "}",
      "",
      "export class Box {",
      "  child: Point = new Point();",
      "}",
      "",
      "export function local(point: Point, box: Box): number {",
      "  const { x } = point;",
      "  const { x: aliasX, \"y\": stringY } = point;",
      "  const { child: { x: nestedX } } = box;",
      "  const [first] = point.values;",
      "  const [, second] = point.values;",
      "  return x + aliasX + stringY + nestedX + first + second;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /var __destructure0 = point;/);
  assert.match(generatedSource, /double x = __destructure0\.x;/);
  assert.match(generatedSource, /var __destructure1 = point;/);
  assert.match(generatedSource, /double aliasX = __destructure1\.x;/);
  assert.match(generatedSource, /double stringY = __destructure1\.y;/);
  assert.match(generatedSource, /var __destructure2 = box;/);
  assert.match(generatedSource, /var __destructure3 = __destructure2\.child;/);
  assert.match(generatedSource, /double nestedX = __destructure3\.x;/);
  assert.match(generatedSource, /var __destructure4 = point\.values;/);
  assert.match(generatedSource, /double first = __destructure4\[0\];/);
  assert.match(generatedSource, /var __destructure5 = point\.values;/);
  assert.match(generatedSource, /double second = __destructure5\[1\];/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedDestructuring.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI lowers parameter and for-of destructuring without dynamic C# carriers", async () => {
  const projectDirectory = resolve(tempRoot, "parameter-forof-destructuring");
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
            assemblyName: "SmokeGeneratedParameterForOfDestructuring",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export class Point {",
      "  x: number = 1;",
      "  y: number = 2;",
      "  values: number[] = [];",
      "}",
      "",
      "export function fromObjectParameter({ x }: Point): number {",
      "  return x;",
      "}",
      "",
      "export function fromArrayParameter([first]: number[]): number {",
      "  return first;",
      "}",
      "",
      "export function fromForOf(rows: number[][]): number {",
      "  let total = 0;",
      "  for (const [first] of rows) {",
      "    total = total + first;",
      "  }",
      "  return total;",
      "}",
      "",
      "export function fromForInitializer(point: Point): number {",
      "  for (const { x } = point; x < 2;) {",
      "    return x;",
      "  }",
      "  return 0;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static double fromObjectParameter\(Point __param0\)/);
  assert.match(generatedSource, /double x = __param0\.x;/);
  assert.match(generatedSource, /public static double fromArrayParameter\(double\[\] __param0\)/);
  assert.match(generatedSource, /double first = __param0\[0\];/);
  assert.match(generatedSource, /foreach \(var __forOf0 in rows\)/);
  assert.match(generatedSource, /double first = __forOf0\[0\];/);
  assert.match(generatedSource, /var __destructure0 = point;/);
  assert.match(generatedSource, /for \(; x < 2; \)/);
  assert.doesNotMatch(generatedSource, /object __param/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedParameterForOfDestructuring.csproj"), "--nologo", "--v:minimal"]);
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

test("CLI emits C# generic declarations from TSTS generic AST", async () => {
  const projectDirectory = resolve(tempRoot, "generic-declarations");
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
            assemblyName: "SmokeGeneratedGenerics",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export class Box<T> {",
      "  value: T;",
      "",
      "  constructor(value: T) {",
      "    this.value = value;",
      "  }",
      "",
      "  get(): T {",
      "    return this.value;",
      "  }",
      "}",
      "",
      "export function identity<T>(value: T): T {",
      "  return value;",
      "}",
      "",
      "export function hold<T>(value: T): T {",
      "  const current = value;",
      "  return current;",
      "}",
      "",
      "export function sameBox<T>(box: Box<T>): Box<T> {",
      "  const current = box;",
      "  return current;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public class Box<T>/);
  assert.match(generatedSource, /public T value;/);
  assert.match(generatedSource, /public Box\(T value\)/);
  assert.match(generatedSource, /public T get\(\)/);
  assert.match(generatedSource, /public static T identity<T>\(T value\)/);
  assert.match(generatedSource, /public static T hold<T>\(T value\)/);
  assert.match(generatedSource, /T current = value;/);
  assert.match(generatedSource, /public static Box<T> sameBox<T>\(Box<T> box\)/);
  assert.match(generatedSource, /Box<T> current = box;/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedGenerics.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits C# interfaces and class heritage from TSTS AST", async () => {
  const projectDirectory = resolve(tempRoot, "interfaces-and-heritage");
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
            assemblyName: "SmokeGeneratedInterfaces",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export interface Getter<T> {",
      "  get(): T;",
      "}",
      "",
      "export interface Named {",
      "  name: string;",
      "}",
      "",
      "export class Base {",
      "  start: number;",
      "",
      "  constructor(start: number) {",
      "    this.start = start;",
      "  }",
      "",
      "  value(): number {",
      "    return this.start;",
      "  }",
      "}",
      "",
      "export class Derived extends Base {",
      "  constructor(start: number) {",
      "    super(start);",
      "  }",
      "",
      "  extra(): number {",
      "    return super.value() + 1;",
      "  }",
      "}",
      "",
      "export class Box<T> implements Getter<T> {",
      "  value: T;",
      "",
      "  constructor(value: T) {",
      "    this.value = value;",
      "  }",
      "",
      "  get(): T {",
      "    return this.value;",
      "  }",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public interface Getter<T>/);
  assert.match(generatedSource, /T get\(\);/);
  assert.match(generatedSource, /public interface Named/);
  assert.match(generatedSource, /string name \{ get; \}/);
  assert.match(generatedSource, /public class Derived : Base/);
  assert.match(generatedSource, /public Derived\(double start\) : base\(start\)/);
  assert.match(generatedSource, /return base\.value\(\) \+ 1;/);
  assert.match(generatedSource, /public class Box<T> : Getter<T>/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedInterfaces.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits interface index signatures as C# indexers", async () => {
  const projectDirectory = resolve(tempRoot, "interface-index-signature");
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
            assemblyName: "SmokeGeneratedIndexSignatures",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export interface Bag {",
      "  [key: string]: number;",
      "}",
      "",
      "export function read(bag: Bag, key: string): number {",
      "  return bag[key];",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public interface Bag/);
  assert.match(generatedSource, /double this\[string key\] \{ get; \}/);
  assert.match(generatedSource, /return bag\[key\];/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedIndexSignatures.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits named generic constraints as C# where clauses", async () => {
  const projectDirectory = resolve(tempRoot, "generic-constraints");
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
            assemblyName: "SmokeGeneratedGenericConstraints",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export interface Named {",
      "  name: string;",
      "}",
      "",
      "export function constrained<T extends Named>(value: T): string {",
      "  return value.name;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static string constrained<T>\(T value\)/);
  assert.match(generatedSource, /where T : Named/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedGenericConstraints.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI rejects primitive generic constraints until provider constraint facts are finalized", async () => {
  const projectDirectory = resolve(tempRoot, "primitive-generic-constraints");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp" }],
    }, null, 2),
    "src/index.ts": [
      "export function constrained<T extends number>(value: T): T {",
      "  return value;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /Generic constraints require a named target type/);
});

test("CLI reports unsupported property enumeration semantics instead of guessing", async () => {
  const projectDirectory = resolve(tempRoot, "unsupported-for-in");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp" }],
    }, null, 2),
    "src/index.ts": [
      "export function countKeys(values: number[]): number {",
      "  let total = 0;",
      "  for (const key in values) {",
      "    total = total + 1;",
      "  }",
      "  return total;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /For-in requires target property enumeration semantics/);
});

test("CLI rejects structural object destructuring until target object-shape facts are finalized", async () => {
  const projectDirectory = resolve(tempRoot, "structural-object-destructuring");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp" }],
    }, null, 2),
    "src/index.ts": [
      "export function fromParameter({ value }: { value: number }): number {",
      "  return value;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /Structural object type annotations require target object-shape semantics/);
});

test("CLI does not emit target artifacts when TSTS rejects the source program", async () => {
  const projectDirectory = resolve(tempRoot, "tsts-diagnostic-stop");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp" }],
    }, null, 2),
    "src/index.ts": [
      "export function invalid(): number {",
      "  return \"not a number\";",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /TSTS_DIAGNOSTIC/);
  assert.doesNotMatch(build.stdout, /Artifacts: [1-9]/);
});

async function writeProject(projectDirectory, files) {
  for (const [relativePath, text] of Object.entries(files)) {
    const outputPath = resolve(projectDirectory, relativePath);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, text, "utf8");
  }
}

function runNode(args) {
  return run(process.execPath, args);
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
  });
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}
