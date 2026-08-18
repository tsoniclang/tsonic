import { assert, assertInstalledAssemblyReference, assertNoRuntimeProjectReference, cliPath, existsSync, readFile, repoRoot, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";

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
  assertInstalledAssemblyReference(generatedProject, "Tsonic.CSharp.Runtime");
  assertNoRuntimeProjectReference(generatedProject, "Tsonic.CSharp.Runtime");

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
  assert.match(generatedShapes, /public class __TsonicShape_/);
  assert.match(generatedShapes, /public required double value;/);
  assert.match(generatedShapes, /public required string label;/);
  assert.match(generatedSource, /public static double fromParameter\(__TsonicShape_[A-Za-z0-9_]+ __tsonic_param0\)/);
  assert.match(generatedSource, /double value = __tsonic_param0\.value;/);
  assert.match(generatedSource, /public static __TsonicShape_[A-Za-z0-9_]+ create\(double value\)/);
  assert.match(generatedSource, /return new __TsonicShape_[A-Za-z0-9_]+\s*\{\s*value = value,\s*label = "ok",\s*\};/);
  assert.match(generatedSource, /public static double fromLocal\(__TsonicShape_[A-Za-z0-9_]+ input\)/);
  assert.match(generatedSource, /__TsonicShape_[A-Za-z0-9_]+ __tsonic_destructure\d+ = input;/);
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
  assert.match(generatedSource, /__TsonicShape_[A-Za-z0-9_]+ rest = new __TsonicShape_[A-Za-z0-9_]+\s*\{\s*label = __tsonic_destructure\d+\.label,\s*active = __tsonic_destructure\d+\.active,\s*\};/);
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
  assert.match(generatedSource, /__TsonicShape_[A-Za-z0-9_]+ __tsonic_destructure\d+ = input;/);
  assert.match(generatedSource, /__TsonicShape_[A-Za-z0-9_]+ __tsonic_destructure\d+ = __tsonic_destructure\d+\.address;/);
  assert.match(generatedSource, /string city = __tsonic_destructure\d+\.city;/);
  assert.match(generatedSource, /__TsonicShape_[A-Za-z0-9_]+ restAddress = new __TsonicShape_[A-Za-z0-9_]+\s*\{\s*zip = __tsonic_destructure\d+\.zip,\s*country = __tsonic_destructure\d+\.country,\s*\};/);
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
  assert.match(generatedSource, /__TsonicShape_[A-Za-z0-9_]+ rest = new __TsonicShape_[A-Za-z0-9_]+\s*\{\s*label = __tsonic_param\d+\.label,\s*active = __tsonic_param\d+\.active,\s*\};/);
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
  assert.match(generatedSource, /public static string inspect\(__TsonicShape_[A-Za-z0-9_]+ __tsonic_param\d+\)/);
  assert.match(generatedSource, /__TsonicShape_[A-Za-z0-9_]+ __tsonic_destructure\d+ = __tsonic_param\d+\.child;/);
  assert.match(generatedSource, /int count = __tsonic_destructure\d+\.count;/);
  assert.match(generatedSource, /int renamed = __tsonic_param\d+\.value;/);
  assert.match(generatedSource, /__tsonic_shape_method_\d+_run = __tsonic_param\d+\.__tsonic_shape_method_\d+_run/);
  assert.match(generatedSource, /return \$"\{count\}\|\{renamed\}\|\{rest\.extra\}\|\{rest\.run\(5\)\}";/);
  assert.doesNotMatch(generatedSource, /__unsupported|InvalidExpression|dynamic|System\.Reflection/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, `out/csharp/${assemblyName}.csproj`), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
  assert.equal(runGeneratedProject(projectDirectory, assemblyName), "3|4|6|7\n");
});
