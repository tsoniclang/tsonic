import type { AstReader, Node } from "@tsonic/tsts";
import { BinaryExpression_Left, BinaryExpression_Right, BinaryExpression_OperatorToken, Node_Expression } from "./ast.js";
import type { SourceFileSemantics } from "../source-semantics/types.js";

export type SourceAbsenceUse = "coalesce" | "comparison" | undefined;

export function sourceAbsenceUse(expression: Node, context: {
  readonly ast: AstReader;
  semanticsFor(node: Node): SourceFileSemantics;
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
    const semantics = context.semanticsFor(parent);
    const type = semantics.types.expressionType(other);
    return type !== undefined && (semantics.types.isNullish(type) || semantics.types.isVoidLike(type))
      ? "comparison" : undefined;
  }
  return undefined;
}
