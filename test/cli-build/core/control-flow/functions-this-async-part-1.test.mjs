import { performance } from "node:perf_hooks";
import { assert, cliPath, existsSync, readFile, repoRoot, resolve, run, runGeneratedCsharpRunner, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";

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
  assert.match(generatedSource, /async System\.Threading\.Tasks\.Task<double> (?<callable>__tsonic_callable_\d+)\(\)\s*\{\s*return 2;\s*\}\s*return new Func<System\.Threading\.Tasks\.Task<double>>\(\k<callable>\);/);
  assert.doesNotMatch(generatedSource, /__unsupported/);
});

test("CLI executes inferred callable expressions without requiring a contextual delegate annotation", async () => {
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
  assert.equal(build.status, 0, build.stdout + build.stderr);
  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static void bare\(\)\s*\{\s*\}/u);
  assert.doesNotMatch(generatedSource, /__unsupported|InvalidExpression|dynamic|System\.Reflection/u);
  assert.equal(await runGeneratedCsharpRunner(projectDirectory, "SmokeGeneratedLambdaFacts", [
    "using System;",
    "public static class Program",
    "{",
    "    public static void Main()",
    "    {",
    "        Smoke.Generated.Index.bare();",
    "        Console.WriteLine(\"completed\");",
    "    }",
    "}",
  ]), "completed\n");
});

test("CLI rejects inferred callable bodies without exact checked source bindings", async () => {
  for (const prefix of ["", "async "]) {
    const projectDirectory = resolve(tempRoot, `inferred-callable-missing-binding-${prefix === "" ? "sync" : "async"}`);
    await writeProject(projectDirectory, {
      "tsonic.json": JSON.stringify({
        entryPoint: "index.ts",
        rootDir: "src",
        outDir: "out",
        targets: [{ id: "csharp" }],
      }, null, 2),
      "src/index.ts": `export function bare(): void { (${prefix}() => missing); }\n`,
    });
    const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
    assert.equal(build.status, 1);
    assert.match(build.stderr, /TS2304: Cannot find name 'missing'/u);
    assert.equal(existsSync(resolve(projectDirectory, "out/csharp/src/Index.cs")), false);
    assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
  }
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
  assert.match(generatedSource, /public static int inferred\(\)/);
  assert.match(generatedSource, /public static void sideEffect\(double value\)/);
  assert.match(generatedSource, /public static int\[\] inferredArray\(\)/);
  assert.match(generatedSource, /return new int\[\] \{ 1, 2 \};/);
  assert.match(generatedSource, /public static T inferredGeneric<T>\(T value\)/);
  assert.match(generatedSource, /public static int localArray\(\)/);
  assert.match(generatedSource, /int\[\] values = new int\[\] \{ 1, 2 \};/);
  assert.match(generatedSource, /public int\[\] values = new int\[\] \{ 1, 2 \};/);
  assert.match(generatedSource, /public double current\(\)/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedInferredReturns.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});
