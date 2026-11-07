import type { Node } from "@tsonic/tsts";
import type { SourceValueFlowQueryContext } from "./value-flow-model.js";
import { BinaryExpression_Left, BinaryExpression_Right, BinaryExpression_OperatorToken, Node_Expression } from "../source-navigation/ast.js";
import { createSourceSyntaxDomain } from "../source-navigation/node-inventory.js";
import { sourceTypeDescriptorStructure } from "./local-type-flow/terms.js";

export type SourceNativeValueGuard =
  | { readonly kind: "typeof"; readonly sourceOperand: Node; readonly value: string; readonly negated: boolean }
  | { readonly kind: "absence"; readonly sourceOperand: Node; readonly negated: boolean }
  | { readonly kind: "literal"; readonly sourceOperand: Node; readonly category: "string" | "number" | "bigint" | "boolean"; readonly negated: boolean }
  | { readonly kind: "nominal"; readonly sourceOperand: Node; readonly sourceConstructor: Node; readonly declaration: Node };

export function selectSourceNativeValueGuard(
  { ast, navigation, values }: Pick<SourceValueFlowQueryContext, "ast" | "navigation" | "values">,
  expression: Node,
): SourceNativeValueGuard | undefined {
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
  if (left === undefined || right === undefined || token === undefined) return undefined;
  const operator = ast.kindName(token);
  if (operator === "KindInstanceOfKeyword") {
    const declaration = navigation.sourceReferenceFor(right)?.declaration;
    return declaration === undefined ? undefined : Object.freeze({ kind: "nominal", sourceOperand: left, sourceConstructor: right, declaration });
  }
  const equal = operator === "KindEqualsEqualsEqualsToken" || operator === "KindEqualsEqualsToken";
  const different = operator === "KindExclamationEqualsEqualsToken" || operator === "KindExclamationEqualsToken";
  if (!equal && !different) return undefined;
  for (const [sourceOperand, absent] of [[left, right], [right, left]] as const) {
    if (ast.kindName(absent) === "KindNullKeyword") {
      return Object.freeze({ kind: "absence", sourceOperand, negated: different });
    }
    if (ast.is.IsIdentifier(absent) && absenceValue(values, absent)) {
      return Object.freeze({ kind: "absence", sourceOperand, negated: different });
    }
  }
  for (const [value, category] of [[left, right], [right, left]] as const) {
    if (!ast.is.IsTypeOfExpression(value) || !ast.is.IsStringLiteral(category)) continue;
    const sourceOperand = transparent(Node_Expression(ast, value));
    if (sourceOperand !== undefined) return Object.freeze({ kind: "typeof", sourceOperand,
      value: ast.text(category), negated: different });
  }
  if (operator === "KindEqualsEqualsEqualsToken" || operator === "KindExclamationEqualsEqualsToken") {
    for (const [sourceOperand, literal] of [[left, right], [right, left]] as const) {
      const category = ast.is.IsStringLiteral(literal) || ast.kindName(literal) === "KindNoSubstitutionTemplateLiteral" ? "string"
        : ast.is.IsNumericLiteral(literal) ? "number"
        : ast.is.IsBigIntLiteral(literal) ? "bigint"
        : ast.kindName(literal) === "KindTrueKeyword" || ast.kindName(literal) === "KindFalseKeyword" ? "boolean" : undefined;
      if (category !== undefined) return Object.freeze({ kind: "literal", sourceOperand, category, negated: different });
    }
  }
  return undefined;
}

/**
 * Whether an identifier operand is the absence value: its Host descriptor (R3: never the checked type) is the absence
 * intrinsic (`undefined`, or a binding whose Host type is exactly null/undefined).
 */
function absenceValue(values: SourceValueFlowQueryContext["values"], operand: Node): boolean {
  const outcome = values.type(operand);
  if (outcome.kind === "refused") return false;
  const structure = sourceTypeDescriptorStructure(outcome.type);
  return structure.kind === "intrinsic" && structure.intrinsic === "absence";
}
