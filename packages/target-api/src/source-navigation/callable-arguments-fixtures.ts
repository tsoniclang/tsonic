import assert from "node:assert/strict";

import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";

import type { Node } from "@tsonic/tsts";

import { createTargetSourceProgram } from "../source-semantics/target-source-program.js";

import { sourceClosedCallableArguments } from "./callable-arguments.js";

function fixture(body: string, inline = false) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/index.ts": `export {};
declare function consume(callback: (value: unknown) => void): void;
declare const construct: new (callback: (value: unknown) => void) => object;
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

export { fixture };
