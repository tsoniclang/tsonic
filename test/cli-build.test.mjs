import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const repoRoot = process.cwd();
const cliPath = resolve(repoRoot, "packages/cli/dist/src/index.js");
const tempRoot = resolve(repoRoot, ".temp/test-runs/cli-build");

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
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSourcePath = resolve(projectDirectory, "out/csharp/src/Index.cs");
  const generatedSource = await readFile(generatedSourcePath, "utf8");
  assert.match(generatedSource, /public static int pick\(int\[\] values\)/);
  assert.match(generatedSource, /public Counter\(int initial\)/);
  assert.match(generatedSource, /for \(int i = 0; i < delta; i\+\+\)/);
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

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedNeutral.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI reports unsupported iteration semantics instead of guessing", async () => {
  const projectDirectory = resolve(tempRoot, "unsupported-for-of");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp" }],
    }, null, 2),
    "src/index.ts": [
      "export function sum(values: number[]): number {",
      "  let total = 0;",
      "  for (const value of values) {",
      "    total = total + value;",
      "  }",
      "  return total;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /For-in\/for-of requires target collection iteration semantics/);
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
