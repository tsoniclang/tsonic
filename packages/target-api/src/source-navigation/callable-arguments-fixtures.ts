import assert from "node:assert/strict";

import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";

import type { Node } from "@tsonic/tsts";

import { createTargetSourceProgram } from "../source-semantics/target-source-program.js";

import { sourceExpressionCallArgument, type SourceClosedCallableArgument } from "./callable-arguments.js";
import { Node_Expression } from "./ast.js";

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
  const declarations = new Map<string, Node>();
  const calls: Node[] = [];
  const file = checked.getSourceFile("/src/index.ts");
  assert.ok(file);
  const visit = (node: Node): void => {
    if (source.ast.is.IsFunctionDeclaration(node) || source.ast.is.IsVariableDeclaration(node)) {
      const name = source.ast.name(node);
      if (name !== undefined) declarations.set(source.ast.text(name), node);
    }
    if (source.ast.is.IsCallExpression(node) || source.ast.is.IsNewExpression(node)) calls.push(node);
    if (inline && (source.ast.is.IsArrowFunction(node) || source.ast.is.IsFunctionExpression(node))) expression = node;
    if (source.ast.is.IsVariableDeclaration(node) && source.ast.text(source.ast.name(node)) === "callback") {
      expression = source.ast.as.AsVariableDeclaration(node)?.Initializer;
    }
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file);
  assert.ok(expression);
  const nativeDeclarations = new Set([declarations.get("consume"), declarations.get("construct")]);
  const directCalls = calls.filter(call => {
    const callee = Node_Expression(source.ast, call);
    const declaration = callee === undefined ? undefined : source.navigation.sourceReferenceFor(callee)?.declaration;
    return declaration !== undefined && nativeDeclarations.has(declaration);
  });
  return { source, expression: expression!, declarations, select() {
    const selected: SourceClosedCallableArgument[] = [];
    for (const call of directCalls) {
      let reference = source.ast.arguments(call)[0];
      for (let depth = 0; reference !== undefined; depth += 1) {
        const wrapped = source.ast.is.IsParenthesizedExpression(reference) || source.ast.is.IsSatisfiesExpression(reference) ||
          source.ast.is.IsAsExpression(reference) || source.ast.is.IsNonNullExpression(reference) || source.ast.is.IsSpreadElement(reference);
        if (!wrapped) break;
        if (depth >= 256) return undefined;
        reference = Node_Expression(source.ast, reference);
      }
      const argument = reference === undefined ? undefined : sourceExpressionCallArgument(reference, source);
      if (argument === undefined || argument.call !== call) return undefined;
      selected.push(argument);
    }
    return selected.length === 0 ? undefined : Object.freeze(selected);
  } };
}

export { fixture };
