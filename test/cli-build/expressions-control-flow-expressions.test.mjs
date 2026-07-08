import { performance } from "node:perf_hooks";
import { assert, cliPath, existsSync, readFile, repoRoot, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "./harness.mjs";

test("CLI emits C# string literals and template expressions from TSTS AST", async () => {
  const projectDirectory = resolve(tempRoot, "template-expressions");
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
            assemblyName: "SmokeGeneratedTemplates",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function plain(): string {",
      "  return `plain`;",
      "}",
      "",
      "export function greet(name: string, count: number): string {",
      "  return `hello ${name} ${count}`;",
      "}",
      "",
      "export function escaped(name: string): string {",
      "  return `hello {${name}}`;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /return "plain";/);
  assert.match(generatedSource, /return \$"hello \{name\} \{count\}";/);
  assert.match(generatedSource, /return \$"hello \{\{\{name\}\}\}";/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedTemplates.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI erases TypeScript-only expression wrappers after TSTS validation", async () => {
  const projectDirectory = resolve(tempRoot, "erased-expression-wrappers");
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
            assemblyName: "SmokeGeneratedErasedWrappers",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function asValue(value: number): number {",
      "  return value as number;",
      "}",
      "",
      "export function satisfiesValue(value: number): number {",
      "  return value satisfies number;",
      "}",
      "",
      "export function nonNullValue(value: number): number {",
      "  return value!;",
      "}",
      "",
      "export function typeAssertionValue(value: number): number {",
      "  return <number>value;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static double asValue\(double value\)/);
  assert.match(generatedSource, /public static double satisfiesValue\(double value\)/);
  assert.match(generatedSource, /public static double nonNullValue\(double value\)/);
  assert.match(generatedSource, /public static double typeAssertionValue\(double value\)/);
  assert.match(generatedSource, /return value;/);
  assert.doesNotMatch(generatedSource, /satisfies number/);
  assert.doesNotMatch(generatedSource, / as number/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedErasedWrappers.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI emits C# bitwise and compound operators from selected TSTS provider facts", async () => {
  const projectDirectory = resolve(tempRoot, "direct-operators");
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
            assemblyName: "SmokeGeneratedOperators",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int } from \"@tsonic/csharp/types.js\";",
      "",
      "export function operators(value: int, shift: int): int {",
      "  let result: int = value;",
      "  result += 1;",
      "  result -= 1;",
      "  result *= 2;",
      "  result /= 2;",
      "  result %= 2;",
      "  result <<= shift;",
      "  result >>= shift;",
      "  result >>>= shift;",
      "  result &= 7;",
      "  result |= 8;",
      "  result ^= 3;",
      "  return (~result & value) | (value ^ shift) | (value << shift) | (value >> shift) | (value >>> shift);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /result \+= 1;/);
  assert.match(generatedSource, /result >>>= shift;/);
  assert.match(generatedSource, /return \(~result & value\) \| \(value \^ shift\) \| \(value << shift\) \| \(value >> shift\) \| \(value >>> shift\);/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedOperators.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI finalizes long checked operator chains without superlinear traversal", async () => {
  const projectDirectory = resolve(tempRoot, "long-checked-operator-chain");
  const assemblyName = "SmokeGeneratedLongCheckedOperatorChain";
  const numericOperands = Array.from({ length: 16 }, (_, index) => index === 0 ? "seed" : `${index}`).join(" + ");
  const stringOperands = Array.from({ length: 16 }, (_, index) => index === 0 ? "label" : `"|${index}"`).join(" + ");
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
            assemblyName,
            outputType: "Exe",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { Console } from \"@tsonic/dotnet/System.js\";",
      "import type { int } from \"@tsonic/csharp/types.js\";",
      "",
      "export function numeric(seed: int): int {",
      `  return ${numericOperands};`,
      "}",
      "",
      "export function mixed(label: string): string {",
      `  return ${stringOperands};`,
      "}",
      "",
      "Console.WriteLine(`${numeric(1)}:${mixed(\"x\")}`);",
      "",
    ].join("\n"),
  });

  const startedAt = performance.now();
  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  const elapsedMs = performance.now() - startedAt;
  assert.equal(build.status, 0, build.stdout + build.stderr);
  assert.ok(elapsedMs < 60_000, `long checked operator chain build took ${elapsedMs.toFixed(1)}ms`);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /return seed \+ 1 \+ 2 \+ 3/);
  assert.match(generatedSource, /return label \+ "\|1" \+ "\|2"/);
  assert.doesNotMatch(generatedSource, /__unsupported|InvalidExpression|dynamic|Reflection|GetProperty|GetMethod/);

  assert.equal(runGeneratedProject(projectDirectory, assemblyName), "121:x|1|2|3|4|5|6|7|8|9|10|11|12|13|14|15\n");
});

test("CLI rejects direct C# bitwise operators on plain TypeScript number", async () => {
  const projectDirectory = resolve(tempRoot, "plain-number-bitwise");
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
            assemblyName: "SmokeGeneratedPlainNumberBitwise",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function bitwise(left: number, right: number): number {",
      "  return left & right;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /C# bitwise operator '&' requires integral, enum, or explicit provider operator facts/);
});

test("CLI rejects TypeScript truthiness in C# control-flow conditions without bool facts", async () => {
  const projectDirectory = resolve(tempRoot, "truthy-control-flow-conditions");
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
            assemblyName: "SmokeGeneratedTruthyConditions",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function choose(value: number): number {",
      "  if (value) {",
      "    return 1;",
      "  }",
      "  while (value) {",
      "    return 2;",
      "  }",
      "  do {",
      "    return 3;",
      "  } while (value);",
      "  return 0;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /If statement condition requires a finalized C# bool runtime carrier/);
  assert.match(build.stderr, /While statement condition requires a finalized C# bool runtime carrier/);
  assert.match(build.stderr, /Do statement condition requires a finalized C# bool runtime carrier/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedTruthyConditions.csproj")), false);
});

test("CLI rejects TypeScript truthiness in conditional expressions without bool facts", async () => {
  const projectDirectory = resolve(tempRoot, "truthy-conditional-expression");
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
            assemblyName: "SmokeGeneratedTruthyConditionalExpression",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function choose(value: number): number {",
      "  return value ? 1 : 2;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /Conditional expression condition requires a finalized C# bool runtime carrier/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedTruthyConditionalExpression.csproj")), false);
});

test("CLI rejects logical-not on plain number without provider truthiness lowering", async () => {
  const projectDirectory = resolve(tempRoot, "logical-not-number");
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
            assemblyName: "SmokeGeneratedLogicalNotNumber",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function negated(value: number): boolean {",
      "  return !value;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /C# prefix unary operator '!' requires operand runtime-carrier facts/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedLogicalNotNumber.csproj")), false);
});

test("CLI rejects in-operator emission without selected provider operation facts", async () => {
  const projectDirectory = resolve(tempRoot, "in-operator-requires-facts");
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
            assemblyName: "SmokeGeneratedInOperatorFacts",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export interface Box {",
      "  value: number;",
      "}",
      "",
      "export function hasValue(box: Box): boolean {",
      "  return \"value\" in box;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /C# operator 'in' has no finalized provider target operation/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedInOperatorFacts.csproj")), false);
});

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
  assert.match(generatedSource, /return sum\(1, 2, 3\);/);
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
  assert.match(generatedSource, /public static double add\(double value = 3, bool enabled = true, string label = "x"\)/);
  assert.match(generatedSource, /return add\(\);/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedDefaultParameters.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI rejects non-literal TypeScript default parameters without C# fallback", async () => {
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
  assert.equal(build.status, 1);
  assert.match(build.stderr, /C# parameter defaults require compile-time literal values/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedNonliteralDefaultParameters.csproj")), false);
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
  assert.match(generatedSource, /public static void discardCall\(int value\)[\s\S]*bump\(value\);/);
  assert.match(generatedSource, /public static void returnDiscard\(int value\)[\s\S]*bump\(value\);[\s\S]*return;/);
  assert.match(generatedSource, /public static void discardLiteral\(\)[\s\S]*_ = 0;/);
  assert.doesNotMatch(generatedSource, /return bump\(value\);/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedVoidExpressionDiscard.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});
