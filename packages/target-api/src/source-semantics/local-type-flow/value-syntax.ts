import type { AstReader, Node } from "@tsonic/tsts";
import { isTypeSyntaxNode } from "../../source-navigation/syntax.js";

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
