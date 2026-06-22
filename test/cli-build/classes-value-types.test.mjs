import {
  assert,
  cliPath,
  existsSync,
  readFile,
  resolve,
  run,
  runNode,
  tempRoot,
  test,
  writeProject,
} from "./harness.mjs";

test("CLI emits finalized class properties, static members, and generic inheritance", async () => {
  const projectDirectory = resolve(tempRoot, "classes-finalized-facts");
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
            assemblyName: "SmokeGeneratedClassesValueTypes",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "export interface Named<T> {",
      "  id: T;",
      "  label: string;",
      "}",
      "",
      "export class Box<T> {",
      "  value: T;",
      "",
      "  constructor(value: T) {",
      "    this.value = value;",
      "  }",
      "",
      "  get current(): T {",
      "    return this.value;",
      "  }",
      "}",
      "",
      "export class NamedBox<T> extends Box<T> implements Named<T> {",
      "  id: T;",
      "  label: string = \"unset\";",
      "",
      "  constructor(id: T, value: T, label: string) {",
      "    super(value);",
      "    this.id = id;",
      "    this.label = label;",
      "  }",
      "}",
      "",
      "export class IntNamedBox extends NamedBox<int32> {",
      "  constructor(id: int32, value: int32) {",
      "    super(id, value, \"int\");",
      "  }",
      "",
      "  double(): int32 {",
      "    return this.value * 2;",
      "  }",
      "}",
      "",
      "export class ClassCounters {",
      "  static created: int32 = 0;",
      "",
      "  static bump(): int32 {",
      "    ClassCounters.created++;",
      "    return ClassCounters.created;",
      "  }",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public T value;/);
  assert.match(generatedSource, /public T current\s*\{\s*get\s*\{\s*return this\.value;\s*\}/);
  assert.match(generatedSource, /public class NamedBox<T> : Box<T>, Named<T>/);
  assert.match(generatedSource, /public T id\s*\{\s*get;\s*set;\s*\}/);
  assert.match(generatedSource, /public string label\s*\{\s*get;\s*set;\s*\}\s*=\s*"unset";/);
  assert.match(generatedSource, /public NamedBox\(T id, T value, string label\) : base\(value\)/);
  assert.match(generatedSource, /public class IntNamedBox : NamedBox<int>/);
  assert.match(generatedSource, /public static int created = 0;/);
  assert.match(generatedSource, /public static int bump\(\)/);
  assert.match(generatedSource, /ClassCounters\.created\+\+;/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedClassesValueTypes.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits value-type structs only from finalized field facts", async () => {
  const projectDirectory = resolve(tempRoot, "value-type-finalized-facts");
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
            assemblyName: "SmokeGeneratedValueTypeFacts",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { struct, field } from \"@tsonic/core/lang.js\";",
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "export const Point = struct({",
      "  x: field<int32>(),",
      "  y: field<int32>(),",
      "});",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public struct Point/);
  assert.match(generatedSource, /public int x;/);
  assert.match(generatedSource, /public int y;/);
  assert.doesNotMatch(generatedSource, /struct\(/);
  assert.doesNotMatch(generatedSource, /field\(/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedValueTypeFacts.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI rejects value-type members without finalized field facts", async () => {
  const projectDirectory = resolve(tempRoot, "value-type-missing-field-facts");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp" }],
    }, null, 2),
    "src/index.ts": [
      "import { struct } from \"@tsonic/core/lang.js\";",
      "",
      "export const Broken = struct({",
      "  x: 1,",
      "});",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /Value-type member 'x' requires a finalized field fact/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
});
