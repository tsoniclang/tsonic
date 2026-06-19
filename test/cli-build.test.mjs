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
      "import type { int32, float64, bool } from \"@tsonic/core/types.js\";",
      "",
      "export function choose(flag: bool, left: int32, right: int32): int32 {",
      "  return flag ? left : right;",
      "}",
      "",
      "export function scale(value: float64): float64 {",
      "  return value * 2;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static int choose\(bool flag, int left, int right\)/);
  assert.match(generatedSource, /public static double scale\(double value\)/);
  const generatedProject = await readFile(resolve(projectDirectory, "out/csharp/SmokeGeneratedNeutral.csproj"), "utf8");
  assert.match(generatedProject, /<OutputType>Library<\/OutputType>/);
  assert.match(generatedProject, /<PublishAot>false<\/PublishAot>/);
  assert.match(generatedProject, /<LangVersion>preview<\/LangVersion>/);
  assert.match(generatedProject, /<CheckForOverflowUnderflow>true<\/CheckForOverflowUnderflow>/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedNeutral.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
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
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedGenerics.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI rejects generic constraints until target constraint facts are finalized", async () => {
  const projectDirectory = resolve(tempRoot, "generic-constraints");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp" }],
    }, null, 2),
    "src/index.ts": [
      "export function constrained<T extends object>(value: T): T {",
      "  return value;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /Generic constraints require finalized target constraint facts/);
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

test("CLI reports unsupported binding patterns instead of synthesizing C# names", async () => {
  const projectDirectory = resolve(tempRoot, "unsupported-binding-pattern");
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
      "export function fromLocal(point: { value: number }): number {",
      "  const { value } = point;",
      "  return value;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /CSHARP_UNSUPPORTED_NAME/);
  assert.match(build.stderr, /Parameter name must be an identifier/);
  assert.match(build.stderr, /Local binding name must be an identifier/);
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
