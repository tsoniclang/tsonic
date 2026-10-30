import { assert, assertRuntimeProjectReference, assertNoInstalledAssemblyReference, cliPath, existsSync, readFile, repoRoot, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";

test("CLI emits non-nullish unions through finalized runtime-carrier facts", async () => {
  const projectDirectory = resolve(tempRoot, "runtime-carrier-unions");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp" }],
    }, null, 2),
    "src/index.ts": [
      "export function choose(flag: boolean): string | number {",
      "  return flag ? \"x\" : 1;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedProject = await readFile(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj"), "utf8");
  assertRuntimeProjectReference(generatedProject, "Tsonic.CSharp.Runtime");
  assertNoInstalledAssemblyReference(generatedProject, "Tsonic.CSharp.Runtime");

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static Tsonic\.CSharp\.Runtime\.Union<double, string> choose\(bool flag\)/);
  assert.match(generatedSource, /return flag \? Tsonic\.CSharp\.Runtime\.Union<double, string>\.From2\("x"\) : Tsonic\.CSharp\.Runtime\.Union<double, string>\.From1\(1\);/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits structural type-literal object shapes from finalized provider facts", async () => {
  const projectDirectory = resolve(tempRoot, "structural-object-destructuring");
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
            assemblyName: "SmokeGeneratedObjectShapes",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function fromParameter({ value }: { value: number }): number {",
      "  return value;",
      "}",
      "",
      "export function create(value: number): { value: number; label: string } {",
      "  return { value, label: \"ok\" };",
      "}",
      "",
      "export function fromLocal(input: { value: number; label: string }): number {",
      "  const { value } = input;",
      "  return value;",
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
  assert.match(generatedShapes, /public class [A-Za-z][A-Za-z0-9_]*Shape_[a-f0-9]{12}/);
  assert.match(generatedShapes, /public required double value\s*\{\s*get;\s*set;\s*\}/);
  assert.match(generatedShapes, /public required string label\s*\{\s*get;\s*set;\s*\}/);
  assert.match(generatedSource, /public static double fromParameter\([A-Za-z][A-Za-z0-9_]*Shape_[a-f0-9]{12}<double> __tsonic_param0\)/);
  assert.match(generatedSource, /double value = __tsonic_param0\.value;/);
  assert.match(generatedSource, /public static [A-Za-z][A-Za-z0-9_]*Shape_[a-f0-9]{12}<string, double> create\(double value\)/);
  assert.match(generatedSource, /return new [A-Za-z][A-Za-z0-9_]*Shape_[a-f0-9]{12}\s*\{\s*value = value,\s*label = "ok",\s*\};/);
  assert.match(generatedSource, /public static double fromLocal\([A-Za-z][A-Za-z0-9_]*Shape_[a-f0-9]{12}<string, double> input\)/);
  assert.match(generatedSource, /[A-Za-z][A-Za-z0-9_]*Shape_[a-f0-9]{12}<string, double> __tsonic_destructure\d+ = input;/);
  assert.match(generatedSource, /double value = __tsonic_destructure\d+\.value;/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedObjectShapes.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits object rest destructuring from finalized TSTS rest binding shape", async () => {
  const projectDirectory = resolve(tempRoot, "object-rest-destructuring");
  const assemblyName = "SmokeGeneratedObjectRestDestructuring";
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
      "export function restLabel(input: { value: number; label: string; active: boolean }): string {",
      "  const { value, ...rest } = input;",
      "  const activeLabel = rest.active ? \"yes\" : \"no\";",
      "  return `${value}:${rest.label}:${activeLabel}`;",
      "}",
      "",
      "Console.WriteLine(restLabel({ value: 7, label: \"ok\", active: true }));",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /[A-Za-z][A-Za-z0-9_]*Shape_[a-f0-9]{12} rest = new [A-Za-z][A-Za-z0-9_]*Shape_[a-f0-9]{12}\s*\{\s*label = __tsonic_destructure\d+\.label,\s*active = __tsonic_destructure\d+\.active,\s*\};/);
  assert.match(generatedSource, /string activeLabel = rest\.active \? "yes" : "no";/);
  assert.match(generatedSource, /return \$"\{value\}:\{rest\.label\}:\{activeLabel\}";/);
  assert.doesNotMatch(generatedSource, /unsupported|invalid/i);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, `out/csharp/${assemblyName}.csproj`), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
  assert.equal(runGeneratedProject(projectDirectory, assemblyName), "7:ok:yes\n");
});
