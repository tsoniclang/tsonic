import type { AstReader, Node } from "@tsonic/tsts";
import { isTypeSyntaxNode } from "../../source-navigation/syntax.js";
import { Node_Expression, Node_Initializer, sourceTransparentExpressionOperand } from "../../source-navigation/ast.js";
import type { SourceTypeFlowSource } from "./types.js";

const effectSelectionOperators: ReadonlySet<string> = new Set([
  "KindAmpersandAmpersandToken", "KindBarBarToken", "KindQuestionQuestionToken",
]);

const expressions: ReadonlySet<string> = new Set([
  "KindIdentifier", "KindPrivateIdentifier", "KindNumericLiteral", "KindBigIntLiteral", "KindStringLiteral",
  "KindRegularExpressionLiteral", "KindNoSubstitutionTemplateLiteral", "KindTemplateExpression",
  "KindTrueKeyword", "KindFalseKeyword", "KindNullKeyword", "KindThisKeyword", "KindSuperKeyword",
  "KindArrayLiteralExpression", "KindObjectLiteralExpression", "KindPropertyAccessExpression",
  "KindElementAccessExpression", "KindCallExpression", "KindNewExpression", "KindTaggedTemplateExpression",
  "KindTypeAssertionExpression", "KindParenthesizedExpression", "KindFunctionExpression", "KindArrowFunction",
  "KindClassExpression", "KindDeleteExpression", "KindTypeOfExpression", "KindVoidExpression", "KindAwaitExpression",
  "KindPrefixUnaryExpression", "KindPostfixUnaryExpression", "KindBinaryExpression", "KindConditionalExpression",
  "KindYieldExpression", "KindAsExpression", "KindSatisfiesExpression", "KindNonNullExpression", "KindMetaProperty",
]);

export function sourceTypeFlowTypeSyntax(ast: AstReader, node: Node): boolean {
  const parent = ast.parent(node);
  return isTypeSyntaxNode(ast, node) || ast.is.IsTypeLiteralNode(node) || ast.is.IsInterfaceDeclaration(node) ||
    ast.is.IsTypeParameterDeclaration(node) || parent !== undefined && ast.typeNode(parent) === node;
}

export function sourceTypeFlowValueSyntax(ast: AstReader, node: Node): boolean {
  if (!expressions.has(ast.kindName(node))) return false;
  const parent = ast.parent(node);
  if (parent !== undefined && (ast.is.IsImportDeclaration(parent) || ast.is.IsExportDeclaration(parent))) return false;
  if (parent === undefined || ast.name(parent) !== node) return true;
  return ast.is.IsShorthandPropertyAssignment(parent);
}

export function sourceTypeFlowDiscardedSelection(source: SourceTypeFlowSource, node: Node): boolean {
  const { ast } = source;
  const operator = ast.is.IsBinaryExpression(node) ? ast.operatorKindName(node) : undefined;
  return (ast.is.IsConditionalExpression(node) || operator !== undefined &&
    effectSelectionOperators.has(operator)) &&
    source.navigation.expressionResultDisposition(node).kind === "discarded";
}

export function sourceTypeFlowDiscardedValue(source: SourceTypeFlowSource, node: Node): boolean {
  let selected = node;
  for (;;) {
    if (sourceTypeFlowDiscardedSelection(source, selected)) return true;
    const operand = sourceTransparentExpressionOperand(source.ast, selected);
    if (operand === undefined) return false;
    selected = operand;
  }
}

export function sourceTypeFlowAssignmentPattern(ast: AstReader, node: Node): boolean {
  let current = node;
  for (let parent = ast.parent(current); parent !== undefined; parent = ast.parent(current)) {
    if (ast.is.IsBinaryExpression(parent) && ast.operatorKindName(parent) === "KindEqualsToken") {
      return ast.as.AsBinaryExpression(parent)?.Left === current;
    }
    if (ast.is.IsArrayLiteralExpression(parent) || ast.is.IsObjectLiteralExpression(parent) ||
      ast.is.IsPropertyAssignment(parent) && Node_Initializer(ast, parent) === current ||
      (ast.is.IsSpreadElement(parent) || ast.is.IsSpreadAssignment(parent) || ast.is.IsParenthesizedExpression(parent)) &&
        Node_Expression(ast, parent) === current) current = parent;
    else return false;
  }
  return false;
}
