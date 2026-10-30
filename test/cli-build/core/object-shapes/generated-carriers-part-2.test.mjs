import { assert, assertRuntimeProjectReference, assertNoInstalledAssemblyReference, cliPath, existsSync, readFile, repoRoot, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";

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

test("CLI emits nested object rest destructuring from finalized TSTS rest binding shape", async () => {
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
      "type Address = { city: string; zip: string; country: string };",
      "type User = { name: string; address: Address };",
      "",
      "export function describe(input: User): string {",
      "  const { address: { city, ...restAddress } } = input;",
      "  return `${city}:${restAddress.zip}:${restAddress.country}`;",
      "}",
      "",
      "Console.WriteLine(describe({ name: \"Ada\", address: { city: \"Paris\", zip: \"75001\", country: \"FR\" } }));",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /ObjectShape_[a-f0-9]{12}<(?<address>ObjectShape_[a-f0-9]{12}<string, string, string>), string> (?<input>__tsonic_destructure\d+) = input;\s*\k<address> __tsonic_destructure\d+ = \k<input>\.address;/);
  assert.match(generatedSource, /string city = __tsonic_destructure\d+\.city;/);
  assert.match(generatedSource, /[A-Za-z][A-Za-z0-9_]*Shape_[a-f0-9]{12} restAddress = new [A-Za-z][A-Za-z0-9_]*Shape_[a-f0-9]{12}\s*\{\s*zip = __tsonic_destructure\d+\.zip,\s*country = __tsonic_destructure\d+\.country,\s*\};/);
  assert.doesNotMatch(generatedSource, /city = __tsonic_destructure\d+\.city,\s*\};/);
  assert.doesNotMatch(generatedSource, /unsupported|invalid|dynamic|System\.Reflection/i);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, `out/csharp/${assemblyName}.csproj`), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
  assert.equal(runGeneratedProject(projectDirectory, assemblyName), "Paris:75001:FR\n");
});

test("CLI emits parameter object rest destructuring with finalized rest member facts", async () => {
  const projectDirectory = resolve(tempRoot, "parameter-object-rest-destructuring");
  const assemblyName = "SmokeGeneratedParameterObjectRestDestructuring";
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
      "export function restLabel({ value, ...rest }: { value: number; label: string; active: boolean }): string {",
      "  const activeLabel = rest.active ? \"yes\" : \"no\";",
      "  return `${value}:${rest.label}:${activeLabel}`;",
      "}",
      "",
      "Console.WriteLine(restLabel({ value: 9, label: \"param\", active: false }));",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /[A-Za-z][A-Za-z0-9_]*Shape_[a-f0-9]{12} rest = new [A-Za-z][A-Za-z0-9_]*Shape_[a-f0-9]{12}\s*\{\s*label = __tsonic_param\d+\.label,\s*active = __tsonic_param\d+\.active,\s*\};/);
  assert.match(generatedSource, /string activeLabel = rest\.active \? "yes" : "no";/);
  assert.match(generatedSource, /return \$"\{value\}:\{rest\.label\}:\{activeLabel\}";/);
  assert.doesNotMatch(generatedSource, /unsupported|invalid|dynamic|System\.Reflection/i);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, `out/csharp/${assemblyName}.csproj`), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
  assert.equal(runGeneratedProject(projectDirectory, assemblyName), "9:param:no\n");
});

test("CLI runs object parameter rename rest nested and callable destructuring from finalized facts", async () => {
  const projectDirectory = resolve(tempRoot, "object-parameter-binding-facts");
  const assemblyName = "SmokeGeneratedObjectParameterBindingFacts";
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
      "import type { int } from \"@tsonic/csharp/types.js\";",
      "",
      "type Child = { count: int; label: string };",
      "type Payload = { child: Child; value: int; extra: int; run(value: int): int };",
      "",
      "function inspect({ child: { count }, value: renamed, ...rest }: Payload): string {",
      "  return `${count}|${renamed}|${rest.extra}|${rest.run(5)}`;",
      "}",
      "",
      "const child: Child = { count: 3, label: \"ok\" };",
      "const payload: Payload = {",
      "  child,",
      "  value: 4,",
      "  extra: 6,",
      "  run(value: int) { return value + 2; },",
      "};",
      "",
      "Console.WriteLine(inspect(payload));",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static string inspect\([A-Za-z][A-Za-z0-9_]*Shape_[a-f0-9]{12} __tsonic_param\d+\)/);
  assert.match(generatedSource, /[A-Za-z][A-Za-z0-9_]*Shape_[a-f0-9]{12}<int, string> __tsonic_destructure\d+ = __tsonic_param\d+\.child;/);
  assert.match(generatedSource, /int count = __tsonic_destructure\d+\.count;/);
  assert.match(generatedSource, /int renamed = __tsonic_param\d+\.value;/);
  assert.match(generatedSource, /__tsonic_shape_method_\d+_run = __tsonic_param\d+\.__tsonic_shape_method_\d+_run/);
  assert.match(generatedSource, /return \$"\{count\}\|\{renamed\}\|\{rest\.extra\}\|\{rest\.run\(5\)\}";/);
  assert.doesNotMatch(generatedSource, /__unsupported|InvalidExpression|dynamic|System\.Reflection/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, `out/csharp/${assemblyName}.csproj`), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
  assert.equal(runGeneratedProject(projectDirectory, assemblyName), "3|4|6|7\n");
});
