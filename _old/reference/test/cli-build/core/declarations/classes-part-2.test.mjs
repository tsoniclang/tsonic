import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { assert, cliPath, existsSync, readFile, repoRoot, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";
import { bannedGeneratedRuntimeSemantics, assertGeneratedOutputHasNoReflectionSemantics, collectFiles } from "./classes-fixtures.mjs";

test("CLI emits C# interfaces and class heritage from TSTS AST", async () => {
  const projectDirectory = resolve(tempRoot, "interfaces-and-heritage");
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
            assemblyName: "SmokeGeneratedInterfaces",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export interface Getter<T> {",
      "  get(): T;",
      "}",
      "",
      "export interface Named {",
      "  name: string;",
      "}",
      "",
      "export class Base {",
      "  start: number;",
      "",
      "  constructor(start: number) {",
      "    this.start = start;",
      "  }",
      "",
      "  value(): number {",
      "    return this.start;",
      "  }",
      "}",
      "",
      "export class Derived extends Base {",
      "  constructor(start: number) {",
      "    super(start);",
      "  }",
      "",
      "  extra(): number {",
      "    return super.value() + 1;",
      "  }",
      "}",
      "",
      "export class Box<T> implements Getter<T> {",
      "  value: T;",
      "",
      "  constructor(value: T) {",
      "    this.value = value;",
      "  }",
      "",
      "  get(): T {",
      "    return this.value;",
      "  }",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public interface Getter<T>/);
  assert.match(generatedSource, /T get\(\);/);
  assert.match(generatedSource, /public interface Named/);
  assert.match(generatedSource, /string name \{ get; set; \}/);
  assert.match(generatedSource, /public class Derived : Base/);
  assert.match(generatedSource, /public Derived\(double start\) : base\(start\)/);
  assert.match(generatedSource, /return base\.value\(\) \+ 1;/);
  assert.match(generatedSource, /public class Box<T> : Getter<T>/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedInterfaces.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits source-owned instanceof as C# is expressions", async () => {
  const projectDirectory = resolve(tempRoot, "source-owned-instanceof");
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
            assemblyName: "SmokeGeneratedInstanceOf",
          },
        },
      ],
    }, null, 2),
    "src/animal.ts": [
      "export class Animal {",
      "  name: string = \"\";",
      "}",
      "",
      "export class Dog extends Animal {",
      "}",
      "",
    ].join("\n"),
    "src/index.ts": [
      "import { Animal, Dog } from \"./animal.js\";",
      "",
      "export function isDog(value: Animal): boolean {",
      "  return value instanceof Dog;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static bool isDog\(Animal value\)/);
  assert.match(generatedSource, /return \(object\?\)value is Dog;/);
  assert.doesNotMatch(generatedSource, /value is Animal\.Dog/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedInstanceOf.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits standard JavaScript class static blocks as C# static constructors", async () => {
  const projectDirectory = resolve(tempRoot, "class-static-blocks");
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
            assemblyName: "SmokeGeneratedStaticBlocks",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export class Counter {",
      "  static value: number = 0;",
      "  static {",
      "    Counter.value = 3;",
      "  }",
      "}",
      "",
      "export function read(): number {",
      "  return Counter.value;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static double value;/);
  assert.match(generatedSource, /static Counter\(\)\s*\{\s*Counter\.value = 0;\s*Counter\.value = 3;/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedStaticBlocks.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});
