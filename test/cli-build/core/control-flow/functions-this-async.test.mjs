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
  assert.match(shapes, /public double read\(\)\s*\{\s*return 3;\s*\}/u);
  assert.match(shapes, /public double read\(\)\s*\{\s*return this\.value;\s*\}/u);
  assert.equal((shapes.match(/public double read\(\)/gu) ?? []).length, 2, "both authored methods retain native bodies");
  assert.doesNotMatch(source + shapes, /__tsonic_shape_method_/u);
  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedObjectLiteralThis.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
  assert.equal(await runGeneratedCsharpRunner(projectDirectory, "SmokeGeneratedObjectLiteralThis", [
    "using System;",
    "public static class Program",
    "{",
    "    public static void Main()",
    "    {",
    "        Console.WriteLine(Smoke.Generated.Index.read());",
    "    }",
    "}",
  ]), "10\n");
});
