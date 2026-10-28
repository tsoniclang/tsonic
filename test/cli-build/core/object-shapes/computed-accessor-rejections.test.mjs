import { assert, assertRuntimeProjectReference, assertNoInstalledAssemblyReference, cliPath, existsSync, readFile, repoRoot, resolve, run, runGeneratedCsharpRunner, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";






















test("CLI accepts a const-string computed key and rejects an accessor object literal member before shape fallback emission", async () => {
  const projectDirectory = resolve(tempRoot, "computed-accessor-object-members-rejected");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp" }],
    }, null, 2),
    "src/index.ts": [
      "const valueKey = \"value\" as const;",
      "type Box = { value: number };",
      "",
      "export function computed(): Box {",
      "  return { [valueKey]: 7 };",
      "}",
      "",
      "export function accessor(): Box {",
      "  return { get value() { return 8; } };",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  // RULINGS 2026-10-23: a computed key whose expression is a const string literal is that literal property name, so
  // { [valueKey]: 7 } is accepted; only the getter-only member is refused.
  assert.doesNotMatch(build.stderr, /Computed object-shape members/u);
  assert.doesNotMatch(build.stderr, /index\.ts:5:/u);
  assert.match(build.stderr, /cannot satisfy the selected writable property contract without an exact setter/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
});
test("CLI emits object-shape spread from finalized provider object-shape facts", async () => {
  const projectDirectory = resolve(tempRoot, "object-shape-spread");
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
            assemblyName: "SmokeGeneratedObjectShapeSpread",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function clone(input: { value: number; label: string }, value: number): { value: number; label: string } {",
      "  return { ...input, value };",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static [A-Za-z][A-Za-z0-9_]*Shape_[a-f0-9]{12}<string, double> clone\([A-Za-z][A-Za-z0-9_]*Shape_[a-f0-9]{12}<string, double> input, double value\)/);
  assert.match(generatedSource, /[A-Za-z][A-Za-z0-9_]*Shape_[a-f0-9]{12}<string, double> (?<input>__tsonic_value_\d+) = input;\s*double (?<value>_*tsonic_value_\d+) = \k<input>\.value;\s*string (?<label>_*tsonic_value_\d+) = \k<input>\.label;\s*\k<value> = value;\s*return new [A-Za-z][A-Za-z0-9_]*Shape_[a-f0-9]{12}\s*\{\s*value = \k<value>,\s*label = \k<label>,\s*\};/);
  assert.doesNotMatch(generatedSource, /unsupported|invalid/i);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedObjectShapeSpread.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});
test("CLI runs nested object rest destructuring from finalized object-shape facts", async () => {
  const projectDirectory = resolve(tempRoot, "nested-object-rest-destructuring");
  const assemblyName = "SmokeGeneratedNestedObjectRestDestructuring";
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
      "type Address = { city: string; zip: number; country: string };",
      "type User = { name: string; address: Address };",
      "",
      "function summarize({ address: { city, ...restAddress } }: User): string {",
      "  return `${city}:${restAddress.zip}:${restAddress.country}`;",
      "}",
      "",
      "const user: User = { name: \"Ada\", address: { city: \"Paris\", zip: 75001, country: \"FR\" } };",
      "Console.WriteLine(summarize(user));",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /[A-Za-z][A-Za-z0-9_]*Shape_[a-f0-9]{12}<string, string, double> __tsonic_destructure\d+ = __tsonic_param\d+\.address;/);
  assert.match(generatedSource, /string city = __tsonic_destructure\d+\.city;/);
  assert.match(generatedSource, /[A-Za-z][A-Za-z0-9_]*Shape_[a-f0-9]{12} restAddress = new [A-Za-z][A-Za-z0-9_]*Shape_[a-f0-9]{12}\s*\{\s*zip = __tsonic_destructure\d+\.zip,\s*country = __tsonic_destructure\d+\.country,\s*\};/);
  assert.doesNotMatch(generatedSource, /__unsupported|InvalidExpression|dynamic|System\.Reflection|GetProperty|GetMethod|MethodInfo\.Invoke|MakeGenericMethod|Activator\.CreateInstance|Assembly\.Load/);

  assert.equal(runGeneratedProject(projectDirectory, assemblyName), "Paris:75001:FR\n");
});
test("CLI emits object-shape spread from finalized subset facts plus explicit members", async () => {
  const projectDirectory = resolve(tempRoot, "object-shape-partial-spread");
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
            assemblyName: "SmokeGeneratedObjectShapePartialSpread",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function expand(input: { label: string }, value: number): { value: number; label: string; active: boolean } {",
      "  return { ...input, value, active: true };",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static [A-Za-z][A-Za-z0-9_]*Shape_[a-f0-9]{12}<bool, string, double> expand\([A-Za-z][A-Za-z0-9_]*Shape_[a-f0-9]{12}<string> input, double value\)/);
  assert.match(generatedSource, /return new [A-Za-z][A-Za-z0-9_]*Shape_[a-f0-9]{12}\s*\{\s*label = input\.label,\s*value = value,\s*active = true,\s*\};/);
  assert.doesNotMatch(generatedSource, /unsupported|invalid/i);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedObjectShapePartialSpread.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});
