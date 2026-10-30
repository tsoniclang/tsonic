import { performance } from "node:perf_hooks";
import { assert, cliPath, readFile, repoRoot, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";

test("CLI emits C# switch defaults and literal fallthrough labels", async () => {
  const projectDirectory = resolve(tempRoot, "literal-switch-fallthrough");
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
            assemblyName: "SmokeGeneratedLiteralSwitchFallthrough",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function classify(value: string): string {",
      "  switch (value) {",
      "    case \"alpha\":",
      "    case \"beta\":",
      "      return \"known\";",
      "    default:",
      "      return \"other\";",
      "  }",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /switch \(value\)/);
  assert.match(generatedSource, /case "alpha":\s+goto case "beta";/);
  assert.match(generatedSource, /case "beta":\s+return "known";/);
  assert.match(generatedSource, /default:\s+return "other";/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedLiteralSwitchFallthrough.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI executes dynamic switch cases in source order with default and fallthrough", async () => {
  const projectDirectory = resolve(tempRoot, "dynamic-switch-case-expression");
  const assemblyName = "SmokeGeneratedDynamicSwitchCase";
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
      "let trace = \"\";",
      "function record(value: string, label: string): string { trace += label; return value; }",
      "export function classify(value: string, dynamicCase: string): string {",
      "  trace = \"\";",
      "  let result = \"\";",
      "  switch (record(value, \"input;\")) {",
      "    case record(dynamicCase, \"first;\"):",
      "      result = \"dynamic\";",
      "      break;",
      "    default:",
      "      result = \"default\";",
      "    case record(\"last\", \"last;\"):",
      "      result += \"last\";",
      "  }",
      "  return result + \"|\" + trace;",
      "}",
      "Console.WriteLine(classify(\"first\", \"first\"));",
      "Console.WriteLine(classify(\"last\", \"first\"));",
      "Console.WriteLine(classify(\"missing\", \"first\"));",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);
  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.doesNotMatch(generatedSource, /__unsupported|InvalidExpression|System\.Reflection/u);
  assert.equal(runGeneratedProject(projectDirectory, assemblyName),
    "dynamic|input;first;\nlast|input;first;last;\ndefaultlast|input;first;last;\n");
});

test("CLI lowers switch fallthrough into explicit C# switch gotos", async () => {
  const projectDirectory = resolve(tempRoot, "switch-fallthrough");
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
            assemblyName: "SmokeGeneratedSwitchFallthrough",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function choose(value: number): number {",
      "  let result = 0;",
      "  switch (value) {",
      "    case 0:",
      "      result = 1;",
      "    case 1:",
      "      result = result + 2;",
      "      break;",
      "    case 2:",
      "      result = 4;",
      "    default:",
      "      result = result + 8;",
      "  }",
      "  return result;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /goto case 1;/);
  assert.match(generatedSource, /goto default;/);
  assert.doesNotMatch(generatedSource, /Switch case fallthrough requires/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedSwitchFallthrough.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});
