import { assert, cliPath, existsSync, readFile, resolve, run, runNode, tempRoot, test, writeProject } from "./harness.mjs";

test("Slice 4 emits source functions, lambdas, block scopes, if/else, and returns from finalized facts", async () => {
  const projectDirectory = resolve(tempRoot, "slice4-functions-statements");
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
            assemblyName: "SmokeGeneratedSlice4Functions",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function choose(flag: boolean): number {",
      "  if (flag) {",
      "    const selected = 1;",
      "    return selected;",
      "  }",
      "  return 2;",
      "}",
      "",
      "export function apply(value: number, mapper: (input: number) => number): number {",
      "  return value;",
      "}",
      "",
      "export function useLambda(): number {",
      "  const mapper: (input: number) => number = (input: number): number => input + 4;",
      "  return 3;",
      "}",
      "",
      "export function makeAdder(left: number): (right: number) => number {",
      "  return (right: number): number => left + right;",
      "}",
      "",
      "export function identity<T>(value: T): T {",
      "  return value;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static double choose\(bool flag\)/);
  assert.match(generatedSource, /if \(flag\)/);
  assert.match(generatedSource, /double selected = 1;/);
  assert.match(generatedSource, /return selected;/);
  assert.match(generatedSource, /public static double apply\(double value, Func<double, double> mapper\)/);
  assert.match(generatedSource, /Func<double, double> mapper = \(double input\) => input \+ 4;/);
  assert.match(generatedSource, /public static Func<double, double> makeAdder\(double left\)/);
  assert.match(generatedSource, /return \(double right\) => left \+ right;/);
  assert.match(generatedSource, /public static T identity<T>\(T value\)/);
  assert.doesNotMatch(generatedSource, /__unsupported|dynamic|object mapper/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedSlice4Functions.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("Slice 4 emits classes, constructors, fields, methods, private identifiers, static blocks, and interfaces from finalized facts", async () => {
  const projectDirectory = resolve(tempRoot, "slice4-class-declarations");
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
            assemblyName: "SmokeGeneratedSlice4Classes",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export interface Named {",
      "  name: string;",
      "}",
      "",
      "export class Base {",
      "}",
      "",
      "export class Box<T> {",
      "  value: T;",
      "",
      "  constructor(value: T) {",
      "    this.value = value;",
      "  }",
      "",
      "  read(): T {",
      "    return this.value;",
      "  }",
      "}",
      "",
      "export class NamedBox {",
      "  name: string = \"\";",
      "}",
      "",
      "export class Derived {",
      "  static count: number = 0;",
      "  static {",
      "    Derived.count = 1;",
      "  }",
      "}",
      "",
      "export class SecretBox {",
      "  #secret: string;",
      "",
      "  constructor(secret: string) {",
      "    this.#secret = secret;",
      "  }",
      "",
      "  reveal(): string {",
      "    return this.#secret;",
      "  }",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public interface Named/);
  assert.match(generatedSource, /string name \{ get; \}/);
  assert.match(generatedSource, /public class Base/);
  assert.match(generatedSource, /public class Box<T>/);
  assert.match(generatedSource, /public T value;/);
  assert.match(generatedSource, /public Box\(T value\)/);
  assert.match(generatedSource, /public T read\(\)/);
  assert.match(generatedSource, /public class NamedBox/);
  assert.match(generatedSource, /public class Derived/);
  assert.match(generatedSource, /public static double count = 0;/);
  assert.match(generatedSource, /static Derived\(\)\n\s*\{\n\s*Derived\.count = 1;/);
  assert.match(generatedSource, /private string _secret;/);
  assert.match(generatedSource, /public SecretBox\(string secret\)/);
  assert.match(generatedSource, /this\._secret = secret;/);
  assert.match(generatedSource, /return this\._secret;/);
  assert.doesNotMatch(generatedSource, /#secret|__unsupported|dynamic/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedSlice4Classes.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("Slice 4 fail-closed diagnostics cover missing callable context, truthiness, and TypeScript-only class modifiers", async () => {
  const scenarios = [
    {
      name: "bare-lambda",
      source: [
        "export function invalid(): void {",
        "  (() => 1);",
        "}",
        "",
      ].join("\n"),
      diagnostic: /Lambda emission requires a contextual function\/delegate type/,
    },
    {
      name: "truthy-if",
      source: [
        "export function invalid(value: number): number {",
        "  if (value) {",
        "    return 1;",
        "  }",
        "  return 0;",
        "}",
        "",
      ].join("\n"),
      diagnostic: /If statement condition requires a finalized C# bool runtime carrier/,
    },
    {
      name: "typescript-only-class-modifiers",
      source: [
        "export class Box {",
        "  public value: number = 1;",
        "}",
        "",
      ].join("\n"),
      diagnostic: /TypeScript-only modifier 'public'/,
    },
  ];

  for (const scenario of scenarios) {
    const projectDirectory = resolve(tempRoot, `slice4-negative-${scenario.name}`);
    await writeProject(projectDirectory, {
      "tsonic.json": JSON.stringify({
        entryPoint: "index.ts",
        rootDir: "src",
        outDir: "out",
        targets: [{ id: "csharp" }],
      }, null, 2),
      "src/index.ts": scenario.source,
    });

    const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
    assert.equal(build.status, 1);
    assert.match(build.stderr, scenario.diagnostic);
    assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
  }
});
