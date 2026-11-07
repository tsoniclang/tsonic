import type { AstReader, Node } from "@tsonic/tsts";
import { BinaryExpression_Left, BinaryExpression_Right, BinaryExpression_OperatorToken, Node_Expression } from "./ast.js";
import type { SourceProgramNavigation } from "./types.js";

export type SourceAbsenceUse = "coalesce" | "comparison" | undefined;

/**
 * How an expression's absence is used: the left operand of `??`, or an operand of an equality comparison whose other
 * operand is an authored absence (`null`, `undefined`, `void e`). Syntax only (R3: no checked operand type).
 */
export function sourceAbsenceUse(expression: Node, context: {
  readonly ast: AstReader;
  readonly navigation: Pick<SourceProgramNavigation, "sourceReferenceFor">;
}): SourceAbsenceUse {
  let receiver = expression;
  const seen = new Set<Node>();
  for (let depth = 0; depth <= 2048; depth += 1) {
    if (seen.has(receiver)) return undefined;
    seen.add(receiver);
    const parent = context.ast.parent(receiver);
    if (parent === undefined) return undefined;
    const kind = context.ast.kindName(parent);
    if ((kind === "KindParenthesizedExpression" || kind === "KindSatisfiesExpression") &&
      Node_Expression(context.ast, parent) === receiver) {
      receiver = parent;
      continue;
    }
    if (kind !== "KindBinaryExpression") return undefined;
    const operator = BinaryExpression_OperatorToken(context.ast, parent);
    if (operator !== undefined && context.ast.kindName(operator) === "KindQuestionQuestionToken")
      return BinaryExpression_Left(context.ast, parent) === receiver ? "coalesce" : undefined;
    if (operator === undefined || !["KindEqualsEqualsToken", "KindExclamationEqualsToken",
      "KindEqualsEqualsEqualsToken", "KindExclamationEqualsEqualsToken"].includes(context.ast.kindName(operator))) return undefined;
    const left = BinaryExpression_Left(context.ast, parent);
    const right = BinaryExpression_Right(context.ast, parent);
    const other = left === receiver ? right : right === receiver ? left : undefined;
    if (other === undefined) return undefined;
    return authoredAbsence(context, other) ? "comparison" : undefined;
  }
  return undefined;
}

function authoredAbsence(context: Parameters<typeof sourceAbsenceUse>[1], node: Node): boolean {
  let current: Node | undefined = node;
  for (let depth = 0; current !== undefined && depth < 64; depth += 1) {
    const kind = context.ast.kindName(current);
    if (kind === "KindNullKeyword" || kind === "KindVoidExpression") return true;
    if (kind === "KindIdentifier") {
      return context.ast.text(current) === "undefined" && context.navigation.sourceReferenceFor(current) === undefined;
    }
    if (kind !== "KindParenthesizedExpression") return false;
    current = Node_Expression(context.ast, current);
  }
  return false;
}
