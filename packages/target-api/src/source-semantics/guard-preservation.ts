import type { Node } from "@tsonic/tsts";
import { forEachSourceImmediateEvaluationChild } from "../source-navigation/immediate-evaluation.js";
import { sourceBindingCallableKinds } from "../source-navigation/binding-mutation-exposure.js";
import type { SourceValueFlowQueryContext } from "./value-flow-conditions.js";

export function sourceGuardPreservesCapturedBinding(
  context: Pick<SourceValueFlowQueryContext, "ast" | "navigation">,
  condition: Node,
  reference: Node,
  enter: () => boolean,
): boolean {
  const stable = (node: Node): boolean => {
    if (!enter()) return false;
    const effects = context.navigation.expressionEffects(node);
    return !effects.invokes && !effects.mutates && !effects.suspends;
  };
  if (!stable(condition)) return false;
  let current = reference;
  while (enter()) {
    const parent = context.ast.parent(current);
    if (parent === undefined || sourceBindingCallableKinds.has(context.ast.kindName(parent))) return false;
    if (context.ast.is.IsWhileStatement(parent) || context.ast.is.IsDoStatement(parent) ||
      context.ast.is.IsForStatement(parent) || context.ast.is.IsForInStatement(parent) ||
      context.ast.is.IsForOfStatement(parent)) return false;
    if (context.ast.is.IsIfStatement(parent)) {
      const statement = context.ast.as.AsIfStatement(parent);
      if (statement?.Expression === condition && (current === statement.ThenStatement || current === statement.ElseStatement)) return true;
    }
    if (context.ast.is.IsConditionalExpression(parent)) {
      const expression = context.ast.as.AsConditionalExpression(parent);
      if (expression?.Condition === condition && (current === expression.WhenTrue || current === expression.WhenFalse)) return true;
    }
    if (context.ast.is.IsBinaryExpression(parent)) {
      const expression = context.ast.as.AsBinaryExpression(parent);
      const operator = context.ast.operatorKindName(parent);
      if (expression?.Left === condition && expression.Right === current &&
        (operator === "KindAmpersandAmpersandToken" || operator === "KindBarBarToken")) return true;
    }
    let reached = false;
    let preserved = true;
    forEachSourceImmediateEvaluationChild(context.ast, parent, child => {
      if (child === current) reached = true;
      else if (!reached && preserved) preserved = stable(child);
    });
    if (!reached || !preserved) return false;
    current = parent;
  }
  return false;
}
