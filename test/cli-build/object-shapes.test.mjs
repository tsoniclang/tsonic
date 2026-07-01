import { assert, cliPath, existsSync, readFile, repoRoot, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "./harness.mjs";

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
  assert.match(build.stderr, /TS2740: Type '\{ message: string; toString\(\): string; \}' is missing/);
});

test("CLI rejects unknown and object dynamic member access before target planning", async () => {
  const projectDirectory = resolve(tempRoot, "unknown-object-dynamic-access-rejected");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp" }],
    }, null, 2),
    "src/index.ts": [
      "export function readUnknown(value: unknown): unknown {",
      "  return value.foo;",
      "}",
      "",
      "export function readObject(value: object): unknown {",
      "  return value.foo;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /TS18046: 'value' is of type 'unknown'/);
  assert.match(build.stderr, /TS2339: Property 'foo' does not exist on type 'object'/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
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
  assert.match(generatedProject, /Tsonic\.CSharp\.Runtime\.csproj/);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static Tsonic\.CSharp\.Runtime\.Union<string, double> choose\(bool flag\)/);
  assert.match(generatedSource, /return flag \? "x" : 1;/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
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
      "Console.writeLine(`found=${score(found)}`);",
      "Console.writeLine(`missing=${score(missing)}`);",
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
  assert.match(generatedSource, /total = total \+ key\.Length;/);
  assert.doesNotMatch(generatedSource, /unsupported|invalid/i);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedObjectShapeForIn.csproj"), "--nologo", "--v:minimal"]);
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
  assert.match(generatedSource, /public class __TsonicShape_/);
  assert.match(generatedSource, /public double value;/);
  assert.match(generatedSource, /public string label;/);
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
      "Console.writeLine(`${parent.child.label}:${parent.child.value + parent.count}`);",
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
  assert.match(build.stderr, /any and unknown cannot trickle into generated C#/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
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
      "Console.writeLine(restLabel({ value: 7, label: \"ok\", active: true }));",
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
      "Console.writeLine(restLabel({ value: 9, label: \"param\", active: false }));",
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
      "Console.writeLine(`${invoke({ run(value: number) { return value + 4; } })}`);",
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
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "type Child = { count: int32; label: string };",
      "type Payload = { child: Child; value: int32; extra: int32; run(value: int32): int32 };",
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
      "  run(value: int32) { return value + 2; },",
      "};",
      "",
      "Console.writeLine(inspect(payload));",
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


test("CLI runs object rest defaults with nested object spread from finalized facts", async () => {
  const projectDirectory = resolve(tempRoot, "object-rest-defaults-nested-spread");
  const assemblyName = "SmokeGeneratedObjectRestDefaultsNestedSpread";
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
      "type Child = { id: number; value: number };",
      "type Source = { label?: string; child: Child; count: number; note: string; extra: number };",
      "type Output = { label: string; child: Child; count: number; note: string; extra: number };",
      "",
      "function rewrite({ label = \"missing\", child, count, ...rest }: Source, value: number): string {",
      "  const updatedChild: Child = { ...child, value };",
      "  const output: Output = { ...rest, label, child: { ...updatedChild }, count };",
      "  return `${output.label}:${output.child.id}:${output.child.value}:${output.count}:${output.note}:${output.extra}`;",
      "}",
      "",
      "const first: Source = { child: { id: 2, value: 3 }, count: 10, note: \"n\", extra: 4 };",
      "const second: Source = { label: \"ready\", child: { id: 5, value: 6 }, count: 11, note: \"m\", extra: 7 };",
      "Console.writeLine(rewrite(first, 9));",
      "Console.writeLine(rewrite(second, 8));",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static string rewrite\(__TsonicShape_[A-Za-z0-9_]+ __tsonic_param\d+, double value\)/);
  assert.match(generatedSource, /string label = __tsonic_param\d+\.label \?\? "missing";/);
  assert.match(generatedSource, /__TsonicShape_[A-Za-z0-9_]+ child = __tsonic_param\d+\.child;/);
  assert.match(generatedSource, /__TsonicShape_[A-Za-z0-9_]+ rest = new __TsonicShape_[A-Za-z0-9_]+\s*\{\s*note = __tsonic_param\d+\.note,\s*extra = __tsonic_param\d+\.extra,\s*\};/);
  assert.match(generatedSource, /__TsonicShape_[A-Za-z0-9_]+ updatedChild = new __TsonicShape_[A-Za-z0-9_]+\s*\{\s*id = child\.id,\s*value = value,\s*\};/);
  assert.match(generatedSource, /__TsonicShape_[A-Za-z0-9_]+ output = new __TsonicShape_[A-Za-z0-9_]+\s*\{\s*note = rest\.note,\s*extra = rest\.extra,\s*label = label,\s*child = new __TsonicShape_[A-Za-z0-9_]+[\s\S]*id = updatedChild\.id,\s*value = updatedChild\.value,/);
  assert.doesNotMatch(generatedSource, /__unsupported|InvalidExpression|dynamic|System\.Reflection|GetProperty|GetMethod|MethodInfo\.Invoke|MakeGenericMethod|Activator\.CreateInstance|Assembly\.Load/);

  assert.equal(runGeneratedProject(projectDirectory, assemblyName), [
    "missing:2:9:10:n:4",
    "ready:5:8:11:m:7",
    "",
  ].join("\n"));
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
      "Console.writeLine(`${clone(value).id}:${clone(value).label}`);",
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


test("CLI rejects non-identifier object spread until single-evaluation provider lowering exists", async () => {
  const projectDirectory = resolve(tempRoot, "object-spread-single-evaluation");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp" }],
    }, null, 2),
    "src/index.ts": [
      "type Box = { value: number };",
      "",
      "export function clone(create: () => Box): Box {",
      "  return { ...create() };",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /Object literal spread requires a single-evaluation provider lowering/);
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


test("CLI rejects structural binary operators without selected target facts", async () => {
  const projectDirectory = resolve(tempRoot, "structural-binary-operator");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp" }],
    }, null, 2),
    "src/index.ts": [
      "export function compare<T>(left: T, right: T): boolean {",
      "  return left == right;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /C# operator '==' requires finalized provider operator facts for type-parameter operands/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
});
