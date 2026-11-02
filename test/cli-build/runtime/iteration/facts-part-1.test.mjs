import { assert, cliPath, readFile, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";

test("CLI emits array for-of from finalized provider foreach iteration facts", async () => {
  const projectDirectory = resolve(tempRoot, "iteration-array-for-of");
  const originalFiles = {
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
            assemblyName: "SmokeGeneratedIterationArrayForOf",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function sum(values: number[]): number {",
      "  let total = 0;",
      "  for (const value of values) {",
      "    total = total + value;",
      "  }",
      "  return total;",
      "}",
      "",
    ].join("\n"),
  };

  await writeProject(projectDirectory, originalFiles);
  const refusedBuild = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(refusedBuild.status, 1, refusedBuild.stdout + refusedBuild.stderr);
  const refusedLine = originalFiles["src/index.ts"].split("\n").findIndex(line => line.includes("total = total + value")) + 1;
  assert.equal(refusedLine > 0 && refusedBuild.stderr.includes(`ERROR tsonic-csharp:CSHARP_UNSUPPORTED_AST index.ts:${refusedLine}:13: No exact C# implicit conversion relates 'source:float64' to 'source:int64'.`), true,
    "the unchanged original refuses at its exact later assignment without retyping the int64 accumulator");
  await writeProject(projectDirectory, { "src/index.ts": originalFiles["src/index.ts"].replace("let total = 0", "let total: number = 0") });
  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static double sum\(Tsonic\.CSharp\.Js\.JSArray<double> values\)/);
  assert.match(generatedSource, /double total = 0D;/);
  assert.match(generatedSource, /foreach \(double value in values\)/);
  assert.match(generatedSource, /total = total \+ value;/);
  assert.doesNotMatch(generatedSource, /unsupported|invalid/i);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedIterationArrayForOf.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits string for-of from finalized provider code-point iteration facts", async () => {
  const projectDirectory = resolve(tempRoot, "iteration-string-for-of");
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
            assemblyName: "SmokeGeneratedIterationStringForOf",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function totalLength(value: string): number {",
      "  let total = 0;",
      "  for (const ch of value) {",
      "    total = total + ch.length;",
      "  }",
      "  return total;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /string __tsonic_forOfString\d+ = value;/);
  assert.match(generatedSource, /for \(int __tsonic_forOfIndex\d+ = 0; __tsonic_forOfIndex\d+ < __tsonic_forOfString\d+\.Length; \)/);
  assert.match(generatedSource, /char\.IsHighSurrogate\(__tsonic_forOfString\d+\[__tsonic_forOfIndex\d+\]\)/);
  assert.match(generatedSource, /char\.IsLowSurrogate\(__tsonic_forOfString\d+\[__tsonic_forOfIndex\d+ \+ 1\]\)/);
  assert.match(generatedSource, /ch = __tsonic_forOfString\d+\.Substring\(__tsonic_forOfIndex\d+, 2\);/);
  assert.match(generatedSource, /ch = __tsonic_forOfString\d+\.Substring\(__tsonic_forOfIndex\d+, 1\);/);
  assert.match(generatedSource, /total = total \+ ch\.Length;/);
  assert.doesNotMatch(generatedSource, /unsupported|invalid/i);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedIterationStringForOf.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});
