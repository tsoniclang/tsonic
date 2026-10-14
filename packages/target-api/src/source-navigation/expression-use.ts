import type { AstReader, Node } from "@tsonic/tsts";
import { sourceNodesEqual } from "./identity.js";

export function sourceExpressionSelectsOperandValue(ast: AstReader, expression: Node, operand: Node): boolean {
  if (ast.is.IsConditionalExpression(expression)) {
    const conditional = ast.as.AsConditionalExpression(expression);
    return sourceNodesEqual(ast, conditional?.WhenTrue, operand) ||
      sourceNodesEqual(ast, conditional?.WhenFalse, operand);
  }
  if (!ast.is.IsBinaryExpression(expression)) return false;
  const binary = ast.as.AsBinaryExpression(expression);
  const operator = ast.operatorKindName(expression);
  if (operator === "KindCommaToken") return sourceNodesEqual(ast, binary?.Right, operand);
  return (operator === "KindQuestionQuestionToken" || operator === "KindAmpersandAmpersandToken" ||
    operator === "KindBarBarToken") &&
    (sourceNodesEqual(ast, binary?.Left, operand) || sourceNodesEqual(ast, binary?.Right, operand));
}

export type SourceExpressionResultDisposition =
  | { readonly kind: "discarded"; readonly use: Node }
  | { readonly kind: "stored"; readonly use: Node }
  | { readonly kind: "returned"; readonly use: Node }
  | { readonly kind: "consumed"; readonly use: Node }
  | { readonly kind: "awaited-in-scope"; readonly use: Node; readonly completionReturned: boolean }
  | { readonly kind: "passed"; readonly use: Node; readonly invocation: Node; readonly argument: Node };

export function sourceExpressionResultDisposition(
  ast: AstReader,
  expression: Node,
): SourceExpressionResultDisposition {
  let current = expression;
  const visited = new Set<Node>();
  for (;;) {
    if (visited.has(current) || visited.size >= 262_144) {
      throw new Error("Expression result use exceeded its finite acyclic source boundary.");
    }
    visited.add(current);
    const parent = ast.parent(current);
    if (parent === undefined) {
      return Object.freeze({ kind: "consumed", use: current });
    }
    if (transparentResultParent(ast, parent, current)) {
      current = parent;
      continue;
    }
    if (ast.is.IsExpressionStatement(parent)) {
      return Object.freeze({ kind: sourceNodesEqual(ast,
        ast.as.AsExpressionStatement(parent)?.Expression, current) ? "discarded" : "consumed", use: parent });
    }
    if (ast.is.IsVoidExpression(parent)) {
      return Object.freeze({ kind: sourceNodesEqual(ast,
        ast.as.AsVoidExpression(parent)?.Expression, current) ? "discarded" : "consumed", use: parent });
    }
    if (ast.is.IsAwaitExpression(parent) &&
      sourceNodesEqual(ast, ast.as.AsAwaitExpression(parent)?.Expression, current)) {
      let completion = parent;
      while (true) {
        const owner = ast.parent(completion);
        if (owner === undefined || !transparentResultParent(ast, owner, completion)) break;
        if (visited.has(owner) || visited.size >= 262_144) {
          throw new Error("Expression result use exceeded its finite acyclic source boundary.");
        }
        visited.add(owner);
        completion = owner;
      }
      const owner = ast.parent(completion);
      return Object.freeze({ kind: "awaited-in-scope", use: parent,
        completionReturned: owner !== undefined && ast.is.IsReturnStatement(owner) &&
          sourceNodesEqual(ast, ast.as.AsReturnStatement(owner)?.Expression, completion) });
    }
    if (ast.is.IsReturnStatement(parent) &&
      sourceNodesEqual(ast, ast.as.AsReturnStatement(parent)?.Expression, current) ||
      ast.is.IsArrowFunction(parent) && sourceNodesEqual(ast, ast.body(parent), current)) {
      return Object.freeze({ kind: "returned", use: parent });
    }
    if (ast.is.IsVariableDeclaration(parent) &&
      sourceNodesEqual(ast, ast.as.AsVariableDeclaration(parent)?.Initializer, current) ||
      ast.is.IsPropertyDeclaration(parent) &&
      sourceNodesEqual(ast, ast.as.AsPropertyDeclaration(parent)?.Initializer, current) ||
      ast.is.IsPropertyAssignment(parent) &&
      sourceNodesEqual(ast, ast.as.AsPropertyAssignment(parent)?.Initializer, current) ||
      ast.is.IsBindingElement(parent) &&
      sourceNodesEqual(ast, ast.as.AsBindingElement(parent)?.Initializer, current) ||
      ast.is.IsArrayLiteralExpression(parent) || ast.is.IsSpreadElement(parent) ||
      ast.is.IsSpreadAssignment(parent) || ast.is.IsYieldExpression(parent) || ast.is.IsExportAssignment(parent)) {
      return Object.freeze({ kind: "stored", use: parent });
    }
    if ((ast.is.IsCallExpression(parent) || ast.is.IsNewExpression(parent)) &&
      ast.arguments(parent).some(argument => sourceNodesEqual(ast, argument, current))) {
      return Object.freeze({ kind: "passed", use: parent, invocation: parent, argument: current });
    }
    if (ast.is.IsConditionalExpression(parent) && sourceExpressionSelectsOperandValue(ast, parent, current)) {
      current = parent;
      continue;
    }
    if (ast.is.IsBinaryExpression(parent)) {
      const binary = ast.as.AsBinaryExpression(parent);
      const operator = ast.operatorKindName(parent);
      if (operator === "KindEqualsToken" && sourceNodesEqual(ast, binary?.Right, current)) {
        return Object.freeze({ kind: "stored", use: parent });
      }
      if (operator === "KindCommaToken" && sourceNodesEqual(ast, binary?.Left, current)) {
        return Object.freeze({ kind: "discarded", use: parent });
      }
      if ((operator === "KindCommaToken" || operator === "KindQuestionQuestionToken" ||
        operator === "KindAmpersandAmpersandToken" || operator === "KindBarBarToken") &&
        sourceNodesEqual(ast, binary?.Right, current) || operator === "KindQuestionQuestionToken" &&
        sourceNodesEqual(ast, binary?.Left, current)) {
        current = parent;
        continue;
      }
      return Object.freeze({ kind: "consumed", use: parent });
    }
    if (ast.is.IsForStatement(parent)) {
      const statement = ast.as.AsForStatement(parent);
      return Object.freeze({ kind: sourceNodesEqual(ast, statement?.Initializer, current) ||
        sourceNodesEqual(ast, statement?.Incrementor, current) ? "discarded" : "consumed", use: parent });
    }
    return Object.freeze({ kind: "consumed", use: parent });
  }
}

