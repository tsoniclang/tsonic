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

test("CLI emits TypeScript numeric enums as C# enums", async () => {
  const projectDirectory = resolve(tempRoot, "numeric-enums");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          options: {
            outputType: "Exe",
            namespace: "Smoke.Generated",
            assemblyName: "SmokeGeneratedEnums",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { Console } from \"@tsonic/dotnet/System.js\";",
      "",
      "export enum Direction {",
      "  Up = 1,",
      "  Down = 2,",
      "  Left = 4,",
      "  Right = Left << 1,",
      "}",
      "",
      "export function turn(direction: Direction): Direction {",
      "  return direction === Direction.Up ? Direction.Right : Direction.Up;",
      "}",
      "",
      "const selected = turn(Direction.Up) === Direction.Right ? \"right\" : \"bad\";",
      "Console.WriteLine(selected);",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public enum Direction/);
  assert.match(generatedSource, /Up = 1,/);
  assert.match(generatedSource, /Down = 2,/);
  assert.match(generatedSource, /Left = 4,/);
  assert.match(generatedSource, /Right = Left << 1/);
  assert.match(generatedSource, /public static Direction turn\(Direction direction\)/);
  assert.match(generatedSource, /return direction == Direction\.Up \? Direction\.Right : Direction\.Up;/);
  assert.match(generatedSource, /selected = turn\(Direction\.Up\) == Direction\.Right \? "right" : "bad";/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedEnums.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
  assert.equal(runGeneratedProject(projectDirectory, "SmokeGeneratedEnums"), "right\n");
});

test("CLI rejects string enums until target enum-carrier facts are finalized", async () => {
  const projectDirectory = resolve(tempRoot, "reject-string-enums");
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
            assemblyName: "SmokeGeneratedStringEnums",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export enum Mode {",
      "  Read = \"read\",",
      "  Write = \"write\",",
      "}",
      "",
      "export function read(): Mode {",
      "  return Mode.Read;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.notEqual(build.status, 0);
  assert.match(build.stderr, /C# enum member initializers must be integer constants evaluated by TSTS/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedStringEnums.csproj")), false);
});

test("CLI rejects fractional numeric enum initializers before C# artifact generation", async () => {
  const projectDirectory = resolve(tempRoot, "reject-fractional-enums");
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
            assemblyName: "SmokeGeneratedFractionalEnums",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export enum Ratio {",
      "  Half = 0.5,",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.notEqual(build.status, 0);
  assert.match(build.stderr, /C# enum member initializers must be integer constants evaluated by TSTS/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedFractionalEnums.csproj")), false);
});

test("CLI rejects const enums as TypeScript-only runtime shape", async () => {
  const projectDirectory = resolve(tempRoot, "reject-const-enums");
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
            assemblyName: "SmokeGeneratedConstEnums",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export const enum Mode {",
      "  Read = 1,",
      "}",
      "",
      "export function read(): Mode {",
      "  return Mode.Read;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.notEqual(build.status, 0);
  assert.match(build.stderr, /TypeScript-only modifier 'const' on enum declaration is outside the native runtime-shape source subset/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedConstEnums.csproj")), false);
});

test("CLI emits delegate function types and expression-bodied lambdas from TSTS AST", async () => {
  const projectDirectory = resolve(tempRoot, "delegate-lambdas");
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
            assemblyName: "SmokeGeneratedDelegateLambdas",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function apply(value: number, mapper: (input: number) => number): number {",
      "  return mapper(value);",
      "}",
      "",
      "export function useInline(): number {",
      "  return apply(3, (input) => input + 4);",
      "}",
      "",
      "export function useLocal(): number {",
      "  const mapper: (input: number) => number = (input) => input * 2;",
      "  return mapper(5);",
      "}",
      "",
      "export function useInferredLocal(): number {",
      "  const mapper = (input: number) => input + 3;",
      "  return mapper(8);",
      "}",
      "",
      "export function useBlock(): number {",
      "  const mapper: (input: number) => number = (input) => {",
      "    const next = input + 1;",
      "    return next;",
      "  };",
      "  return mapper(6);",
      "}",
      "",
      "export function useFunctionExpression(): number {",
      "  const mapper: (input: number) => number = function(input: number): number {",
      "    return input + 2;",
      "  };",
      "  return mapper(7);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static double apply\(double value, Func<double, double> mapper\)/);
  assert.match(generatedSource, /return apply\(3, \(double input\) => input \+ 4\);/);
  assert.match(generatedSource, /Func<double, double> mapper = \(double input\) => input \* 2;/);
  assert.match(generatedSource, /Func<double, double> mapper = \(double input\) => input \+ 3;/);
  assert.match(generatedSource, /Func<double, double> mapper = \(double input\) =>\n\s*\{/);
  assert.match(generatedSource, /Func<double, double> mapper = \(double input\) =>\n\s*\{/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedDelegateLambdas.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits closure-capturing returned lambdas from TSTS callable facts", async () => {
  const projectDirectory = resolve(tempRoot, "closure-returned-lambdas");
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
            assemblyName: "SmokeGeneratedClosureReturnedLambdas",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function makeCounter(): () => number {",
      "  let count = 0;",
      "  return (): number => {",
      "    count++;",
      "    return count;",
      "  };",
      "}",
      "",
      "export function makeAdder(left: number): (right: number) => number {",
      "  return (right: number): number => left + right;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static Func<double> makeCounter\(\)/);
  assert.match(generatedSource, /double count = 0;/);
  assert.match(generatedSource, /return \(\) =>\n\s*\{/);
  assert.match(generatedSource, /count\+\+;/);
  assert.match(generatedSource, /return count;/);
  assert.match(generatedSource, /public static Func<double, double> makeAdder\(double left\)/);
  assert.match(generatedSource, /return \(double right\) => left \+ right;/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedClosureReturnedLambdas.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits optional callback parameters and nullable callable unions from finalized C# carriers", async () => {
  const projectDirectory = resolve(tempRoot, "optional-callback-delegates");
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
            assemblyName: "SmokeGeneratedOptionalCallbacks",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int } from \"@tsonic/csharp/types.js\";",
      "",
      "export type Callback = (result: int) => void;",
      "",
      "export function compute(value: int, callback?: Callback): int {",
      "  const result = value * 2;",
      "  if (callback !== undefined) {",
      "    callback(result);",
      "  }",
      "  return result;",
      "}",
      "",
      "export function maybeTransform(value: int, transform: ((x: int) => int) | null): int {",
      "  if (transform !== null) {",
      "    return transform(value);",
      "  }",
      "  return value;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static int compute\(int value, Action<int>\? callback = null\)/);
  assert.match(generatedSource, /if \(callback is not null\)/);
  assert.match(generatedSource, /callback\(result\);/);
  assert.match(generatedSource, /public static int maybeTransform\(int value, Func<int, int>\? transform\)/);
  assert.match(generatedSource, /if \(transform is not null\)/);
  assert.match(generatedSource, /return transform\(value\);/);
  assert.doesNotMatch(generatedSource, /Func<double, double>|undefined|__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedOptionalCallbacks.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});
