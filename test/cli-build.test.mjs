import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const repoRoot = process.cwd();
const cliPath = resolve(repoRoot, "packages/cli/dist/src/index.js");
const tempRoot = resolve(repoRoot, ".temp/test-runs/cli-build", `${Date.now()}-${process.pid}`);

test("CLI lists built-in target packs", () => {
  const result = runNode([cliPath, "targets"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^csharp\tC#$/m);
});

test("CLI rejects duplicate target ids before compiling", async () => {
  const projectDirectory = resolve(tempRoot, "duplicate-targets");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp" }, { id: "csharp" }],
    }, null, 2),
    "src/index.ts": "export function value(): number { return 1; }\n",
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /target 'csharp' is declared more than once/);
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

test("CLI emits explicit C# target .NET references without host inference", async () => {
  const projectDirectory = resolve(tempRoot, "target-references");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          options: {
            assemblyName: "SmokeGeneratedReferences",
            references: {
              projects: ["../csharp-runtime/src/Tsonic.CSharp.Runtime/Tsonic.CSharp.Runtime.csproj"],
              packages: [{ include: "Tsonic.CSharp.Runtime", version: "0.0.1" }],
              frameworks: ["Microsoft.AspNetCore.App"],
              assemblies: [{ include: "Example.Assembly", hintPath: "../lib/Example.Assembly.dll" }],
            },
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function value(): number {",
      "  return 1;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedProject = await readFile(resolve(projectDirectory, "out/csharp/SmokeGeneratedReferences.csproj"), "utf8");
  assert.match(generatedProject, /<ProjectReference Include="\.\.\/csharp-runtime\/src\/Tsonic\.CSharp\.Runtime\/Tsonic\.CSharp\.Runtime\.csproj" \/>/);
  assert.match(generatedProject, /<PackageReference Include="Tsonic\.CSharp\.Runtime" Version="0\.0\.1" \/>/);
  assert.match(generatedProject, /<FrameworkReference Include="Microsoft\.AspNetCore\.App" \/>/);
  assert.match(generatedProject, /<Reference Include="Example\.Assembly" HintPath="\.\.\/lib\/Example\.Assembly\.dll" \/>/);
});

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
      "import { Convert } from \"@tsonic/csharp/lang.js\";",
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

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static byte toByte\(double value\)/);
  assert.match(generatedSource, /return System\.Convert\.ToByte\(value\);/);
  assert.doesNotMatch(generatedSource, /return Convert\.ToByte\(value\);/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedProviderStaticCalls.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI rejects provider-owned calls when argument carriers do not match the selected target signature", async () => {
  const projectDirectory = resolve(tempRoot, "provider-static-call-carrier-mismatch");
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
            assemblyName: "SmokeGeneratedProviderStaticCallCarrierMismatch",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { Convert } from \"@tsonic/csharp/lang.js\";",
      "import type { int32, uint8 } from \"@tsonic/core/types.js\";",
      "",
      "export function toByte(value: int32): uint8 {",
      "  return Convert.toByte(value);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /C# call emission requires a source-owned callable or a selected target signature fact/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedProviderStaticCallCarrierMismatch.csproj")), false);
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
      "import { Environment } from \"@tsonic/csharp/lang.js\";",
      "",
      "export function newline(): string {",
      "  return Environment.newLine;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static string newline\(\)/);
  assert.match(generatedSource, /return System\.Environment\.NewLine;/);
  assert.doesNotMatch(generatedSource, /return Environment\.NewLine;/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedProviderStaticProperties.csproj"), "--nologo", "--v:minimal"]);
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
      "import { Environment } from \"@tsonic/csharp/lang.js\";",
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
      "import { Exception } from \"@tsonic/csharp/lang.js\";",
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

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /System\.Exception ex = new System\.Exception\("boom"\);/);
  assert.match(generatedSource, /return ex\.Message;/);
  assert.match(generatedSource, /return ex\.ToString\(\);/);
  assert.doesNotMatch(generatedSource, /ex\.message/);
  assert.doesNotMatch(generatedSource, /ex\.toString/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedProviderInstanceMembers.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits char16 string literals as C# char literals from expected TSTS type", async () => {
  const projectDirectory = resolve(tempRoot, "char16-literals");
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
      "import type { char16 } from \"@tsonic/core/types.js\";",
      "",
      "export function letter(): char16 {",
      "  return \"x\";",
      "}",
      "",
      "export function newline(): char16 {",
      "  return \"\\n\";",
      "}",
      "",
      "export function choose(flag: boolean): char16 {",
      "  return flag ? \"a\" : `b`;",
      "}",
      "",
      "export function defaulted(value: char16 = \"q\"): char16 {",
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

test("CLI rejects multi-code-unit string literals for char16 targets", async () => {
  const projectDirectory = resolve(tempRoot, "char16-invalid-literal");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp" }],
    }, null, 2),
    "src/index.ts": [
      "import type { char16 } from \"@tsonic/core/types.js\";",
      "",
      "export function bad(): char16 {",
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

test("CLI emits typeof narrowing through selected TSTS target facts", async () => {
  const projectDirectory = resolve(tempRoot, "typeof-narrowing");
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
            assemblyName: "SmokeGeneratedTypeofNarrowing",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function lengthOrZero(value: string | null): number {",
      "  if (typeof value === \"string\") {",
      "    return value.length;",
      "  }",
      "  return 0;",
      "}",
      "",
      "export function isMissing(value: string | null): boolean {",
      "  return typeof value !== \"string\";",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static double lengthOrZero\(string\? value\)/);
  assert.match(generatedSource, /if \(value is string\)/);
  assert.match(generatedSource, /return value\.Length;/);
  assert.match(generatedSource, /public static bool isMissing\(string\? value\)/);
  assert.match(generatedSource, /return value is not string;/);
  assert.doesNotMatch(generatedSource, /typeof/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedTypeofNarrowing.csproj"), "--nologo", "--v:minimal"]);
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
    "src/system-attributes.d.ts": [
      "export declare const CLSCompliantAttribute: object;",
      "",
    ].join("\n"),
    "src/index.ts": [
      "import { attributes as A } from \"@tsonic/core/lang.js\";",
      "import { CLSCompliantAttribute } from \"./system-attributes.js\";",
      "",
      "export class Annotated {",
      "  value: number = 1;",
      "",
      "  run(input: number): number {",
      "    return input;",
      "  }",
      "}",
      "",
      "A<Annotated>().add(CLSCompliantAttribute, true);",
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
      "import { attributes as A } from \"@tsonic/core/lang.js\";",
      "import { CLSCompliantAttribute } from \"@tsonic/csharp/lang.js\";",
      "",
      "export class Annotated {",
      "  value: number = 1;",
      "",
      "  run(input: number): number {",
      "    return input;",
      "  }",
      "}",
      "",
      "A<Annotated>().add(CLSCompliantAttribute, true);",
      "A<Annotated>().property((target) => target.value).add(CLSCompliantAttribute, false);",
      "A<Annotated>().method((target) => target.run).add(CLSCompliantAttribute, true);",
      "A<Annotated>().method((target) => target.run).parameter(\"input\").add(CLSCompliantAttribute, false);",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /\[System\.CLSCompliantAttribute\(true\)\]\s+public class Annotated/);
  assert.match(generatedSource, /\[System\.CLSCompliantAttribute\(false\)\]\s+public double value = 1;/);
  assert.match(generatedSource, /\[System\.CLSCompliantAttribute\(true\)\]\s+public double run\(\[System\.CLSCompliantAttribute\(false\)\] double input\)/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedProviderAttributes.csproj"), "--nologo", "--v:minimal"]);
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
      "import type { ptr, fnptr } from \"@tsonic/csharp/lang.js\";",
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

test("CLI emits C# bitwise and compound operators from selected TSTS provider facts", async () => {
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

test("CLI rejects direct C# bitwise operators on plain TypeScript number", async () => {
  const projectDirectory = resolve(tempRoot, "plain-number-bitwise");
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
            assemblyName: "SmokeGeneratedPlainNumberBitwise",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function bitwise(left: number, right: number): number {",
      "  return left & right;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /C# binary operator emission requires a selected provider operator fact/);
});

test("CLI escapes TypeScript identifiers that are C# reserved words", async () => {
  const projectDirectory = resolve(tempRoot, "csharp-keyword-identifiers");
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
            assemblyName: "SmokeGeneratedCsharpKeywordIdentifiers",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "let event = 1;",
      "",
      "export function read(operator: number): number {",
      "  let params = operator + event;",
      "  return params;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static double @event = 1;/);
  assert.match(generatedSource, /public static double read\(double @operator\)/);
  assert.match(generatedSource, /double @params = @operator \+ @event;/);
  assert.match(generatedSource, /return @params;/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedCsharpKeywordIdentifiers.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI validates and escapes C# target namespace segments", async () => {
  const projectDirectory = resolve(tempRoot, "csharp-keyword-namespace");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          options: {
            namespace: "event.operator",
            assemblyName: "SmokeGeneratedCsharpKeywordNamespace",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function read(): number {",
      "  return 1;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /namespace @event\.@operator/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedCsharpKeywordNamespace.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI rejects invalid C# target namespace segments", async () => {
  const projectDirectory = resolve(tempRoot, "csharp-invalid-namespace");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          options: {
            namespace: "Smoke.Bad-Name",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function read(): number {",
      "  return 1;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /C# target option 'namespace' must be a dot-separated C# identifier path/);
});

test("CLI rejects non-string C# target namespace option", async () => {
  const projectDirectory = resolve(tempRoot, "csharp-invalid-namespace-type");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          options: {
            namespace: 42,
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function read(): number {",
      "  return 1;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /C# target option 'namespace' must be a non-empty string/);
});

test("CLI rejects invalid C# target assembly name", async () => {
  const projectDirectory = resolve(tempRoot, "csharp-invalid-assembly-name");
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
            assemblyName: "../Bad",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function read(): number {",
      "  return 1;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /C# target option 'assemblyName' must be a file-safe \.NET assembly name/);
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

test("CLI emits literal default parameters as C# optional parameters", async () => {
  const projectDirectory = resolve(tempRoot, "default-parameters");
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
            assemblyName: "SmokeGeneratedDefaultParameters",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function add(value: number = 3, enabled: boolean = true, label: string = \"x\"): number {",
      "  if (enabled) {",
      "    return value;",
      "  }",
      "  return 0;",
      "}",
      "",
      "export function callDefault(): number {",
      "  return add();",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static double add\(double value = 3, bool enabled = true, string label = "x"\)/);
  assert.match(generatedSource, /return add\(\);/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedDefaultParameters.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI rewrites mixed-type for initializers into C# prelude locals", async () => {
  const projectDirectory = resolve(tempRoot, "mixed-for-initializers");
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
            assemblyName: "SmokeGeneratedMixedForInitializers",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function mixed(limit: number): number {",
      "  let total = 0;",
      "  for (let index = 0, active = true; index < limit; index++) {",
      "    if (active) {",
      "      total = total + index;",
      "    }",
      "  }",
      "  return total;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /double index = 0;/);
  assert.match(generatedSource, /bool active = true;/);
  assert.match(generatedSource, /for \(; index < limit; index\+\+\)/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedMixedForInitializers.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI lowers labeled break and continue into deterministic C# labels", async () => {
  const projectDirectory = resolve(tempRoot, "labeled-control-flow");
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
            assemblyName: "SmokeGeneratedLabeledControlFlow",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function count(limit: number): number {",
      "  let total = 0;",
      "  outer: for (let row = 0; row < limit; row++) {",
      "    for (let column = 0; column < limit; column++) {",
      "      if (column === 1) {",
      "        continue outer;",
      "      }",
      "      if (row === 2) {",
      "        break outer;",
      "      }",
      "      total = total + 1;",
      "    }",
      "  }",
      "  return total;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /goto __label\d+_outer_continue;/);
  assert.match(generatedSource, /goto __label\d+_outer_break;/);
  assert.match(generatedSource, /__label\d+_outer_continue:/);
  assert.match(generatedSource, /__label\d+_outer_break:/);
  assert.doesNotMatch(generatedSource, /Labeled break requires/);
  assert.doesNotMatch(generatedSource, /Labeled continue requires/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedLabeledControlFlow.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI lowers switch fallthrough into explicit C# switch gotos", async () => {
  const projectDirectory = resolve(tempRoot, "switch-fallthrough");
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
            assemblyName: "SmokeGeneratedSwitchFallthrough",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function choose(value: number): number {",
      "  let result = 0;",
      "  switch (value) {",
      "    case 0:",
      "      result = 1;",
      "    case 1:",
      "      result = result + 2;",
      "      break;",
      "    case 2:",
      "      result = 4;",
      "    default:",
      "      result = result + 8;",
      "  }",
      "  return result;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /goto case 1;/);
  assert.match(generatedSource, /goto default;/);
  assert.doesNotMatch(generatedSource, /Switch case fallthrough requires/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedSwitchFallthrough.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits module-scope variables as C# static fields", async () => {
  const projectDirectory = resolve(tempRoot, "module-fields");
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
            assemblyName: "SmokeGeneratedModuleFields",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "let total = 1;",
      "",
      "export function bump(): number {",
      "  total = total + 1;",
      "  return total;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static double total = 1;/);
  assert.match(generatedSource, /total = total \+ 1;/);
  assert.doesNotMatch(generatedSource, /public static void Main\(\)/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedModuleFields.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits module-scope const bindings as C# static readonly fields", async () => {
  const projectDirectory = resolve(tempRoot, "module-const-fields");
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
            assemblyName: "SmokeGeneratedModuleConstFields",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "const total = 1;",
      "",
      "export function read(): number {",
      "  return total;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static readonly double total = 1;/);
  assert.doesNotMatch(generatedSource, /public static double total = 1;/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedModuleConstFields.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI erases source-local standalone export declarations", async () => {
  const projectDirectory = resolve(tempRoot, "standalone-export-declaration");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp" }],
    }, null, 2),
    "src/index.ts": [
      "const value = 1;",
      "export { value };",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static readonly double value = 1;/);
  assert.doesNotMatch(generatedSource, /export|__unsupported/);
});

test("CLI emits cross-file source references from TSTS resolved symbols", async () => {
  const projectDirectory = resolve(tempRoot, "cross-file-source-reference");
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
            assemblyName: "SmokeGeneratedCrossFileReferences",
          },
        },
      ],
    }, null, 2),
    "src/math.ts": [
      "export const seed = 1;",
      "",
      "export function add(value: number): number {",
      "  return value + seed;",
      "}",
      "",
    ].join("\n"),
    "src/index.ts": [
      "import { add, seed } from \"./math.js\";",
      "",
      "export function read(): number {",
      "  return add(seed);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /return Math\.add\(Math\.seed\);/);
  assert.doesNotMatch(generatedSource, /return add\(seed\);/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedCrossFileReferences.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits namespace-import source references from TSTS resolved symbols", async () => {
  const projectDirectory = resolve(tempRoot, "namespace-import-source-reference");
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
            assemblyName: "SmokeGeneratedNamespaceImportReferences",
          },
        },
      ],
    }, null, 2),
    "src/math.ts": [
      "export const seed = 1;",
      "",
      "export function add(value: number): number {",
      "  return value + seed;",
      "}",
      "",
    ].join("\n"),
    "src/index.ts": [
      "import * as math from \"./math.js\";",
      "",
      "export function read(): number {",
      "  return math.add(math.seed);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /return Math\.add\(Math\.seed\);/);
  assert.doesNotMatch(generatedSource, /math\.add|math\.seed|__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedNamespaceImportReferences.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI erases re-export declarations and uses TSTS symbols for re-exported source values", async () => {
  const projectDirectory = resolve(tempRoot, "re-export-declaration");
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
            assemblyName: "SmokeGeneratedReExportReferences",
          },
        },
      ],
    }, null, 2),
    "src/other.ts": "export const value = 1;\n",
    "src/barrel.ts": [
      "export { value } from \"./other.js\";",
      "",
    ].join("\n"),
    "src/index.ts": [
      "import { value } from \"./barrel.js\";",
      "",
      "export function read(): number {",
      "  return value;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /return Other\.value;/);
  assert.doesNotMatch(generatedSource, /return value;/);
  assert.doesNotMatch(generatedSource, /export|__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedReExportReferences.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits default export expression snapshots through TSTS module-export symbols", async () => {
  const projectDirectory = resolve(tempRoot, "default-export-expression");
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
            assemblyName: "SmokeGeneratedDefaultExportExpression",
          },
        },
      ],
    }, null, 2),
    "src/other.ts": [
      "let value = 1;",
      "export default value;",
      "value = 2;",
      "",
    ].join("\n"),
    "src/index.ts": [
      "import value from \"./other.js\";",
      "",
      "export function read(): number {",
      "  return value;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const otherSource = await readFile(resolve(projectDirectory, "out/csharp/src/Other.cs"), "utf8");
  assert.match(otherSource, /public static readonly double @default = value;/);
  assert.doesNotMatch(otherSource, /__unsupported/);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /return Other\.@default;/);
  assert.doesNotMatch(generatedSource, /return Other\.value;|return value;|__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedDefaultExportExpression.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits aliased star and namespace re-exports from TSTS module-export symbols", async () => {
  const projectDirectory = resolve(tempRoot, "module-export-forms");
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
            assemblyName: "SmokeGeneratedModuleExportForms",
          },
        },
      ],
    }, null, 2),
    "src/other.ts": "export const value = 1;\n",
    "src/math.ts": [
      "export const seed = 2;",
      "export function add(value: number): number {",
      "  return value + seed;",
      "}",
      "",
    ].join("\n"),
    "src/barrel.ts": [
      "export { value as answer } from \"./other.js\";",
      "export * from \"./math.js\";",
      "export * as math from \"./math.js\";",
      "",
    ].join("\n"),
    "src/index.ts": [
      "import { answer, add, seed, math } from \"./barrel.js\";",
      "",
      "export function read(): number {",
      "  return answer + add(seed) + math.seed;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /return Other\.value \+ Math\.add\(Math\.seed\) \+ Math\.seed;/);
  assert.doesNotMatch(generatedSource, /answer|math\.seed|add\(seed\)|__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedModuleExportForms.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI rejects anonymous exported declarations instead of synthesizing C# names", async () => {
  const scenarios = [
    {
      name: "anonymous-default-function",
      source: [
        "export default function (): number {",
        "  return 1;",
        "}",
        "",
      ].join("\n"),
      diagnostic: /Function name must be present/,
    },
    {
      name: "anonymous-default-class",
      source: [
        "export default class {",
        "  value: number = 1;",
        "}",
        "",
      ].join("\n"),
      diagnostic: /Class name must be present/,
    },
  ];

  for (const scenario of scenarios) {
    const projectDirectory = resolve(tempRoot, scenario.name);
    await writeProject(projectDirectory, {
      "tsonic.json": JSON.stringify({
        entryPoint: "index.ts",
        rootDir: "src",
        outDir: "out",
        targets: [{ id: "csharp" }],
      }, null, 2),
      "src/index.ts": scenario.source,
    });

    const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
    assert.equal(build.status, 1);
    assert.match(build.stderr, scenario.diagnostic);
    assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
  }
});

test("CLI routes top-level for-of statements through the C# module entrypoint", async () => {
  const projectDirectory = resolve(tempRoot, "top-level-for-of");
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
            assemblyName: "SmokeGeneratedTopLevelForOf",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "let total = 0;",
      "",
      "for (const value of [1, 2, 3]) {",
      "  total = total + value;",
      "}",
      "",
      "export function read(): number {",
      "  return total;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static double total = 0;/);
  assert.match(generatedSource, /public static void Main\(\)/);
  assert.match(generatedSource, /foreach \(double value in new double\[\] \{ 1, 2, 3 \}\)/);
  assert.match(generatedSource, /total = total \+ value;/);
  assert.doesNotMatch(generatedSource, /Top-level statement is outside/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedTopLevelForOf.csproj"), "--nologo", "--v:minimal"]);
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

test("CLI rejects TypeScript-only runtime-shape modifiers before C# emission", async () => {
  const projectDirectory = resolve(tempRoot, "typescript-only-modifiers");
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
            assemblyName: "SmokeGeneratedTypeScriptOnlyModifiers",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export class Box {",
      "  public visible: number = 1;",
      "  private hidden: number = 2;",
      "  readonly id: number = 3;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /TypeScript-only modifier 'public'/);
  assert.match(build.stderr, /TypeScript-only modifier 'private'/);
  assert.match(build.stderr, /TypeScript-only modifier 'readonly'/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedTypeScriptOnlyModifiers.csproj")), false);
});

test("CLI emits async functions and lambdas from TSTS Promise carriers", async () => {
  const projectDirectory = resolve(tempRoot, "async-promise-carriers");
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
            assemblyName: "SmokeGeneratedAsyncCarriers",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export async function value(): Promise<number> {",
      "  return 1;",
      "}",
      "",
      "export async function echo(value: Promise<number>): Promise<number> {",
      "  return await value;",
      "}",
      "",
      "export function delayed(): () => Promise<number> {",
      "  return async () => 2;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);
  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static async System\.Threading\.Tasks\.Task<double> value\(\)/);
  assert.match(generatedSource, /public static async System\.Threading\.Tasks\.Task<double> echo\(System\.Threading\.Tasks\.Task<double> value\)/);
  assert.match(generatedSource, /return await value;/);
  assert.match(generatedSource, /public static Func<System\.Threading\.Tasks\.Task<double>> delayed\(\)/);
  assert.match(generatedSource, /return async \(\) => 2;/);
  assert.doesNotMatch(generatedSource, /__unsupported/);
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
      "import { Exception } from \"@tsonic/csharp/lang.js\";",
      "",
      "export function fail(): never {",
      "  throw new Exception(\"failed\");",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
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

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /catch \(System\.Exception error\)/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedCatchVariable.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits array literals from finalized runtime carrier facts", async () => {
  const projectDirectory = resolve(tempRoot, "array-literal-runtime-carriers");
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
            assemblyName: "SmokeGeneratedArrayLiteralFacts",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function values(): number[] {",
      "  return [1, 2];",
      "}",
      "",
      "export function first(): number {",
      "  const values = [1, 2];",
      "  return values[0];",
      "}",
      "",
      "export function bare(): void {",
      "  [1, 2];",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);
  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /return new double\[\] \{ 1, 2 \};/);
  assert.match(generatedSource, /double\[\] values = new double\[\] \{ 1, 2 \};/);
  assert.match(generatedSource, /new double\[\] \{ 1, 2 \};/);
  assert.doesNotMatch(generatedSource, /__unsupported/);
  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedArrayLiteralFacts.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI rejects lambdas without contextual target delegate facts", async () => {
  const projectDirectory = resolve(tempRoot, "lambda-requires-context");
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
            assemblyName: "SmokeGeneratedLambdaFacts",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function bare(): void {",
      "  (() => 1);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /Lambda emission requires a contextual function\/delegate type/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedLambdaFacts.csproj")), false);
});

test("CLI emits omitted function and method return types from TSTS inferred signatures", async () => {
  const projectDirectory = resolve(tempRoot, "inferred-return-types");
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
            assemblyName: "SmokeGeneratedInferredReturns",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function inferred() {",
      "  return 1;",
      "}",
      "",
      "export function sideEffect(value: number) {",
      "  let copy = value;",
      "}",
      "",
      "export function inferredArray() {",
      "  return [1, 2];",
      "}",
      "",
      "export function inferredGeneric<T>(value: T) {",
      "  return value;",
      "}",
      "",
      "export function localArray() {",
      "  let values = [1, 2];",
      "  return values[0];",
      "}",
      "",
      "export class Counter {",
      "  value: number = 0;",
      "  values = [1, 2];",
      "  current() {",
      "    return this.value;",
      "  }",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static double inferred\(\)/);
  assert.match(generatedSource, /public static void sideEffect\(double value\)/);
  assert.match(generatedSource, /public static double\[\] inferredArray\(\)/);
  assert.match(generatedSource, /return new double\[\] \{ 1, 2 \};/);
  assert.match(generatedSource, /public static T inferredGeneric<T>\(T value\)/);
  assert.match(generatedSource, /public static double localArray\(\)/);
  assert.match(generatedSource, /double\[\] values = new double\[\] \{ 1, 2 \};/);
  assert.match(generatedSource, /public double\[\] values = new double\[\] \{ 1, 2 \};/);
  assert.match(generatedSource, /public double current\(\)/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedInferredReturns.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits source-owned local object destructuring", async () => {
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
      "  return x + aliasX + stringY + nestedX;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /Point __destructure0 = point;/);
  assert.match(generatedSource, /double x = __destructure0\.x;/);
  assert.match(generatedSource, /double aliasX = __destructure\d+\.x;/);
  assert.match(generatedSource, /double stringY = __destructure\d+\.y;/);
  assert.match(generatedSource, /Point __destructure\d+ = __destructure\d+\.child;/);
  assert.match(generatedSource, /double nestedX = __destructure\d+\.x;/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedDestructuring.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits source-owned parameter and for-initializer object destructuring", async () => {
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
      "}",
      "",
      "export function fromObjectParameter({ x }: Point): number {",
      "  return x;",
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
  assert.match(generatedSource, /Point __destructure0 = point;/);
  assert.match(generatedSource, /double x = __destructure0\.x;/);
  assert.match(generatedSource, /for \(; x < 2; \)/);
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

test("CLI rejects generic type-parameter operators without selected target facts", async () => {
  const projectDirectory = resolve(tempRoot, "generic-operator-facts");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp" }],
    }, null, 2),
    "src/index.ts": [
      "export function same<T>(left: T, right: T): boolean {",
      "  return left === right;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /operator emission requires a selected provider operator fact/);
  assert.match(build.stderr, /operand type parameter/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
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

test("CLI emits source-owned instanceof as C# is expressions", async () => {
  const projectDirectory = resolve(tempRoot, "source-owned-instanceof");
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
            assemblyName: "SmokeGeneratedInstanceOf",
          },
        },
      ],
    }, null, 2),
    "src/animal.ts": [
      "export class Animal {",
      "  name: string = \"\";",
      "}",
      "",
      "export class Dog extends Animal {",
      "}",
      "",
    ].join("\n"),
    "src/index.ts": [
      "import { Animal, Dog } from \"./animal.js\";",
      "",
      "export function isDog(value: Animal): boolean {",
      "  return value instanceof Dog;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static bool isDog\(Animal value\)/);
  assert.match(generatedSource, /return value is Dog;/);
  assert.doesNotMatch(generatedSource, /value is Animal\.Dog/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedInstanceOf.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits sanitized C# names through source-owned provider facts", async () => {
  const projectDirectory = resolve(tempRoot, "source-owned-sanitized-names");
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
            assemblyName: "SmokeGeneratedSanitizedNames",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export class KeywordBox {",
      "  default: number = 1;",
      "}",
      "",
      "export function read(box: KeywordBox): number {",
      "  return box.default;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public double @default = 1;/);
  assert.match(generatedSource, /return box\.@default;/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedSanitizedNames.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits TypeScript numeric enums as C# enums", async () => {
  const projectDirectory = resolve(tempRoot, "numeric-enums");
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
            assemblyName: "SmokeGeneratedEnums",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export enum Direction {",
      "  Up = 1,",
      "  Down = 2,",
      "  Left = 4,",
      "  Right = Left << 1,",
      "}",
      "",
      "export function turn(direction: Direction): Direction {",
      "  return direction === Direction.Up ? Direction.Right : Direction.Up;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public enum Direction/);
  assert.match(generatedSource, /Up = 1,/);
  assert.match(generatedSource, /Down = 2,/);
  assert.match(generatedSource, /Left = 4,/);
  assert.match(generatedSource, /Right = Left << 1/);
  assert.match(generatedSource, /public static Direction turn\(Direction direction\)/);
  assert.match(generatedSource, /return direction == Direction\.Up \? Direction\.Right : Direction\.Up;/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedEnums.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI rejects string enums until target enum-carrier facts are finalized", async () => {
  const projectDirectory = resolve(tempRoot, "reject-string-enums");
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
            assemblyName: "SmokeGeneratedStringEnums",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export enum Mode {",
      "  Read = \"read\",",
      "  Write = \"write\",",
      "}",
      "",
      "export function read(): Mode {",
      "  return Mode.Read;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.notEqual(build.status, 0);
  assert.match(build.stderr, /C# enum member initializers must be integer constants evaluated by TSTS/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedStringEnums.csproj")), false);
});

test("CLI rejects fractional numeric enum initializers before C# artifact generation", async () => {
  const projectDirectory = resolve(tempRoot, "reject-fractional-enums");
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
            assemblyName: "SmokeGeneratedFractionalEnums",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export enum Ratio {",
      "  Half = 0.5,",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.notEqual(build.status, 0);
  assert.match(build.stderr, /C# enum member initializers must be integer constants evaluated by TSTS/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedFractionalEnums.csproj")), false);
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

test("CLI emits delegate function types and expression-bodied lambdas from TSTS AST", async () => {
  const projectDirectory = resolve(tempRoot, "delegate-lambdas");
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
            assemblyName: "SmokeGeneratedDelegateLambdas",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function apply(value: number, mapper: (input: number) => number): number {",
      "  return mapper(value);",
      "}",
      "",
      "export function useInline(): number {",
      "  return apply(3, (input) => input + 4);",
      "}",
      "",
      "export function useLocal(): number {",
      "  const mapper: (input: number) => number = (input) => input * 2;",
      "  return mapper(5);",
      "}",
      "",
      "export function useInferredLocal(): number {",
      "  const mapper = (input: number) => input + 3;",
      "  return mapper(8);",
      "}",
      "",
      "export function useBlock(): number {",
      "  const mapper: (input: number) => number = (input) => {",
      "    const next = input + 1;",
      "    return next;",
      "  };",
      "  return mapper(6);",
      "}",
      "",
      "export function useFunctionExpression(): number {",
      "  const mapper: (input: number) => number = function(input: number): number {",
      "    return input + 2;",
      "  };",
      "  return mapper(7);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static double apply\(double value, Func<double, double> mapper\)/);
  assert.match(generatedSource, /return apply\(3, input => input \+ 4\);/);
  assert.match(generatedSource, /Func<double, double> mapper = input => input \* 2;/);
  assert.match(generatedSource, /Func<double, double> mapper = \(double input\) => input \+ 3;/);
  assert.match(generatedSource, /Func<double, double> mapper = input =>\n\s*\{/);
  assert.match(generatedSource, /Func<double, double> mapper = \(double input\) =>\n\s*\{/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedDelegateLambdas.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits C# null-conditional access from TSTS optional-chain AST", async () => {
  const projectDirectory = resolve(tempRoot, "optional-chain");
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
            assemblyName: "SmokeGeneratedOptionalChain",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export class Box {",
      "  value: number = 1;",
      "  read(): number {",
      "    return this.value;",
      "  }",
      "}",
      "",
      "export function readValue(box: Box, defaultValue: number): number {",
      "  return box?.value ?? defaultValue;",
      "}",
      "",
      "export function readCall(box: Box, defaultValue: number): number {",
      "  return box?.read() ?? defaultValue;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /return box\?\.value \?\? defaultValue;/);
  assert.match(generatedSource, /return box\?\.read\(\) \?\? defaultValue;/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedOptionalChain.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits nullable C# storage for nullish unions from provider runtime-carrier facts", async () => {
  const projectDirectory = resolve(tempRoot, "nullable-unions");
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
            assemblyName: "SmokeGeneratedNullableUnions",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export class Box {",
      "  value: number = 1;",
      "}",
      "",
      "export function maybeNumber(flag: boolean): number | null {",
      "  return flag ? 1.5 : null;",
      "}",
      "",
      "export function maybeBox(flag: boolean, box: Box): Box | null {",
      "  return flag ? box : null;",
      "}",
      "",
      "export function read(box: Box | null, defaultValue: number): number {",
      "  return box?.value ?? defaultValue;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static double\? maybeNumber\(bool flag\)/);
  assert.match(generatedSource, /return flag \? 1\.5 : null;/);
  assert.match(generatedSource, /public static Box\? maybeBox\(bool flag, Box box\)/);
  assert.match(generatedSource, /public static double read\(Box\? box, double defaultValue\)/);
  assert.match(generatedSource, /return box\?\.value \?\? defaultValue;/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedNullableUnions.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits source-owned typed object literals as C# object initializers", async () => {
  const projectDirectory = resolve(tempRoot, "typed-object-initializers");
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
            assemblyName: "SmokeGeneratedObjectInitializers",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export class Box {",
      "  value: number = 0;",
      "  label: string = \"\";",
      "}",
      "",
      "export class WithCtor {",
      "  value: number = 0;",
      "",
      "  constructor() {",
      "    this.value = 0;",
      "  }",
      "}",
      "",
      "export class HandlerBox {",
      "  run: (value: number) => number = (value) => value;",
      "}",
      "",
      "export function createExplicit(): Box {",
      "  const box: Box = { value: 1, label: \"one\" };",
      "  return box;",
      "}",
      "",
      "export function createShorthand(value: number): Box {",
      "  const box: Box = { value, label: \"two\" };",
      "  return box;",
      "}",
      "",
      "export function createReturn(value: number): Box {",
      "  return { value, label: \"three\" };",
      "}",
      "",
      "export function choose(flag: boolean, value: number): Box {",
      "  return flag ? { value, label: \"yes\" } : { value: 0, label: \"no\" };",
      "}",
      "",
      "export function createWithCtor(value: number): WithCtor {",
      "  return { value };",
      "}",
      "",
      "export function createHandler(): HandlerBox {",
      "  return {",
      "    run(value: number): number {",
      "      return value + 1;",
      "    },",
      "  };",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /Box box = new Box\s*\{\s*value = 1,\s*label = "one",\s*\};/);
  assert.match(generatedSource, /Box box = new Box\s*\{\s*value = value,\s*label = "two",\s*\};/);
  assert.match(generatedSource, /return new Box\s*\{\s*value = value,\s*label = "three",\s*\};/);
  assert.match(generatedSource, /return flag \? new Box\s*\{\s*value = value,\s*label = "yes",\s*\} : new Box\s*\{\s*value = 0,\s*label = "no",\s*\};/);
  assert.match(generatedSource, /return new WithCtor\s*\{\s*value = value,\s*\};/);
  assert.match(generatedSource, /public Func<double, double> run = value => value;/);
  assert.match(generatedSource, /return new HandlerBox\s*\{\s*run = \(double value\) =>\s*\{\s*return value \+ 1;\s*\},\s*\};/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedObjectInitializers.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI rejects provider-owned object literals until object-shape facts are finalized", async () => {
  const projectDirectory = resolve(tempRoot, "provider-owned-object-initializers");
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
            assemblyName: "SmokeGeneratedProviderObjectInitializers",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { Exception } from \"@tsonic/csharp/lang.js\";",
      "",
      "export function create(): Exception {",
      "  return {",
      "    message: \"boom\",",
      "    toString() {",
      "      return \"boom\";",
      "    },",
      "  };",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /Object literal emission requires a source-owned expected type or finalized TSTS\/provider object-shape facts/);
});

test("CLI emits interface object literals through provider object-shape adapters", async () => {
  const projectDirectory = resolve(tempRoot, "interface-object-initializers");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp" }],
    }, null, 2),
    "src/index.ts": [
      "export interface Named {",
      "  name: string;",
      "  run(value: number): number;",
      "}",
      "",
      "export function create(): Named {",
      "  return {",
      "    name: \"one\",",
      "    run(value: number) {",
      "      return value + 1;",
      "    },",
      "  };",
      "}",
      "",
      "export function invoke(named: Named): number {",
      "  const { run } = named;",
      "  return run(2);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);
  const generated = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generated, /public interface Named[\s\S]*string name \{ get; \}[\s\S]*double run\(double value\);/);
  assert.match(generated, /public class __TsonicShape_Named_[A-Za-z0-9_]+ : Named[\s\S]*public string name[\s\S]*get;[\s\S]*set;[\s\S]*public Func<double, double> __tsonic_shape_method_1_run;/);
  assert.match(generated, /public double run\(double arg0\)[\s\S]*return __tsonic_shape_method_1_run\(arg0\);/);
  assert.match(generated, /public static Named create\(\)[\s\S]*return new __TsonicShape_Named_[A-Za-z0-9_]+[\s\S]*name = "one",[\s\S]*__tsonic_shape_method_1_run = \(double value\) =>[\s\S]*return value \+ 1;/);
  assert.match(generated, /public static double invoke\(Named named\)[\s\S]*Func<double, double> run = __destructure\d+\.run;[\s\S]*return run\(2\);/);
  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits generic interface object literals through specialized provider adapters", async () => {
  const projectDirectory = resolve(tempRoot, "generic-interface-object-initializers");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp" }],
    }, null, 2),
    "src/index.ts": [
      "export interface Box<T> {",
      "  value: T;",
      "  label: string;",
      "}",
      "",
      "export function create(): Box<number> {",
      "  return { value: 1, label: \"one\" };",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);
  const generated = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generated, /public interface Box<T>[\s\S]*T value \{ get; \}[\s\S]*string label \{ get; \}/);
  assert.match(generated, /public class __TsonicShape_Box_[A-Za-z0-9_]+ : Box<double>[\s\S]*public double value[\s\S]*get;[\s\S]*set;[\s\S]*public string label[\s\S]*get;[\s\S]*set;/);
  assert.match(generated, /public static Box<double> create\(\)[\s\S]*return new __TsonicShape_Box_[A-Za-z0-9_]+[\s\S]*value = 1,[\s\S]*label = "one",/);
  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits source-owned object initializers with identifier-compatible string property names", async () => {
  const projectDirectory = resolve(tempRoot, "source-object-string-initializers");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp" }],
    }, null, 2),
    "src/index.ts": [
      "export class Box {",
      "  value: number = 0;",
      "}",
      "",
      "export function create(): Box {",
      "  return { \"value\": 42 };",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);
  const generated = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generated, /public static Box create\(\)[\s\S]*return new Box[\s\S]*value = 42,/);
  assert.doesNotMatch(generated, /unsupported|invalid/i);
  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI rejects class object literals when parameterless construction is unavailable", async () => {
  const projectDirectory = resolve(tempRoot, "required-constructor-object-initializers");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp" }],
    }, null, 2),
    "src/index.ts": [
      "export class Box {",
      "  value: number;",
      "",
      "  constructor(value: number) {",
      "    this.value = value;",
      "  }",
      "}",
      "",
      "export function create(): Box {",
      "  return { value: 1 };",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /Object literal emission requires a source-owned expected type or finalized TSTS\/provider object-shape facts/);
});

test("CLI emits explicit tuple types and tuple literals as C# value tuples", async () => {
  const projectDirectory = resolve(tempRoot, "value-tuples");
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
            assemblyName: "SmokeGeneratedTuples",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function makePair(name: string, value: number): [string, number] {",
      "  const pair: [string, number] = [name, value];",
      "  return pair;",
      "}",
      "",
      "export function returnPair(name: string, value: number): [string, number] {",
      "  return [name, value];",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static \(string, double\) makePair\(string name, double value\)/);
  assert.match(generatedSource, /\(string, double\) pair = \(name, value\);/);
  assert.match(generatedSource, /public static \(string, double\) returnPair\(string name, double value\)/);
  assert.match(generatedSource, /return \(name, value\);/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedTuples.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits standard JavaScript class static blocks as C# static constructors", async () => {
  const projectDirectory = resolve(tempRoot, "class-static-blocks");
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
            assemblyName: "SmokeGeneratedStaticBlocks",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export class Counter {",
      "  static value: number = 0;",
      "  static {",
      "    Counter.value = 3;",
      "  }",
      "}",
      "",
      "export function read(): number {",
      "  return Counter.value;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static double value = 0;/);
  assert.match(generatedSource, /static Counter\(\)\n\s*\{\n\s*Counter\.value = 3;/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedStaticBlocks.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI rejects non-nullish unions until runtime-carrier facts are finalized", async () => {
  const projectDirectory = resolve(tempRoot, "runtime-carrier-unions");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp" }],
    }, null, 2),
    "src/index.ts": [
      "export function choose(flag: boolean): string | number {",
      "  return flag ? \"x\" : 1;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /Union type annotations require finalized TSTS\/provider storage facts/);
});

test("CLI emits array length and indexer access from TSTS provider facts", async () => {
  const projectDirectory = resolve(tempRoot, "array-surface-operations");
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
            assemblyName: "SmokeGeneratedArraySurfaceOperations",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "export function first(values: int32[]): int32 {",
      "  return values[0];",
      "}",
      "",
      "export function pick(values: int32[], index: int32): int32 {",
      "  return values[index];",
      "}",
      "",
      "export function count(values: int32[]): int32 {",
      "  return values.length;",
      "}",
      "",
      "export function join(values: int32[]): string {",
      "  return values.join(\"|\");",
      "}",
      "",
      "export function destruct(values: int32[]): int32 {",
      "  const [first, second] = values;",
      "  return first + second;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static int first\(int\[\] values\)/);
  assert.match(generatedSource, /return values\[0\];/);
  assert.match(generatedSource, /public static int pick\(int\[\] values, int index\)/);
  assert.match(generatedSource, /return values\[index\];/);
  assert.match(generatedSource, /public static int count\(int\[\] values\)/);
  assert.match(generatedSource, /return values\.Length;/);
  assert.match(generatedSource, /public static string join\(int\[\] values\)/);
  assert.match(generatedSource, /return string\.Join\("\|", values\);/);
  assert.match(generatedSource, /public static int destruct\(int\[\] values\)/);
  assert.match(generatedSource, /int first = __destructure0\[0\];/);
  assert.match(generatedSource, /int second = __destructure0\[1\];/);
  assert.match(generatedSource, /return first \+ second;/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedArraySurfaceOperations.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits void-expression statement and return lowering as discard evaluation", async () => {
  const projectDirectory = resolve(tempRoot, "void-expression-discard");
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
            assemblyName: "SmokeGeneratedVoidExpressionDiscard",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "export function bump(value: int32): int32 {",
      "  return value + 1;",
      "}",
      "",
      "export function discardCall(value: int32): void {",
      "  void bump(value);",
      "}",
      "",
      "export function returnDiscard(value: int32): void {",
      "  return void bump(value);",
      "}",
      "",
      "export function discardLiteral(): void {",
      "  void 0;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static void discardCall\(int value\)[\s\S]*bump\(value\);/);
  assert.match(generatedSource, /public static void returnDiscard\(int value\)[\s\S]*bump\(value\);[\s\S]*return;/);
  assert.match(generatedSource, /public static void discardLiteral\(\)[\s\S]*_ = 0;/);
  assert.doesNotMatch(generatedSource, /return bump\(value\);/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedVoidExpressionDiscard.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits RegExp literals through provider-backed JS runtime carriers", async () => {
  const projectDirectory = resolve(tempRoot, "regexp-literal-carrier");
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
            assemblyName: "SmokeGeneratedRegExpLiteralCarrier",
            references: {
              projects: [
                resolve(repoRoot, "../csharp-js/src/Tsonic.CSharp.Js/Tsonic.CSharp.Js.csproj"),
              ],
            },
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function matches(input: string): boolean {",
      "  const expression = /abc/i;",
      "  const constructed = new RegExp(\"xyz\", \"g\");",
      "  return expression.test(input) || constructed.test(input);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.RegExp expression = new Tsonic\.CSharp\.Js\.RegExp\("abc", "i"\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.RegExp constructed = new Tsonic\.CSharp\.Js\.RegExp\("xyz", "g"\);/);
  assert.match(generatedSource, /return expression\.test\(input\) \|\| constructed\.test\(input\);/);
  assert.doesNotMatch(generatedSource, /unsupported|invalid/i);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedRegExpLiteralCarrier.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits string element access from selected provider index facts", async () => {
  const projectDirectory = resolve(tempRoot, "string-element-access");
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
            assemblyName: "SmokeGeneratedStringElementAccess",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "export function at(value: string, index: int32): string {",
      "  return value[index];",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static string at\(string value, int index\)/);
  assert.match(generatedSource, /return value\.Substring\(index, 1\);/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedStringElementAccess.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI rejects element access with non-integral indexes until conversion facts are finalized", async () => {
  const projectDirectory = resolve(tempRoot, "non-integral-element-index");
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
            assemblyName: "SmokeGeneratedNonIntegralIndexes",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function stringAt(value: string, index: number): string {",
      "  return value[index];",
      "}",
      "",
      "export function arrayAt(value: string[], index: number): string {",
      "  return value[index];",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /C# element access must be selected by TSTS\/provider facts/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedNonIntegralIndexes.csproj")), false);
});

test("CLI emits string for-of from provider code-point iteration facts", async () => {
  const projectDirectory = resolve(tempRoot, "string-for-of");
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
            assemblyName: "SmokeGeneratedStringForOf",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function totalLength(value: string): number {",
      "  let total = 0;",
      "  for (const ch of value) {",
      "    total = total + ch.length;",
      "  }",
      "  return total;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /string __forOfString0 = value;/);
  assert.match(generatedSource, /for \(int __forOfIndex0 = 0; __forOfIndex0 < __forOfString0\.Length; \)/);
  assert.match(generatedSource, /char\.IsHighSurrogate\(__forOfString0\[__forOfIndex0\]\)/);
  assert.match(generatedSource, /char\.IsLowSurrogate\(__forOfString0\[__forOfIndex0 \+ 1\]\)/);
  assert.match(generatedSource, /ch = __forOfString0\.Substring\(__forOfIndex0, 2\);/);
  assert.match(generatedSource, /ch = __forOfString0\.Substring\(__forOfIndex0, 1\);/);
  assert.match(generatedSource, /total = total \+ ch\.Length;/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedStringForOf.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits primitive generic constraints from provider facts", async () => {
  const projectDirectory = resolve(tempRoot, "primitive-generic-constraints");
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
            assemblyName: "SmokeGeneratedPrimitiveGenericConstraints",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function constrained<T extends number>(value: T): T {",
      "  return value;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static T constrained<T>\(T value\)/);
  assert.match(generatedSource, /where T : System\.Numerics\.INumber<T>/);
  assert.match(generatedSource, /return value;/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedPrimitiveGenericConstraints.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI rejects unsupported primitive generic constraints without provider facts", async () => {
  const projectDirectory = resolve(tempRoot, "unsupported-primitive-generic-constraints");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp" }],
    }, null, 2),
    "src/index.ts": [
      "export function constrained<T extends string>(value: T): T {",
      "  return value;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /Generic constraints require a named target type/);
});

test("CLI emits array for-in from provider enumeration facts", async () => {
  const projectDirectory = resolve(tempRoot, "array-for-in");
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
            assemblyName: "SmokeGeneratedArrayForIn",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function countKeys(values: number[]): number {",
      "  let total = 0;",
      "  for (const key in values) {",
      "    total = total + key.length;",
      "  }",
      "  return total;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /double\[\] __forInTarget0 = values;/);
  assert.match(generatedSource, /for \(int __forInIndex0 = 0; __forInIndex0 < __forInTarget0\.Length; __forInIndex0\+\+\)/);
  assert.match(generatedSource, /string key = __forInIndex0\.ToString\(System\.Globalization\.CultureInfo\.InvariantCulture\);/);
  assert.match(generatedSource, /total = total \+ key\.Length;/);
  assert.doesNotMatch(generatedSource, /unsupported|invalid/i);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedArrayForIn.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits object-shape for-in from finalized provider enumeration facts", async () => {
  const projectDirectory = resolve(tempRoot, "object-shape-for-in");
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
            assemblyName: "SmokeGeneratedObjectShapeForIn",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function countKeys(values: { value: number; label: string }): number {",
      "  let total = 0;",
      "  for (const key in values) {",
      "    total = total + key.length;",
      "  }",
      "  return total;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public class __TsonicShape_/);
  assert.match(generatedSource, /public double value;/);
  assert.match(generatedSource, /public string label;/);
  assert.match(generatedSource, /__TsonicShape_[A-Za-z0-9_]+ __forInTarget0 = values;/);
  assert.match(generatedSource, /string\[\] __forInKeys0 = new string\[\] \{ "value", "label" \};/);
  assert.match(generatedSource, /for \(int __forInIndex0 = 0; __forInIndex0 < __forInKeys0\.Length; __forInIndex0\+\+\)/);
  assert.match(generatedSource, /string key = __forInKeys0\[__forInIndex0\];/);
  assert.match(generatedSource, /total = total \+ key\.Length;/);
  assert.doesNotMatch(generatedSource, /unsupported|invalid/i);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedObjectShapeForIn.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits structural type-literal object shapes from finalized provider facts", async () => {
  const projectDirectory = resolve(tempRoot, "structural-object-destructuring");
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
            assemblyName: "SmokeGeneratedObjectShapes",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function fromParameter({ value }: { value: number }): number {",
      "  return value;",
      "}",
      "",
      "export function create(value: number): { value: number; label: string } {",
      "  return { value, label: \"ok\" };",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public class __TsonicShape_/);
  assert.match(generatedSource, /public double value;/);
  assert.match(generatedSource, /public string label;/);
  assert.match(generatedSource, /public static double fromParameter\(__TsonicShape_[A-Za-z0-9_]+ __param0\)/);
  assert.match(generatedSource, /double value = __param0\.value;/);
  assert.match(generatedSource, /public static __TsonicShape_[A-Za-z0-9_]+ create\(double value\)/);
  assert.match(generatedSource, /return new __TsonicShape_[A-Za-z0-9_]+\s*\{\s*value = value,\s*label = "ok",\s*\};/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedObjectShapes.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits structural type-literal methods as delegate-backed object shapes", async () => {
  const projectDirectory = resolve(tempRoot, "structural-object-methods");
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
            assemblyName: "SmokeGeneratedObjectShapeMethods",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function create(): { run(value: number): number } {",
      "  return {",
      "    run(value: number) {",
      "      return value + 1;",
      "    },",
      "  };",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public Func<double, double> __tsonic_shape_method_0_run;/);
  assert.match(generatedSource, /public double run\(double arg0\)[\s\S]*return __tsonic_shape_method_0_run\(arg0\);/);
  assert.match(generatedSource, /__tsonic_shape_method_0_run = \(double value\) =>/);
  assert.match(generatedSource, /return value \+ 1;/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedObjectShapeMethods.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI rejects structural binary operators without selected target facts", async () => {
  const projectDirectory = resolve(tempRoot, "structural-binary-operator");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp" }],
    }, null, 2),
    "src/external.d.ts": [
      "export declare const left: { value: number };",
      "export declare const right: { value: number };",
      "",
    ].join("\n"),
    "src/index.ts": [
      "import { left, right } from \"./external.js\";",
      "",
      "export function compare(): boolean {",
      "  return left == right;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /C# binary operator emission requires a selected provider operator fact/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
});

test("CLI emits string instance calls from selected target signature facts", async () => {
  const projectDirectory = resolve(tempRoot, "string-call-target-facts");
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
            assemblyName: "SmokeGeneratedStringCalls",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function text(value: string): string {",
      "  return value.toString();",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static string text\(string value\)/);
  assert.match(generatedSource, /return value\.ToString\(\);/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedStringCalls.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI rejects non-source-owned constructors without selected target signature facts", async () => {
  const projectDirectory = resolve(tempRoot, "builtin-constructor-requires-target-facts");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp" }],
    }, null, 2),
    "src/index.ts": [
      "export function create(): Date {",
      "  return new Date();",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /C# construction emission requires a source-owned constructor or a selected target constructor fact/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
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
