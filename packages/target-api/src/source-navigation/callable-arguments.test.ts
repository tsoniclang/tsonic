import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import type { Node } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../source-semantics/target-source-program.js";
import { sourceClosedCallableArguments, sourceExpressionCallArgument } from "./callable-arguments.js";

function fixture(body: string, inline = false) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/index.ts": `export {};
declare function consume(callback: (value: unknown) => void): void;
${body}`,
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics.filter(diagnostic => diagnostic !== undefined)));
  const source = createTargetSourceProgram(checked);
  let expression: Node | undefined;
  const file = checked.getSourceFile("/src/index.ts");
  assert.ok(file);
  const visit = (node: Node): void => {
    if (inline && (source.ast.is.IsArrowFunction(node) || source.ast.is.IsFunctionExpression(node))) expression = node;
    if (source.ast.is.IsVariableDeclaration(node) && source.ast.text(source.ast.name(node)) === "callback") {
      expression = source.ast.as.AsVariableDeclaration(node)?.Initializer;
    }
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file);
  assert.ok(expression);
  return { source, expression: expression!, select: () => sourceClosedCallableArguments(expression!, source) };
}

test("closed callable arguments preserve exact checked calls through stable aliases and grouping", () => {
  const current = fixture(`const callback = (value: unknown): void => {};
