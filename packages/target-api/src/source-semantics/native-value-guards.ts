import type { Node } from "@tsonic/tsts";
import type { SourceGuardContext } from "./value-flow-model.js";
import type { SourceProductionResult } from "./descriptor-contracts.js";
import { BinaryExpression_Left, BinaryExpression_Right, BinaryExpression_OperatorToken, Node_Expression } from "../source-navigation/ast.js";
import { createSourceSyntaxDomain } from "../source-navigation/node-inventory.js";

export type SourceValueGuard =
  | { readonly kind: "typeof"; readonly sourceOperand: Node; readonly value: string; readonly negated: boolean }
  | { readonly kind: "absence"; readonly sourceOperand: Node; readonly negated: boolean }
  | { readonly kind: "literal"; readonly sourceOperand: Node; readonly literal: Node; readonly category: "string" | "number" | "bigint" | "boolean"; readonly negated: boolean }
  | { readonly kind: "nominal"; readonly sourceOperand: Node; readonly sourceConstructor: Node; readonly declaration: Node };

export function selectSourceValueGuard(
  { ast, navigation, syntaxDomain }: Pick<SourceGuardContext, "ast" | "navigation" | "syntaxDomain">,
  expression: Node,
): SourceProductionResult<SourceValueGuard | undefined> {
  navigation.callableRoles(expression);
  const resolved = (value: SourceValueGuard | undefined): SourceProductionResult<SourceValueGuard | undefined> =>
    Object.freeze({ kind: "resolved", value });
  const contains = createSourceSyntaxDomain(ast, expression);
  const transparent = (node: Node | undefined): Node | undefined => {
    const visited = new Set<Node>();
    while (node !== undefined) {
      if (!contains(node) || visited.has(node)) return undefined;
      visited.add(node);
      if (!ast.is.IsParenthesizedExpression(node) && !ast.is.IsSatisfiesExpression(node) && !ast.is.IsNonNullExpression(node)) return node;
      node = Node_Expression(ast, node);
    }
    return undefined;
  };
  const left = transparent(BinaryExpression_Left(ast, expression));
  const right = transparent(BinaryExpression_Right(ast, expression));
  const token = BinaryExpression_OperatorToken(ast, expression);
  if (left === undefined || right === undefined || token === undefined) return resolved(undefined);
  const operator = ast.kindName(token);
  if (operator === "KindInstanceOfKeyword") {
    const declaration = navigation.sourceReferenceFor(right)?.declaration;
    return resolved(declaration === undefined ? undefined : Object.freeze({ kind: "nominal", sourceOperand: left, sourceConstructor: right, declaration }));
  }
  const equal = operator === "KindEqualsEqualsEqualsToken" || operator === "KindEqualsEqualsToken";
  const different = operator === "KindExclamationEqualsEqualsToken" || operator === "KindExclamationEqualsToken";
  if (!equal && !different) return resolved(undefined);
  for (const [sourceOperand, absent] of [[left, right], [right, left]] as const) {
    if (ast.kindName(absent) === "KindNullKeyword") {
      return resolved(Object.freeze({ kind: "absence", sourceOperand, negated: different }));
    }
    if (ast.is.IsIdentifier(absent)) {
      const domain = syntaxDomain(absent);
      if (domain.kind !== "resolved") return domain;
      if (domain.value.kind === "finite" && domain.value.values.length !== 0 &&
        domain.value.values.every(value => value.kind === "absence")) {
        return resolved(Object.freeze({ kind: "absence", sourceOperand, negated: different }));
      }
    }
  }
  for (const [value, category] of [[left, right], [right, left]] as const) {
    if (!ast.is.IsTypeOfExpression(value) || !ast.is.IsStringLiteral(category)) continue;
    const sourceOperand = transparent(Node_Expression(ast, value));
    if (sourceOperand !== undefined) return resolved(Object.freeze({ kind: "typeof", sourceOperand,
      value: ast.text(category), negated: different }));
  }
  if (operator === "KindEqualsEqualsEqualsToken" || operator === "KindExclamationEqualsEqualsToken") {
    for (const [sourceOperand, literal] of [[left, right], [right, left]] as const) {
      const category = ast.is.IsStringLiteral(literal) || ast.kindName(literal) === "KindNoSubstitutionTemplateLiteral" ? "string"
        : ast.is.IsNumericLiteral(literal) ? "number"
        : ast.is.IsBigIntLiteral(literal) ? "bigint"
        : ast.kindName(literal) === "KindTrueKeyword" || ast.kindName(literal) === "KindFalseKeyword" ? "boolean" : undefined;
      if (category !== undefined) return resolved(Object.freeze({ kind: "literal", sourceOperand, literal, category, negated: different }));
    }
  }
  return resolved(undefined);
}
