import { assert, assertInstalledAssemblyReference, assertNoRuntimeProjectReference, cliPath, existsSync, readFile, repoRoot, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "./harness.mjs";






















test("CLI rejects computed and accessor object literal members before shape fallback emission", async () => {
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
  assert.match(build.stderr, /Object-shape object initializers require identifier or string-literal property names/);
  assert.match(build.stderr, /Object literal property must match a finalized provider object-shape member/);
  assert.match(build.stderr, /Object literal member is outside the current C# planning surface/);
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
  assert.match(generatedSource, /public static __TsonicShape_[A-Za-z0-9_]+ clone\(__TsonicShape_[A-Za-z0-9_]+ input, double value\)/);
  assert.match(generatedSource, /return new __TsonicShape_[A-Za-z0-9_]+\s*\{\s*value = value,\s*label = input\.label,\s*\};/);
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
  assert.match(generatedSource, /__TsonicShape_[A-Za-z0-9_]+ __tsonic_destructure\d+ = __tsonic_param\d+\.address;/);
  assert.match(generatedSource, /string city = __tsonic_destructure\d+\.city;/);
  assert.match(generatedSource, /__TsonicShape_[A-Za-z0-9_]+ restAddress = new __TsonicShape_[A-Za-z0-9_]+\s*\{\s*zip = __tsonic_destructure\d+\.zip,\s*country = __tsonic_destructure\d+\.country,\s*\};/);
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
  assert.match(generatedSource, /public static __TsonicShape_[A-Za-z0-9_]+ expand\(__TsonicShape_[A-Za-z0-9_]+ input, double value\)/);
  assert.match(generatedSource, /return new __TsonicShape_[A-Za-z0-9_]+\s*\{\s*label = input\.label,\s*value = value,\s*active = true,\s*\};/);
  assert.doesNotMatch(generatedSource, /unsupported|invalid/i);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedObjectShapePartialSpread.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});
test("CLI rejects object-shape spread members without finalized target carriers", async () => {
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
  assert.equal(build.status, 1);
  assert.match(build.stderr, /Object literal spread source member 'label' requires a finalized target object-shape member carrier/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
});
test("CLI emits structural type-literal methods as delegate-backed object shapes", async () => {
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
  assert.match(generatedSource, /public Func<double, double> __tsonic_shape_method_0_run;/);
  assert.match(generatedSource, /public double run\(double arg0\)[\s\S]*return __tsonic_shape_method_0_run\(arg0\);/);
  assert.match(generatedSource, /__tsonic_shape_method_0_run = \(double value\) =>/);
  assert.match(generatedSource, /return value \+ 1;/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedObjectShapeMethods.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});