import type { Node } from "@tsonic/tsts";
import type { SourcePresence, SourceResult } from "../public/source/contracts.js";
import type { SourceNavigationQueryContext } from "./query-context.js";
import { BinaryExpression_Left, BinaryExpression_Right, BinaryExpression_OperatorToken, Node_Expression } from "./ast.js";

export type SourceAbsenceUse = "coalesce" | "comparison";

export function sourceAbsenceUse(expression: Node, source: SourceNavigationQueryContext):
  SourceResult<SourcePresence<SourceAbsenceUse>> {
  const { ast } = source;
  if (!source.facts.navigation.includes(expression)) throw new Error("Source absence uses require their original occurrence.");
  const none = Object.freeze({ kind: "resolved", value: Object.freeze({ kind: "none" }) } as const);
  const present = (value: SourceAbsenceUse): SourceResult<SourcePresence<SourceAbsenceUse>> =>
    Object.freeze({ kind: "resolved", value: Object.freeze({ kind: "present", value }) });
  let receiver = expression;
  const seen = new Set<Node>();
  while (!seen.has(receiver)) {
    seen.add(receiver);
    const parent = ast.parent(receiver);
    if (parent === undefined) return none;
    const kind = ast.kindName(parent);
    if ((kind === "KindParenthesizedExpression" || kind === "KindSatisfiesExpression") && Node_Expression(ast, parent) === receiver) {
      receiver = parent;
      continue;
    }
    if (kind !== "KindBinaryExpression") return none;
    const operator = BinaryExpression_OperatorToken(ast, parent);
    if (operator !== undefined && ast.kindName(operator) === "KindQuestionQuestionToken")
      return BinaryExpression_Left(ast, parent) === receiver ? present("coalesce") : none;
    if (operator === undefined || !["KindEqualsEqualsToken", "KindExclamationEqualsToken",
      "KindEqualsEqualsEqualsToken", "KindExclamationEqualsEqualsToken"].includes(ast.kindName(operator))) return none;
    const left = BinaryExpression_Left(ast, parent), right = BinaryExpression_Right(ast, parent);
    const other = left === receiver ? right : right === receiver ? left : undefined;
    if (other === undefined) return none;
    const selected = source.facts.values.type(other);
    if (selected.kind === "refused") return selected;
    const alternatives = selected.value.sum?.arms ?? [selected.value];
    return alternatives.length > 0 && alternatives.every(value => value.category.kind === "known" && value.category.category === "absence")
      ? present("comparison") : none;
  }
  return none;
}
