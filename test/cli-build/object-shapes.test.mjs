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
  assert.match(generatedSource, /public Func<double, double> run = value => value;/);
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


test("CLI rejects non-nullish unions until runtime-carrier facts are finalized", async () => {
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
  assert.equal(build.status, 1);
  assert.match(build.stderr, /Union type annotations require finalized TSTS\/provider storage facts/);
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
            assemblyName: "SmokeGeneratedObjectRestDestructuring",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function restLabel(input: { value: number; label: string; active: boolean }): string {",
      "  const { value, ...rest } = input;",
      "  return rest.label;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /__TsonicShape_[A-Za-z0-9_]+ rest = new __TsonicShape_[A-Za-z0-9_]+\s*\{\s*label = __tsonic_destructure\d+\.label,\s*active = __tsonic_destructure\d+\.active,\s*\};/);
  assert.match(generatedSource, /return rest\.label;/);
  assert.doesNotMatch(generatedSource, /unsupported|invalid/i);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedObjectRestDestructuring.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
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
    "src/external.d.ts": [
      "export declare const left: { value: number };",
      "export declare const right: { value: number };",
      "",
    ].join("\n"),
    "src/index.ts": [
      "import { left, right } from \"./external.js\";",
      "",
      "export function compare(): boolean {",
      "  return left == right;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /C# binary operator emission requires a selected provider operator fact/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
});