export function sourceExpressionResultUse(ast: AstReader, expression: Node): "consumed" | "discarded" {
  return sourceExpressionResultDisposition(ast, expression).kind === "discarded" ? "discarded" : "consumed";
}

function transparentResultParent(ast: AstReader, parent: Node, child: Node): boolean {
  if (ast.is.IsParenthesizedExpression(parent)) return sourceNodesEqual(ast, ast.as.AsParenthesizedExpression(parent)?.Expression, child);
  if (ast.is.IsAsExpression(parent)) return sourceNodesEqual(ast, ast.as.AsAsExpression(parent)?.Expression, child);
  if (ast.is.IsTypeAssertion(parent)) return sourceNodesEqual(ast, ast.as.AsTypeAssertion(parent)?.Expression, child);
  if (ast.is.IsSatisfiesExpression(parent)) return sourceNodesEqual(ast, ast.as.AsSatisfiesExpression(parent)?.Expression, child);
  return ast.is.IsNonNullExpression(parent) && sourceNodesEqual(ast, ast.as.AsNonNullExpression(parent)?.Expression, child);
}

export function sourceCallableDefinitionIsDiscarded(declaration: Node, ast: AstReader): boolean {
  const visited = new Set<Node>();
  for (let current: Node | undefined = declaration; current !== undefined; current = ast.parent(current)) {
    if (visited.has(current) || visited.size >= 262_144) {
      throw new Error("Callable creation demand exceeded its finite acyclic source boundary.");
    }
    visited.add(current);
    if ((ast.is.IsArrowFunction(current) || ast.is.IsFunctionExpression(current)) &&
      sourceExpressionResultUse(ast, current) === "discarded") return true;
  }
  return false;
}
