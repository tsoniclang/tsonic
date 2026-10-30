import { performance } from "node:perf_hooks";
import { assert, cliPath, existsSync, readFile, repoRoot, resolve, run, runGeneratedCsharpRunner, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";

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
  assert.match(build.stderr, /C# bitwise operator '&' requires integral operands or one exact enum type/);
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
  assert.match(build.stderr, /C# logical negation requires an exact bool operand/);
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
  assert.match(build.stderr, /Source operator 'in' requires a dedicated C# translation policy/);
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
