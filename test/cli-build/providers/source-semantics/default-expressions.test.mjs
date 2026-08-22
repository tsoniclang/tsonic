import { assert, cliPath, existsSync, readFile, repoRoot, resolve, run, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";






























test("CLI emits C# default expressions from neutral default facts and C# aliases", async () => {
  const projectDirectory = resolve(tempRoot, "default-value-facts");
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
            assemblyName: "SmokeGeneratedDefaults",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { defaultValue, field, struct } from \"@tsonic/core/lang.js\";",
      "import { defaultof as csharpDefaultof } from \"@tsonic/csharp/lang.js\";",
      "import type { bool, int32 } from \"@tsonic/core/types.js\";",
      "import type { List } from \"@tsonic/dotnet/System.Collections.Generic.js\";",
      "",
      "export class User {",
      "  name: string = \"\";",
      "}",
      "",
      "export const Point = struct({",
      "  x: field<int32>(),",
      "  ok: field<bool>(),",
      "});",
      "",
      "export function zero(): int32 {",
      "  return defaultValue<int32>();",
      "}",
      "",
      "export function csharpZero(): int32 {",
      "  return csharpDefaultof<int32>();",
      "}",
      "",
      "export function emptyUser(): User {",
      "  return defaultValue<User>();",
      "}",
      "",
      "export function emptyList(): List<int32> {",
      "  return defaultValue<List<int32>>();",
      "}",
      "",
      "export function emptyMaybeUser(): User | null {",
      "  return defaultValue<User | null>();",
      "}",
      "",
      "export function emptyPoint(): typeof Point {",
      "  return defaultValue<typeof Point>();",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /return default\(int\)!;/);
  assert.match(generatedSource, /public static int csharpZero\(\)/);
  assert.match(generatedSource, /public class User/);
  assert.match(generatedSource, /public struct Point/);
  assert.match(generatedSource, /public static User emptyUser\(\)/);
  assert.match(generatedSource, /return default\(User\)!;/);
  assert.match(generatedSource, /public static System\.Collections\.Generic\.List<int> emptyList\(\)/);
  assert.match(generatedSource, /return default\(System\.Collections\.Generic\.List<int>\)!;/);
  assert.match(generatedSource, /public static User\? emptyMaybeUser\(\)/);
  assert.match(generatedSource, /return default\(User\?\)!;/);
  assert.match(generatedSource, /public static Point emptyPoint\(\)/);
  assert.match(generatedSource, /return default\(Point\)!;/);
  assert.doesNotMatch(generatedSource, /defaultValue|defaultof/u);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedDefaults.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});
