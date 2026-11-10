import { assert, assertRuntimeProjectReference, assertNoInstalledAssemblyReference, cliPath, existsSync, readFile, repoRoot, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";

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
  assert.match(generatedSource, /public Func<double, double> run = \(double value\) => value;/u);
  assert.doesNotMatch(generatedSource, /public HandlerBox\(\)|__tsonic_callable_\d+|new Func<double, double>/u);
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
  const generatedShapes = await readFile(
    resolve(projectDirectory, "out/csharp/generated/TsonicObjectShapes.cs"),
    "utf8",
  );
  const shapeName = /public class (NamedShape_[a-f0-9]{12}) : Named/.exec(generatedShapes)?.[1];
  assert.ok(shapeName);
  assert.match(generated, /public interface Named[\s\S]*string name \{ get; set; \}[\s\S]*double run\(double value\);/);
  assert.match(generatedShapes, /public class NamedShape_[a-f0-9]{12} : Named/u);
  assert.match(generatedShapes, /public double run\(double value\)[\s\S]*return value \+ 1;/u);
  assert.match(generatedShapes, /public required string name\s*\{\s*get;\s*set;\s*\}/u);
  assert.doesNotMatch(generatedShapes, /Func<double, double> __tsonic_shape_method_1_run;/);
  assert.match(generated, new RegExp(`public static Named create\\(\\)[\\s\\S]*return new ${shapeName}\\s*\\{\\s*name = "one",\\s*\\};`));
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
  const generatedShapes = await readFile(
    resolve(projectDirectory, "out/csharp/generated/TsonicObjectShapes.cs"),
    "utf8",
  );
  assert.match(generated, /public interface Box<T>[\s\S]*T value \{ get; set; \}[\s\S]*string label \{ get; set; \}/);
  assert.match(generatedShapes, /public class (BoxShape_[a-f0-9]{12}) : Box<double>[\s\S]*public required string label[\s\S]*get;[\s\S]*set;[\s\S]*public required double value[\s\S]*get;[\s\S]*set;/);
  const shapeName = /public class (BoxShape_[a-f0-9]{12}) : Box<double>/.exec(generatedShapes)?.[1];
  assert.ok(shapeName);
  assert.match(generated, new RegExp(`public static Box<double> create\\(\\)[\\s\\S]*return new ${shapeName}[\\s\\S]*value = 1,[\\s\\S]*label = "one",`));
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
  assert.match(build.stderr, /Class object literal emission requires an exact constructible source class with a parameterless constructor/);
});
