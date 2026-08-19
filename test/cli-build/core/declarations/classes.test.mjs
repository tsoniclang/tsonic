import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { assert, cliPath, existsSync, readFile, repoRoot, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";

const bannedGeneratedRuntimeSemantics = [
  /\bdynamic\b/u,
  /\bSystem\.Reflection\b/u,
  /\bGetProperty\b/u,
  /\bGetProperties\b/u,
  /\bGetMethod\b/u,
  /\bGetMethods\b/u,
  /\bMethodInfo\.Invoke\b/u,
  /\bMakeGenericMethod\b/u,
  /\bActivator\.CreateInstance\b/u,
  /\bAssembly\.Load\b/u,
];

test("CLI emits standard JavaScript static class members", async () => {
  const projectDirectory = resolve(tempRoot, "static-class-members");
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
            assemblyName: "SmokeGeneratedStaticMembers",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export class MathBox {",
      "  static count: number = 1;",
      "",
      "  static add(left: number, right: number): number {",
      "    return left + right;",
      "  }",
      "}",
      "",
      "export function useStatic(): number {",
      "  return MathBox.add(MathBox.count, 2);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static double count = 1;/);
  assert.match(generatedSource, /public static double add\(double left, double right\)/);
  assert.match(generatedSource, /return MathBox\.add\(MathBox\.count, 2\);/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedStaticMembers.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits standard JavaScript class accessors as C# properties", async () => {
  const projectDirectory = resolve(tempRoot, "class-accessors");
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
            assemblyName: "SmokeGeneratedAccessors",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export class AccessorBox {",
      "  backing: number = 1;",
      "",
      "  get doubled(): number {",
      "    return this.backing * 2;",
      "  }",
      "",
      "  set doubled(next: number) {",
      "    this.backing = next / 2;",
      "  }",
      "}",
      "",
      "export function useAccessor(box: AccessorBox): number {",
      "  box.doubled = 10;",
      "  return box.doubled;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public double doubled/);
  assert.match(generatedSource, /get/);
  assert.match(generatedSource, /set/);
  assert.match(generatedSource, /return this\.backing \* 2;/);
  assert.match(generatedSource, /double next = value;/);
  assert.match(generatedSource, /this\.backing = next \/ 2;/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedAccessors.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI preserves JavaScript class field dispatch through C# properties", async () => {
  const projectDirectory = resolve(tempRoot, "class-field-dispatch-properties");
  const assemblyName = "SmokeGeneratedClassFieldDispatch";
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
            outputType: "Exe",
            assemblyName,
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { Console } from \"@tsonic/dotnet/System.js\";",
      "",
      "class Base {",
      "  value: string = \"base\";",
      "",
      "  print(): void {",
      "    Console.WriteLine(this.value);",
      "  }",
      "}",
      "",
      "class Derived extends Base {",
      "  value: string = \"derived\";",
      "}",
      "",
      "const box: Base = new Derived();",
      "box.print();",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public virtual string value\s*\{\s*get;\s*set;\s*\}\s*=\s*"base";/);
  assert.match(generatedSource, /public override string value\s*\{\s*get;\s*set;\s*\}\s*=\s*"derived";/);
  assert.doesNotMatch(generatedSource, /public string value;/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  assert.equal(runGeneratedProject(projectDirectory, assemblyName), "derived\n");
});

test("CLI emits standard JavaScript private identifiers as private C# members", async () => {
  const projectDirectory = resolve(tempRoot, "private-identifiers");
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
            assemblyName: "SmokeGeneratedPrivateIdentifiers",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export class PrivateBox {",
      "  #value: number = 1;",
      "",
      "  get value(): number {",
      "    return this.#value;",
      "  }",
      "",
      "  bump(): number {",
      "    this.#value++;",
      "    return this.#value;",
      "  }",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  const privateName = /private double (__tsonic_private_[a-f0-9]{64}) = 1;/.exec(generatedSource)?.[1];
  assert.ok(privateName);
  assert.match(generatedSource, /public double value/);
  assert.match(generatedSource, new RegExp(`return this\\.${privateName};`));
  assert.match(generatedSource, new RegExp(`this\\.${privateName}\\+\\+;`));
  assert.doesNotMatch(generatedSource, /#value/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedPrivateIdentifiers.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

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
  assert.match(generatedSource, /return value is Dog;/);
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
  assert.match(generatedSource, /public static double value = 0;/);
  assert.match(generatedSource, /static Counter\(\)\n\s*\{\n\s*Counter\.value = 3;/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedStaticBlocks.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

async function assertGeneratedOutputHasNoReflectionSemantics(projectDirectory) {
  const generatedRoot = resolve(projectDirectory, "out/csharp");
  const files = await collectFiles(generatedRoot, (fileName) => fileName.endsWith(".cs"));
  assert.notEqual(files.length, 0);
  for (const file of files) {
    const text = await readFile(file, "utf8");
    for (const pattern of bannedGeneratedRuntimeSemantics) {
      assert.doesNotMatch(text, pattern, `${file} contains banned generated runtime semantic mechanism ${pattern}`);
    }
  }
}

async function collectFiles(directory, predicate) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(absolutePath, predicate));
    } else if (entry.isFile() && predicate(entry.name)) {
      files.push(absolutePath);
    }
  }
  return files;
}
