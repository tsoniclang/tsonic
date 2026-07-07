import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { assert, cliPath, existsSync, readFile, repoRoot, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "./harness.mjs";

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
  assert.match(build.stderr, /C# operator '===' requires finalized provider operator facts for type-parameter operands/);
  assert.match(build.stderr, /type-parameter operands/);
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
  assert.match(generatedSource, /return Helpers\.apply<int, string>\(\(int current\) => \$"\{current\}", value\);/);
  assert.match(generatedSource, /int chosen = Helpers\.choose<int>\(value, 7\);/);
  assert.doesNotMatch(generatedSource, /apply\(|choose\(|__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedContextualGenericSourceCalls.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits interface index signatures as C# indexers", async () => {
  const projectDirectory = resolve(tempRoot, "interface-index-signature");
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
            assemblyName: "SmokeGeneratedIndexSignatures",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export interface Bag {",
      "  [key: string]: number;",
      "}",
      "",
      "export function read(bag: Bag, key: string): number {",
      "  return bag[key];",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public interface Bag/);
  assert.match(generatedSource, /double this\[string key\] \{ get; \}/);
  assert.match(generatedSource, /return bag\[key\];/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedIndexSignatures.csproj"), "--nologo", "--v:minimal"]);
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

test("CLI emits generic Action and Func delegate signatures from TSTS callable types", async () => {
  const projectDirectory = resolve(tempRoot, "action-func-delegates");
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
            assemblyName: "SmokeGeneratedActionFuncDelegates",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int } from \"@tsonic/csharp/types.js\";",
      "",
      "export function runAction(action: () => void): void {",
      "  action();",
      "}",
      "",
      "export function runActionWithArg(action: (value: int) => void, value: int): void {",
      "  action(value);",
      "}",
      "",
      "export function applyFunc<T, R>(fn: (arg: T) => R, value: T): R {",
      "  return fn(value);",
      "}",
      "",
      "export function applyFunc2<T1, T2, R>(fn: (left: T1, right: T2) => R, left: T1, right: T2): R {",
      "  return fn(left, right);",
      "}",
      "",
      "export function compose<A, B, C>(f: (value: A) => B, g: (value: B) => C): (value: A) => C {",
      "  return (value: A): C => g(f(value));",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static void runAction\(Action action\)/);
  assert.match(generatedSource, /action\(\);/);
  assert.match(generatedSource, /public static void runActionWithArg\(Action<int> action, int value\)/);
  assert.match(generatedSource, /public static R applyFunc<T, R>\(Func<T, R> fn, T value\)/);
  assert.match(generatedSource, /public static R applyFunc2<T1, T2, R>\(Func<T1, T2, R> fn, T1 left, T2 right\)/);
  assert.match(generatedSource, /public static Func<A, C> compose<A, B, C>\(Func<A, B> f, Func<B, C> g\)/);
  assert.match(generatedSource, /return \(A value\) => g\(f\(value\)\);/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedActionFuncDelegates.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits higher-order callable returns and generic function type aliases", async () => {
  const projectDirectory = resolve(tempRoot, "higher-order-callables");
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
            assemblyName: "SmokeGeneratedHigherOrderCallables",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int } from \"@tsonic/csharp/types.js\";",
      "",
      "type Predicate<T> = (value: T) => boolean;",
      "type Transform<T, U> = (value: T) => U;",
      "type Comparer<T> = (left: T, right: T) => int;",
      "",
      "export function add(left: int): (right: int) => int {",
      "  return (right: int): int => left + right;",
      "}",
      "",
      "export function makeRepeater(value: string): () => string {",
      "  return (): string => value;",
      "}",
      "",
      "export function createNested(): () => () => string {",
      "  return (): (() => string) => (): string => \"deeply nested\";",
      "}",
      "",
      "export function test<T>(value: T, predicate: Predicate<T>): boolean {",
      "  return predicate(value);",
      "}",
      "",
      "export function transform<T, U>(value: T, fn: Transform<T, U>): U {",
      "  return fn(value);",
      "}",
      "",
      "export function compare<T>(left: T, right: T, comparer: Comparer<T>): int {",
      "  return comparer(left, right);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static Func<int, int> add\(int left\)/);
  assert.match(generatedSource, /return \(int right\) => left \+ right;/);
  assert.match(generatedSource, /public static Func<string> makeRepeater\(string value\)/);
  assert.match(generatedSource, /return \(\) => value;/);
  assert.match(generatedSource, /public static Func<Func<string>> createNested\(\)/);
  assert.match(generatedSource, /return \(\) => \(\) => "deeply nested";/);
  assert.match(generatedSource, /public static bool test<T>\(T value, Func<T, bool> predicate\)/);
  assert.match(generatedSource, /public static U transform<T, U>\(T value, Func<T, U> fn\)/);
  assert.match(generatedSource, /public static int compare<T>\(T left, T right, Func<T, T, int> comparer\)/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedHigherOrderCallables.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits arrays and interfaces containing callable target types", async () => {
  const projectDirectory = resolve(tempRoot, "callable-containers");
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
            assemblyName: "SmokeGeneratedCallableContainers",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int } from \"@tsonic/csharp/types.js\";",
      "",
      "export type Operation = (left: int, right: int) => int;",
      "",
      "export const operations: Operation[] = [",
      "  (left, right) => left + right,",
      "  (left, right) => left - right,",
      "  (left, right) => left * right,",
      "];",
      "",
      "export interface OperationMap {",
      "  add: Operation;",
      "  subtract: Operation;",
      "  multiply: Operation;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static readonly Func<int, int, int>\[\] operations;/);
  assert.match(generatedSource, /operations = new Func<int, int, int>\[\] \{ \(int left, int right\) => left \+ right, \(int left, int right\) => left - right, \(int left, int right\) => left \* right \};/);
  assert.match(generatedSource, /public interface OperationMap/);
  assert.match(generatedSource, /Func<int, int, int> add \{ get; \}/);
  assert.match(generatedSource, /Func<int, int, int> subtract \{ get; \}/);
  assert.match(generatedSource, /Func<int, int, int> multiply \{ get; \}/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedCallableContainers.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

