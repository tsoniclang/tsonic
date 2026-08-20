import type { CheckedSourceProgram, Node, Type } from "@tsonic/tsts";
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

const coerciveBinaryOperators = new Set([
  "KindPlusToken",
  "KindMinusToken",
  "KindAsteriskToken",
  "KindAsteriskAsteriskToken",
  "KindSlashToken",
  "KindPercentToken",
  "KindLessThanLessThanToken",
  "KindGreaterThanGreaterThanToken",
  "KindGreaterThanGreaterThanGreaterThanToken",
  "KindAmpersandToken",
  "KindBarToken",
  "KindCaretToken",
  "KindLessThanToken",
  "KindLessThanEqualsToken",
  "KindGreaterThanToken",
  "KindGreaterThanEqualsToken",
  "KindEqualsEqualsToken",
  "KindExclamationEqualsToken",
  "KindInKeyword",
  "KindInstanceOfKeyword",
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
]);

const coerciveUnaryOperators = new Set([
  "KindPlusToken",
  "KindMinusToken",
  "KindTildeToken",
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
  source: CheckedSourceProgram,
  expression: Node,
): SourceExpressionEffects {
  const { ast } = source;
  let invokes = false;
  let mutates = false;
  let suspends = false;
  let mayThrow = false;
  const visit = (node: Node | undefined): void => {
    if (node === undefined) {
      return;
    }
    const kind = ast.kindName(node);
    if (functionKinds.has(kind ?? "")) {
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
    if (ast.is.IsBinaryExpression(node)) {
      const operator = ast.operatorKindName(node) ?? "";
      if (assignmentOperators.has(operator)) {
        mutates = true;
        mayThrow = true;
      }
      const binary = ast.as.AsBinaryExpression(node);
      if (coerciveBinaryOperators.has(operator) &&
        !operandsAreDefinitelyPrimitive(source, [binary?.Left, binary?.Right])) {
        invokes = true;
        mayThrow = true;
      }
    }
    if (ast.is.IsPrefixUnaryExpression(node) || ast.is.IsPostfixUnaryExpression(node)) {
      const operator = ast.operatorKindName(node);
      if (operator === "KindPlusPlusToken" || operator === "KindMinusMinusToken") {
        mutates = true;
        mayThrow = true;
      }
      const unary = ast.is.IsPrefixUnaryExpression(node)
        ? ast.as.AsPrefixUnaryExpression(node)
        : undefined;
      if (operator !== "KindPlusPlusToken" && operator !== "KindMinusMinusToken" &&
        coerciveUnaryOperators.has(operator ?? "") &&
        !operandsAreDefinitelyPrimitive(source, [unary?.Operand])) {
        invokes = true;
        mayThrow = true;
      }
    }
    if (ast.is.IsSpreadElement(node) || ast.is.IsSpreadAssignment(node) ||
      kind === "KindComputedPropertyName" || kind === "KindTemplateExpression") {
      invokes = true;
      mayThrow = true;
    }
    if (ast.is.IsDeleteExpression(node)) {
      mutates = true;
      mayThrow = true;
    }
    if (ast.is.IsAwaitExpression(node) || ast.is.IsYieldExpression(node)) {
      suspends = true;
      mayThrow = true;
    }
    ast.forEachChild(node, visit);
  };
  visit(expression);
  return Object.freeze({ invokes, mutates, suspends, mayThrow });
}

function operandsAreDefinitelyPrimitive(
  source: CheckedSourceProgram,
  operands: readonly (Node | undefined)[],
): boolean {
  return operands.length > 0 && operands.every((operand) => {
    if (operand === undefined) {
      return false;
    }
    const sourceFile = source.ast.getSourceFile(operand);
    if (sourceFile === undefined) {
      return false;
    }
    const queries = source.getSourceFileQueries(sourceFile);
    const type = queries.checker.getTypeAtLocation(operand);
    return type !== undefined && typeIsDefinitelyPrimitive(type, queries.typeShape);
  });
}

function typeIsDefinitelyPrimitive(
  type: Type,
  types: ReturnType<CheckedSourceProgram["getSourceFileQueries"]>["typeShape"],
): boolean {
  if (types.isAny(type) || types.isUnknown(type) || types.isIntersection(type)) {
    return false;
  }
  if (types.isUnion(type)) {
    const members = types.getUnionOrIntersectionTypes(type);
    return members.length > 0 && members.every((member) =>
      member !== undefined && typeIsDefinitelyPrimitive(member, types));
  }
  return types.isNever(type) ||
    types.isVoidLike(type) ||
    types.isNullish(type) ||
    types.isStringLike(type) ||
    types.isNumberLike(type) ||
    types.isBooleanLike(type) ||
    types.isBigIntLike(type);
}
