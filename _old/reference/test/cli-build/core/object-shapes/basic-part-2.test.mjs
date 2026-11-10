import { assert, assertRuntimeProjectReference, assertNoInstalledAssemblyReference, cliPath, existsSync, readFile, repoRoot, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";

test("CLI emits nested Record object literals through explicit Dictionary carriers", async () => {
  const projectDirectory = resolve(tempRoot, "record-nested-object");
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
            assemblyName: "SmokeGeneratedRecordNestedObject",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function getSettings(): Record<string, Record<string, boolean>> {",
      "  return {",
      "    authentication_methods: {",
      "      password: true,",
      "      dev: true,",
      "      \"openid connect\": false,",
      "    },",
      "  };",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /System\.Collections\.Generic\.Dictionary<string, System\.Collections\.Generic\.Dictionary<string, bool>> getSettings\(\)/);
  assert.match(generatedSource, /\["authentication_methods"\] = new System\.Collections\.Generic\.Dictionary<string, bool>/);
  assert.match(generatedSource, /\["password"\] = true,/);
  assert.match(generatedSource, /\["dev"\] = true,/);
  assert.match(generatedSource, /\["openid connect"\] = false,/);
  assert.doesNotMatch(generatedSource, /Dictionary<string, object|\bobject\b|\bdynamic\b|__unsupported|invalid/i);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedRecordNestedObject.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI runs nested object literals through the canonical broad TypeScript-value carrier", async () => {
  const projectDirectory = resolve(tempRoot, "unknown-object-shape");
  const assemblyName = "SmokeGeneratedUnknownObjectShape";
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{
        id: "csharp",
        options: {
          assemblyName,
          namespace: "Smoke.Generated",
          outputType: "Exe",
        },
      }],
    }, null, 2),
    "src/index.ts": [
      "import { Console } from \"@tsonic/dotnet/System.js\";",
      "import type { int } from \"@tsonic/csharp/types.js\";",
      "",
      "export function leak(): unknown {",
      "  return { value: 1, child: { label: \"ready\" } };",
      "}",
      "const value: any = leak();",
      "const count: int = value.value;",
      "const label: string = value.child.label;",
      "Console.WriteLine(`${count}:${label}`);",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);
  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.equal((generatedSource.match(/new Tsonic\.CSharp\.Runtime\.TsObject\(\)/gu) ?? []).length, 2);
  assert.match(generatedSource, /\.WriteDynamicSlot\("value",/u);
  assert.match(generatedSource, /\.WriteDynamicSlot\("child",/u);
  assert.match(generatedSource, /\.WriteDynamicSlot\("label",/u);
  assert.ok(generatedSource.indexOf('.WriteDynamicSlot("value",') < generatedSource.indexOf('.WriteDynamicSlot("label",') &&
    generatedSource.indexOf('.WriteDynamicSlot("label",') < generatedSource.indexOf('.WriteDynamicSlot("child",'));
  assert.doesNotMatch(generatedSource, /\.CreateDynamicObject\(|new object\??\[/u);
  assert.doesNotMatch(generatedSource, /\bdynamic\b|System\.Reflection|GetProperty|GetMethod|[A-Za-z][A-Za-z0-9_]*Shape_[a-f0-9]{12}/u);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, `out/csharp/${assemblyName}.csproj`), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
  assert.equal(runGeneratedProject(projectDirectory, assemblyName), "1:ready\n");
});

test("CLI emits calls through parameter destructured object-shape callable facts", async () => {
  const projectDirectory = resolve(tempRoot, "parameter-object-callable-destructuring");
  const assemblyName = "SmokeGeneratedParameterObjectCallableDestructuring";
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
      "export function invoke({ run }: { run(value: number): number }): number {",
      "  return run(3);",
      "}",
      "",
      "Console.WriteLine(`${invoke({ run(value: number) { return value + 4; } })}`);",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /Func<double, double> run = __tsonic_param\d+\.run;/);
  assert.match(generatedSource, /return run\(3\);/);
  assert.doesNotMatch(generatedSource, /unsupported|invalid|dynamic|System\.Reflection/i);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, `out/csharp/${assemblyName}.csproj`), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
  assert.equal(runGeneratedProject(projectDirectory, assemblyName), "7\n");
});

test("CLI runs readonly utility object spread through object-shape copy facts", async () => {
  const projectDirectory = resolve(tempRoot, "readonly-utility-object-spread");
  const assemblyName = "SmokeGeneratedReadonlyUtilityObjectSpread";
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
      "type Mutable = { id: number; label: string };",
      "type ReadOnlyShape = Readonly<Mutable>;",
      "",
      "function clone(input: ReadOnlyShape): Mutable {",
      "  return { ...input };",
      "}",
      "",
      "const value: ReadOnlyShape = { id: 1, label: \"ro\" };",
      "Console.WriteLine(`${clone(value).id}:${clone(value).label}`);",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static [A-Za-z][A-Za-z0-9_]*Shape_[a-f0-9]{12}<double, string> clone\([A-Za-z][A-Za-z0-9_]*Shape_[a-f0-9]{12}<double, string> input\)/);
  assert.match(generatedSource, /[A-Za-z][A-Za-z0-9_]*Shape_[a-f0-9]{12}<double, string> (?<input>__tsonic_value_\d+) = input;\s*double (?<id>_*tsonic_value_\d+) = \k<input>\.id;\s*string (?<label>_*tsonic_value_\d+) = \k<input>\.label;\s*return new [A-Za-z][A-Za-z0-9_]*Shape_[a-f0-9]{12}\s*\{\s*id = \k<id>,\s*label = \k<label>,\s*\};/);
  assert.doesNotMatch(generatedSource, /__unsupported|InvalidExpression|dynamic|System\.Reflection|GetProperty|GetMethod|MethodInfo\.Invoke|MakeGenericMethod|Activator\.CreateInstance|Assembly\.Load/);

  assert.equal(runGeneratedProject(projectDirectory, assemblyName), "1:ro\n");
});
