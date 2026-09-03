import { performance } from "node:perf_hooks";
import { assert, cliPath, existsSync, readFile, repoRoot, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";

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

test("CLI emits instance and lexical this only from finalized receiver facts", async () => {
  const projectDirectory = resolve(tempRoot, "instance-lexical-this-facts");
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
            assemblyName: "SmokeGeneratedThisFacts",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export class Counter {",
      "  value: number = 7;",
      "  read(): number {",
      "    const read = (): number => this.value;",
      "    return read();",
      "  }",
      "}",
      "",
      "export function run(): number {",
      "  const counter = new Counter();",
      "  return counter.read();",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);
  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public class Counter/);
  assert.match(generatedSource, /public double value = 7;/);
  assert.match(generatedSource, /Func<double> read = \(\) => this\.value;/);
  assert.match(generatedSource, /return read\(\);/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedThisFacts.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI rejects static this before C# emission instead of guessing receiver semantics", async () => {
  const projectDirectory = resolve(tempRoot, "static-this-rejected");
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
            assemblyName: "SmokeGeneratedStaticThisRejected",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export class Counter {",
      "  static value: number = 7;",
      "  static read(): number {",
      "    return this.value;",
      "  }",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.notEqual(build.status, 0);
  assert.match(build.stderr, /C# this emission requires a TSTS-selected instance class receiver/);
  assert.match(build.stderr, /static class member receiver/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/src/Index.cs")), false);
});

test("CLI emits object-literal lexical this through a receiver-bound generated shape", async () => {
  const projectDirectory = resolve(tempRoot, "object-literal-method-this");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{
        id: "csharp",
        options: {
          namespace: "Smoke.Generated",
          assemblyName: "SmokeGeneratedObjectLiteralThis",
        },
      }],
    }, null, 2),
    "src/index.ts": [
      "type Box = { value: number; read(): number };",
      "export function read(): number {",
      "  const direct: Box = { value: 3, read(): number { return 3; } };",
      "  const receiver: Box = {",
      "    value: 7,",
      "    read(): number { return this.value; },",
      "  };",
      "  return direct.read() + receiver.read();",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);
  const source = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  const shapes = await readFile(resolve(projectDirectory, "out/csharp/generated/TsonicObjectShapes.cs"), "utf8");
  assert.match(shapes, /public required Func<[A-Za-z][A-Za-z0-9_]*Shape_[a-f0-9]{12}, double> __tsonic_shape_method_/u);
  assert.match(shapes, /return __tsonic_shape_method_\w+\(this\);/u);
  assert.equal((source.match(/__tsonic_shape_method_\w+ =/gu) ?? []).length, 2);
  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedObjectLiteralThis.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI rejects class-field this without a finalized field-initializer receiver contract", async () => {
  const projectDirectory = resolve(tempRoot, "class-field-this-rejected");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{
        id: "csharp",
        options: {
          namespace: "Smoke.Generated",
          assemblyName: "SmokeGeneratedClassFieldThisRejected",
        },
      }],
    }, null, 2),
    "src/index.ts": [
      "export class Counter {",
      "  value: number = 7;",
      "  doubled: number = this.value * 2;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.notEqual(build.status, 0);
  assert.match(build.stderr, /C# this emission requires a TSTS-selected instance class receiver/);
  assert.match(build.stderr, /class field initializer receiver/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/src/Index.cs")), false);
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
  assert.match(generatedSource, /public static int inferred\(\)/);
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
