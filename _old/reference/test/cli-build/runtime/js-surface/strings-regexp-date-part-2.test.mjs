import { assert, assertRuntimeProjectReference, assertNoRuntimeReference, assertNoInstalledAssemblyReference, cliPath, existsSync, readFile, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";
import { assertExternalCallNotMapped } from "./strings-regexp-date-fixtures.mjs";

test("CLI emits Date calls through provider-backed JS runtime carriers", async () => {
  const projectDirectory = resolve(tempRoot, "date-runtime-carrier");
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
            assemblyName: "SmokeGeneratedDateRuntimeCarrier",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function iso(): string {",
      "  const date = new Date(Date.UTC(2023, 5, 15, 12, 30, 45, 123));",
      "  return date.toISOString();",
      "}",
      "",
      "export function epoch(value: number): number {",
      "  const date = new Date(value);",
      "  return date.getTime();",
      "}",
      "",
      "export function currentDateString(): string {",
      "  return Date();",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedProject = await readFile(resolve(projectDirectory, "out/csharp/SmokeGeneratedDateRuntimeCarrier.csproj"), "utf8");
  assertRuntimeProjectReference(generatedProject, "Tsonic.CSharp.Runtime");
  assertNoInstalledAssemblyReference(generatedProject, "Tsonic.CSharp.Runtime");
  assertRuntimeProjectReference(generatedProject, "Tsonic.CSharp.Js");
  assertNoInstalledAssemblyReference(generatedProject, "Tsonic.CSharp.Js");

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.Date date = new Tsonic\.CSharp\.Js\.Date\(Tsonic\.CSharp\.Js\.Date\.UTC\(2023, 5, 15, 12, 30, 45, 123\)\);/);
  assert.match(generatedSource, /return date\.toISOString\(\);/);
  assert.match(generatedSource, /return date\.getTime\(\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Date\.call\(\);/);
  assert.doesNotMatch(generatedSource, /return Date\./);
  assert.doesNotMatch(generatedSource, /new Date/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedDateRuntimeCarrier.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});
