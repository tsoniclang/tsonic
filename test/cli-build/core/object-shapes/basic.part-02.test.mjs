import { assert, assertRuntimeProjectReference, assertNoInstalledAssemblyReference, cliPath, existsSync, readFile, repoRoot, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";

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
