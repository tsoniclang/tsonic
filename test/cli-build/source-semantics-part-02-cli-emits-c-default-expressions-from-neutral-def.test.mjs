import { assert, cliPath, existsSync, readFile, repoRoot, resolve, run, runNode, tempRoot, test, writeProject } from "./harness.mjs";






























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
      "import { defaultof, field, struct } from \"@tsonic/core/lang.js\";",
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
      "  return defaultof<int32>();",
      "}",
      "",
      "export function csharpZero(): int32 {",
      "  return csharpDefaultof<int32>();",
      "}",
      "",
      "export function emptyUser(): User {",
      "  return defaultof<User>();",
      "}",
      "",
      "export function emptyList(): List<int32> {",
      "  return defaultof<List<int32>>();",
      "}",
      "",
      "export function emptyMaybeUser(): User | null {",
      "  return defaultof<User | null>();",
      "}",
      "",
      "export function emptyPoint(): typeof Point {",
      "  return defaultof<typeof Point>();",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /return default\(int\);/);
  assert.match(generatedSource, /public static int csharpZero\(\)/);
  assert.match(generatedSource, /public class User/);
  assert.match(generatedSource, /public struct Point/);
  assert.match(generatedSource, /public static User emptyUser\(\)/);
  assert.match(generatedSource, /return default\(User\);/);
  assert.match(generatedSource, /public static System\.Collections\.Generic\.List<int> emptyList\(\)/);
  assert.match(generatedSource, /return default\(System\.Collections\.Generic\.List<int>\);/);
  assert.match(generatedSource, /public static User\? emptyMaybeUser\(\)/);
  assert.match(generatedSource, /return default\(User\?\);/);
  assert.match(generatedSource, /public static Point emptyPoint\(\)/);
  assert.match(generatedSource, /return default\(Point\);/);
  assert.doesNotMatch(generatedSource, /defaultof/);
  assert.doesNotMatch(generatedSource, /defaultof/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedDefaults.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});
test("CLI rejects defaultof without explicit source type evidence before C# output", async () => {
  const projectDirectory = resolve(tempRoot, "default-value-missing-type-evidence");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp" }],
    }, null, 2),
    "src/index.ts": [
      "import { defaultof } from \"@tsonic/core/lang.js\";",
      "",
      "export function invalid(): unknown {",
      "  return defaultof();",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /TSONIC_SOURCE_CORE_9901106/);
  assert.match(build.stderr, /index\.ts:4:10/);
  assert.match(build.stderr, /defaultof<T>\(\) requires explicit type evidence/);
  assert.match(build.stderr, /evidence: Tsonic source-core marker requires explicit type evidence/);
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
      "import { out as writeonlyRef, ref as readwriteRef, inref as readonlyRef } from \"@tsonic/core/lang.js\";",
      "import { out, ref, inref } from \"@tsonic/csharp/lang.js\";",
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "export function consume(a: int32): void {",
      "}",
      "",
      "export function pass(value: int32): void {",
      "  consume(writeonlyRef(value));",
      "  consume(readwriteRef(value));",
      "  consume(readonlyRef(value));",
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
      "import { out, ref, inref } from \"@tsonic/core/lang.js\";",
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "export function invalid(value: int32): void {",
      "  out(value + 1);",
      "  ref(value + 1);",
      "  inref(value + 1);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /TSTS_SOURCE_SEMANTICS_0001/);
  assert.match(build.stderr, /requires a storage expression/);
  assert.match(build.stderr, /out/u);
  assert.match(build.stderr, /ref/u);
  assert.match(build.stderr, /inref/u);
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
      "import { borrow as sharedBorrow } from \"@tsonic/core/lang.js\";",
      "import * as CoreLang from \"@tsonic/core/lang.js\";",
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "export function use(value: int32): void {",
      "  sharedBorrow(value);",
      "  CoreLang.borrowMut(value);",
      "  CoreLang.move(value);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /TS9100135/);
  assert.match(build.stderr, /C# target does not implement source flow marker/);
  assert.match(build.stderr, /borrow/u);
  assert.match(build.stderr, /borrowMut/u);
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
      "import type { ptr, fnptr } from \"@tsonic/core/lang.js\";",
      "import type { ptr as csharpPtr, fnptr as csharpFnptr } from \"@tsonic/csharp/lang.js\";",
      "",
      "export class NativeSlots {",
      "  current: ptr<int32>;",
      "  callback: fnptr<[int32], int32>;",
      "  csharpCurrent: csharpPtr<int32>;",
      "  csharpCallback: csharpFnptr<[int32], int32>;",
      "",
      "  constructor(current: ptr<int32>, callback: fnptr<[int32], int32>, csharpCurrent: csharpPtr<int32>, csharpCallback: csharpFnptr<[int32], int32>) {",
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
  assert.match(generatedSource, /public unsafe class NativeSlots/);
  assert.match(generatedSource, /public int\* current;/);
  assert.match(generatedSource, /public delegate\*<int, int> callback;/);
  assert.match(generatedSource, /public int\* csharpCurrent;/);
  assert.match(generatedSource, /public delegate\*<int, int> csharpCallback;/);
  assert.match(generatedSource, /public NativeSlots\(int\* current, delegate\*<int, int> callback, int\* csharpCurrent, delegate\*<int, int> csharpCallback\)/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedPointers.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});
test("CLI rejects any and unknown before they trickle into C# output", async () => {
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
  assert.equal(build.status, 1);
  assert.match(build.stderr, /unknown cannot trickle into generated C#/);
  assert.match(build.stderr, /any cannot trickle into generated C# unless the selected target explicitly enables TypeScript compatibility carriers/);
});