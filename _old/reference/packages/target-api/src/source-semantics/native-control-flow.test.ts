import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, type Node } from "@tsonic/tsts";
import { createTargetSourceProgram } from "./target-source-program.js";
import { selectSourceNativeValueGuard } from "./native-value-guards.js";
import { selectSourceNativeGuardResult } from "./value-flow-conditions.js";
import { sourceNodeIsNativeUnreachable } from "./native-control-flow.js";

function fixture(body: string) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/index.ts": `declare function observe(value: unknown): void;
      function run(value: string | number | null | undefined, other: string | number, flag: boolean): void { ${body} }`,
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.deepEqual(checked.diagnostics, []);
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  assert.ok(file);
  const conditions: Node[] = [];
  const observations: Node[] = [];
  const visit = (node: Node): void => {
    const condition = source.ast.is.IsIfStatement(node) ? source.ast.as.AsIfStatement(node)?.Expression : undefined;
    if (condition !== undefined) conditions.push(condition);
    const callee = source.ast.is.IsCallExpression(node) ? source.ast.as.AsCallExpression(node)?.Expression : undefined;
    if (callee !== undefined && source.ast.is.IsIdentifier(callee) && source.ast.text(callee) === "observe") {
      observations.push(node);
    }
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file);
  const context = { ast: source.ast, navigation: source.navigation, sourceFacts: source.sourceFacts,
    semanticsFor: (node: Node) => source.semantics.forNode(node) };
  const result = (expression: Node, members: readonly string[] = ["string", "absence"]) =>
    selectSourceNativeGuardResult(context, expression, () => members, selected => {
      const guard = selectSourceNativeValueGuard(context, selected);
      return guard?.kind === "absence" || guard?.kind === "typeof"
        ? { sourceOperand: guard.sourceOperand, predicate: guard } : undefined;
    }, (member, predicate) => member === "unknown" ? undefined
      : (predicate.kind === "absence" ? member === "absence"
        : (member === "absence" ? "object" : member) === predicate.value) !== predicate.negated);
  return { source, file, conditions, observations, result };
}

test("native guard results use selected carriers and dominating early exits, not checker never", () => {
  const current = fixture('if (value === undefined) return; if (typeof value === "string") return; if (typeof value === "number") observe(value); observe(value);');
  assert.deepEqual(current.conditions.map(expression => current.result(expression)), [undefined, true, undefined]);
  assert.deepEqual(current.observations.map(node => sourceNodeIsNativeUnreachable(current.source.ast, node, current.result)), [true, true]);
});

test("native absence is one state even when source checking distinguishes null and undefined", () => {
  const current = fixture('if (value === undefined) { if (value === null) observe(value); }');
  assert.equal(current.result(current.conditions[1]!), true);
  assert.equal(sourceNodeIsNativeUnreachable(current.source.ast, current.observations[0]!, current.result), false);
});

test("native reachability retains uncertain arms and does not erase effectful guard operands", () => {
  for (const body of [
    'if (typeof other === "string") observe(value);',
    'if (typeof ({ get value() { observe(value); return value; } }).value === "string") observe(value);',
    'if (typeof (() => { observe(value); return value; })() === "string") observe(value);',
    'if (flag) { if (typeof value === "string") return; } observe(value);',
    'if (typeof value === "string" && flag) return; observe(value);',
  ]) {
    const current = fixture(body);
    const condition = current.conditions[0]!;
    const result = (expression: Node) => current.result(expression, ["string", "number", "absence", "unknown"]);
    assert.equal(result(condition), undefined, body);
    assert.ok(current.observations.every(node => !sourceNodeIsNativeUnreachable(current.source.ast, node, result)), body);
  }
});

test("native guard proof respects intervening writes and captured mutation", () => {
  for (const body of [
    'if (typeof value === "string") { value = other; if (typeof value === "string") observe(value); }',
    'if (typeof value === "string") { const change = () => { value = other; }; change(); if (typeof value === "string") observe(value); }',
  ]) {
    const current = fixture(body);
    assert.equal(current.result(current.conditions[1]!, ["string", "number", "absence"]), undefined, body);
  }
});

test("native path selection handles opposite branches, block exits, negation and nested callables", () => {
  const current = fixture('if (!(typeof value !== "string")) { { return; } } else { observe(value); } observe(value);');
  assert.deepEqual(current.observations.map(node => sourceNodeIsNativeUnreachable(current.source.ast, node,
    expression => current.result(expression, ["string"]))), [true, true]);
  const nested = fixture('if (typeof value === "string") return; const nested = () => { observe(value); };');
  assert.equal(sourceNodeIsNativeUnreachable(nested.source.ast, nested.observations[0]!,
    expression => nested.result(expression, ["string"])), false);
});

test("native path accounting fails closed and preserves loop or try uncertainty", () => {
  for (const body of [
    'while (flag) { return; } observe(value);',
    'try { return; } finally { observe(value); }',
    `${";".repeat(2_100)} if (typeof value === "string") return; observe(value);`,
  ]) {
    const current = fixture(body);
    assert.ok(current.observations.every(node => !sourceNodeIsNativeUnreachable(current.source.ast, node,
      expression => current.result(expression, ["string"]))), body);
  }
});

test("hoisted lexical declarations are not unreachable execution after an exit", () => {
  const current = fixture('observe(read()); return; function read(): number { observe(value); return 3; } observe(value);');
  const declarations: Node[] = [];
  const visit = (node: Node): void => {
    if (current.source.ast.is.IsFunctionDeclaration(node) &&
      current.source.ast.text(current.source.ast.name(node)) === "read") declarations.push(node);
    current.source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(current.file);
  assert.equal(declarations.length, 1);
  assert.equal(sourceNodeIsNativeUnreachable(current.source.ast, declarations[0]!, current.result), false);
  assert.deepEqual(current.observations.map(node => sourceNodeIsNativeUnreachable(current.source.ast, node,
    current.result)), [false, false, true]);
});
