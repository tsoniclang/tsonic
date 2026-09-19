import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, type Node } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../source-semantics/target-source-program.js";
import { analyzeSourceIntegerRanges } from "./analysis.js";

function analyze(text: string) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": text },
    compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0);
  const source = createTargetSourceProgram(checked);
  const queries = analyzeSourceIntegerRanges({ ast: source.ast, navigation: source.navigation,
    sourceFiles: source.navigation.sourceFiles, isNumber(node: Node) {
      const types = source.semantics.forNode(node).types;
      const type = types.expressionType(node);
      return type !== undefined && types.isNumberLike(type);
    } });
  return { source, queries };
}

test("integer evidence is immutable, occurrence-specific and bounded by source loops", () => {
  const { queries } = analyze(`export function run() {
    let total = 0;
    for (let value = 2; value <= 100; value++) {
      for (let divisor = 2; divisor * divisor <= value; divisor++) total += value % divisor;
    }
    return total;
  }`);
  assert.equal(queries.exactInt32Remainders.length, 1);
  assert.deepEqual(queries.range(queries.exactInt32Remainders[0]!), { minimum: 0, maximum: 9 });
  assert.equal(Object.isFrozen(queries), true);
  assert.equal(Object.isFrozen(queries.exactInt32Remainders), true);
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
  for (const body of bodies) assert.equal(analyze(`export function run(input: number) { ${body} }`).queries.exactInt32Remainders.length, 0, body);
});

test("the proof budget abandons a callable atomically without affecting other callables", () => {
  const statements = "const value = 8; const divisor = 3; value % divisor;";
  const large = Array.from({ length: 6_000 }, () => `{ ${statements} }`).join("\n");
  const { queries } = analyze(`export function large() { ${large} } export function small() { ${statements} }`);
  assert.equal(queries.exactInt32Remainders.length, 1);
});

test("selected numeric domains are mandatory even when syntax appears integral", () => {
  const { source } = analyze("export function run() { const value = 8; return value % 3; }");
  const queries = analyzeSourceIntegerRanges({ ast: source.ast, navigation: source.navigation,
    sourceFiles: source.navigation.sourceFiles, isNumber: () => false });
  assert.equal(queries.exactInt32Remainders.length, 0);
});
