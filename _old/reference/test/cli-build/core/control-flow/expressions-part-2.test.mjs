import { performance } from "node:perf_hooks";
import { assert, cliPath, existsSync, readFile, repoRoot, resolve, run, runGeneratedCsharpRunner, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";

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
