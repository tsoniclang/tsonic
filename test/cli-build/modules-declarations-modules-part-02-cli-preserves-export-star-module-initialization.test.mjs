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



















test("CLI preserves export-star module initialization before re-exported values are read", async () => {
  const projectDirectory = resolve(tempRoot, "export-star-module-init-order");
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
            assemblyName: "SmokeGeneratedExportStarModuleInitOrder",
          },
        },
      ],
    }, null, 2),
    "src/state.ts": [
      "export let text = \"\";",
      "export function append(value: string): void {",
      "  text = text + value;",
      "}",
      "",
    ].join("\n"),
    "src/side.ts": [
      "import { append } from \"./state.js\";",
      "append(\"side;\");",
      "export const sideValue = 1;",
      "",
    ].join("\n"),
    "src/barrel.ts": [
      "export * from \"./side.js\";",
      "",
    ].join("\n"),
    "src/index.ts": [
      "import { sideValue } from \"./barrel.js\";",
      "",
      "export function read(): number {",
      "  return sideValue;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const indexSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(indexSource, /return Side\.sideValue;/);
  assert.match(indexSource, /private static object\? __tsonic_module_init_core\(\)/);
  assert.match(indexSource, /Barrel\.__tsonic_module_init\(\);/);
  assert.doesNotMatch(indexSource, /return sideValue;|__unsupported/);

  const barrelSource = await readFile(resolve(projectDirectory, "out/csharp/src/Barrel.cs"), "utf8");
  assert.match(barrelSource, /private static object\? __tsonic_module_init_core\(\)/);
  assert.match(barrelSource, /Side\.__tsonic_module_init\(\);/);
  assert.doesNotMatch(barrelSource, /__unsupported/);

  const sideSource = await readFile(resolve(projectDirectory, "out/csharp/src/Side.cs"), "utf8");
  assert.match(sideSource, /State\.__tsonic_module_init\(\);[\s\S]*State\.append\("side;"\);[\s\S]*sideValue = 1;/);
  assert.doesNotMatch(sideSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedExportStarModuleInitOrder.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});
test("CLI rejects anonymous exported declarations instead of synthesizing C# names", async () => {
  const scenarios = [
    {
      name: "anonymous-default-function",
      source: [
        "export default function (): number {",
        "  return 1;",
        "}",
        "",
      ].join("\n"),
      diagnostic: /Function name must be present/,
    },
    {
      name: "anonymous-default-class",
      source: [
        "export default class {",
        "  value: number = 1;",
        "}",
        "",
      ].join("\n"),
      diagnostic: /Class name must be present/,
    },
  ];

  for (const scenario of scenarios) {
    const projectDirectory = resolve(tempRoot, scenario.name);
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
test("CLI emits imported and re-exported generic source calls from TSTS-selected declarations", async () => {
  const projectDirectory = resolve(tempRoot, "generic-source-calls-across-modules");
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
            assemblyName: "SmokeGeneratedGenericSourceCallsAcrossModules",
          },
        },
      ],
    }, null, 2),
    "src/generics.ts": [
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
      "export function boxedValue<T>(box: Box<T>): T {",
      "  return box.get();",
      "}",
      "",
    ].join("\n"),
    "src/barrel.ts": [
      "export { Box, identity, boxedValue } from \"./generics.js\";",
      "",
    ].join("\n"),
    "src/index.ts": [
      "import type { int } from \"@tsonic/csharp/types.js\";",
      "import { Box, identity, boxedValue } from \"./barrel.js\";",
      "",
      "export function echoText(value: string): string {",
      "  return identity<string>(value);",
      "}",
      "",
      "export function echoNumber(value: int): int {",
      "  return identity<int>(value);",
      "}",
      "",
      "export function readBox(value: int): int {",
      "  const box = new Box<int>(value);",
      "  return boxedValue<int>(box);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static string echoText\(string value\)/);
  assert.match(generatedSource, /return Generics\.identity<string>\(value\);/);
  assert.match(generatedSource, /public static int echoNumber\(int value\)/);
  assert.match(generatedSource, /return Generics\.identity<int>\(value\);/);
  assert.match(generatedSource, /Box<int> box = new Box<int>\(value\);/);
  assert.match(generatedSource, /return Generics\.boxedValue<int>\(box\);/);
  assert.doesNotMatch(generatedSource, /Barrel\.identity|Barrel\.boxedValue|identity\(value\)|__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedGenericSourceCallsAcrossModules.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});
test("CLI emits module-scope arrow function values as lazily initialized C# Func properties", async () => {
  const projectDirectory = resolve(tempRoot, "module-arrow-function-values");
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
            assemblyName: "SmokeGeneratedModuleArrowValues",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "type NumberToNumber = (value: number) => number;",
      "type BinaryNumber = (left: number, right: number) => number;",
      "",
      "export const add: BinaryNumber = (left, right) => left + right;",
      "export const greet = (name: string): string => `Hello ${name}`;",
      "export const double: NumberToNumber = (value) => value * 2;",
      "export const triple = (value: number): number => value * 3;",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static Func<double, double, double> add\s*\{\s*get;\s*private set;\s*\} = default\(Func<double, double, double>\)!;/);
  assert.match(generatedSource, /public static Func<string, string> greet\s*\{\s*get;\s*private set;\s*\} = default\(Func<string, string>\)!;/);
  assert.match(generatedSource, /public static Func<double, double> @double\s*\{\s*get;\s*private set;\s*\} = default\(Func<double, double>\)!;/);
  assert.match(generatedSource, /public static Func<double, double> triple\s*\{\s*get;\s*private set;\s*\} = default\(Func<double, double>\)!;/);
  assert.match(generatedSource, /add = \(double left, double right\) => left \+ right;/);
  assert.match(generatedSource, /greet = \(string name\) => \$"Hello \{name\}";/);
  assert.match(generatedSource, /@double = \(double value\) => value \* 2;/);
  assert.match(generatedSource, /triple = \(double value\) => value \* 3;/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedModuleArrowValues.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});
