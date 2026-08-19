import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceExpressionEffects } from "./types.js";

const assignmentOperators = new Set([
  "KindEqualsToken",
  "KindPlusEqualsToken",
  "KindMinusEqualsToken",
  "KindAsteriskEqualsToken",
  "KindAsteriskAsteriskEqualsToken",
  "KindSlashEqualsToken",
  "KindPercentEqualsToken",
  "KindLessThanLessThanEqualsToken",
  "KindGreaterThanGreaterThanEqualsToken",
  "KindGreaterThanGreaterThanGreaterThanEqualsToken",
  "KindAmpersandEqualsToken",
  "KindBarEqualsToken",
  "KindCaretEqualsToken",
  "KindBarBarEqualsToken",
  "KindAmpersandAmpersandEqualsToken",
  "KindQuestionQuestionEqualsToken",
]);

const functionKinds = new Set([
  "KindArrowFunction",
  "KindFunctionExpression",
  "KindFunctionDeclaration",
  "KindMethodDeclaration",
  "KindGetAccessor",
  "KindSetAccessor",
  "KindConstructor",
]);

export function sourceExpressionEffects(
  ast: AstReader,
  expression: Node,
): SourceExpressionEffects {
  let invokes = false;
  let mutates = false;
  let suspends = false;
  let mayThrow = false;
  const visit = (node: Node | undefined, root: boolean): void => {
    if (node === undefined) {
      return;
    }
    const kind = ast.kindName(node);
    if (!root && functionKinds.has(kind ?? "")) {
      return;
    }
    if (ast.is.IsCallExpression(node) || ast.is.IsNewExpression(node) ||
      kind === "KindTaggedTemplateExpression") {
      invokes = true;
      mayThrow = true;
    }
    if (ast.is.IsPropertyAccessExpression(node) || ast.is.IsElementAccessExpression(node)) {
      invokes = true;
      mayThrow = true;
    }
    if (ast.is.IsBinaryExpression(node) &&
      assignmentOperators.has(ast.operatorKindName(node) ?? "")) {
      mutates = true;
      mayThrow = true;
    }
    if (ast.is.IsPrefixUnaryExpression(node) || ast.is.IsPostfixUnaryExpression(node)) {
      const operator = ast.operatorKindName(node);
      if (operator === "KindPlusPlusToken" || operator === "KindMinusMinusToken") {
        mutates = true;
        mayThrow = true;
      }
    }
    if (ast.is.IsDeleteExpression(node)) {
      mutates = true;
      mayThrow = true;
    }
    if (ast.is.IsAwaitExpression(node) || ast.is.IsYieldExpression(node)) {
      suspends = true;
      mayThrow = true;
    }
    ast.forEachChild(node, (child) => visit(child, false));
  };
  visit(expression, true);
  return Object.freeze({ invokes, mutates, suspends, mayThrow });
}
