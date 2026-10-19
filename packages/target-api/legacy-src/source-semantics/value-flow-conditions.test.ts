import assert from "node:assert/strict";
import test from "node:test";
import { argumentPassingFactKey, pointerOperationFactKey, createCompilerSessionFromFiles, type Node, type ReadonlySourceFactResolver } from "@tsonic/tsts";
import { createTargetSourceProgram } from "./target-source-program.js";
import { selectSourceGuardedValueMembers, type SourceNativeGuard } from "./value-flow-conditions.js";

function fixture(body: string) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": `
    declare function isArray(value: unknown): boolean;
    declare function isRecord(value: unknown): boolean;
    declare function observe(value: unknown): void;
    declare function consume(value: unknown): void;
    function run(value: unknown, other: unknown, flag: boolean): void { ${body} }
  ` }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.deepEqual(checked.diagnostics, []);
  assert.deepEqual(checked.extensionDiagnostics, []);
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  assert.ok(file);
  const reads: Node[] = [];
  const calls: Node[] = [];
  const visit = (node: Node): void => {
    if (source.ast.is.IsCallExpression(node)) {
      calls.push(node);
      const call = source.semantics.forNode(node).operations.call(node);
      if (source.ast.text(call?.sourceCallee.expression) === "observe") {
        assert.ok(call?.sourceArguments[0]);
        reads.push(call.sourceArguments[0].expression);
      }
    }
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file);
  const guard = (expression: Node): SourceNativeGuard<"array" | "record"> | undefined => {
    const call = source.semantics.forNode(expression).operations.call(expression);
    const argument = call?.sourceArguments[0];
    const name = source.ast.text(call?.sourceCallee.expression);
    return call === undefined || argument === undefined || name !== "isArray" && name !== "isRecord"
      ? undefined : { sourceOperand: argument.expression, predicate: name === "isArray" ? "array" : "record" };
  };
  const select = (members: readonly string[] = ["array", "record"], sourceFacts?: ReadonlySourceFactResolver) => reads.map(reference =>
    selectSourceGuardedValueMembers({ ast: source.ast, navigation: source.navigation,
      sourceFacts: sourceFacts ?? source.sourceFacts, semanticsFor: node => source.semantics.forNode(node) },
    reference, members, guard, (member, predicate) => member === "unknown" ? undefined : member === predicate));
  return { source, reads, calls, select, guard };
}

test("native flow selection retains original members through branches, negation and early returns", () => {
  for (const body of [
    "if (isArray(value)) { observe(value); return; } observe(value);",
    "if (!isArray(value)) { observe(value); return; } observe(value);",
    "isArray(value) ? observe(value) : observe(value);",
  ]) {
    const current = fixture(body);
    const expected = body.includes("!isArray") ? [["record"], ["array"]] : [["array"], ["record"]];
    const selected = current.select();
    assert.deepEqual(selected, expected, body);
    assert.ok(selected.every(Object.isFrozen));
    assert.deepEqual(current.select(["record", "array"]), expected, body);
  }
});

test("native flow evidence retains unknown members instead of guessing a backing arm", () => {
  const current = fixture("if (isArray(value)) { observe(value); return; } observe(value);");
  assert.deepEqual(current.select(["array", "record", "unknown"]), [["array", "unknown"], ["record", "unknown"]]);
});

test("uncaptured bindings retain call-bearing disjunctions and their complete native subsets", () => {
  for (const body of [
    "if (isArray(value) || isArray(value)) observe(value);",
    "if (!(isArray(value) || isArray(value))) return; observe(value);",
    "if (!(isArray(value) || isArray(value))) { value = other; return; } observe(value);",
    "if (isArray(value) || isArray(value)) { consume(other); } else { throw other; } observe(value);",
    "(isArray(value) || isArray(value)) ? observe(value) : consume(other);",
    "if (isArray(value) || isArray(value)) { consume(other); observe(value); }",
  ]) assert.deepEqual(fixture(body).select(), [["array"]], body);
  const current = fixture("if (isArray(value) || isRecord(value)) observe(value);");
  assert.deepEqual(current.select(["array", "record", "other", "unknown"]), [["array", "record", "unknown"]]);
});

test("lexical disjunction evidence rejects exact rebinding in the condition and evaluation interval", () => {
  for (const body of [
    "if (isArray(value) || (value = other, isArray(value))) observe(value);",
    "if (isArray(value) || isArray(value)) { value = other; observe(value); }",
    "if (isArray(value) || isArray(value)) { [value] = [other]; observe(value); }",
    "if (isArray(value) || isArray(value)) { const change = () => { value = other; }; change(); observe(value); }",
    "if (isArray(value) || isArray(value)) observe((value = other, value));",
    "if (!(isArray(value) || isArray(value))) return; value = other; observe(value);",
    "if (!(isArray(value) || isArray(value))) return; const change = () => { value = other; }; change(); observe(value);",
    "if (!(isArray(value) || isArray(value))) return; else value = other; observe(value);",
  ]) assert.deepEqual(fixture(body).select(), [undefined], body);
});

test("native flow selection rejects non-dominating and foreign-operand conditions", () => {
  for (const body of [
    "if (isArray(value) && flag) return; observe(value);",
    "if (flag) { if (isArray(value)) return; } observe(value);",
    "if (isArray(other)) observe(value);",
    "if (isArray(value)) { const value = other; observe(value); }",
  ]) assert.deepEqual(fixture(body).select(), [undefined], body);
});

test("native flow selection invalidates intervening writes but not unrelated or later writes", () => {
  assert.deepEqual(fixture("if (isArray(value)) { value = other; observe(value); }").select(), [undefined]);
  assert.deepEqual(fixture("if (isArray(value)) { other = 1; observe(value); value = other; }").select(), [["array"]]);
  assert.deepEqual(fixture("value = other; if (isArray(value)) observe(value);").select(), [["array"]]);
  assert.deepEqual(fixture("if (isArray(value)) { const change = () => { value = other; }; change(); observe(value); }").select(), [undefined]);
});

test("native flow selection preserves original checked loop and finally conditions", () => {
  for (const body of [
    "while (isArray(value)) { observe(value); break; }",
    "if (isArray(value)) { try { consume(other); } finally { observe(value); } }",
  ]) assert.deepEqual(fixture(body).select(), [["array"]], body);
});

test("native flow selection rejects mutable passing and address exposure through canonical facts", () => {
  const current = fixture("if (isArray(value)) { consume(value); observe(value); }");
  const call = current.calls.find(node => current.source.ast.text(current.source.semantics.forNode(node).operations.call(node)?.sourceCallee.expression) === "consume");
  assert.ok(call);
  for (const mode of ["by-value", "borrow-shared", "byref-readonly", "borrow-mut", "byref", "out"] as const) {
    const sourceFacts = { getFact(subject: Node, key: unknown) {
      return subject === call && key === argumentPassingFactKey ? { mode } : undefined;
    } } as unknown as ReadonlySourceFactResolver;
    assert.deepEqual(current.select(undefined, sourceFacts),
      [mode === "by-value" || mode === "borrow-shared" || mode === "byref-readonly" ? ["array"] : undefined], mode);
  }
  const sourceFacts = { getFact(subject: Node, key: unknown) {
    return subject === call && key === pointerOperationFactKey ? { operation: "address-of" } : undefined;
  } } as unknown as ReadonlySourceFactResolver;
  assert.deepEqual(current.select(undefined, sourceFacts), [undefined]);
});

test("native flow selection rejects exhausted accounting without changing checked provenance", () => {
  const current = fixture(`if (isArray(value)) { ${"consume(value);".repeat(1_000)} observe(value); }`);
  assert.deepEqual(current.select(), [undefined]);
  const flow = current.source.semantics.forNode(current.reads[0]!).operations.flowConditions(current.reads[0]!);
  assert.ok(flow?.conditions.length === 1 && Object.isFrozen(flow));
});
