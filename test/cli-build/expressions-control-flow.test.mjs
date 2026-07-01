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
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "export function operators(value: int32, shift: int32): int32 {",
      "  let result: int32 = value;",
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


test("CLI emits C# switch defaults and literal fallthrough labels", async () => {
  const projectDirectory = resolve(tempRoot, "literal-switch-fallthrough");
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
            assemblyName: "SmokeGeneratedLiteralSwitchFallthrough",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function classify(value: string): string {",
      "  switch (value) {",
      "    case \"alpha\":",
      "    case \"beta\":",
      "      return \"known\";",
      "    default:",
      "      return \"other\";",
      "  }",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /switch \(value\)/);
  assert.match(generatedSource, /case "alpha":\s+goto case "beta";/);
  assert.match(generatedSource, /case "beta":\s+return "known";/);
  assert.match(generatedSource, /default:\s+return "other";/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedLiteralSwitchFallthrough.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});


test("CLI rejects dynamic TypeScript switch case expressions before C# emission", async () => {
  const projectDirectory = resolve(tempRoot, "dynamic-switch-case-expression");
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
            assemblyName: "SmokeGeneratedDynamicSwitchCase",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function classify(value: string, dynamicCase: string): string {",
      "  switch (value) {",
      "    case dynamicCase:",
      "      return \"dynamic\";",
      "    default:",
      "      return \"other\";",
      "  }",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /Switch case labels must be C# compile-time constants/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedDynamicSwitchCase.csproj")), false);
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


test("CLI rewrites mixed-type for initializers into C# prelude locals", async () => {
  const projectDirectory = resolve(tempRoot, "mixed-for-initializers");
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
            assemblyName: "SmokeGeneratedMixedForInitializers",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function mixed(limit: number): number {",
      "  let total = 0;",
      "  for (let index = 0, active = true; index < limit; index++) {",
      "    if (active) {",
      "      total = total + index;",
      "    }",
      "  }",
      "  return total;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /double index = 0;/);
  assert.match(generatedSource, /bool active = true;/);
  assert.match(generatedSource, /for \(; index < limit; index\+\+\)/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedMixedForInitializers.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});


test("CLI lowers labeled break and continue into deterministic C# labels", async () => {
  const projectDirectory = resolve(tempRoot, "labeled-control-flow");
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
            assemblyName: "SmokeGeneratedLabeledControlFlow",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function count(limit: number): number {",
      "  let total = 0;",
      "  outer: for (let row = 0; row < limit; row++) {",
      "    for (let column = 0; column < limit; column++) {",
      "      if (column === 1) {",
      "        continue outer;",
      "      }",
      "      if (row === 2) {",
      "        break outer;",
      "      }",
      "      total = total + 1;",
      "    }",
      "  }",
      "  return total;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /goto __tsonic_label_outer_continue\d+;/);
  assert.match(generatedSource, /goto __tsonic_label_outer_break\d+;/);
  assert.match(generatedSource, /__tsonic_label_outer_continue\d+:/);
  assert.match(generatedSource, /__tsonic_label_outer_break\d+:/);
  assert.doesNotMatch(generatedSource, /Labeled break requires/);
  assert.doesNotMatch(generatedSource, /Labeled continue requires/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedLabeledControlFlow.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});


test("CLI lowers switch fallthrough into explicit C# switch gotos", async () => {
  const projectDirectory = resolve(tempRoot, "switch-fallthrough");
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
            assemblyName: "SmokeGeneratedSwitchFallthrough",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function choose(value: number): number {",
      "  let result = 0;",
      "  switch (value) {",
      "    case 0:",
      "      result = 1;",
      "    case 1:",
      "      result = result + 2;",
      "      break;",
      "    case 2:",
      "      result = 4;",
      "    default:",
      "      result = result + 8;",
      "  }",
      "  return result;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /goto case 1;/);
  assert.match(generatedSource, /goto default;/);
  assert.doesNotMatch(generatedSource, /Switch case fallthrough requires/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedSwitchFallthrough.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});


test("CLI routes top-level for-of statements through the C# module entrypoint", async () => {
  const projectDirectory = resolve(tempRoot, "top-level-for-of");
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
            assemblyName: "SmokeGeneratedTopLevelForOf",
            outputType: "Exe",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "let total = 0;",
      "",
      "for (const value of [1, 2, 3]) {",
      "  total = total + value;",
      "}",
      "",
      "export function read(): number {",
      "  return total;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  const generatedEntrypoint = await readFile(resolve(projectDirectory, "out/csharp/generated/TsonicEntrypoint.cs"), "utf8");
  assert.match(generatedSource, /public static double total;/);
  assert.match(generatedSource, /static Index\(\)/);
  assert.match(generatedSource, /total = 0;/);
  assert.match(generatedEntrypoint, /public static void Main\(\)/);
  assert.match(generatedEntrypoint, /Index\.__tsonic_module_init\(\);/);
  assert.match(generatedSource, /foreach \(double value in new double\[\] \{ 1, 2, 3 \}\)/);
  assert.match(generatedSource, /total = total \+ value;/);
  assert.doesNotMatch(generatedSource, /Top-level statement is outside/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedTopLevelForOf.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});


test("CLI emits async functions and lambdas from TSTS Promise carriers", async () => {
  const projectDirectory = resolve(tempRoot, "async-promise-carriers");
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
            assemblyName: "SmokeGeneratedAsyncCarriers",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export async function value(): Promise<number> {",
      "  return 1;",
      "}",
      "",
      "export async function echo(value: Promise<number>): Promise<number> {",
      "  return await value;",
      "}",
      "",
      "export function delayed(): () => Promise<number> {",
      "  return async () => 2;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);
  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static async System\.Threading\.Tasks\.Task<double> value\(\)/);
  assert.match(generatedSource, /public static async System\.Threading\.Tasks\.Task<double> echo\(System\.Threading\.Tasks\.Task<double> value\)/);
  assert.match(generatedSource, /return await value;/);
  assert.match(generatedSource, /public static Func<System\.Threading\.Tasks\.Task<double>> delayed\(\)/);
  assert.match(generatedSource, /return async \(\) => 2;/);
  assert.doesNotMatch(generatedSource, /__unsupported/);
});

test("CLI emits instance and lexical this only from finalized receiver facts", async () => {
  const projectDirectory = resolve(tempRoot, "instance-lexical-this-facts");
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
            assemblyName: "SmokeGeneratedThisFacts",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export class Counter {",
      "  value: number = 7;",
      "  read(): number {",
      "    const read = (): number => this.value;",
      "    return read();",
      "  }",
      "}",
      "",
      "export function run(): number {",
      "  const counter = new Counter();",
      "  return counter.read();",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);
  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public class Counter/);
  assert.match(generatedSource, /public double value = 7;/);
  assert.match(generatedSource, /Func<double> read = \(\) => this\.value;/);
  assert.match(generatedSource, /return read\(\);/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedThisFacts.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI rejects static this before C# emission instead of guessing receiver semantics", async () => {
  const projectDirectory = resolve(tempRoot, "static-this-rejected");
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
            assemblyName: "SmokeGeneratedStaticThisRejected",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export class Counter {",
      "  static value: number = 7;",
      "  static read(): number {",
      "    return this.value;",
      "  }",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.notEqual(build.status, 0);
  assert.match(build.stderr, /C# this emission requires a TSTS-selected instance class receiver/);
  assert.match(build.stderr, /static class member receiver/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/src/Index.cs")), false);
});


test("CLI emits array literals from finalized runtime carrier facts", async () => {
  const projectDirectory = resolve(tempRoot, "array-literal-runtime-carriers");
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
            assemblyName: "SmokeGeneratedArrayLiteralFacts",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function values(): number[] {",
      "  return [1, 2];",
      "}",
      "",
      "export function first(): number {",
      "  const values = [1, 2];",
      "  return values[0];",
      "}",
      "",
      "export function bare(): void {",
      "  [1, 2];",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);
  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /return new double\[\] \{ 1, 2 \};/);
  assert.match(generatedSource, /double\[\] values = new double\[\] \{ 1, 2 \};/);
  assert.match(generatedSource, /new double\[\] \{ 1, 2 \};/);
  assert.doesNotMatch(generatedSource, /__unsupported/);
  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedArrayLiteralFacts.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});


test("CLI rejects lambdas without contextual target delegate facts", async () => {
  const projectDirectory = resolve(tempRoot, "lambda-requires-context");
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
            assemblyName: "SmokeGeneratedLambdaFacts",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function bare(): void {",
      "  (() => 1);",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /Lambda emission requires a contextual function\/delegate type/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedLambdaFacts.csproj")), false);
});


test("CLI emits omitted function and method return types from TSTS inferred signatures", async () => {
  const projectDirectory = resolve(tempRoot, "inferred-return-types");
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
            assemblyName: "SmokeGeneratedInferredReturns",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function inferred() {",
      "  return 1;",
      "}",
      "",
      "export function sideEffect(value: number) {",
      "  let copy = value;",
      "}",
      "",
      "export function inferredArray() {",
      "  return [1, 2];",
      "}",
      "",
      "export function inferredGeneric<T>(value: T) {",
      "  return value;",
      "}",
      "",
      "export function localArray() {",
      "  let values = [1, 2];",
      "  return values[0];",
      "}",
      "",
      "export class Counter {",
      "  value: number = 0;",
      "  values = [1, 2];",
      "  current() {",
      "    return this.value;",
      "  }",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static double inferred\(\)/);
  assert.match(generatedSource, /public static void sideEffect\(double value\)/);
  assert.match(generatedSource, /public static double\[\] inferredArray\(\)/);
  assert.match(generatedSource, /return new double\[\] \{ 1, 2 \};/);
  assert.match(generatedSource, /public static T inferredGeneric<T>\(T value\)/);
  assert.match(generatedSource, /public static double localArray\(\)/);
  assert.match(generatedSource, /double\[\] values = new double\[\] \{ 1, 2 \};/);
  assert.match(generatedSource, /public double\[\] values = new double\[\] \{ 1, 2 \};/);
  assert.match(generatedSource, /public double current\(\)/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedInferredReturns.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});


test("CLI emits source-owned local object destructuring", async () => {
  const projectDirectory = resolve(tempRoot, "local-destructuring");
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
            assemblyName: "SmokeGeneratedDestructuring",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export class Point {",
      "  x: number = 1;",
      "  y: number = 2;",
      "}",
      "",
      "export class Box {",
      "  child: Point = new Point();",
      "}",
      "",
      "export function local(point: Point, box: Box): number {",
      "  const { x } = point;",
      "  const { x: aliasX, \"y\": stringY } = point;",
      "  const { child: { x: nestedX } } = box;",
      "  return x + aliasX + stringY + nestedX;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /Point __tsonic_destructure0 = point;/);
  assert.match(generatedSource, /double x = __tsonic_destructure0\.x;/);
  assert.match(generatedSource, /double aliasX = __tsonic_destructure\d+\.x;/);
  assert.match(generatedSource, /double stringY = __tsonic_destructure\d+\.y;/);
  assert.match(generatedSource, /Point __tsonic_destructure\d+ = __tsonic_destructure\d+\.child;/);
  assert.match(generatedSource, /double nestedX = __tsonic_destructure\d+\.x;/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedDestructuring.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});


test("CLI emits source-owned parameter and for-initializer object destructuring", async () => {
  const projectDirectory = resolve(tempRoot, "parameter-forof-destructuring");
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
            assemblyName: "SmokeGeneratedParameterForOfDestructuring",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export class Point {",
      "  x: number = 1;",
      "  y: number = 2;",
      "}",
      "",
      "export function fromObjectParameter({ x }: Point): number {",
      "  return x;",
      "}",
      "",
      "export function fromForInitializer(point: Point): number {",
      "  for (const { x } = point; x < 2;) {",
      "    return x;",
      "  }",
      "  return 0;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static double fromObjectParameter\(Point __tsonic_param0\)/);
  assert.match(generatedSource, /double x = __tsonic_param0\.x;/);
  assert.match(generatedSource, /Point __tsonic_destructure0 = point;/);
  assert.match(generatedSource, /double x = __tsonic_destructure0\.x;/);
  assert.match(generatedSource, /for \(; x < 2; \)/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedParameterForOfDestructuring.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI runs array and object-shape destructuring assignment from finalized facts", async () => {
  const projectDirectory = resolve(tempRoot, "destructuring-assignment-runtime");
  const assemblyName = "SmokeGeneratedDestructuringAssignment";
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
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "type Shape = { value: int32; label: string };",
      "",
      "function assignArray(values: int32[]): int32 {",
      "  let first: int32 = 0;",
      "  let second: int32 = 0;",
      "  [first, second] = values;",
      "  return first + second;",
      "}",
      "",
      "function assignObject(input: Shape): string {",
      "  let value: int32 = 0;",
      "  let label: string = \"\";",
      "  ({ value, label } = input);",
      "  return `${label}:${value}`;",
      "}",
      "",
      "Console.writeLine(`${assignArray([2, 3])}|${assignObject({ value: 7, label: \"ok\" })}`);",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /int\[\] __tsonic_destructure\d+ = values;/);
  assert.match(generatedSource, /first = __tsonic_destructure\d+\[0\];/);
  assert.match(generatedSource, /second = __tsonic_destructure\d+\[1\];/);
  assert.match(generatedSource, /__TsonicShape_[A-Za-z0-9_]+ __tsonic_destructure\d+ = input;/);
  assert.match(generatedSource, /value = __tsonic_destructure\d+\.value;/);
  assert.match(generatedSource, /label = __tsonic_destructure\d+\.label;/);
  assert.doesNotMatch(generatedSource, /__unsupported|invalid/i);

  assert.equal(runGeneratedProject(projectDirectory, assemblyName), "5|ok:7\n");
});


test("CLI emits C# null-conditional access from TSTS optional-chain AST", async () => {
  const projectDirectory = resolve(tempRoot, "optional-chain");
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
            assemblyName: "SmokeGeneratedOptionalChain",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "export class Box {",
      "  value: number = 1;",
      "  read(): number {",
      "    return this.value;",
      "  }",
      "}",
      "",
      "export function readValue(box: Box, defaultValue: number): number {",
      "  return box?.value ?? defaultValue;",
      "}",
      "",
      "export function readCall(box: Box, defaultValue: number): number {",
      "  return box?.read() ?? defaultValue;",
      "}",
      "",
      "export function readElement(values: number[] | null, index: int32, defaultValue: number): number {",
      "  return values?.[index] ?? defaultValue;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /return box\?\.value \?\? defaultValue;/);
  assert.match(generatedSource, /return box\?\.read\(\) \?\? defaultValue;/);
  assert.match(generatedSource, /public static double readElement\(double\[\]\? values, int index, double defaultValue\)/);
  assert.match(generatedSource, /return values\?\[index\] \?\? defaultValue;/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedOptionalChain.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});


test("CLI emits nullable C# storage for nullish unions from provider runtime-carrier facts", async () => {
  const projectDirectory = resolve(tempRoot, "nullable-unions");
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
            assemblyName: "SmokeGeneratedNullableUnions",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export class Box {",
      "  value: number = 1;",
      "}",
      "",
      "export function maybeNumber(flag: boolean): number | null {",
      "  return flag ? 1.5 : null;",
      "}",
      "",
      "export function maybeNumberUndefined(flag: boolean): number | undefined {",
      "  return flag ? 2.5 : undefined;",
      "}",
      "",
      "export function maybeBoolean(flag: boolean): boolean | null {",
      "  return flag ? true : null;",
      "}",
      "",
      "export function maybeBox(flag: boolean, box: Box): Box | null {",
      "  return flag ? box : null;",
      "}",
      "",
      "export function readBoolean(value: boolean | null, alternate: boolean): boolean {",
      "  return value ?? alternate;",
      "}",
      "",
      "export function readUndefined(value: number | undefined, alternate: number): number {",
      "  return value ?? alternate;",
      "}",
      "",
      "export function read(box: Box | null, defaultValue: number): number {",
      "  return box?.value ?? defaultValue;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static double\? maybeNumber\(bool flag\)/);
  assert.match(generatedSource, /return flag \? 1\.5 : null;/);
  assert.match(generatedSource, /public static double\? maybeNumberUndefined\(bool flag\)/);
  assert.match(generatedSource, /return flag \? 2\.5 : null;/);
  assert.match(generatedSource, /public static bool\? maybeBoolean\(bool flag\)/);
  assert.match(generatedSource, /return flag \? true : null;/);
  assert.match(generatedSource, /public static Box\? maybeBox\(bool flag, Box box\)/);
  assert.match(generatedSource, /public static bool readBoolean\(bool\? value, bool alternate\)/);
  assert.match(generatedSource, /return value \?\? alternate;/);
  assert.match(generatedSource, /public static double readUndefined\(double\? value, double alternate\)/);
  assert.match(generatedSource, /public static double read\(Box\? box, double defaultValue\)/);
  assert.match(generatedSource, /return box\?\.value \?\? defaultValue;/);
  assert.doesNotMatch(generatedSource, /\bundefined\b/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedNullableUnions.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
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
      "import type { char } from \"@tsonic/core/types.js\";",
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

test("CLI rejects invalid nullish coalescing fallback literals before C# emission", async () => {
  const projectDirectory = resolve(tempRoot, "nullish-char-invalid-expected-type");
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
            assemblyName: "SmokeGeneratedNullishCharInvalidExpectedType",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import type { char } from \"@tsonic/core/types.js\";",
      "",
      "export function fallback(value: char | null): char {",
      "  return value ?? \"xy\";",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /char literals require exactly one UTF-16 code unit/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedNullishCharInvalidExpectedType.csproj")), false);
});


test("CLI emits explicit tuple types and tuple literals as C# value tuples", async () => {
  const projectDirectory = resolve(tempRoot, "value-tuples");
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
            assemblyName: "SmokeGeneratedTuples",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function makePair(name: string, value: number): [string, number] {",
      "  const pair: [string, number] = [name, value];",
      "  return pair;",
      "}",
      "",
      "export function returnPair(name: string, value: number): [string, number] {",
      "  return [name, value];",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static \(string, double\) makePair\(string name, double value\)/);
  assert.match(generatedSource, /\(string, double\) pair = \(name, value\);/);
  assert.match(generatedSource, /public static \(string, double\) returnPair\(string name, double value\)/);
  assert.match(generatedSource, /return \(name, value\);/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedTuples.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});


test("CLI runs utility-projected object shapes and Parameters tuple destructuring", async () => {
  const assemblyName = "SmokeGeneratedUtilityProjectedTuples";
  const projectDirectory = resolve(tempRoot, "utility-projected-tuples");
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
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "type Point = { x: int32; y: int32; label: string; active: boolean };",
      "type PointSummary = Pick<Point, \"x\" | \"label\">;",
      "type PointHidden = Omit<Point, \"active\" | \"y\">;",
      "type PointReadonly = Readonly<PointSummary>;",
      "type PairFn = (name: string, value: number) => string;",
      "type PairArgs = Parameters<PairFn>;",
      "",
      "function summarize(value: PointSummary): string {",
      "  return `${value.label}:${value.x}`;",
      "}",
      "",
      "function summarizeHidden(value: PointHidden): string {",
      "  return `${value.label}:${value.x}`;",
      "}",
      "",
      "function summarizeReadonly(value: PointReadonly): string {",
      "  return `${value.label}:${value.x}`;",
      "}",
      "",
      "function formatPair(args: PairArgs): string {",
      "  const [name, value] = args;",
      "  return `${name}:${value}`;",
      "}",
      "",
      "const summary: PointSummary = { x: 7, label: \"p\" };",
      "const hidden: PointHidden = { x: 5, label: \"q\" };",
      "const readonlySummary: PointReadonly = { x: 9, label: \"r\" };",
      "const args: PairArgs = [\"tuple\", 4];",
      "Console.writeLine(summarize(summary));",
      "Console.writeLine(summarizeHidden(hidden));",
      "Console.writeLine(summarizeReadonly(readonlySummary));",
      "Console.writeLine(formatPair(args));",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public class __TsonicShape_/);
  assert.match(generatedSource, /public int x;/);
  assert.match(generatedSource, /public string label;/);
  assert.doesNotMatch(generatedSource, /public int y;/);
  assert.doesNotMatch(generatedSource, /public bool active;/);
  assert.match(generatedSource, /public static string formatPair\(\(string, double\) args\)/);
  assert.match(generatedSource, /string name = __tsonic_destructure\d+\.Item1;/);
  assert.match(generatedSource, /double value = __tsonic_destructure\d+\.Item2;/);
  assert.doesNotMatch(generatedSource, /__tsonic_destructure\d+\[\d+\]/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const projectPath = resolve(projectDirectory, `out/csharp/${assemblyName}.csproj`);
  const dotnet = run("dotnet", ["build", projectPath, "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);

  const executed = run("dotnet", ["run", "--project", projectPath, "--no-build", "--no-restore"]);
  assert.equal(executed.status, 0, executed.stdout + executed.stderr);
  assert.equal(executed.stdout.replace(/\r\n/g, "\n"), [
    "p:7",
    "q:5",
    "r:9",
    "tuple:4",
    "",
  ].join("\n"));
});


test("CLI runs tuple numeric index access through value-tuple members", async () => {
  const assemblyName = "SmokeGeneratedTupleElementAccess";
  const projectDirectory = resolve(tempRoot, "tuple-element-access");
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
      "",
      "type Row = [string, number];",
      "",
      "function format(row: Row): string {",
      "  const zero = 0 as const;",
      "  return `${row[zero]}:${row[1]}`;",
      "}",
      "",
      "const row: Row = [\"tuple\", 4];",
      "Console.writeLine(format(row));",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public static string format\(\(string, double\) row\)/);
  assert.match(generatedSource, /return \$"\{row\.Item1\}:\{row\.Item2\}";/);
  assert.doesNotMatch(generatedSource, /row\[[^\]]+\]/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const projectPath = resolve(projectDirectory, `out/csharp/${assemblyName}.csproj`);
  const dotnet = run("dotnet", ["build", projectPath, "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);

  const executed = run("dotnet", ["run", "--project", projectPath, "--no-build", "--no-restore"]);
  assert.equal(executed.status, 0, executed.stdout + executed.stderr);
  assert.equal(executed.stdout.replace(/\r\n/g, "\n"), "tuple:4\n");
});


test("CLI rejects tuple rest and default destructuring until slice facts are finalized", async () => {
  const projectDirectory = resolve(tempRoot, "tuple-rest-default-fail-closed");
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
            assemblyName: "SmokeGeneratedTupleRestDefaults",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function tupleDefault(input: [string, number]): string {",
      "  const [name = \"fallback\"] = input;",
      "  return name;",
      "}",
      "",
      "export function tupleRest(input: [string, number, boolean]): string {",
      "  const [name, ...rest] = input;",
      "  return name;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /Tuple destructuring defaults require finalized tuple optional-element facts before C# emission/);
  assert.match(build.stderr, /Tuple rest destructuring requires finalized tuple slice facts before C# emission/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedTupleRestDefaults.csproj")), false);
});


test("CLI rejects tuple dynamic indexes without finalized element facts", async () => {
  const projectDirectory = resolve(tempRoot, "tuple-dynamic-index-fail-closed");
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
            assemblyName: "SmokeGeneratedTupleDynamicIndex",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function dynamicIndex(row: [string, number], index: number): string | number {",
      "  return row[index];",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /C# source tuple element access requires a statically proven non-negative integer tuple index from TSTS literal or constant facts/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedTupleDynamicIndex.csproj")), false);
});


test("CLI rejects tuple out-of-range indexes through TSTS before C# emission", async () => {
  const projectDirectory = resolve(tempRoot, "tuple-out-of-range-fail-closed");
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
            assemblyName: "SmokeGeneratedTupleOutOfRangeIndex",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function outOfRangeIndex(row: [string, number]): boolean {",
      "  return row[2];",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /TS2493: Tuple type '\[string, number\]' of length '2' has no element at index '2'/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedTupleOutOfRangeIndex.csproj")), false);
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
      "import type { int32 } from \"@tsonic/core/types.js\";",
      "",
      "export function bump(value: int32): int32 {",
      "  return value + 1;",
      "}",
      "",
      "export function discardCall(value: int32): void {",
      "  void bump(value);",
      "}",
      "",
      "export function returnDiscard(value: int32): void {",
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
