import type { Node, ResolvedSourceFlowCondition, ResolvedSourceFlowConditionInfo } from "@tsonic/tsts";
import { sourceBindingCallableKinds } from "../source-navigation/binding-mutation-exposure.js";
import type { SourceValueFlowQueryContext } from "./value-flow-conditions.js";
import { sourceGuardPreservesCapturedBinding } from "./guard-preservation.js";

export function resolveSourceFlowConditions(
  context: Pick<SourceValueFlowQueryContext, "ast" | "navigation">,
  reference: Node,
  checked: ResolvedSourceFlowConditionInfo | undefined,
): ResolvedSourceFlowConditionInfo | undefined {
  if (checked === undefined || checked.reference !== reference) return undefined;
  const conditions = [...checked.conditions];
  let remaining = 2_048;
  const enter = (): boolean => --remaining >= 0;
  const retain = (expression: Node | undefined, assumed: boolean): void => {
    if (expression === undefined || conditions.some(condition => condition.expression === expression && condition.assumed === assumed)) return;
    if (sourceGuardPreservesCapturedBinding(context, expression, reference, enter)) {
      const condition: ResolvedSourceFlowCondition = Object.freeze({ expression, assumed, assignments: Object.freeze([]) });
      conditions.push(condition);
    }
  };
  let current = reference;
  while (enter()) {
    const parent = context.ast.parent(current);
    if (parent === undefined || sourceBindingCallableKinds.has(context.ast.kindName(parent))) break;
    if (context.ast.is.IsIfStatement(parent)) {
      const statement = context.ast.as.AsIfStatement(parent);
      if (statement?.ThenStatement === current) retain(statement.Expression, true);
      if (statement?.ElseStatement === current) retain(statement.Expression, false);
    } else if (context.ast.is.IsConditionalExpression(parent)) {
      const expression = context.ast.as.AsConditionalExpression(parent);
      if (expression?.WhenTrue === current) retain(expression.Condition, true);
      if (expression?.WhenFalse === current) retain(expression.Condition, false);
    } else if (context.ast.is.IsBinaryExpression(parent)) {
      const expression = context.ast.as.AsBinaryExpression(parent);
      const operator = context.ast.operatorKindName(parent);
      if (expression?.Right === current && (operator === "KindAmpersandAmpersandToken" || operator === "KindBarBarToken")) {
        retain(expression.Left, operator === "KindAmpersandAmpersandToken");
      }
    }
    if (remaining < 0) return undefined;
    current = parent;
  }
  return remaining < 0 ? undefined : Object.freeze({ reference, conditions: Object.freeze(conditions) });
}
