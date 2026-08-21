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
  cache: WeakMap<Node, SourceExpressionEffects> = new WeakMap(),
): SourceExpressionEffects {
  const cached = cache.get(expression);
  if (cached !== undefined) {
    return cached;
  }
  const { ast } = source;
  const kind = ast.kindName(expression);
  if (functionKinds.has(kind ?? "")) {
    const effects = frozenEffects(false, false, false, false);
    cache.set(expression, effects);
    return effects;
  }
  let invokes = false;
  let mutates = false;
  let suspends = false;
  let mayThrow = false;
  if (ast.is.IsCallExpression(expression) || ast.is.IsNewExpression(expression) ||
    kind === "KindTaggedTemplateExpression") {
    invokes = true;
    mayThrow = true;
  }
  if (ast.is.IsPropertyAccessExpression(expression) ||
    ast.is.IsElementAccessExpression(expression)) {
    invokes = true;
    mayThrow = true;
  }
  if (ast.is.IsBinaryExpression(expression)) {
    const operator = ast.operatorKindName(expression) ?? "";
    if (assignmentOperators.has(operator)) {
      mutates = true;
      mayThrow = true;
    }
    const binary = ast.as.AsBinaryExpression(expression);
    if (coerciveBinaryOperators.has(operator) &&
      !operandsAreDefinitelyPrimitive(source, [binary?.Left, binary?.Right])) {
      invokes = true;
      mayThrow = true;
    }
  }
  if (ast.is.IsPrefixUnaryExpression(expression) ||
    ast.is.IsPostfixUnaryExpression(expression)) {
    const operator = ast.operatorKindName(expression);
    if (operator === "KindPlusPlusToken" || operator === "KindMinusMinusToken") {
      mutates = true;
      mayThrow = true;
    }
    const unary = ast.is.IsPrefixUnaryExpression(expression)
      ? ast.as.AsPrefixUnaryExpression(expression)
      : undefined;
    if (operator !== "KindPlusPlusToken" && operator !== "KindMinusMinusToken" &&
      coerciveUnaryOperators.has(operator ?? "") &&
      !operandsAreDefinitelyPrimitive(source, [unary?.Operand])) {
      invokes = true;
      mayThrow = true;
    }
  }
  if (ast.is.IsSpreadElement(expression) || ast.is.IsSpreadAssignment(expression) ||
    kind === "KindComputedPropertyName" || kind === "KindTemplateExpression") {
    invokes = true;
    mayThrow = true;
  }
  if (ast.is.IsDeleteExpression(expression)) {
    mutates = true;
    mayThrow = true;
  }
  if (ast.is.IsAwaitExpression(expression) || ast.is.IsYieldExpression(expression)) {
    suspends = true;
    mayThrow = true;
  }
  ast.forEachChild(expression, (child) => {
    if (child === undefined) {
      return;
    }
    const childEffects = sourceExpressionEffects(source, child, cache);
    invokes ||= childEffects.invokes;
    mutates ||= childEffects.mutates;
    suspends ||= childEffects.suspends;
    mayThrow ||= childEffects.mayThrow;
  });
  const effects = frozenEffects(invokes, mutates, suspends, mayThrow);
  cache.set(expression, effects);
  return effects;
}

function frozenEffects(
  invokes: boolean,
  mutates: boolean,
  suspends: boolean,
  mayThrow: boolean,
): SourceExpressionEffects {
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
