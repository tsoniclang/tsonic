import assert from "node:assert/strict";
import test from "node:test";
import { getTargetCompilationPaths, resolveProjectPaths } from "../../packages/host/dist/index.js";
import { createCsharpTargetPack } from "../../../tsonic-csharp/dist/public/index.js";
import { checkSourceProgramFixture } from "./source-program-fixture.mjs";

function analyze(text) {
  const targetPack = createCsharpTargetPack();
  const target = { id: "csharp", options: { outputType: "Library" } };
  const project = { entryPoint: "index.ts", rootDir: ".", targets: [target] };
  const paths = getTargetCompilationPaths(resolveProjectPaths({ projectFilePath: "/src/tsonic.json", project }), target);
  const checked = checkSourceProgramFixture({ project, projectDirectory: "/src", currentDirectory: "/src", target, targetPack, paths,
    selectedCapabilities: [], selectedSurfaces: [], files: { "/src/index.ts": text },
    compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" } });
  assert.equal(checked.kind === "resolved", true, checked.diagnostics.map(issue => issue.message).join("\n").slice(0, 4096));
  assert.equal(checked.diagnostics.length, 0, "the original whole program has no checker, extension or Source diagnostic");
  const source = checked.value;
  const file = source.sourceFiles.find(node => source.ast.getFileName(node) === "/src/index.ts");
  assert.equal(file !== undefined, true, "the original project file is present");
  const nodes = source.facts.navigation.nodesForFiles([file]);
  const range = node => {
    const result = source.facts.integers.range(node);
    assert.equal(result.kind === "resolved", true, "an admitted original numeric occurrence has its exact Source proof outcome");
    return result.value;
  };
  const remainders = nodes.filter(node => source.ast.is.IsBinaryExpression(node) && source.ast.operatorKindName(node) === "KindPercentToken");
  const bounds = node => {
    const operation = source.facts.values.operation(node);
    assert.equal(operation.kind === "resolved" && operation.value.kind === "binary" && operation.value.operator === "remainder", true,
      "the original remainder is selected by the canonical Source operation owner");
    assert.equal(operation.value.operands.length, 2);
    return { node, left: range(operation.value.operands[0].occurrence), right: range(operation.value.operands[1].occurrence), result: range(node) };
  };
  return { source, nodes, remainders, bounds, range };
}

function int32SourceBounds(row) {
  return [row.left, row.right, row.result].every(result => result.kind === "present" &&
    result.value.minimum >= 0n && result.value.maximum <= 2147483647n) && row.right.value.minimum > 0n;
}

test("integer evidence is immutable, occurrence-specific and bounded by source loops", () => {
  const current = analyze(`export function run() {
    let total = 0;
    for (let value = 2; value <= 100; value++) {
      for (let divisor = 2; divisor * divisor <= value; divisor++) total += value % divisor;
    }
    return total;
  }`);
  const selected = current.remainders.map(current.bounds).filter(int32SourceBounds);
  assert.equal(selected.length, 1);
  assert.deepEqual(selected[0].result, { kind: "present", value: { minimum: 0n, maximum: 9n } });
  assert.equal(Object.isFrozen(current.source.facts.integers), true);
  assert.equal(Object.isFrozen(selected[0].result.value), true);
  const original = current.source.facts.integers.range(selected[0].node);
  assert.equal(current.source.facts.integers.range(selected[0].node) === original, true, "a completed original occurrence retains its identical proof outcome");
  const foreign = analyze("export function run() { return 8 % 3; }");
  assert.throws(() => current.source.facts.integers.range(foreign.remainders[0]), /exact original node/u);
});

test("mutations, captures, zero, negative zero and uncertain bounds cannot select integer remainder", () => {
  const bodies = [
    "let value = 3; value = input; return value % 2;",
    "let value = -0; return value % 2;",
    "const value = -6; return value % 3;",
    "const value = 2147483648; return value % 3;",
    "let divisor = 3; (divisor) = 0; return 9 % divisor;",
    "let divisor = 0; let flag = input > 0; flag ||= (divisor = 3) > 0; return 9 % divisor;",
    "let divisor = 0; input > 0 && (divisor = 3); return 9 % divisor;",
    "let divisor = 3; while (input-- > 0) divisor = 0; return 9 % divisor;",
    "let divisor = 3; for (let value = 0; value < 10; value++) { const remainder = value % divisor; divisor--; } return 0;",
    "let value = 3; const mutate = () => { value = input; }; mutate(); return value % 2;",
    "let total = 0; for (let value = 0; value < input; value++) total += value % 3; return total;",
    "let total = 0; for (let value = 0; value < 10; value++) { value += 0.5; total += value % 3; } return total;",
    "let divisor = 3; [divisor] = [0]; return 9 % divisor;",
    "let divisor = 3; for (divisor of [0]) {} return 9 % divisor;",
    "let divisor = 3; for (let value = 1; value < 4; value++) { const result = value % divisor; for (divisor of [0]) {} } return 0;",
    "var divisor = 3; for (let value = 1; value < 4; value++) { const result = value % divisor; var divisor = 0; } return 0;",
    "var value = 5; var value = 1.5; return value % 3;",
    "var divisor = 3; var divisor = 0; return 9 % divisor;",
    "var divisor = 3; divisor = 2; var divisor = 0; return 9 % divisor;",
    "let divisor = 3; const { value = (divisor = 0) } = {} as { value?: number }; return 9 % divisor;",
    "let divisor = 3; const [value = (divisor = 0)] = [] as number[]; return 9 % divisor;",
    "let divisor = 3; const { value: { nested = (divisor = 0) } } = { value: {} } as { value: { nested?: number } }; return 9 % divisor;",
    "let divisor = 3; const { value = (divisor = 0) } = (divisor = 1, {} as { value?: number }); return 9 % divisor;",
    "let divisor = 2; let sum = 0; for (let value = (divisor = 1); value < 4; value++) { sum += value % divisor; divisor = 0; } return sum;",
    "let divisor = 2; let sum = 0; for (let value = (divisor = 1); value < 4; value++) { sum += value % divisor; divisor = 1.5; } return sum;",
    "let divisor = 2; let sum = 0; for (let value = (divisor = 1); value < (5 % divisor) + 3; value++) { sum += value; divisor = 0; } return sum;",
    "let divisor = 2; let sum = 0; for (let value = (divisor = 1); value < 10 + (6 % divisor) + (divisor = 0); value++) sum += value; return sum;",
    "for (let value = 0; value < ((value = 2147483648) - 2147483640); value++) return value % 3; return 0;",
  ];
  for (const body of bodies) {
    const current = analyze(`export function run(input: number) { ${body} }`);
    assert.equal(current.remainders.map(current.bounds).filter(int32SourceBounds).length, 0,
      `${body}: the original Source interval preconditions cannot authorize an int32 remainder; actual Native ABI is independently required`);
  }
});

test("the proof budget abandons a callable atomically without affecting other callables", () => {
  const statements = "const value = 8; const divisor = 3; value % divisor;";
  const large = Array.from({ length: 6_000 }, () => `{ ${statements} }`).join("\n");
  const current = analyze(`export function large() { ${large} } export function small() { ${statements} }`);
  assert.equal(current.remainders.map(current.bounds).filter(int32SourceBounds).length, 1);
  const small = current.nodes.find(node => current.source.ast.is.IsFunctionDeclaration(node) && current.source.ast.text(current.source.ast.name(node)) === "small");
  const selected = current.remainders.filter(node => current.range(node).kind === "present");
  assert.equal(selected.length, 1);
  assert.equal(current.source.facts.navigation.enclosing(selected[0], "body") === small, true,
    "only the independent original small callable keeps a completed proof");
});

test("selected numeric domains are mandatory even when syntax appears integral", () => {
  const numeric = analyze("export function run() { const value = 8; return value % 3; }");
  assert.equal(numeric.range(numeric.remainders[0]).kind, "present", "the original numeric program remains a positive control");
  const unknown = analyze("export function run(value: unknown) { return value; }");
  const statement = unknown.nodes.find(node => unknown.source.ast.is.IsReturnStatement(node));
  const occurrence = unknown.source.ast.as.AsReturnStatement(statement).Expression;
  assert.equal(occurrence !== undefined, true, "the genuine unknown value is an original enrolled occurrence");
  assert.equal(unknown.range(occurrence).kind, "none", "authentic Source unknown evidence never acquires numeric proof from syntax");
  const nonnegative = unknown.source.facts.integers.nonnegative(occurrence);
  assert.equal(nonnegative.kind === "resolved" && nonnegative.value === false, true);
});
