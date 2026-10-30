import { assert, assertRuntimeProjectReference, assertNoRuntimeReference, assertNoInstalledAssemblyReference, cliPath, existsSync, readFile, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";
import { assertExternalCallNotMapped, assertArrayPredicate } from "./arrays.split-fixtures.mjs";

test("CLI selects ordinary TypeScript array public ABI lanes from finalized JS surface facts", async () => {
  const projectDirectory = resolve(tempRoot, "array-public-abi-lanes");
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
            assemblyName: "SmokeGeneratedArrayPublicAbiLanes",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "export function unused(values: int32[]): int32 {",
      "  return 1;",
      "}",
      "",
      "export function sequence(values: int32[]): int32 {",
      "  let total: int32 = 0;",
      "  for (const value of values) {",
      "    total += value;",
      "  }",
      "  return total;",
      "}",
      "",
      "export function indexed(values: int32[]): int32 {",
      "  return values[0] + values.length;",
      "}",
      "",
      "export function dense(values: int32[], index: int32, value: int32): int32 {",
      "  values[index] = value;",
      "  return values.length;",
      "}",
      "",
      "export function make(value: int32): int32[] {",
      "  return [value, value + 1];",
      "}",
      "",
      "export function sparse(values: int32[], index: int32): int32 {",
      "  delete values[index];",
      "  return values.length;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static int unused\(Tsonic\.CSharp\.Js\.JSArray<int> values\)/);
  assert.match(generatedSource, /public static int sequence\(Tsonic\.CSharp\.Js\.JSArray<int> values\)/);
  assert.match(generatedSource, /foreach \(int value in values\)/);
  assert.match(generatedSource, /public static int indexed\(Tsonic\.CSharp\.Js\.JSArray<int> values\)/);
  assert.match(generatedSource, /return values\[0D\] \+ values\.length;/);
  assert.match(generatedSource, /public static int dense\(Tsonic\.CSharp\.Js\.JSArray<int> values, int index, int value\)/);
  assert.match(generatedSource, /values\[index\] = value;/);
  assert.match(generatedSource, /return values\.length;/);
  assert.match(generatedSource, /public static Tsonic\.CSharp\.Js\.JSArray<int> make\(int value\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.JSArray<int>\.of\(\[value, value \+ 1\]\);/);
  assert.match(generatedSource, /public static int sparse\(Tsonic\.CSharp\.Js\.JSArray<int> values, int index\)/);
  assert.match(generatedSource, /values\.deleteAt\(index\);/);
  assert.doesNotMatch(generatedSource, /System\.Collections\.Generic\.(?:IEnumerable|IReadOnlyList|List)<int>/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedArrayPublicAbiLanes.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits sparse JS array delete and length mutation only through JSArray carrier facts", async () => {
  const projectDirectory = resolve(tempRoot, "array-sparse-delete-length");
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
            assemblyName: "SmokeGeneratedArraySparseDeleteLength",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "export function mutate(values: int32[], index: int32): int32 {",
      "  delete values[index];",
      "  values.length = 4;",
      "  values[3] = 7;",
      "  return values.length;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static int mutate\(Tsonic\.CSharp\.Js\.JSArray<int> values, int index\)/);
  assert.match(generatedSource, /values\.deleteAt\(index\);/);
  assert.match(generatedSource, /values\.setLength\(4D\);/);
  assert.match(generatedSource, /values\[3D\] = 7;/);
  assert.match(generatedSource, /return values\.length;/);
  assert.doesNotMatch(generatedSource, /values\.Count =/);
  assert.doesNotMatch(generatedSource, /values\.Length =/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedArraySparseDeleteLength.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});