test("CLI rejects defaultValue without explicit source type evidence before C# output", async () => {
  const projectDirectory = resolve(tempRoot, "default-value-missing-type-evidence");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp" }],
    }, null, 2),
    "src/index.ts": [
      "import { defaultValue } from \"@tsonic/core/lang.js\";",
      "",
      "export function invalid(): unknown {",
      "  return defaultValue();",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /tsonic\.source-core:TS9901106/);
  assert.match(build.stderr, /index\.ts:4:10/);
  assert.match(build.stderr, /defaultValue<T>\(\) requires explicit type evidence/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
});
test("CLI rejects byref source markers for source-owned by-value call parameters", async () => {
  const projectDirectory = resolve(tempRoot, "argument-passing-source-owned-by-value-rejected");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp" }],
    }, null, 2),
    "src/index.ts": [
      "import { writeOnlyRef, readWriteRef, readOnlyRef } from \"@tsonic/core/lang.js\";",
      "import { out, ref, inref } from \"@tsonic/csharp/lang.js\";",
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "export function consume(a: int32): void {",
      "}",
      "",
      "export function pass(value: int32): void {",
      "  consume(writeOnlyRef(value));",
      "  consume(readWriteRef(value));",
      "  consume(readOnlyRef(value));",
      "  consume(out(value));",
      "  consume(ref(value));",
      "  consume(inref(value));",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /Finalized argument-passing fact 'byref-writeonly-must-init' does not match the selected call parameter mode 'by-value'/);
  assert.match(build.stderr, /Finalized argument-passing fact 'byref-readwrite' does not match the selected call parameter mode 'by-value'/);
  assert.match(build.stderr, /Finalized argument-passing fact 'byref-readonly' does not match the selected call parameter mode 'by-value'/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
});
test("CLI rejects byref source markers without finalized storage facts", async () => {
  const projectDirectory = resolve(tempRoot, "argument-passing-non-storage-rejected");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp" }],
    }, null, 2),
    "src/index.ts": [
      "import { writeOnlyRef, readWriteRef, readOnlyRef } from \"@tsonic/core/lang.js\";",
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "export function invalid(value: int32): void {",
      "  writeOnlyRef(value + 1);",
      "  readWriteRef(value + 1);",
      "  readOnlyRef(value + 1);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.equal(
    (build.stderr.match(/tsts\.source-semantics:TS9901101/g) ?? []).length,
    3,
  );
  assert.match(build.stderr, /requires a storage expression/);
  assert.match(build.stderr, /writeOnlyRef/u);
  assert.match(build.stderr, /readWriteRef/u);
  assert.match(build.stderr, /readOnlyRef/u);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
});
test("CLI rejects neutral borrow and move markers before C# output", async () => {
  const projectDirectory = resolve(tempRoot, "borrow-move-rejected");
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
            assemblyName: "SmokeGeneratedBorrowMoveRejected",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { sharedBorrow } from \"@tsonic/core/lang.js\";",
      "import * as CoreLang from \"@tsonic/core/lang.js\";",
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "export function use(value: int32): void {",
      "  sharedBorrow(value);",
      "  CoreLang.mutableBorrow(value);",
      "  CoreLang.move(value);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.equal(
    (build.stderr.match(/tsonic-csharp:CSHARP_SOURCE_FLOW_MARKER_UNSUPPORTED/g) ?? []).length,
    3,
  );
  assert.match(build.stderr, /C# target does not implement source flow marker/);
  assert.match(build.stderr, /shared-borrow/u);
  assert.match(build.stderr, /mutable-borrow/u);
  assert.match(build.stderr, /move/u);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedBorrowMoveRejected.csproj")), false);
});
test("CLI emits C# pointer and function-pointer types from source marker facts", async () => {
  const projectDirectory = resolve(tempRoot, "pointer-function-pointer-types");
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
            assemblyName: "SmokeGeneratedPointers",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "import type { Pointer, FunctionPointer } from \"@tsonic/core/types.js\";",
      "import type { ptr as csharpPtr, fnptr as csharpFnptr } from \"@tsonic/csharp/lang.js\";",
      "",
      "export class NativeSlots {",
      "  current: Pointer<int32>;",
      "  callback: FunctionPointer<[int32], int32>;",
      "  csharpCurrent: csharpPtr<int32>;",
      "  csharpCallback: csharpFnptr<[int32], int32>;",
      "",
      "  constructor(current: Pointer<int32>, callback: FunctionPointer<[int32], int32>, csharpCurrent: csharpPtr<int32>, csharpCallback: csharpFnptr<[int32], int32>) {",
      "    this.current = current;",
      "    this.callback = callback;",
      "    this.csharpCurrent = csharpCurrent;",
      "    this.csharpCallback = csharpCallback;",
      "  }",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedProject = await readFile(resolve(projectDirectory, "out/csharp/SmokeGeneratedPointers.csproj"), "utf8");
  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedProject, /<AllowUnsafeBlocks>true<\/AllowUnsafeBlocks>/);
  assert.match(generatedSource, /public class NativeSlots/);
  assert.doesNotMatch(generatedSource, /public unsafe class NativeSlots/);
  assert.match(generatedSource, /public Tsonic\.CSharp\.Runtime\.Location<int> current;/);
  assert.match(generatedSource, /public unsafe delegate\*<int, int> callback;/);
  assert.match(generatedSource, /public unsafe int\* csharpCurrent;/);
  assert.match(generatedSource, /public unsafe delegate\*<int, int> csharpCallback;/);
  assert.match(generatedSource, /public unsafe NativeSlots\(Tsonic\.CSharp\.Runtime\.Location<int> current, delegate\*<int, int> callback, int\* csharpCurrent, delegate\*<int, int> csharpCallback\)/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedPointers.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});
test("CLI emits any and unknown through the closed TypeScript-value carrier", async () => {
  const projectDirectory = resolve(tempRoot, "reject-any-unknown");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp" }],
    }, null, 2),
    "src/index.ts": [
      "export function leakUnknown(value: unknown): unknown {",
      "  return value;",
      "}",
      "",
      "export function leakAny(value: any): any {",
      "  return value;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);
  const generatedSource = await readFile(
    resolve(projectDirectory, "out/csharp/src/Index.cs"),
    "utf8",
  );
  assert.match(
    generatedSource,
    /Tsonic\.CSharp\.Runtime\.TsValue leakUnknown\(Tsonic\.CSharp\.Runtime\.TsValue value\)/u,
  );
  assert.match(
    generatedSource,
    /Tsonic\.CSharp\.Runtime\.TsValue leakAny\(Tsonic\.CSharp\.Runtime\.TsValue value\)/u,
  );
  assert.doesNotMatch(generatedSource, /\bdynamic\b|System\.Reflection|\bobject\b/u);
  const project = resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj");
  const dotnet = run("dotnet", ["build", project, "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});
