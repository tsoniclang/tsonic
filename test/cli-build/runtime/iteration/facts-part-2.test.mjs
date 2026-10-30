import { assert, cliPath, readFile, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";

test("CLI emits Record for-in from finalized provider Dictionary key facts", async () => {
  const projectDirectory = resolve(tempRoot, "iteration-record-for-in");
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
            namespace: "Smoke.Generated",
            assemblyName: "SmokeGeneratedIterationRecordForIn",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function countKeys(values: Record<string, number>): number {",
      "  let total = 0;",
      "  for (const key in values) {",
      "    total = total + key.length;",
      "  }",
      "  return total;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /System\.Collections\.Generic\.Dictionary<string, double> __tsonic_forInTarget\d+ = values;/);
  assert.match(generatedSource, /foreach \(string key in __tsonic_forInTarget\d+\.Keys\)/);
  assert.match(generatedSource, /total = total \+ key\.Length;/);
  assert.doesNotMatch(generatedSource, /unsupported|invalid/i);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedIterationRecordForIn.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits object-shape for-in from finalized provider enumeration facts", async () => {
  const projectDirectory = resolve(tempRoot, "iteration-object-shape-for-in");
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
            namespace: "Smoke.Generated",
            assemblyName: "SmokeGeneratedIterationObjectShapeForIn",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function countKeys(values: { value: number; label: string }): number {",
      "  let total = 0;",
      "  for (const key in values) {",
      "    total = total + key.length;",
      "  }",
      "  return total;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  const generatedShapes = await readFile(resolve(projectDirectory, "out/csharp/generated/TsonicObjectShapes.cs"), "utf8");
  assert.match(generatedShapes, /public interface [A-Za-z][A-Za-z0-9_]*Shape_[a-f0-9]{12}/);
  assert.match(generatedShapes, /Property1 value \{ get; set; \}/);
  assert.match(generatedShapes, /Property0 label \{ get; set; \}/);
  assert.match(generatedShapes, /System\.ReadOnlySpan<string> __tsonicObjectEnumerableKeys\(\);/);
  assert.match(generatedSource, /[A-Za-z][A-Za-z0-9_]*Shape_[a-f0-9]{12}<string, double> __tsonic_forInTarget0 = values;/);
  assert.match(generatedSource, /System\.ReadOnlySpan<string> __tsonic_forInKeys0 = __tsonic_forInTarget0\.__tsonicObjectEnumerableKeys\(\);/);
  assert.match(generatedSource, /for \(int __tsonic_forInIndex0 = 0; __tsonic_forInIndex0 < __tsonic_forInKeys0\.Length; __tsonic_forInIndex0\+\+\)/);
  assert.match(generatedSource, /string key = __tsonic_forInKeys0\[__tsonic_forInIndex0\];/);
  assert.match(generatedSource, /total = total \+ key\.Length;/);
  assert.doesNotMatch(generatedSource, /unsupported|invalid/i);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedIterationObjectShapeForIn.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});
