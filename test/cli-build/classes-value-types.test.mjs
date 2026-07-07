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
      "    return 2;",
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
      "import type { bool, int32 } from \"@tsonic/core/types.js\";",
      "",
      "export const Point = struct({",
      "  x: field<int32>(),",
      "  y: field<int32>(),",
      "});",
      "",
      "export const Inner = struct({",
      "  value: field<int32>(),",
      "});",
      "",
      "export const Outer = struct({",
      "  first: field<int32>(),",
      "  inner: field<typeof Inner>(),",
      "  enabled: field<bool>(),",
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
  assert.match(generatedSource, /public struct Inner/);
  assert.match(generatedSource, /public int value;/);
  assert.match(generatedSource, /public struct Outer/);
  assert.match(generatedSource, /public int first;/);
  assert.match(generatedSource, /public Inner inner;/);
  assert.match(generatedSource, /public bool enabled;/);
  assert.ok(generatedSource.indexOf("public int first;") < generatedSource.indexOf("public Inner inner;"));
  assert.ok(generatedSource.indexOf("public Inner inner;") < generatedSource.indexOf("public bool enabled;"));
  assert.doesNotMatch(generatedSource, /struct\(/);
  assert.doesNotMatch(generatedSource, /field\(/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedValueTypeFacts.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits class fields only from finalized field facts", async () => {
  const projectDirectory = resolve(tempRoot, "class-field-finalized-facts");
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
            assemblyName: "SmokeGeneratedClassFieldFacts",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { field } from \"@tsonic/core/lang.js\";",
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "export class C {",
      "  raw = field<int32>();",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public class C/);
  assert.match(generatedSource, /public int raw;/);
  assert.doesNotMatch(generatedSource, /raw\s*=/);
  assert.doesNotMatch(generatedSource, /field\(/);
  assert.doesNotMatch(generatedSource, /__tsonic_erased_source_marker/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedClassFieldFacts.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI rejects class field markers without finalized field facts", async () => {
  const projectDirectory = resolve(tempRoot, "class-field-missing-facts");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp" }],
    }, null, 2),
    "src/index.ts": [
      "import { field } from \"@tsonic/core/lang.js\";",
      "",
      "export class C {",
      "  raw = field();",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /TSONIC_SOURCE_CORE_9901102/);
  assert.match(build.stderr, /field<T>\(\) requires explicit field type evidence/);
  assert.match(build.stderr, /C# field marker call requires a finalized TSTS FieldFact with field type evidence before erasure/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
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
  assert.match(build.stderr, /TSONIC_SOURCE_CORE_9901109/);
  assert.match(build.stderr, /struct\(\.\.\.\) field shape members require finalized field<T>\(\) facts/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
});

test("CLI rejects duplicate value-type field facts before target artifacts", async () => {
  const projectDirectory = resolve(tempRoot, "value-type-duplicate-field-facts");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp" }],
    }, null, 2),
    "src/index.ts": [
      "import { field, struct } from \"@tsonic/core/lang.js\";",
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "export const Broken = struct({",
      "  x: field<int32>(),",
      "  [\"x\"]: field<int32>(),",
      "});",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /TS1117|SOURCE_SEMANTICS_STRUCT_DUPLICATE_FIELD/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
});
