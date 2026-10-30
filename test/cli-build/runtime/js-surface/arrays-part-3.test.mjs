import { assert, assertRuntimeProjectReference, assertNoRuntimeReference, assertNoInstalledAssemblyReference, cliPath, existsSync, readFile, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";
import { assertExternalCallNotMapped, assertArrayPredicate } from "./arrays-fixtures.mjs";

test("CLI emits array callbacks with JS callback arities from provider facts", async () => {
  const projectDirectory = resolve(tempRoot, "array-callback-arity-helpers");
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
            assemblyName: "SmokeGeneratedArrayCallbacks",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "export function hasIndexedPositive(values: int32[]): boolean {",
      "  return values.some((value: int32, index: int32) => value > 0 && index > 0);",
      "}",
      "",
      "export function allFromSource(values: int32[]): boolean {",
      "  return values.every((value: int32, index: int32, source: int32[]) => source[index] === value);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static bool hasIndexedPositive\(Tsonic\.CSharp\.Js\.JSArray<int> values\)/);
  assertArrayPredicate(generatedSource, "some", /value > 0 && index > 0/u, "__tsonic_param\\d+");
  assert.match(generatedSource, /public static bool allFromSource\(Tsonic\.CSharp\.Js\.JSArray<int> values\)/);
  assertArrayPredicate(generatedSource, "every", /source\[index\] == value/u, "source");

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedArrayCallbacks.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});
