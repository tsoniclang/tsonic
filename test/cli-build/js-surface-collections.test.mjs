import { assert, assertInstalledAssemblyReference, assertNoInstalledAssemblyReference, assertNoRuntimeProjectReference, cliPath, existsSync, readFile, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "./harness.mjs";

function assertExternalCallNotMapped(stderr, memberName) {
  assert.match(stderr, /tsts:TSTS_DIAGNOSTIC/);
  const sourceContractPatterns = {
    "<anonymous>": /'Array' only refers to a type, but is being used as a value here/u,
    isFinite: /Cannot find name 'Number'|'Number' only refers to a type|Property 'isFinite' does not exist/u,
    log: /Cannot find name 'console'|Property 'log' does not exist/u,
    toString: /Property 'toString' does not exist/u,
    trunc: /Cannot find name 'Math'|Property 'trunc' does not exist/u,
  };
  const pattern = sourceContractPatterns[memberName];
  assert.notEqual(pattern, undefined, `missing exact source-contract diagnostic expectation for ${memberName}`);
  assert.match(stderr, pattern);
}

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
  assertInstalledAssemblyReference(generatedProject, "Tsonic.CSharp.Runtime");
  assertNoRuntimeProjectReference(generatedProject, "Tsonic.CSharp.Runtime");
  assertInstalledAssemblyReference(generatedProject, "Tsonic.CSharp.Js");
  assertNoRuntimeProjectReference(generatedProject, "Tsonic.CSharp.Js");
  assertNoInstalledAssemblyReference(generatedProject, "Tsonic.CSharp.Node");
  assertNoRuntimeProjectReference(generatedProject, "Tsonic.CSharp.Node");

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static bool countHas\(string key\)/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.Map<string, int> counts = new Tsonic\.CSharp\.Js\.Map<string, int>\(\);/);
  assert.match(generatedSource, /counts\.set\("alpha", 1\);/);
  assert.match(generatedSource, /counts\.set\(key, 2\);/);
  assert.match(generatedSource, /return counts\.has\(key\);/);
  assert.match(generatedSource, /public static int\? countGet\(string key\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Map\.getValue\(counts, key\);/);
  assert.match(generatedSource, /public static int countGetOr\(string key, int fallback\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Map\.getValue\(counts, key\) \?\? fallback;/);
  assert.match(generatedSource, /public static bool namesHas\(string value\)/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.Set<string> names = new Tsonic\.CSharp\.Js\.Set<string>\(\);/);
  assert.match(generatedSource, /names\.add\("alpha"\);/);
  assert.match(generatedSource, /names\.add\(value\);/);
  assert.match(generatedSource, /return names\.has\(value\);/);
  assert.match(generatedSource, /public static System\.Collections\.Generic\.List<string> mapKeys\(\)/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.Array\.from\(counts\.keys\(\)\);/);
  assert.doesNotMatch(generatedSource, /InvalidExpression|__unsupported|Reflection|GetProperty|GetMethod|dynamic/);
  assert.doesNotMatch(generatedSource, /System\.Collections\.Generic\.Dictionary|System\.Collections\.Generic\.HashSet/);
  assert.doesNotMatch(generatedSource, /new Map|new Set|MapConstructor|SetConstructor/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedMapSetSurfaceOperations.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits extended Map and Set operations from selected JS surface facts", async () => {
  const projectDirectory = resolve(tempRoot, "map-set-extended-surface-operations");
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
            assemblyName: "SmokeGeneratedMapSetExtendedSurfaceOperations",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "export function mapExtended(seed: int32): int32 {",
      "  const source = new Map<string, int32>();",
      "  source.set(\"alpha\", 1);",
      "  source.set(\"beta\", 2);",
      "  const copy = new Map<string, int32>(source.entries());",
      "  copy.set(\"gamma\", seed);",
      "  let total = copy.size;",
      "  if (copy.delete(\"beta\")) {",
      "    total = total + 10;",
      "  }",
      "  copy.forEach((value, key) => {",
      "    total = total + value;",
      "    if (key === \"alpha\") {",
      "      total = total + 100;",
      "    }",
      "  });",
      "  const values = Array.from(copy.values());",
      "  const entries = Array.from(copy.entries());",
      "  copy.clear();",
      "  return total + values.length + entries.length + copy.size;",
      "}",
      "",
      "export function setExtended(value: string): int32 {",
      "  const source = new Set<string>();",
      "  source.add(\"alpha\");",
      "  source.add(\"beta\");",
      "  const copy = new Set<string>(source.values());",
      "  copy.add(value);",
      "  let total = copy.size;",
      "  if (copy.delete(\"beta\")) {",
      "    total = total + 10;",
      "  }",
      "  copy.forEach((item) => {",
      "    if (copy.has(item)) {",
      "      total = total + 1;",
      "    }",
      "  });",
      "  const keys = Array.from(copy.keys());",
      "  const values = Array.from(copy.values());",
      "  const entries = Array.from(copy.entries());",
      "  copy.clear();",
      "  return total + keys.length + values.length + entries.length + copy.size;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /new Tsonic\.CSharp\.Js\.Map<string, int>\(source\.entries\(\)\)/);
  assert.match(generatedSource, /copy\.forEach\(/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.Array\.from\(copy\.values\(\)\)/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.Array\.from\(copy\.entries\(\)\)/);
  assert.match(generatedSource, /copy\.clear\(\);/);
  assert.match(generatedSource, /new Tsonic\.CSharp\.Js\.Set<string>\(source\.values\(\)\)/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Js\.Array\.from\(copy\.keys\(\)\)/);
  assert.doesNotMatch(generatedSource, /InvalidExpression|__unsupported|Reflection|GetProperty|GetMethod|dynamic/);
  assert.doesNotMatch(generatedSource, /System\.Collections\.Generic\.Dictionary|System\.Collections\.Generic\.HashSet/);
  assert.doesNotMatch(generatedSource, /new Map|new Set|MapConstructor|SetConstructor/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedMapSetExtendedSurfaceOperations.csproj"), "--nologo", "--v:minimal"]);
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
  assert.match(build.stderr, /C# property access 'size' must be selected by TSTS\/provider facts before emission/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedMapSetWithoutJsSurface.csproj")), false);
});