test("CLI retains all spread members through a narrower return interface", async () => {
  const projectDirectory = resolve(tempRoot, "object-shape-spread-extra-member");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp" }],
    }, null, 2),
    "src/index.ts": [
      "export function shrink(input: { value: number; label: string }): { value: number } {",
      "  return { ...input };",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), true);
  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  const shapes = await readFile(resolve(projectDirectory, "out/csharp/generated/TsonicObjectShapes.cs"), "utf8");
  const signature = /public static (?<narrow>ObjectShape_[a-f0-9]{12})<double> shrink\((?<wide>ObjectShape_[a-f0-9]{12})<string, double> input\)/u.exec(generatedSource);
  assert.equal(signature !== null, true, "exact double-only return interface and string/double input interface");
  const allocation = /return new (?<shape>ObjectShape_[a-f0-9]{12})\s*\{\s*value = (?<value>[A-Za-z_][A-Za-z0-9_]*),\s*label = (?<label>[A-Za-z_][A-Za-z0-9_]*),\s*\};/u.exec(generatedSource);
  assert.equal(allocation !== null, true, "one spread allocation retains both physical fields");
  assert.equal((generatedSource.match(/\bnew ObjectShape_/gu) ?? []).length, 1, "no second narrowing copy drops label");
  assert.match(generatedSource, new RegExp(`double ${allocation.groups.value} = [A-Za-z_][A-Za-z0-9_]*\\.value;`, "u"));
  assert.match(generatedSource, new RegExp(`string ${allocation.groups.label} = [A-Za-z_][A-Za-z0-9_]*\\.label;`, "u"));
  assert.match(shapes, new RegExp(`public class ${allocation.groups.shape} : ${signature.groups.narrow}<double>`, "u"));
  assert.match(shapes, /public required string label\s*\{/u);
  assert.match(shapes, /public required double value\s*\{/u);
  assert.doesNotMatch(generatedSource, /dynamic|System\.Reflection|Activator|GetProperty/u);
  assert.equal(await runGeneratedCsharpRunner(projectDirectory, "TsonicGenerated", [
    "using System;",
    `public sealed class Input : Tsonic.Generated.${signature.groups.wide}<string, double>`,
    "{",
    "    public string label { get; set; } = \"kept\";",
    "    public double value { get; set; } = 7;",
    "}",
    "public static class Program",
    "{",
    "    public static void Main()",
    "    {",
    "        var input = new Input();",
    "        var narrowed = Tsonic.Generated.Index.shrink(input);",
    `        if (narrowed is not Tsonic.Generated.${allocation.groups.shape} copy) throw new Exception("physical spread class lost");`,
    "        if (copy.value != 7 || copy.label != \"kept\" || ReferenceEquals(copy, input)) throw new Exception(\"spread identity or fields\");",
    "        input.label = \"changed\";",
    "        if (copy.label != \"kept\") throw new Exception(\"narrowing changed the original spread value\");",
    "        Console.WriteLine(\"7:kept\");",
    "    }",
    "}",
  ]), "7:kept\n");
});
test("CLI emits structural type-literal methods as authored object-shape methods", async () => {
  const projectDirectory = resolve(tempRoot, "structural-object-methods");
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
            assemblyName: "SmokeGeneratedObjectShapeMethods",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function create(): { run(value: number): number } {",
      "  return {",
      "    run(value: number) {",
      "      return value + 1;",
      "    },",
      "  };",
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
  assert.match(generatedShapes, /public class ObjectShape_[a-f0-9]{12,64}[^{]*\{[\s\S]*?public double run\(double value\)\s*\{\s*return value \+ 1;\s*\}/u);
  assert.doesNotMatch(generatedShapes + generatedSource, /__tsonic_shape_method_/u);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedObjectShapeMethods.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});
