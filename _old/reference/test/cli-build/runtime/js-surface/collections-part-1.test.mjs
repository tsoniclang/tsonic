import { assert, assertRuntimeProjectReference, assertNoRuntimeReference, assertNoInstalledAssemblyReference, cliPath, existsSync, readFile, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";
import { assertExternalCallNotMapped } from "./collections-fixtures.mjs";

test("CLI emits Map and Set operations from selected JS surface facts", async () => {
  const projectDirectory = resolve(tempRoot, "map-set-surface-operations");
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
            assemblyName: "SmokeGeneratedMapSetSurfaceOperations",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "export function countHas(key: string): boolean {",
      "  const counts = new Map<string, int32>();",
      "  counts.set(\"alpha\", 1);",
      "  counts.set(key, 2);",
      "  return counts.has(key);",
      "}",
      "",
      "export function countGet(key: string): int32 | undefined {",
      "  const counts = new Map<string, int32>();",
      "  counts.set(\"alpha\", 1);",
      "  return counts.get(key);",
      "}",
      "",
      "export function countGetOr(key: string, fallback: int32): int32 {",
      "  const counts = new Map<string, int32>();",
      "  counts.set(\"alpha\", 1);",
      "  return counts.get(key) ?? fallback;",
      "}",
      "",
      "export function namesHas(value: string): boolean {",
      "  const names = new Set<string>();",
      "  names.add(\"alpha\");",
      "  names.add(value);",
      "  return names.has(value);",
      "}",
      "",
      "export function mapKeys(): string[] {",
      "  const counts = new Map<string, int32>();",
      "  counts.set(\"alpha\", 1);",
      "  counts.set(\"beta\", 2);",
      "  return Array.from(counts.keys());",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedProject = await readFile(resolve(projectDirectory, "out/csharp/SmokeGeneratedMapSetSurfaceOperations.csproj"), "utf8");
  assertRuntimeProjectReference(generatedProject, "Tsonic.CSharp.Runtime");
  assertNoInstalledAssemblyReference(generatedProject, "Tsonic.CSharp.Runtime");
  assertRuntimeProjectReference(generatedProject, "Tsonic.CSharp.Js");
  assertNoInstalledAssemblyReference(generatedProject, "Tsonic.CSharp.Js");
  assertNoRuntimeReference(generatedProject, "Tsonic.CSharp.Node");
  assertNoInstalledAssemblyReference(generatedProject, "Tsonic.CSharp.Node");

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static bool countHas\(string key\)/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.Map<string, int> counts = new Tsonic\.CSharp\.Js\.Map<string, int>\(\);/);
  assert.match(generatedSource, /counts\.set\("alpha", 1\);/);
  assert.match(generatedSource, /counts\.set\(key, 2\);/);
  assert.match(generatedSource, /return counts\.has\(key\);/);
  assert.match(generatedSource, /public static int\? countGet\(string key\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Map\.getValue<string, int>\(counts, key\);/);
  assert.match(generatedSource, /public static int countGetOr\(string key, int fallback\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Map\.getValue<string, int>\(counts, key\) \?\? fallback;/);
  assert.match(generatedSource, /public static bool namesHas\(string value\)/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.Set<string> names = new Tsonic\.CSharp\.Js\.Set<string>\(\);/);
  assert.match(generatedSource, /names\.add\("alpha"\);/);
  assert.match(generatedSource, /names\.add\(value\);/);
  assert.match(generatedSource, /return names\.has\(value\);/);
  assert.match(generatedSource, /public static Tsonic\.CSharp\.Js\.JSArray<string> mapKeys\(\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.JSArrayStatics\.from<string>\(counts\.keys\(\)\);/);
  assert.doesNotMatch(generatedSource, /InvalidExpression|__unsupported|Reflection|GetProperty|GetMethod|dynamic/);
  assert.doesNotMatch(generatedSource, /System\.Collections\.Generic\.Dictionary|System\.Collections\.Generic\.HashSet/);
  assert.doesNotMatch(generatedSource, /new Map|new Set|MapConstructor|SetConstructor/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedMapSetSurfaceOperations.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI rejects Map and Set without selected JS surface declarations", async () => {
  const projectDirectory = resolve(tempRoot, "map-set-without-js-surface");
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
            assemblyName: "SmokeGeneratedMapSetWithoutJsSurface",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function count(key: string): number {",
      "  const counts = new Map<string, number>();",
      "  const names = new Set<string>();",
      "  counts.set(key, 1);",
      "  names.add(key);",
      "  return counts.size + names.size;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /TS2583: Cannot find name 'Map'/);
  assert.match(build.stderr, /TS2583: Cannot find name 'Set'/);
  assert.doesNotMatch(build.stderr, /tsonic-csharp:/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedMapSetWithoutJsSurface.csproj")), false);
});
