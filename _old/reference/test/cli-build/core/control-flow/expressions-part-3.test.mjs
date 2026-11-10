import { performance } from "node:perf_hooks";
import { assert, cliPath, existsSync, readFile, repoRoot, resolve, run, runGeneratedCsharpRunner, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";

test("CLI emits TypeScript rest parameters as C# params arrays", async () => {
  const projectDirectory = resolve(tempRoot, "rest-parameters");
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
            assemblyName: "SmokeGeneratedRestParameters",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function sum(...values: number[]): number {",
      "  let total = 0;",
      "  for (const value of values) {",
      "    total = total + value;",
      "  }",
      "  return total;",
      "}",
      "",
      "export function callSum(): number {",
      "  return sum(1, 2, 3);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static double sum\(params double\[\] values\)/);
  assert.match(generatedSource, /foreach \(double value in values\)/);
  assert.match(generatedSource, /return global::Smoke\.Generated\.Index\.sum\(1, 2, 3\);/);
  assert.doesNotMatch(generatedSource, /object values/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedRestParameters.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits literal default parameters as C# optional parameters", async () => {
  const projectDirectory = resolve(tempRoot, "default-parameters");
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
            assemblyName: "SmokeGeneratedDefaultParameters",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function add(value: number = 3, enabled: boolean = true, label: string = \"x\"): number {",
      "  if (enabled) {",
      "    return value;",
      "  }",
      "  return 0;",
      "}",
      "",
      "export function callDefault(): number {",
      "  return add();",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static double add\(double\? __tsonic_param0 = null, bool\? __tsonic_param1 = null, string\? __tsonic_param2 = null\)/);
  assert.match(generatedSource, /double value = __tsonic_param0 \?\? 3;/);
  assert.match(generatedSource, /bool enabled = __tsonic_param1 \?\? true;/);
  assert.match(generatedSource, /string label = __tsonic_param2 \?\? "x";/);
  assert.doesNotMatch(generatedSource, /\bis (?:double|bool|string) __tsonic_value\d+/);
  assert.match(generatedSource, /return global::Smoke\.Generated\.Index\.add\(\);/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedDefaultParameters.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI executes non-literal parameter defaults only for native absence", async () => {
  const projectDirectory = resolve(tempRoot, "nonliteral-default-parameters");
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
            assemblyName: "SmokeGeneratedNonliteralDefaultParameters",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "function seed(): number {",
      "  return 3;",
      "}",
      "",
      "export function add(value: number = seed()): number {",
      "  return value;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);
  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static double add\(double\? __tsonic_param0 = null\)/u);
  assert.match(generatedSource, /double value = __tsonic_param0 \?\? global::Smoke\.Generated\.Index\.seed\(\);\s*return value;/u);
  assert.doesNotMatch(generatedSource, /\bis double __tsonic_value\d+/u);
  assert.doesNotMatch(generatedSource, /__unsupported|InvalidExpression|Func<|dynamic|System\.Reflection/u);
  assert.equal(await runGeneratedCsharpRunner(projectDirectory, "SmokeGeneratedNonliteralDefaultParameters", [
    "using System;",
    "public static class Program",
    "{",
    "    public static void Main()",
    "    {",
    "        Console.WriteLine(Smoke.Generated.Index.add());",
    "        Console.WriteLine(Smoke.Generated.Index.add(8));",
    "        Console.WriteLine(Smoke.Generated.Index.add(0));",
    "        Console.WriteLine(Smoke.Generated.Index.add(null));",
    "    }",
    "}",
  ]), "3\n8\n0\n3\n");
});

test("CLI rejects a parameter default incompatible with its checked native value type", async () => {
  const projectDirectory = resolve(tempRoot, "invalid-checked-parameter-default");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{ id: "csharp" }],
    }, null, 2),
    "src/index.ts": [
      "function seed(): string { return \"wrong\"; }",
      "export function add(value: number = seed()): number { return value; }",
      "",
    ].join("\n"),
  });
  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /TS2322: Type 'string' is not assignable to type 'number'/u);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/src/Index.cs")), false);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
});

test("CLI emits nullish coalescing fallback literals from finalized operator result target type", async () => {
  const projectDirectory = resolve(tempRoot, "nullish-char-expected-type");
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
            assemblyName: "SmokeGeneratedNullishCharExpectedType",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { char } from \"@tsonic/csharp/types.js\";",
      "",
      "export function fallback(value: char | null): char {",
      "  return value ?? \"x\";",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static char fallback\(char\? value\)/);
  assert.match(generatedSource, /return value \?\? 'x';/);
  assert.doesNotMatch(generatedSource, /return value \?\? "x";/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedNullishCharExpectedType.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits void-expression statement and return lowering as discard evaluation", async () => {
  const projectDirectory = resolve(tempRoot, "void-expression-discard");
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
            assemblyName: "SmokeGeneratedVoidExpressionDiscard",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int } from \"@tsonic/csharp/types.js\";",
      "",
      "export function bump(value: int): int {",
      "  return value + 1;",
      "}",
      "",
      "export function discardCall(value: int): void {",
      "  void bump(value);",
      "}",
      "",
      "export function returnDiscard(value: int): void {",
      "  return void bump(value);",
      "}",
      "",
      "export function discardLiteral(): void {",
      "  void 0;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static void discardCall\(int value\)[\s\S]*global::Smoke\.Generated\.Index\.bump\(value\);/);
  assert.match(generatedSource, /public static void returnDiscard\(int value\)[\s\S]*global::Smoke\.Generated\.Index\.bump\(value\);[\s\S]*return;/);
  assert.match(generatedSource, /public static void discardLiteral\(\)\s*\{\s*\}/u);
  assert.doesNotMatch(generatedSource, /return bump\(value\);/);
  assert.doesNotMatch(generatedSource, /return global::Smoke\.Generated\.Index\.bump\(value\);/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedVoidExpressionDiscard.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});
