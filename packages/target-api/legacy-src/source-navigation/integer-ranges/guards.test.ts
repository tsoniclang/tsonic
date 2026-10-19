import assert from "node:assert/strict";
import test from "node:test";
import { argumentPassingFactKey, createCompilerSessionFromFiles, pointerOperationFactKey } from "@tsonic/tsts";
import type { Node, ReadonlySourceFactResolver } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../source-semantics/target-source-program.js";
import { sourceIntegerIsNonnegative } from "./guards.js";

function fixture(body: string) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/index.ts": `function consume(value: number): void {} function probe(value: number, flag: boolean): number { ${body} }`,
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.deepEqual(checked.diagnostics, []);
  const source = createTargetSourceProgram(checked);
  const occurrences: Node[] = [];
  const calls: Node[] = [];
  const visit = (node: Node): void => {
    if (source.ast.is.IsReturnStatement(node)) {
      const expression = source.ast.as.AsReturnStatement(node)?.Expression;
      if (expression !== undefined && source.ast.is.IsIdentifier(expression) && source.ast.text(expression) === "value") occurrences.push(expression);
    }
    if (source.ast.is.IsCallExpression(node)) calls.push(node);
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  source.navigation.sourceFiles.filter(file => source.ast.getFileName(file) === "/src/index.ts").forEach(visit);
  return { source, occurrences, calls, proved(sourceFacts?: ReadonlySourceFactResolver) {
    return occurrences.map(expression => sourceIntegerIsNonnegative({ ast: source.ast,
      navigation: source.navigation, sourceFacts }, expression));
  } };
}

test("integer guards are occurrence-specific, exact and dominate the continuing branch", () => {
  const positive = [
    "if (value < 0) return -1; return value;",
    "if (0 > value) throw new Error(); return value;",
    "if (value <= -1) return -1; return value;",
    "if (value >= 0) { return value; } return -1;",
    "if (!(value < 0)) return value; return -1;",
    "if (value < 0 || flag) return -1; return value;",
    "if (flag && value >= 0) return value; return -1;",
    "if (value !== 0) return -1; return value;",
    "if (value > 9007199254740993) return value; return -1;",
    "if (value < 0) { if (flag) return -1; else throw new Error(); } return value;",
    "if (value < 0) return -1; { consume(value); return value; }",
  ];
  for (const body of positive) assert.deepEqual(fixture(body).proved(), [true], body);
  assert.deepEqual(fixture("if (value >= 0) return value; else return value;").proved(), [true, false]);
});

test("guard proofs reject unrelated bindings, writes, captures and uncertain control flow", () => {
  const negative = [
    "return value;",
    "if (value < -1) return -1; return value;",
    "if (value <= 0) return value; return -1;",
    "if (value >= 0 || flag) return value; return -1;",
    "if (value < 0 && flag) return -1; return value;",
    "if (value < 0) { if (flag) return -1; } return value;",
    "if (value < 0) consume(value); return value;",
    "if (value < 0) return -1; value = -3; return value;",
    "if (value < 0) return -1; const change = () => { value = -3; }; change(); return value;",
    "if (value < 0) return -1; { const value = -3; return value; }",
    "if (value >= 0) { const read = () => value; consume(read()); } return value;",
    "if ((value as number) < 0) return -1; return value;",
    "if ((<number>value) >= 0) return value; return -1;",
  ];
  for (const body of negative) assert.deepEqual(fixture(body).proved(), [false], body);
});

test("mutable passing and address exposure invalidate source guards", () => {
  const current = fixture("if (value < 0) return -1; consume(value); return value;");
  const call = current.calls[0]!;
  for (const mode of ["by-value", "byref-readonly", "borrow-shared", "borrow-mut", "byref", "out"] as const) {
    const sourceFacts = { getFact(subject: Node, key: unknown) {
      return subject === call && key === argumentPassingFactKey ? { mode } : undefined;
    } } as unknown as ReadonlySourceFactResolver;
    assert.deepEqual(current.proved(sourceFacts), [mode === "by-value" || mode === "byref-readonly" || mode === "borrow-shared"]);
  }
  const sourceFacts = { getFact(subject: Node, key: unknown) {
    return subject === call && key === pointerOperationFactKey ? { operation: "address-of" } : undefined;
  } } as unknown as ReadonlySourceFactResolver;
  assert.deepEqual(current.proved(sourceFacts), [false]);
});

test("finite proof accounting fails closed", () => {
  assert.deepEqual(fixture(`if (value < 0) return -1; ${"consume(value);".repeat(1_000)} return value;`).proved(), [false]);
});
