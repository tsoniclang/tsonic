import { assert, cliPath, readFile, resolve, run, runNode, tempRoot, test, writeProject } from "./harness.mjs";

function csharpProjectPath(projectDirectory, assemblyName) {
  return resolve(projectDirectory, `out/csharp/${assemblyName}.csproj`);
}

function runGeneratedProject(projectDirectory, assemblyName) {
  const build = run("dotnet", ["build", csharpProjectPath(projectDirectory, assemblyName), "--nologo", "--v:minimal"]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const executed = run("dotnet", ["run", "--project", csharpProjectPath(projectDirectory, assemblyName), "--no-build", "--no-restore"]);
  assert.equal(executed.status, 0, executed.stdout + executed.stderr);
  return executed.stdout.replace(/\r\n/g, "\n");
}

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
      "Console.writeLine(\"Hello from Tsonic E2E!\");",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/modules/TsonicModule_1wfnqsm.cs"), "utf8");
  assert.match(generatedSource, /public static void Main\(\)/);
  assert.match(generatedSource, /System\.Console\.WriteLine\("Hello from Tsonic E2E!"\);/);
  assert.equal(runGeneratedProject(projectDirectory, assemblyName), "Hello from Tsonic E2E!\n");
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
      "Console.writeLine(`Sum: ${sum}`);",
      "Console.writeLine(`Product: ${product}`);",
      "Console.writeLine(`PI: ${MathUtils.PI}`);",
      "Console.writeLine(\"Done\");",
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
      `const testFile = Path.combine("${dataPath}", "..", "generated-file.txt");`,
      "File.writeAllText(testFile, \"Hello from Tsonic with BCL!\");",
      "const content = File.readAllText(testFile);",
      "Console.writeLine(`File content: ${content}`);",
      "const exists = File.exists(testFile);",
      "Console.writeLine(`File exists: ${exists}`);",
      "File.delete(testFile);",
      "Console.writeLine(\"File deleted\");",
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
