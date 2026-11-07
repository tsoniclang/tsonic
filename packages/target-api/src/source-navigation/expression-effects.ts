import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceDeclarationReference, SourceExpressionEffects } from "./types.js";
import { Node_Expression, Node_Initializer } from "./ast.js";
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

/** The inputs of the effect analysis: authored syntax and the reference index (declaration input). */
export interface SourceExpressionEffectsInput {
  readonly ast: AstReader;
  sourceReferenceFor(node: Node | undefined): SourceDeclarationReference | undefined;
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

// Whether a coercing operator's operands are primitive, so the coercion calls no user code (valueOf/toString/
// Symbol.toPrimitive). Decided from authored syntax and declared types only (R3: never from the checked type of the
// operand). An operand whose primitiveness only inference could show counts as possibly invoking (conservative).
function operandsAreDefinitelyPrimitive(
  source: SourceExpressionEffectsInput,
  operands: readonly (Node | undefined)[],
): boolean {
  return operands.length > 0 && operands.every(operand => operand !== undefined && primitiveExpression(source, operand, 0));
}

const maximumPrimitiveDepth = 32;
const primitiveLiteralKinds: ReadonlySet<string> = new Set([
  "KindNumericLiteral", "KindBigIntLiteral", "KindStringLiteral", "KindNoSubstitutionTemplateLiteral",
  "KindTemplateExpression", "KindTrueKeyword", "KindFalseKeyword", "KindNullKeyword",
  "KindPrefixUnaryExpression", "KindPostfixUnaryExpression", "KindTypeOfExpression", "KindVoidExpression",
  "KindDeleteExpression",
]);
const primitiveResultOperators: ReadonlySet<string> = new Set([
  ...coerciveBinaryOperators, "KindEqualsEqualsEqualsToken", "KindExclamationEqualsEqualsToken",
  "KindInKeyword", "KindInstanceOfKeyword",
]);
const primitiveKeywordTypes: ReadonlySet<string> = new Set([
  "KindNumberKeyword", "KindStringKeyword", "KindBooleanKeyword", "KindBigIntKeyword", "KindUndefinedKeyword",
  "KindNullKeyword", "KindVoidKeyword", "KindNeverKeyword", "KindLiteralType", "KindTemplateLiteralType",
]);

function primitiveExpression(source: SourceExpressionEffectsInput, expression: Node, depth: number): boolean {
  const { ast } = source;
  if (depth > maximumPrimitiveDepth) return false;
  const kind = ast.kindName(expression);
  if (primitiveLiteralKinds.has(kind)) return true;
  if (kind === "KindParenthesizedExpression" || kind === "KindSatisfiesExpression") {
    const inner = Node_Expression(ast, expression);
    return inner !== undefined && primitiveExpression(source, inner, depth + 1);
  }
  if (kind === "KindAsExpression" || kind === "KindTypeAssertionExpression") {
    const type = ast.typeNode(expression);
    return type !== undefined && primitiveTypeNode(source, type, depth + 1);
  }
  if (kind === "KindConditionalExpression") {
    const conditional = ast.as.AsConditionalExpression(expression);
    return conditional?.WhenTrue !== undefined && conditional.WhenFalse !== undefined &&
      primitiveExpression(source, conditional.WhenTrue, depth + 1) && primitiveExpression(source, conditional.WhenFalse, depth + 1);
  }
  if (kind === "KindBinaryExpression") {
    const operator = ast.operatorKindName(expression) ?? "";
    const binary = ast.as.AsBinaryExpression(expression);
    if (primitiveResultOperators.has(operator)) return true;
    if (operator === "KindAmpersandAmpersandToken" || operator === "KindBarBarToken" || operator === "KindQuestionQuestionToken") {
      return binary?.Left !== undefined && binary.Right !== undefined &&
        primitiveExpression(source, binary.Left, depth + 1) && primitiveExpression(source, binary.Right, depth + 1);
    }
    return (operator === "KindEqualsToken" || operator === "KindCommaToken") && binary?.Right !== undefined &&
      primitiveExpression(source, binary.Right, depth + 1);
  }
  if (kind === "KindIdentifier" || kind === "KindPropertyAccessExpression") {
    const reference = source.sourceReferenceFor(expression);
    if (reference === undefined) return kind === "KindIdentifier" && ast.text(expression) === "undefined";
    return primitiveDeclaration(source, reference.declaration, depth + 1);
  }
  return false;
}

function primitiveDeclaration(source: SourceExpressionEffectsInput, declaration: Node, depth: number): boolean {
  const { ast } = source;
  const kind = ast.kindName(declaration);
  if (kind === "KindEnumMember") return true;
  const type = ast.typeNode(declaration);
  if (type !== undefined) return primitiveTypeNode(source, type, depth);
  if (kind !== "KindVariableDeclaration" && kind !== "KindParameter") return false;
  const initializer = Node_Initializer(ast, declaration);
  return initializer !== undefined && primitiveExpression(source, initializer, depth);
}

function primitiveTypeNode(source: SourceExpressionEffectsInput, type: Node, depth: number): boolean {
  const { ast } = source;
  if (depth > maximumPrimitiveDepth) return false;
  const kind = ast.kindName(type);
  if (primitiveKeywordTypes.has(kind)) return true;
  if (kind === "KindParenthesizedType") {
    const inner = ast.typeNode(type);
    return inner !== undefined && primitiveTypeNode(source, inner, depth + 1);
  }
  if (kind === "KindUnionType") {
    const members = ast.children(type);
    return members.length > 0 && members.every(member => member !== undefined && primitiveTypeNode(source, member, depth + 1));
  }
  if (kind === "KindTypeReference") {
    const declaration = source.sourceReferenceFor(type)?.declaration;
    if (declaration === undefined) return false;
    if (ast.kindName(declaration) === "KindEnumDeclaration") return true;
    if (ast.kindName(declaration) !== "KindTypeAliasDeclaration" || (ast.typeParameters(declaration) ?? []).length > 0) return false;
    const aliased = ast.typeNode(declaration);
    return aliased !== undefined && primitiveTypeNode(source, aliased, depth + 1);
  }
  return false;
}
