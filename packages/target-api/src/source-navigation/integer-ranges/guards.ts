import { argumentPassingFactKey, pointerOperationFactKey } from "@tsonic/tsts";
import type { AstReader, Node, ReadonlySourceFactResolver } from "@tsonic/tsts";
import type { SourceProgramNavigation } from "../types.js";
import { Node_Expression } from "../ast.js";

export function sourceIntegerIsNonnegative(input: {
  readonly ast: AstReader;
  readonly navigation: SourceProgramNavigation;
  readonly sourceFacts?: ReadonlySourceFactResolver;
}, expression: Node): boolean {
  const { ast, navigation } = input;
  let remaining = 2_048;
  const enter = (): boolean => --remaining >= 0;
  const unwrap = (node: Node | undefined): Node | undefined => {
    while (node !== undefined && transparentKinds.has(ast.kindName(node))) {
      if (!enter()) return undefined;
      node = Node_Expression(ast, node);
    }
    return node;
  };
  const reference = unwrap(expression);
  const declaration = reference === undefined || !ast.is.IsIdentifier(reference)
    ? undefined : navigation.sourceReferenceFor(reference)?.declaration;
  if (declaration === undefined || !ast.is.IsVariableDeclaration(declaration) &&
    !ast.is.IsParameterDeclaration(declaration)) return false;
  const summary = navigation.declarationUseSummary(declaration);
  if (summary.bindingWritten || summary.captured || summary.exported || summary.memberWritten) return false;
  for (const use of summary.uses) {
    if (!enter()) return false;
    for (let node: Node | undefined = use.reference; node !== undefined; node = ast.parent(node)) {
      if (!enter()) return false;
      const passing = input.sourceFacts?.getFact(node, argumentPassingFactKey);
      if (passing !== undefined && !immutablePassingModes.has(passing.mode)) return false;
      const pointer = input.sourceFacts?.getFact(node, pointerOperationFactKey);
      if (pointer?.operation === "address-of") return false;
      if (ast.kindName(node).endsWith("Statement") || callableKinds.has(ast.kindName(node))) break;
    }
  }
  const selectsBinding = (node: Node | undefined): boolean => {
    const selected = unwrap(node);
    return selected !== undefined && ast.is.IsIdentifier(selected) &&
      navigation.sourceReferenceFor(selected)?.declaration === declaration;
  };
  const integerLiteral = (node: Node | undefined): bigint | undefined => {
    node = unwrap(node);
    if (node === undefined || !enter()) return undefined;
    if (ast.is.IsPrefixUnaryExpression(node)) {
      const prefix = ast.as.AsPrefixUnaryExpression(node);
      const value = integerLiteral(prefix?.Operand);
      return value === undefined ? undefined : ast.operatorKindName(node) === "KindMinusToken" ? -value
        : ast.operatorKindName(node) === "KindPlusToken" ? value : undefined;
    }
    if (!ast.is.IsNumericLiteral(node) && ast.kindName(node) !== "KindBigIntLiteral") return undefined;
    const text = ast.text(node)?.replace(/_/gu, "").replace(/n$/u, "");
    if (text === undefined || text.length > 256 || !/^(?:\d+|0[xX][\da-fA-F]+|0[bB][01]+|0[oO][0-7]+)$/u.test(text)) return undefined;
    return BigInt(text);
  };
  const proves = (condition: Node | undefined, truth: boolean, depth = 0): boolean => {
    condition = unwrap(condition);
    if (condition === undefined || depth > 64 || !enter()) return false;
    if (ast.is.IsPrefixUnaryExpression(condition) && ast.operatorKindName(condition) === "KindExclamationToken") {
      return proves(ast.as.AsPrefixUnaryExpression(condition)?.Operand, !truth, depth + 1);
    }
    if (!ast.is.IsBinaryExpression(condition)) return false;
    const binary = ast.as.AsBinaryExpression(condition);
    let operator = ast.operatorKindName(condition);
    if (operator === "KindAmpersandAmpersandToken" && truth || operator === "KindBarBarToken" && !truth) {
      return proves(binary?.Left, truth, depth + 1) || proves(binary?.Right, truth, depth + 1);
    }
    let bound = integerLiteral(binary?.Right);
    if (!selectsBinding(binary?.Left)) {
      if (!selectsBinding(binary?.Right)) return false;
      bound = integerLiteral(binary?.Left);
      operator = reversedOperators.get(operator ?? "") ?? operator;
    }
    if (bound === undefined) return false;
    if (!truth) operator = negatedOperators.get(operator ?? "");
    return operator === "KindGreaterThanEqualsToken" && bound >= 0n ||
      operator === "KindGreaterThanToken" && bound >= -1n ||
      (operator === "KindEqualsEqualsToken" || operator === "KindEqualsEqualsEqualsToken") && bound >= 0n;
  };
  const exits = (node: Node | undefined, depth = 0): boolean => {
    if (node === undefined || depth > 64 || !enter()) return false;
    if (ast.is.IsReturnStatement(node) || ast.is.IsThrowStatement(node)) return true;
    if (ast.is.IsBlock(node)) return ast.statements(node).some(statement => exits(statement, depth + 1));
    if (ast.is.IsIfStatement(node)) {
      const branch = ast.as.AsIfStatement(node);
      return exits(branch?.ThenStatement, depth + 1) && exits(branch?.ElseStatement, depth + 1);
    }
    return false;
  };
  for (let current = expression, parent = ast.parent(current); parent !== undefined;
    current = parent, parent = ast.parent(parent)) {
    if (!enter() || callableKinds.has(ast.kindName(parent))) return false;
    if (ast.is.IsIfStatement(parent)) {
      const branch = ast.as.AsIfStatement(parent);
      if (current === branch?.ThenStatement && proves(branch.Expression, true) ||
        current === branch?.ElseStatement && proves(branch.Expression, false)) return remaining >= 0;
    } else if (ast.is.IsConditionalExpression(parent)) {
      const branch = ast.as.AsConditionalExpression(parent);
      if (current === branch?.WhenTrue && proves(branch.Condition, true) ||
        current === branch?.WhenFalse && proves(branch.Condition, false)) return remaining >= 0;
    } else if (ast.is.IsBinaryExpression(parent)) {
      const binary = ast.as.AsBinaryExpression(parent);
      const operator = ast.operatorKindName(parent);
      if (current === binary?.Right && (operator === "KindAmpersandAmpersandToken" && proves(binary.Left, true) ||
        operator === "KindBarBarToken" && proves(binary.Left, false))) return remaining >= 0;
    } else if (ast.is.IsBlock(parent)) {
      for (const statement of ast.statements(parent)) {
        if (!enter()) return false;
        if (statement === current) break;
        if (statement !== undefined && ast.is.IsIfStatement(statement)) {
          const branch = ast.as.AsIfStatement(statement);
          if (exits(branch?.ThenStatement) && proves(branch?.Expression, false) ||
            exits(branch?.ElseStatement) && proves(branch?.Expression, true)) return remaining >= 0;
        }
      }
    }
  }
  return false;
}

