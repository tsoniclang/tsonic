import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import type { Node } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../source-semantics/target-source-program.js";
import { sourceClosedCallableArguments } from "./callable-arguments.js";

function fixture(body: string) {
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
    if (source.ast.is.IsVariableDeclaration(node) && source.ast.text(source.ast.name(node)) === "callback") {
      expression = source.ast.as.AsVariableDeclaration(node)?.Initializer;
    }
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file);
  assert.ok(expression);
  return { source, select: () => sourceClosedCallableArguments(expression!, source) };
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
