import { assert, assertRuntimeProjectReference, assertNoInstalledAssemblyReference, cliPath, existsSync, readFile, repoRoot, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";

test("CLI emits discriminated object-shape unions with identical finalized carriers", async () => {
  const projectDirectory = resolve(tempRoot, "discriminated-object-shape-union");
  const assemblyName = "SmokeGeneratedDiscriminatedObjectShapeUnion";
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
            assemblyName,
            outputType: "Exe",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { Console } from \"@tsonic/dotnet/System.js\";",
      "",
      "type Found = { kind: \"found\"; value: number };",
      "type Missing = { kind: \"missing\"; value: number };",
      "type Lookup = Found | Missing;",
      "",
      "function score(result: Lookup): number {",
      "  if (result.kind === \"found\") {",
      "    const found: Found = result;",
      "    return found.value + 1;",
      "  }",
      "  const missing: Missing = result;",
      "  return missing.value - 1;",
      "}",
      "",
      "const found: Lookup = { kind: \"found\", value: 10 };",
      "const missing: Lookup = { kind: \"missing\", value: 10 };",
      "Console.WriteLine(`found=${score(found)}`);",
      "Console.WriteLine(`missing=${score(missing)}`);",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  const generatedShapes = await readFile(
    resolve(projectDirectory, "out/csharp/generated/TsonicObjectShapes.cs"),
    "utf8",
  );
  assert.match(generatedShapes, /public class [A-Za-z][A-Za-z0-9_]*Shape_[a-f0-9]{12}/);
  assert.match(generatedShapes, /Property0 kind \{ get; set; \}/);
  assert.match(generatedShapes, /Property1 value \{ get; set; \}/);
  assert.match(generatedShapes, /public required string kind\s*\{\s*get;\s*set;\s*\}/);
  assert.match(generatedShapes, /public required double value\s*\{\s*get;\s*set;\s*\}/);
  assert.match(generatedSource, /public static double score\([A-Za-z][A-Za-z0-9_]*Shape_[a-f0-9]{12}<string, double> result\)/);
  assert.match(generatedSource, /if \(result\.kind == "found"\)/);
  assert.match(generatedSource, /[A-Za-z][A-Za-z0-9_]*Shape_[a-f0-9]{12}<string, double> found = result;/);
  assert.match(generatedSource, /return found\.value \+ 1;/);
  assert.match(generatedSource, /[A-Za-z][A-Za-z0-9_]*Shape_[a-f0-9]{12}<string, double> missing = result;/);
  assert.match(generatedSource, /return missing\.value - 1;/);
  assert.doesNotMatch(generatedSource, /__unsupported|invalid/i);

  assert.equal(runGeneratedProject(projectDirectory, assemblyName), [
    "found=11",
    "missing=9",
    "",
  ].join("\n"));
});

test("CLI emits object-shape for-in from finalized provider enumeration facts", async () => {
  const projectDirectory = resolve(tempRoot, "object-shape-for-in");
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
            assemblyName: "SmokeGeneratedObjectShapeForIn",
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
  const generatedShapes = await readFile(
    resolve(projectDirectory, "out/csharp/generated/TsonicObjectShapes.cs"),
    "utf8",
  );
  assert.match(generatedShapes, /public interface [A-Za-z][A-Za-z0-9_]*Shape_[a-f0-9]{12}/);
  assert.match(generatedShapes, /Property1 value \{ get; set; \}/);
  assert.match(generatedShapes, /Property0 label \{ get; set; \}/);
  assert.match(generatedShapes, /System\.ReadOnlySpan<string> __tsonicObjectEnumerableKeys\(\);/);
  assert.match(generatedSource, /[A-Za-z][A-Za-z0-9_]*Shape_[a-f0-9]{12}<string, double> __tsonic_forInTarget0 = values;/);
  assert.match(generatedSource, /System\.ReadOnlySpan<string> __tsonic_forInKeys0 = __tsonic_forInTarget0\.__tsonicObjectEnumerableKeys\(\);/);
  assert.match(generatedSource, /for \(int __tsonic_forInIndex0 = 0; __tsonic_forInIndex0 < __tsonic_forInKeys0\.Length; __tsonic_forInIndex0\+\+\)/);
  assert.match(generatedSource, /string key = __tsonic_forInKeys0\[__tsonic_forInIndex0\];/);
  assert.match(generatedSource, /total = total \+ (?:\(\(string\)key\)|key)\.Length;/);
  assert.doesNotMatch(generatedSource, /unsupported|invalid/i);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedObjectShapeForIn.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits shared generated object-shape declarations once across source files", async () => {
  const projectDirectory = resolve(tempRoot, "shared-object-shape-declarations");
  const assemblyName = "SmokeGeneratedSharedObjectShapes";
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
            assemblyName,
          },
        },
      ],
    }, null, 2),
    "src/types.ts": [
      "export type Shape = { value: number; label: string };",
      "",
    ].join("\n"),
    "src/a.ts": [
      "import type { Shape } from \"./types.js\";",
      "",
      "export function createA(value: number): Shape {",
      "  return { value, label: \"a\" };",
      "}",
      "",
    ].join("\n"),
    "src/b.ts": [
      "import type { Shape } from \"./types.js\";",
      "",
      "export function createB(value: number): Shape {",
      "  return { value, label: \"b\" };",
      "}",
      "",
    ].join("\n"),
    "src/index.ts": [
      "import { createA } from \"./a.js\";",
      "import { createB } from \"./b.js\";",
      "",
      "export function run(): string {",
      "  const left = createA(1);",
      "  const right = createB(2);",
      "  return left.label + right.label;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedFiles = [
    resolve(projectDirectory, "out/csharp/src/Index.cs"),
    resolve(projectDirectory, "out/csharp/src/A.cs"),
    resolve(projectDirectory, "out/csharp/src/B.cs"),
    resolve(projectDirectory, "out/csharp/src/Types.cs"),
    resolve(projectDirectory, "out/csharp/generated/TsonicObjectShapes.cs"),
  ].filter((fileName) => existsSync(fileName));
  const generatedSources = await Promise.all(generatedFiles.map((fileName) => readFile(fileName, "utf8")));
  const shapeDeclarationCount = generatedSources.reduce((count, source) => count + (source.match(/public class [A-Za-z][A-Za-z0-9_]*Shape_[a-f0-9]{12}/g)?.length ?? 0), 0);

  assert.equal(shapeDeclarationCount, 1);
  assert.equal(generatedSources.some((source) => /public static [A-Za-z][A-Za-z0-9_]*Shape_[a-f0-9]{12}<string, double> createA\(double value\)/.test(source)), true);
  assert.equal(generatedSources.some((source) => /public static [A-Za-z][A-Za-z0-9_]*Shape_[a-f0-9]{12}<string, double> createB\(double value\)/.test(source)), true);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, `out/csharp/${assemblyName}.csproj`), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits nested structural object-shape literals through finalized nested carriers", async () => {
  const projectDirectory = resolve(tempRoot, "nested-structural-object-shapes");
  const assemblyName = "SmokeGeneratedNestedObjectShapes";
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
            assemblyName,
            outputType: "Exe",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { Console } from \"@tsonic/dotnet/System.js\";",
      "",
      "type Child = { value: number; label: string };",
      "type Parent = { child: Child; count: number };",
      "",
      "function create(value: number): Parent {",
      "  return { child: { value, label: \"ok\" }, count: 2 };",
      "}",
      "",
      "const parent = create(5);",
      "Console.WriteLine(`${parent.child.label}:${parent.child.value + parent.count}`);",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  const generatedShapes = await readFile(
    resolve(projectDirectory, "out/csharp/generated/TsonicObjectShapes.cs"),
    "utf8",
  );
  assert.match(generatedShapes, /public required [A-Za-z][A-Za-z0-9_]*Shape_[a-f0-9]{12}<string, double> child\s*\{\s*get;\s*set;\s*\}/);
  assert.match(generatedShapes, /public required double count\s*\{\s*get;\s*set;\s*\}/);
  assert.match(generatedShapes, /public required double value\s*\{\s*get;\s*set;\s*\}/);
  assert.match(generatedShapes, /public required string label\s*\{\s*get;\s*set;\s*\}/);
  assert.match(generatedSource, /return new [A-Za-z][A-Za-z0-9_]*Shape_[a-f0-9]{12}\s*\{\s*child = new [A-Za-z][A-Za-z0-9_]*Shape_[a-f0-9]{12}\s*\{\s*value = value,\s*label = "ok",\s*\},\s*count = 2,\s*\};/);
  assert.match(generatedSource, /global::Smoke\.Generated\.Index\.parent\.child\.label/);
  assert.match(generatedSource, /global::Smoke\.Generated\.Index\.parent\.child\.value \+ global::Smoke\.Generated\.Index\.parent\.count/);
  assert.doesNotMatch(generatedSource, /Dictionary<|\bdynamic\b|System\.Reflection|GetProperty|GetMethod|MethodInfo\.Invoke|MakeGenericMethod|Activator\.CreateInstance|Assembly\.Load|__unsupported|invalid/i);

  assert.equal(runGeneratedProject(projectDirectory, assemblyName), "ok:7\n");
});
