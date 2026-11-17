import { assert, cliPath, dotnetOutputAssemblyPath, existsSync, readFile, repoRoot, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";
import { readGeneratedModuleSource } from "./delegates-attributes-exceptions-fixtures.mjs";

test("CLI emits arbitrary TypeScript throw values through the closed thrown-value carrier", async () => {
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
  assert.equal(build.status, 0, build.stdout + build.stderr);
  const generatedSource = await readGeneratedModuleSource(projectDirectory);
  assert.match(
    generatedSource,
    // RULINGS 2026-10-23: no redundant (int) cast on an int literal.
    /throw Tsonic\.CSharp\.Runtime\.TsThrownValueException\.from\(Tsonic\.CSharp\.Runtime\.TsValue\.from\(1\)\);/u,
  );
  assert.doesNotMatch(generatedSource, /\bdynamic\b|System\.Reflection/u);
  const project = resolve(projectDirectory, "out/csharp/SmokeGeneratedThrowFacts.csproj");
  const dotnet = run("dotnet", ["build", project, "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
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
      "import { Exception } from \"@tsonic/dotnet/System.js\";",
      "",
      "export function fail(): never {",
      "  throw new Exception(\"failed\");",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readGeneratedModuleSource(projectDirectory);
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
      "    void error;",
      "    return 2;",
      "  }",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readGeneratedModuleSource(projectDirectory);
  assert.match(
    generatedSource,
    /catch \(System\.Exception __tsonic_catch\d+\)[\s\S]*Tsonic\.CSharp\.Runtime\.TsValue error = Tsonic\.CSharp\.Runtime\.TsThrownValueException\.toValue\(__tsonic_catch\d+\);/u,
  );
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedCatchVariable.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI rejects catch destructuring until thrown-value extraction facts are finalized", async () => {
  const projectDirectory = resolve(tempRoot, "catch-destructuring-requires-facts");
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
            assemblyName: "SmokeGeneratedCatchDestructuringReject",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function guarded(): number {",
      "  try {",
      "    return 1;",
      "  } catch ({ message }: any) {",
      "    return 2;",
      "  }",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stdout + build.stderr, /Catch destructuring requires a closed thrown-value carrier/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedCatchDestructuringReject.csproj")), false);
});

test("CLI runs provider-backed exception throw, catch, and finally semantics", async () => {
  const assemblyName = "SmokeGeneratedProviderExceptionRuntime";
  const projectDirectory = resolve(tempRoot, "provider-backed-exception-runtime");
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
      "import { Console, Exception } from \"@tsonic/dotnet/System.js\";",
      "",
      "let cleanup = 0;",
      "",
      "function guarded(shouldThrow: boolean): string {",
      "  try {",
      "    if (shouldThrow) {",
      "      throw new Exception(\"boom\");",
      "    }",
      "    return \"ok\";",
      "  } catch (error) {",
      "    void error;",
      "    return \"boom\";",
      "  } finally {",
      "    cleanup++;",
      "  }",
      "}",
      "",
      "Console.WriteLine(`throw: ${guarded(true)}`);",
      "Console.WriteLine(`pass: ${guarded(false)}`);",
      "Console.WriteLine(`cleanup: ${cleanup}`);",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readGeneratedModuleSource(projectDirectory);
  assert.match(generatedSource, /throw new System\.Exception\("boom"\);/);
  assert.match(
    generatedSource,
    /catch \(System\.Exception __tsonic_catch\d+\)[\s\S]*Tsonic\.CSharp\.Runtime\.TsValue error = Tsonic\.CSharp\.Runtime\.TsThrownValueException\.toValue\(__tsonic_catch\d+\);/u,
  );
  assert.match(generatedSource, /return "boom";/);
  assert.match(generatedSource, /finally/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  assert.equal(runGeneratedProject(projectDirectory, assemblyName), [
    "throw: boom",
    "pass: ok",
    "cleanup: 2",
    "",
  ].join("\n"));
});
