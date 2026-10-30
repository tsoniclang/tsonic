import { assert, cliPath, existsSync, readFile, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../cli-build/helpers/harness.mjs";
import { readGeneratedModuleSource, runGeneratedCsharpRunner } from './async-build-fixtures.mjs';

test("CLI emits and executes native Promise constructors through core Task completion", async () => {
  const assemblyName = "SmokeGeneratedPromiseConstructorRejected";
  const projectDirectory = resolve(tempRoot, "promise-constructor-rejected");
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
            assemblyName,
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function create(): Promise<number> {",
      "  return new Promise<number>((resolve) => resolve(1));",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);
  const generatedSource = await readGeneratedModuleSource(projectDirectory);
  assert.match(generatedSource, /public static System\.Threading\.Tasks\.Task<double> create\(\)/u);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Runtime\.TaskCompletion<double>\.Create\(\(Tsonic\.CSharp\.Runtime\.TaskResolve<double> resolve, Tsonic\.CSharp\.Runtime\.TaskReject __tsonic_param0\) =>\s*\{\s*resolve\(Tsonic\.CSharp\.Runtime\.Union<double, System\.Threading\.Tasks\.Task<double>>\.From1\(1\)\);\s*return;\s*\}\);/u);
  assert.doesNotMatch(generatedSource, /Tsonic\.CSharp\.Js|__unsupported|System\.Reflection|\bdynamic\b/u);
  const stdout = await runGeneratedCsharpRunner(projectDirectory, assemblyName, [
    "using System;",
    "using System.Threading.Tasks;",
    "public static class Program",
    "{",
    "    public static async Task Main()",
    "    {",
    "        Console.WriteLine(await Smoke.Generated.Index.create());",
    "    }",
    "}",
    "",
  ]);
  assert.equal(stdout, "1\n");
});

test("CLI rejects incompatible native Promise resolution values in the checker", async () => {
  const assemblyName = "SmokeGeneratedPromiseWrongResolution";
  const projectDirectory = resolve(tempRoot, "promise-constructor-wrong-resolution");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp", options: { namespace: "Smoke.Generated", assemblyName } }],
    }, null, 2),
    "src/index.ts": [
      "export function create(): Promise<number> {",
      "  return new Promise<number>((resolve) => resolve(\"wrong\"));",
      "}",
      "",
    ].join("\n"),
  });
  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1, build.stdout + build.stderr);
  assert.match(build.stderr, /TS2345/u);
  assert.match(build.stderr, /TS2345: Argument of type 'string' is not assignable to parameter of type 'number \| PromiseLike<number>'/u);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/src/Index.cs")), false);
  assert.equal(existsSync(resolve(projectDirectory, `out/csharp/${assemblyName}.csproj`)), false);
});

test("CLI rejects Promise.resolve without finalized Task carrier facts before target artifacts", async () => {
  const assemblyName = "SmokeGeneratedPromiseResolveRejected";
  const projectDirectory = resolve(tempRoot, "promise-resolve-rejected");
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
            assemblyName,
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function done(): Promise<void> {",
      "  return Promise.resolve();",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.equal(build.stderr, [
    "ERROR tsts:TSTS_DIAGNOSTIC index.ts:2:18: index.ts(2,18): error TS2554: Expected 1 arguments, but got 0.",
    "  evidence: tsts.code=TS2554",
    "",
  ].join("\n"));
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/src/Index.cs")), false);
  assert.equal(existsSync(resolve(projectDirectory, `out/csharp/${assemblyName}.csproj`)), false);
});

test("CLI rejects unsupported Promise chains before target artifacts", async () => {
  const assemblyName = "SmokeGeneratedPromiseChainRejected";
  const projectDirectory = resolve(tempRoot, "promise-chain-rejected");
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
            assemblyName,
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function chain(): Promise<number> {",
      "  return Promise.resolve(1).then((value: number): number => value + 1);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.equal(
    build.stderr,
    "ERROR tsonic-csharp:CSHARP_UNSUPPORTED_AST index.ts:2:10: The exact selected property is neither provider-owned, source-profile-owned, nor declared by this project.\n",
  );
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/src/Index.cs")), false);
  assert.equal(existsSync(resolve(projectDirectory, `out/csharp/${assemblyName}.csproj`)), false);
});

test("CLI emits and executes async generators through native C# async iterators", async () => {
  const assemblyName = "SmokeGeneratedAsyncGenerator";
  const projectDirectory = resolve(tempRoot, "async-generator");
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
            assemblyName,
            outputType: "Exe",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { Console } from \"@tsonic/dotnet/System.js\";",
      "",
      "export async function* stream(): AsyncGenerator<number, string, number> {",
      "  const received = yield 1;",
      "  return `done:${received}`;",
      "}",
      "",
      "const generator = stream();",
      "const first = await generator.next();",
      "const completed = await generator.next(4);",
      "Console.WriteLine(`${first.value as number}:${completed.value as string}`);",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readGeneratedModuleSource(projectDirectory);
  assert.match(generatedSource, /public static Tsonic\.CSharp\.Runtime\.AsyncGenerator<double, string, double> stream\(\)/);
  assert.match(generatedSource, /async System\.Collections\.Generic\.IAsyncEnumerable<double> __tsonic_iterator0/);
  assert.doesNotMatch(generatedSource, /__unsupported/);
  assert.equal(runGeneratedProject(projectDirectory, assemblyName), "1:done:4\n");
});
