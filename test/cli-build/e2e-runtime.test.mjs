import { assert, cliPath, readFile, resolve, runGeneratedProject, runNode, tempRoot, test, writeProject } from "./harness.mjs";

test("CLI runs generated C# executable for provider Console hello world", async () => {
  const assemblyName = "SmokeGeneratedE2EHello";
  const projectDirectory = resolve(tempRoot, "e2e-hello-world");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp", options: { namespace: "Smoke.Generated", assemblyName, outputType: "Exe" } }],
    }, null, 2),
    "src/index.ts": [
      "import { Console } from \"@tsonic/dotnet/System.js\";",
      "",
      "Console.WriteLine(\"Hello from Tsonic E2E!\");",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /System\.Console\.WriteLine\("Hello from Tsonic E2E!"\);/);
  const entrypointSource = await readFile(resolve(projectDirectory, "out/csharp/generated/TsonicEntrypoint.cs"), "utf8");
  assert.match(entrypointSource, /public static void Main\(\)/);
  assert.match(entrypointSource, /Index\.__tsonic_module_init\(\);/);
  assert.equal(runGeneratedProject(projectDirectory, assemblyName), "Hello from Tsonic E2E!\n");
});

test("CLI runs generated C# executable for top-level code and exported function references", async () => {
  const assemblyName = "SmokeGeneratedE2ETopLevel";
  const projectDirectory = resolve(tempRoot, "e2e-top-level-code");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp", options: { namespace: "Smoke.Generated", assemblyName, outputType: "Exe" } }],
    }, null, 2),
    "src/index.ts": [
      "import { Console } from \"@tsonic/dotnet/System.js\";",
      "",
      "const greeting = \"Hello from top-level!\";",
      "",
      "export function getGreeting(): string {",
      "  return greeting;",
      "}",
      "",
      "Console.WriteLine(getGreeting());",
      "Console.WriteLine(\"Line 1\");",
      "Console.WriteLine(\"Line 2\");",
      "Console.WriteLine(\"Done!\");",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);
  assert.equal(runGeneratedProject(projectDirectory, assemblyName), [
    "Hello from top-level!",
    "Line 1",
    "Line 2",
    "Done!",
    "",
  ].join("\n"));
});

test("CLI runs generated C# executable with namespace imports and module constants", async () => {
  const assemblyName = "SmokeGeneratedE2ENamespaceImports";
  const projectDirectory = resolve(tempRoot, "e2e-namespace-imports");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp", options: { namespace: "Smoke.Generated", assemblyName, outputType: "Exe" } }],
    }, null, 2),
    "src/index.ts": [
      "import * as MathUtils from \"./utils/math.js\";",
      "import { Console } from \"@tsonic/dotnet/System.js\";",
      "",
      "const sum = MathUtils.add(5.0, 3.0);",
      "const product = MathUtils.multiply(4.0, 7.0);",
      "Console.WriteLine(`Sum: ${sum}`);",
      "Console.WriteLine(`Product: ${product}`);",
      "Console.WriteLine(`PI: ${MathUtils.PI}`);",
      "Console.WriteLine(\"Done\");",
      "",
    ].join("\n"),
    "src/utils/math.ts": [
      "export function add(a: number, b: number): number {",
      "  return a + b;",
      "}",
      "",
      "export function multiply(a: number, b: number): number {",
      "  return a * b;",
      "}",
      "",
      "export const PI = 3.14159;",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);
  assert.equal(runGeneratedProject(projectDirectory, assemblyName), [
    "Sum: 8",
    "Product: 28",
    "PI: 3.14159",
    "Done",
    "",
  ].join("\n"));
});

test("CLI runs generated C# executable with provider File and Path operations", async () => {
  const assemblyName = "SmokeGeneratedE2EFileIO";
  const projectDirectory = resolve(tempRoot, "e2e-file-io");
  const dataPath = resolve(projectDirectory, "generated-file.txt").replace(/\\/g, "\\\\");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp", options: { namespace: "Smoke.Generated", assemblyName, outputType: "Exe" } }],
    }, null, 2),
    "src/index.ts": [
      "import { Console } from \"@tsonic/dotnet/System.js\";",
      "import { File, Path } from \"@tsonic/dotnet/System.IO.js\";",
      "",
      `const testFile = Path.Combine("${dataPath}", "..", "generated-file.txt");`,
      "File.WriteAllText(testFile, \"Hello from Tsonic with BCL!\");",
      "const content = File.ReadAllText(testFile);",
      "Console.WriteLine(`File content: ${content}`);",
      "const exists = File.Exists(testFile);",
      "Console.WriteLine(`File exists: ${exists}`);",
      "File.Delete(testFile);",
      "Console.WriteLine(\"File deleted\");",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);
  assert.equal(runGeneratedProject(projectDirectory, assemblyName), [
    "File content: Hello from Tsonic with BCL!",
    "File exists: True",
    "File deleted",
    "",
  ].join("\n"));
});
