import {
  assert,
  assertGeneratedOutputHasNoReflectionSemantics,
  assertInstalledAssemblyReference,
  assertNoRuntimeProjectReference,
  cliPath,
  existsSync,
  readFile,
  resolve,
  runGeneratedCsharpRunner,
  runNode,
  tempRoot,
  test,
  writeProject,
} from "./harness.mjs";

test("CLI maps selected JS Promise construction and all to Task-backed runtime operations", async () => {
  const projectDirectory = resolve(tempRoot, "js-promise-task-runtime");
  const assemblyName = "SmokeGeneratedPromiseTaskRuntime";
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{
        id: "csharp",
        surfaces: ["js"],
        options: {
          namespace: "Smoke.Generated",
          assemblyName,
        },
      }],
    }, null, 2),
    "src/index.ts": [
      "function value(input: number): Promise<number> {",
      "  return new Promise<number>((resolve) => {",
      "    resolve(input);",
      "  });",
      "}",
      "",
      "function settled(): Promise<void> {",
      "  return new Promise<void>((resolve) => {",
      "    resolve();",
      "  });",
      "}",
      "",
      "export function passthrough(input: PromiseLike<number>): PromiseLike<number> {",
      "  return input;",
      "}",
      "",
      "export async function run(): Promise<string> {",
      "  await settled();",
      "  const values = await Promise.all([value(3), value(5)]);",
      "  return `${values[0]}:${values[1]}`;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const projectText = await readFile(resolve(projectDirectory, `out/csharp/${assemblyName}.csproj`), "utf8");
  const generatedText = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assertInstalledAssemblyReference(projectText, "Tsonic.CSharp.Js");
  assertNoRuntimeProjectReference(projectText, "Tsonic.CSharp.Js");
  assert.match(generatedText, /System\.Threading\.Tasks\.Task<double>/u);
  assert.match(generatedText, /System\.Threading\.Tasks\.Task<double> passthrough\(System\.Threading\.Tasks\.Task<double> input\)/u);
  assert.match(generatedText, /Tsonic\.CSharp\.Js\.PromiseRuntime\.Create/u);
  assert.match(generatedText, /Tsonic\.CSharp\.Js\.PromiseRuntime<double>\.Create/u);
  assert.match(generatedText, /Tsonic\.CSharp\.Js\.PromiseRuntime<double>\.All/u);
  assert.match(generatedText, /new System\.Threading\.Tasks\.Task<double>\[\]/u);
  assert.doesNotMatch(generatedText, /new System\.Threading\.Tasks\.Task(?:<[^>]+>)?\s*\(/u);
  await assertGeneratedOutputHasNoReflectionSemantics(projectDirectory);

  const output = await runGeneratedCsharpRunner(projectDirectory, assemblyName, [
    "using System;",
    "using System.Threading.Tasks;",
    "",
    "public static class Program",
    "{",
    "    public static async Task Main()",
    "    {",
    "        Console.WriteLine(await Smoke.Generated.Index.run());",
    "    }",
    "}",
    "",
  ]);
  assert.equal(output, "3:5\n");
});

test("CLI rejects selected JS Promise operations without closed runtime metadata", async () => {
  const projectDirectory = resolve(tempRoot, "js-promise-unsupported-operation");
  const assemblyName = "SmokeGeneratedPromiseUnsupported";
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{
        id: "csharp",
        surfaces: ["js"],
        options: {
          namespace: "Smoke.Generated",
          assemblyName,
        },
      }],
    }, null, 2),
    "src/index.ts": [
      "export function resolved(value: number): Promise<number> {",
      "  return Promise.resolve(value);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.notEqual(build.status, 0);
  assert.match(build.stdout + build.stderr, /Promise\.resolve/u);
  assert.match(build.stdout + build.stderr, /scheduler|continuation|operation metadata/u);
  assert.equal(existsSync(resolve(projectDirectory, `out/csharp/${assemblyName}.csproj`)), false);
});
