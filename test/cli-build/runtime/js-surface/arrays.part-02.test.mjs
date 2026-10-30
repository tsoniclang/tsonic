import { assert, assertRuntimeProjectReference, assertNoRuntimeReference, assertNoInstalledAssemblyReference, cliPath, existsSync, readFile, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";
import { assertExternalCallNotMapped, assertArrayPredicate } from "./arrays.split-fixtures.mjs";

test("CLI runs explicit optional elements through dense JSArray carrier facts", async () => {
  const projectDirectory = resolve(tempRoot, "array-optional-literal-runtime");
  const assemblyName = "SmokeGeneratedArrayOptionalLiteralRuntime";
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
      "import { Console } from \"@tsonic/dotnet/System.js\";",
      "",
      "const values = [undefined, 5, 6];",
      "const [first = 10, second = 20, ...tail] = values;",
      "Console.WriteLine(`${first}:${second}:${tail[0] ?? -1}:${tail.length}:${values[0] ?? -1}`);",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.JSArray<double\?>\.of\(\[default\(double\?\), 5D, 6D\]\)/);
  assert.match(generatedSource, /__tsonic_destructure\d+\.slice\(2\)/);
  assert.doesNotMatch(generatedSource, /new double\?\[\] \{ 5, 6 \}/);

  assert.equal(runGeneratedProject(projectDirectory, assemblyName), "10:5:6:1:-1\n");
});

test("CLI rejects omitted array elements instead of allocating sparse storage", async () => {
  const projectDirectory = resolve(tempRoot, "array-omitted-literal-rejection");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp", surfaces: ["js"] }],
    }),
    "src/index.ts": "export const values = [, 5, 6];\n",
  });
  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.notEqual(build.status, 0);
  assert.match(build.stdout + build.stderr, /Sparse array literal elisions require closed JSArray hole construction facts before C# emission; dense array carriers must not compact holes/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
});

test("CLI rejects sparse JS array operations without selected JS surface facts", async () => {
  const deleteProjectDirectory = resolve(tempRoot, "array-sparse-delete-without-js-surface");
  await writeProject(deleteProjectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          options: {
            namespace: "Smoke.Generated",
            assemblyName: "SmokeGeneratedArraySparseDeleteWithoutJsSurface",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "export function mutate(values: int32[], index: int32): int32 {",
      "  delete values[index];",
      "  return 0;",
      "}",
      "",
    ].join("\n"),
  });

  const deleteBuild = runNode([cliPath, "build", "--project", resolve(deleteProjectDirectory, "tsonic.json")]);
  assert.equal(deleteBuild.status, 1);
  assert.match(deleteBuild.stderr, /Deletion requires an exact native indexed-record or JS Array deletion contract/);
  assert.equal(existsSync(resolve(deleteProjectDirectory, "out/csharp/SmokeGeneratedArraySparseDeleteWithoutJsSurface.csproj")), false);

  const lengthProjectDirectory = resolve(tempRoot, "array-sparse-length-without-js-surface");
  await writeProject(lengthProjectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          options: {
            namespace: "Smoke.Generated",
            assemblyName: "SmokeGeneratedArraySparseLengthWithoutJsSurface",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "export function grow(values: int32[]): int32 {",
      "  values.length = 4;",
      "  return 4;",
      "}",
      "",
    ].join("\n"),
  });

  const lengthBuild = runNode([cliPath, "build", "--project", resolve(lengthProjectDirectory, "tsonic.json")]);
  assert.equal(lengthBuild.status, 1);
  assert.match(lengthBuild.stderr, /Property 'length' does not exist on type 'number\[\]'|Property 'length' does not exist on type 'int32\[\]'/);
  assert.doesNotMatch(lengthBuild.stderr, /tsonic-csharp:/);
  assert.equal(existsSync(resolve(lengthProjectDirectory, "out/csharp/SmokeGeneratedArraySparseLengthWithoutJsSurface.csproj")), false);
});

test("CLI rejects fixed CLR array mutators without JSArray carrier facts", async () => {
  const projectDirectory = resolve(tempRoot, "array-fixed-mutator-rejections");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp" }],
    }, null, 2),
    "src/index.ts": [
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "export function append(values: int32[], value: int32): int32 {",
      "  return values.push(value);",
      "}",
      "",
      "export function removeLast(values: int32[]): int32 | undefined {",
      "  return values.pop();",
      "}",
      "",
      "export function splice(values: int32[]): int32[] {",
      "  return values.splice(1, 1);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /Property 'push' does not exist on type 'number\[\]'/);
  assert.match(build.stderr, /Property 'pop' does not exist on type 'number\[\]'/);
  assert.match(build.stderr, /Property 'splice' does not exist on type 'number\[\]'/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
});
