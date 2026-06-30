import { assert, cliPath, existsSync, readFile, resolve, runGeneratedProject, runNode, tempRoot, test, writeProject } from "./harness.mjs";

test("CLI runs switch and loop statements through structured C# AST", async () => {
  const assemblyName = "SmokeGeneratedSlice6ControlFlow";
  const projectDirectory = resolve(tempRoot, "slice6-control-flow");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          surfaces: ["js"],
          options: {
            outputType: "Exe",
            namespace: "Smoke.Generated",
            assemblyName,
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "let output = \"\";",
      "",
      "function append(value: string): void {",
      "  output = output + value;",
      "}",
      "",
      "function classify(value: number): void {",
      "  switch (value) {",
      "    case 0:",
      "      append(\"zero;\");",
      "    case 1:",
      "      append(\"one;\");",
      "      break;",
      "    default:",
      "      append(\"other;\");",
      "  }",
      "}",
      "",
      "let total = 0;",
      "for (let index = 0; index < 3; index = index + 1) {",
      "  total = total + index;",
      "}",
      "while (total < 5) {",
      "  total = total + 1;",
      "}",
      "do {",
      "  total = total + 1;",
      "} while (total < 6);",
      "",
      "classify(0);",
      "console.log(`${output}total=${total}`);",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /switch \(value\)/);
  assert.match(generatedSource, /goto case 1;/);
  assert.match(generatedSource, /for \(double index = 0; index < 3; index = index \+ 1\)/);
  assert.match(generatedSource, /while \(total < 5\)/);
  assert.match(generatedSource, /do\s+\{/);
  assert.doesNotMatch(generatedSource, /__unsupported|InvalidExpression/u);

  const stdout = runGeneratedProject(projectDirectory, assemblyName);
  assert.equal(stdout, "zero;one;total=6\n");
});

test("CLI rejects switch and loop statements without finalized facts", async () => {
  const projectDirectory = resolve(tempRoot, "slice6-control-flow-diagnostics");
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
            assemblyName: "SmokeGeneratedSlice6ControlFlowDiagnostics",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function invalid(value: string, dynamicCase: string, count: number): void {",
      "  switch (value) {",
      "    case dynamicCase:",
      "      break;",
      "  }",
      "  while (count) {",
      "    break;",
      "  }",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /Switch case labels must be C# compile-time constants/);
  assert.match(build.stderr, /While statement condition requires a finalized C# bool runtime carrier/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedSlice6ControlFlowDiagnostics.csproj")), false);
});