const alias = callback;
consume((((alias))));
consume(callback satisfies typeof callback);`);
  const selected = current.select();
  assert.equal(selected?.length, 2);
  assert.equal(Object.isFrozen(selected), true);
  for (const item of selected ?? []) {
    assert.equal(Object.isFrozen(item), true);
    const call = current.source.semantics.forNode(item.call).operations.call(item.call);
    assert.equal(call?.sourceArguments[item.argumentIndex]?.expression === item.argument, true);
    assert.equal(item.argumentIndex, 0);
  }
});

test("closed callable arguments reject every unproven transport or mutable alias", () => {
  for (const body of [
    "let callback = (value: unknown): void => {}; consume(callback);",
    "const callback = (value: unknown): void => {}; let alias = callback; consume(alias);",
    "export const callback = (value: unknown): void => {}; consume(callback);",
    "const callback = (value: unknown): void => {}; function escape() { return callback; } consume(callback);",
    "const callback = (value: unknown): void => {}; const holder = { callback }; consume(callback);",
    "const callback = (value: unknown): void => {}; const same = callback === callback; consume(callback);",
    "const callback = (value: unknown): void => {}; callback(3); consume(callback);",
    "const callback = (value: unknown): void => {}; consume(callback as typeof callback);",
    "const callback = (value: unknown): void => {}; consume(callback!);",
    "const callback = (value: unknown): void => {}; const alias: typeof callback = callback; consume(alias);",
    "const callback = function recurse(value: unknown): void { recurse(value); }; consume(callback);",
    "start(); const callback = (value: unknown): void => {}; function start() { consume(callback); }",
  ]) assert.equal(fixture(body).select() === undefined, true, body);
});

test("closed callable argument accounting rejects an excessive alias closure", () => {
  const bindings = ["const callback = (value: unknown): void => {};"];
  for (let index = 0; index < 1_024; index += 1) bindings.push(`const alias${index} = ${index === 0 ? "callback" : `alias${index - 1}`};`);
  assert.equal(fixture(bindings.join("\n") + "\nconsume(alias1023);").select() === undefined, true);
});

test("checked call arguments are selected independently of closed callable ABI eligibility", () => {
  for (const body of [
    "consume((value: unknown): void => {});",
    "consume((((value: unknown): void => {})));",
    "consume(((value: unknown): void => {}) satisfies ((value: unknown) => void));",
    "consume(function recurse(value: unknown): void { if (value !== undefined) recurse(undefined); });",
    "consume(function self(value: unknown): void { const alias = self; if (alias !== self) throw value; });",
  ]) {
    const current = fixture(body, true);
    const flow = current.source.navigation.expressionValueFlow(current.expression);
    assert.equal(flow.aliasDeclarations.length, 0, body);
    assert.equal(flow.uses.length, 1, body);
    const selected = sourceExpressionCallArgument(flow.uses[0]!.reference, current.source);
    assert.equal(selected !== undefined, true, body);
    assert.equal(selected!.argumentIndex, 0, body);
    assert.equal(current.source.semantics.forNode(selected!.call).operations.call(selected!.call)
      ?.sourceArguments[0]?.expression === selected!.argument, true, body);
    assert.equal(Object.isFrozen(selected), true, body);
    assert.equal(current.select() === undefined, true, "direct and named callbacks do not close their ABI through this fact");
  }
});

test("checked argument selection does not authorize mutable or named callable ABI transport", () => {
  for (const body of [
    "let callback = (value: unknown): void => {}; consume(callback);",
    "const callback = function recurse(value: unknown): void { if (value !== undefined) recurse(undefined); }; consume(callback);",
  ]) {
    const current = fixture(body);
    const arguments_ = current.source.navigation.expressionValueFlow(current.expression).uses.filter(use => use.role === "argument");
    assert.equal(arguments_.length, 1, body);
    assert.equal(sourceExpressionCallArgument(arguments_[0]!.reference, current.source) !== undefined, true, body);
    assert.equal(current.select() === undefined, true, body);
  }
});

test("checked argument selection rejects nontransparent, optional, spread and unchecked references", () => {
  for (const body of [
    "const callback = (value: unknown): void => {}; consume?.(callback);",
    "const callback = (value: unknown): void => {}; consume(callback as typeof callback);",
    "const callback = (value: unknown): void => {}; consume(callback!);",
    "const callback = (value: unknown): void => {}; consume(...[callback]);",
    "const callback = (value: unknown): void => {}; callback(1);",
  ]) {
    const current = fixture(body);
    const uses = current.source.navigation.expressionValueFlow(current.expression).uses;
    assert.equal(uses.length > 0, true, body);
    for (const use of uses) {
      if (use.role === "storage") continue;
      assert.equal(sourceExpressionCallArgument(use.reference, current.source) === undefined, true, body);
    }
  }
  const current = fixture("consume((value: unknown): void => {});", true);
  const reference = current.source.navigation.expressionValueFlow(current.expression).uses[0]!.reference;
  for (const checked of [undefined, { sourceArguments: [{ expression: {} }] }]) {
    const source = { ...current.source, semantics: { ...current.source.semantics, forNode: () => ({
      operations: { call: () => checked },
    }) } } as unknown as typeof current.source;
    assert.equal(sourceExpressionCallArgument(reference, source) === undefined, true, "exact checked argument required");
  }
});

test("checked argument selection retains bounded grouping and exact call indexes", () => {
  const indexed = fixture(`declare function pair(prefix: string, callback: (value: unknown) => void): void;
    pair("prefix", (value: unknown): void => {});`, true);
  const selected = sourceExpressionCallArgument(indexed.expression, indexed.source);
  assert.equal(selected !== undefined, true, "exact second argument");
  assert.equal(selected!.argumentIndex, 1, "no assumed first-argument position");
  assert.equal(indexed.source.semantics.forNode(selected!.call).operations.call(selected!.call)
    ?.sourceArguments[1]?.expression === selected!.argument, true, "exact checked second-argument identity");
  const duplicated = { ...indexed.source, ast: { ...indexed.source.ast,
    arguments: (node: Node | undefined) => node === selected!.call ? [indexed.expression, indexed.expression] : indexed.source.ast.arguments(node),
  } };
  assert.equal(sourceExpressionCallArgument(indexed.expression, duplicated) === undefined, true, "unique AST argument position");
  const current = fixture("consume(" + "(".repeat(257) + "(value: unknown): void => {}" + ")".repeat(257) + ");", true);
  const reference = current.source.navigation.expressionValueFlow(current.expression).uses[0]!.reference;
  assert.equal(sourceExpressionCallArgument(reference, current.source) === undefined, true, "bounded parent traversal");
});
