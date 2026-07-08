import { performance } from "node:perf_hooks";
import { assert, cliPath, existsSync, readFile, repoRoot, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "./harness.mjs";

test("CLI emits array literals from finalized runtime carrier facts", async () => {
  const projectDirectory = resolve(tempRoot, "array-literal-runtime-carriers");
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
            assemblyName: "SmokeGeneratedArrayLiteralFacts",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function values(): number[] {",
      "  return [1, 2];",
      "}",
      "",
      "export function first(): number {",
      "  const values = [1, 2];",
      "  return values[0];",
      "}",
      "",
      "export function bare(): void {",
      "  [1, 2];",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);
  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /return new double\[\] \{ 1, 2 \};/);
  assert.match(generatedSource, /double\[\] values = new double\[\] \{ 1, 2 \};/);
  assert.match(generatedSource, /new double\[\] \{ 1, 2 \};/);
  assert.doesNotMatch(generatedSource, /__unsupported/);
  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedArrayLiteralFacts.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});