const transparentKinds = new Set(["KindParenthesizedExpression", "KindSatisfiesExpression", "KindNonNullExpression"]);
const callableKinds = new Set(["KindFunctionDeclaration", "KindFunctionExpression", "KindArrowFunction",
  "KindMethodDeclaration", "KindConstructor", "KindGetAccessor", "KindSetAccessor"]);
const immutablePassingModes = new Set(["by-value", "byref-readonly", "borrow-shared"]);
const reversedOperators = new Map([
  ["KindGreaterThanToken", "KindLessThanToken"], ["KindGreaterThanEqualsToken", "KindLessThanEqualsToken"],
  ["KindLessThanToken", "KindGreaterThanToken"], ["KindLessThanEqualsToken", "KindGreaterThanEqualsToken"],
]);
const negatedOperators = new Map([
  ["KindGreaterThanToken", "KindLessThanEqualsToken"], ["KindGreaterThanEqualsToken", "KindLessThanToken"],
  ["KindLessThanToken", "KindGreaterThanEqualsToken"], ["KindLessThanEqualsToken", "KindGreaterThanToken"],
  ["KindExclamationEqualsToken", "KindEqualsEqualsToken"],
  ["KindExclamationEqualsEqualsToken", "KindEqualsEqualsEqualsToken"],
]);
