import { assert, assertInstalledAssemblyReference, assertNoRuntimeProjectReference, cliPath, existsSync, readFile, repoRoot, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "./harness.mjs";






















test("CLI emits source-owned typed object literals as C# object initializers", async () => {
  const projectDirectory = resolve(tempRoot, "typed-object-initializers");
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
            assemblyName: "SmokeGeneratedObjectInitializers",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export class Box {",
      "  value: number = 0;",
      "  label: string = \"\";",
      "}",
      "",
      "export class WithCtor {",
      "  value: number = 0;",
      "",
      "  constructor() {",
      "    this.value = 0;",
      "  }",
      "}",
      "",
      "export class HandlerBox {",
      "  run: (value: number) => number = (value) => value;",
      "}",
      "",
      "export function createExplicit(): Box {",
      "  const box: Box = { value: 1, label: \"one\" };",
      "  return box;",
      "}",
      "",
      "export function createShorthand(value: number): Box {",
      "  const box: Box = { value, label: \"two\" };",
      "  return box;",
      "}",
      "",
      "export function createReturn(value: number): Box {",
      "  return { value, label: \"three\" };",
      "}",
      "",
      "export function choose(flag: boolean, value: number): Box {",
      "  return flag ? { value, label: \"yes\" } : { value: 0, label: \"no\" };",
      "}",
      "",
      "export function createWithCtor(value: number): WithCtor {",
      "  return { value };",
      "}",
      "",
      "export function createHandler(): HandlerBox {",
      "  return {",
      "    run(value: number): number {",
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
  assert.match(generatedSource, /Box box = new Box\s*\{\s*value = 1,\s*label = "one",\s*\};/);
  assert.match(generatedSource, /Box box = new Box\s*\{\s*value = value,\s*label = "two",\s*\};/);
  assert.match(generatedSource, /return new Box\s*\{\s*value = value,\s*label = "three",\s*\};/);
  assert.match(generatedSource, /return flag \? new Box\s*\{\s*value = value,\s*label = "yes",\s*\} : new Box\s*\{\s*value = 0,\s*label = "no",\s*\};/);
  assert.match(generatedSource, /return new WithCtor\s*\{\s*value = value,\s*\};/);
  assert.match(generatedSource, /public Func<double, double> run = \(double value\) => value;/);
  assert.match(generatedSource, /return new HandlerBox\s*\{\s*run = \(double value\) =>\s*\{\s*return value \+ 1;\s*\},\s*\};/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedObjectInitializers.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});
test("CLI rejects provider-owned object literals until object-shape facts are finalized", async () => {
  const projectDirectory = resolve(tempRoot, "provider-owned-object-initializers");
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
            assemblyName: "SmokeGeneratedProviderObjectInitializers",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { Exception } from \"@tsonic/dotnet/System.js\";",
      "",
      "export function create(): Exception {",
      "  return {",
      "    message: \"boom\",",
      "    toString() {",
      "      return \"boom\";",
      "    },",
      "  };",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /TS2561: Object literal may only specify known properties, but 'message' does not exist in type 'Exception'/);
  assert.match(build.stderr, /Did you mean to write 'Message'/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedProviderObjectInitializers.csproj")), false);
});
test("CLI emits interface object literals through provider object-shape adapters", async () => {
  const projectDirectory = resolve(tempRoot, "interface-object-initializers");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp" }],
    }, null, 2),
    "src/index.ts": [
      "export interface Named {",
      "  name: string;",
      "  run(value: number): number;",
      "}",
      "",
      "export function create(): Named {",
      "  return {",
      "    name: \"one\",",
      "    run(value: number) {",
      "      return value + 1;",
      "    },",
      "  };",
      "}",
      "",
      "export function invoke(named: Named): number {",
      "  const { run } = named;",
      "  return run(2);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);
  const generated = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generated, /public interface Named[\s\S]*string name \{ get; \}[\s\S]*double run\(double value\);/);
  assert.match(generated, /public class __TsonicShape_Named_[A-Za-z0-9_]+ : Named[\s\S]*public string name[\s\S]*get;[\s\S]*set;[\s\S]*public Func<double, double> __tsonic_shape_method_1_run;/);
  assert.match(generated, /public double run\(double arg0\)[\s\S]*return __tsonic_shape_method_1_run\(arg0\);/);
  assert.match(generated, /public static Named create\(\)[\s\S]*return new __TsonicShape_Named_[A-Za-z0-9_]+[\s\S]*name = "one",[\s\S]*__tsonic_shape_method_1_run = \(double value\) =>[\s\S]*return value \+ 1;/);
  assert.match(generated, /public static double invoke\(Named named\)[\s\S]*Func<double, double> run = __tsonic_destructure\d+\.run;[\s\S]*return run\(2\);/);
  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});
test("CLI emits generic interface object literals through specialized provider adapters", async () => {
  const projectDirectory = resolve(tempRoot, "generic-interface-object-initializers");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp" }],
    }, null, 2),
    "src/index.ts": [
      "export interface Box<T> {",
      "  value: T;",
      "  label: string;",
      "}",
      "",
      "export function create(): Box<number> {",
      "  return { value: 1, label: \"one\" };",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);
  const generated = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generated, /public interface Box<T>[\s\S]*T value \{ get; \}[\s\S]*string label \{ get; \}/);
  assert.match(generated, /public class __TsonicShape_Box_[A-Za-z0-9_]+ : Box<double>[\s\S]*public double value[\s\S]*get;[\s\S]*set;[\s\S]*public string label[\s\S]*get;[\s\S]*set;/);
  assert.match(generated, /public static Box<double> create\(\)[\s\S]*return new __TsonicShape_Box_[A-Za-z0-9_]+[\s\S]*value = 1,[\s\S]*label = "one",/);
  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});
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
  assert.match(build.stderr, /Class object literal emission requires a finalized constructible source class fact with a parameterless constructor/);
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
  assert.match(generatedSource, /public class __TsonicShape_/);
  assert.match(generatedSource, /public string kind;/);
  assert.match(generatedSource, /public double value;/);
  assert.match(generatedSource, /public static double score\(__TsonicShape_[A-Za-z0-9_]+ result\)/);
  assert.match(generatedSource, /if \(result\.kind == "found"\)/);
  assert.match(generatedSource, /__TsonicShape_[A-Za-z0-9_]+ found = result;/);
  assert.match(generatedSource, /return found\.value \+ 1;/);
  assert.match(generatedSource, /__TsonicShape_[A-Za-z0-9_]+ missing = result;/);
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
  assert.match(generatedSource, /public class __TsonicShape_/);
  assert.match(generatedSource, /public double value;/);
  assert.match(generatedSource, /public string label;/);
  assert.match(generatedSource, /__TsonicShape_[A-Za-z0-9_]+ __tsonic_forInTarget0 = values;/);
  assert.match(generatedSource, /string\[\] __tsonic_forInKeys0 = new string\[\] \{ "value", "label" \};/);
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
  ].filter((fileName) => existsSync(fileName));
  const generatedSources = await Promise.all(generatedFiles.map((fileName) => readFile(fileName, "utf8")));
  const shapeDeclarationCount = generatedSources.reduce((count, source) => count + (source.match(/public class __TsonicShape_/g)?.length ?? 0), 0);

  assert.equal(shapeDeclarationCount, 1);
  assert.equal(generatedSources.some((source) => /public static __TsonicShape_[A-Za-z0-9_]+ createA\(double value\)/.test(source)), true);
  assert.equal(generatedSources.some((source) => /public static __TsonicShape_[A-Za-z0-9_]+ createB\(double value\)/.test(source)), true);

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
  assert.match(generatedSource, /public __TsonicShape_[A-Za-z0-9_]+ child;/);
  assert.match(generatedSource, /public double count;/);
  assert.match(generatedSource, /public double value;/);
  assert.match(generatedSource, /public string label;/);
  assert.match(generatedSource, /return new __TsonicShape_[A-Za-z0-9_]+\s*\{\s*child = new __TsonicShape_[A-Za-z0-9_]+\s*\{\s*value = value,\s*label = "ok",\s*\},\s*count = 2,\s*\};/);
  assert.match(generatedSource, /parent\.child\.label/);
  assert.match(generatedSource, /parent\.child\.value \+ parent\.count/);
  assert.doesNotMatch(generatedSource, /Dictionary<|\bobject\b|\bdynamic\b|__unsupported|invalid/i);

  assert.equal(runGeneratedProject(projectDirectory, assemblyName), "ok:7\n");
});
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
test("CLI rejects object literals contextualized as unknown before C# carrier emission", async () => {
  const projectDirectory = resolve(tempRoot, "unknown-object-shape");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp" }],
    }, null, 2),
    "src/index.ts": [
      "export function leak(): unknown {",
      "  return { value: 1 };",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /unknown cannot trickle into generated C#/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
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
  assert.match(generatedSource, /public static __TsonicShape_[A-Za-z0-9_]+ clone\(__TsonicShape_[A-Za-z0-9_]+ input\)/);
  assert.match(generatedSource, /return new __TsonicShape_[A-Za-z0-9_]+\s*\{\s*id = input\.id,\s*label = input\.label,\s*\};/);
  assert.doesNotMatch(generatedSource, /__unsupported|InvalidExpression|dynamic|System\.Reflection|GetProperty|GetMethod|MethodInfo\.Invoke|MakeGenericMethod|Activator\.CreateInstance|Assembly\.Load/);

  assert.equal(runGeneratedProject(projectDirectory, assemblyName), "1:ro\n");
});
