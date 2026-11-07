import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceExpressionEffects } from "./types.js";
import { forEachSourceImmediateEvaluationChild } from "./immediate-evaluation.js";

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

/** The inputs of the effect analysis: authored syntax and the Host value primitiveness of a coerced operand. */
export interface SourceExpressionEffectsInput {
  readonly ast: AstReader;
  /**
   * Whether the Host value type of `operand` is definitely primitive, so coercing it runs no user code (valueOf /
   * toString / Symbol.toPrimitive). The answer comes from the value model (`facts.values.type`), the one owner of a
   * value's Source type (R1); navigation never classifies types itself (R2 #15).
   */
  operandIsPrimitive(operand: Node): boolean;
}

export function sourceExpressionEffects(
  source: SourceExpressionEffectsInput,
  expression: Node,
  cache: WeakMap<Node, SourceExpressionEffects> = new WeakMap(),
): SourceExpressionEffects {
  const cached = cache.get(expression);
  if (cached !== undefined) {
    return cached;
  }
  const { ast } = source;
  const kind = ast.kindName(expression);
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
  forEachSourceImmediateEvaluationChild(ast, expression, (child) => {
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

// Whether a coercing operator's operands are primitive, so the coercion calls no user code. Decided by the Host value
// model through `operandIsPrimitive` (R1, R3: never from the checked type, never from a private syntax classifier).
function operandsAreDefinitelyPrimitive(
  source: SourceExpressionEffectsInput,
  operands: readonly (Node | undefined)[],
): boolean {
  return operands.length > 0 && operands.every(operand => operand !== undefined && source.operandIsPrimitive(operand));
}
