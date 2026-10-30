import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { assert, cliPath, existsSync, readFile, repoRoot, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";
import { bannedGeneratedRuntimeSemantics } from "./generics-interfaces-fixtures.mjs";

test("CLI emits C# generic declarations from TSTS generic AST", async () => {
  const projectDirectory = resolve(tempRoot, "generic-declarations");
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
            assemblyName: "SmokeGeneratedGenerics",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export class Box<T> {",
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
      "export function identity<T>(value: T): T {",
      "  return value;",
      "}",
      "",
      "export function hold<T>(value: T): T {",
      "  const current = value;",
      "  return current;",
      "}",
      "",
      "export function sameBox<T>(box: Box<T>): Box<T> {",
      "  const current = box;",
      "  return current;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public class Box<T>/);
  assert.match(generatedSource, /public T value;/);
  assert.match(generatedSource, /public Box\(T value\)/);
  assert.match(generatedSource, /public T get\(\)/);
  assert.match(generatedSource, /public static T identity<T>\(T value\)/);
  assert.match(generatedSource, /public static T hold<T>\(T value\)/);
  assert.match(generatedSource, /T current = value;/);
  assert.match(generatedSource, /public static Box<T> sameBox<T>\(Box<T> box\)/);
  assert.match(generatedSource, /Box<T> current = box;/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedGenerics.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI rejects generic type-parameter operators without selected target facts", async () => {
  const projectDirectory = resolve(tempRoot, "generic-operator-facts");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp" }],
    }, null, 2),
    "src/index.ts": [
      "export function same<T>(left: T, right: T): boolean {",
      "  return left === right;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /Source operator '===' over a type parameter requires an exact target constraint policy/);
  assert.match(build.stderr, /type parameter/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
});

test("CLI emits contextual generic source call results from TSTS-selected call signatures", async () => {
  const projectDirectory = resolve(tempRoot, "contextual-generic-source-calls");
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
            assemblyName: "SmokeGeneratedContextualGenericSourceCalls",
          },
        },
      ],
    }, null, 2),
    "src/helpers.ts": [
      "export function apply<T, R>(fn: (value: T) => R, value: T): R {",
      "  return fn(value);",
      "}",
      "",
      "export function choose<T>(left: T, right: T): T {",
      "  return left;",
      "}",
      "",
    ].join("\n"),
    "src/index.ts": [
      "import type { int } from \"@tsonic/csharp/types.js\";",
      "import { apply, choose } from \"./helpers.js\";",
      "",
      "export function stringify(value: int): string {",
      "  return apply<int, string>((current: int): string => `${current}`, value);",
      "}",
      "",
      "export function pick(value: int): int {",
      "  const chosen: int = choose<int>(value, 7);",
      "  return chosen;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static string stringify\(int value\)/);
  assert.match(generatedSource, /string (?<callable>__tsonic_callable_\d+)\(int current\)\s*\{\s*return \$"\{current\}";\s*\}\s*return global::Smoke\.Generated\.Helpers\.apply<int, string>\(new Func<int, string>\(\k<callable>\), value\);/);
  assert.match(generatedSource, /int chosen = global::Smoke\.Generated\.Helpers\.choose<int>\(value, 7\);/);
  assert.doesNotMatch(generatedSource, /apply\(|choose\(|__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedContextualGenericSourceCalls.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits finalized generic constraints as C# where clauses", async () => {
  const projectDirectory = resolve(tempRoot, "generic-constraints");
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
            assemblyName: "SmokeGeneratedGenericConstraints",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export interface Named {",
      "  name: string;",
      "}",
      "",
      "export interface Timestamped {",
      "  createdAt: string;",
      "}",
      "",
      "export function constrained<T extends Named & Timestamped>(value: T): string {",
      "  return `${value.name}:${value.createdAt}`;",
      "}",
      "",
      "export function referenceOnly<T extends object>(value: T): T {",
      "  return value;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static string constrained<T>\(T value\)/);
  assert.match(generatedSource, /where T : Named, Timestamped/);
  assert.match(generatedSource, /return \$"\{value\.name\}:\{value\.createdAt\}";/);
  assert.match(generatedSource, /public static T referenceOnly<T>\(T value\)/);
  assert.match(generatedSource, /where T : class/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedGenericConstraints.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});
