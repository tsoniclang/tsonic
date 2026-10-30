import { assert, assertRuntimeProjectReference, assertNoInstalledAssemblyReference, cliPath, existsSync, readFile, repoRoot, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";

test("CLI emits source-owned object initializers with identifier-valid string property names", async () => {
  const projectDirectory = resolve(tempRoot, "source-object-string-initializers");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp" }],
    }, null, 2),
    "src/index.ts": [
      "export class Box {",
      "  value: number = 0;",
      "}",
      "",
      "export function create(): Box {",
      "  return { \"value\": 42 };",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);
  const generated = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generated, /public static Box create\(\)[\s\S]*return new Box[\s\S]*value = 42,/);
  assert.doesNotMatch(generated, /unsupported|invalid/i);
  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI rejects class object literals when parameterless construction is unavailable", async () => {
  const projectDirectory = resolve(tempRoot, "required-constructor-object-initializers");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp" }],
    }, null, 2),
    "src/index.ts": [
      "export class Box {",
      "  value: number;",
      "",
      "  constructor(value: number) {",
      "    this.value = value;",
      "  }",
      "}",
      "",
      "export function create(): Box {",
      "  return { value: 1 };",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /Class object literal emission requires an exact constructible source class with a parameterless constructor/);
});

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
