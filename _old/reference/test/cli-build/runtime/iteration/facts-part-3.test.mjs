import { assert, cliPath, readFile, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";

test("CLI executes generated for-of and for-in from finalized iteration facts", async () => {
  const projectDirectory = resolve(tempRoot, "iteration-runtime");
  const assemblyName = "SmokeGeneratedIterationRuntime";
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
            assemblyName,
            outputType: "Exe",
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
      "export function objectKeyLength(values: { value: number; label: string }): number {",
      "  let total = 0;",
      "  for (const key in values) {",
      "    total = total + key.length;",
      "  }",
      "  return total;",
      "}",
      "",
      "console.log(sum([1, 2, 3]));",
      "console.log(objectKeyLength({ value: 1, label: \"x\" }));",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  assert.equal(runGeneratedProject(projectDirectory, assemblyName), [
    "6",
    "10",
    "",
  ].join("\n"));
});
