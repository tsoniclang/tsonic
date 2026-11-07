import type { Node } from "@tsonic/tsts";
import { sourceNodeHasRole } from "../source-model/callable-boundaries.js";
import type { SourceFlowCondition, SourceFlowConditions, SourceValueFlowQueryContext } from "./value-flow-model.js";
import { sourceGuardPreservesBinding } from "./guard-preservation.js";
import { sourceStatementAlwaysExits } from "./native-control-flow.js";

/**
 * The flow conditions at a reference: the checker flow-condition witness (host-input) plus every enclosing guard the
 * Host proves still holds for the binding (sourceGuardPreservesBinding). Undefined when the work budget is exhausted.
 */
export function resolveSourceFlowConditions(
  context: Pick<SourceValueFlowQueryContext, "ast" | "navigation" | "sourceFacts" | "effects">,
  reference: Node,
  checked: SourceFlowConditions | undefined,
): SourceFlowConditions | undefined {
  if (checked === undefined || checked.reference !== reference) return undefined;
  const conditions = [...checked.conditions];
  let remaining = 2_048;
  const enter = (): boolean => --remaining >= 0;
  const retain = (expression: Node | undefined, assumed: boolean): void => {
    if (expression === undefined || conditions.some(condition => condition.expression === expression && condition.assumed === assumed)) return;
    if (sourceGuardPreservesBinding(context, expression, reference, assumed, enter)) {
      const condition: SourceFlowCondition = Object.freeze({ expression, assumed, assignments: Object.freeze([]) });
      conditions.push(condition);
    }
  };
  let current = reference;
  while (enter()) {
    const parent = context.ast.parent(current);
    if (parent === undefined || sourceNodeHasRole(context.ast, parent, "execution-barrier")) break;
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
    } else if (context.ast.is.IsBlock(parent)) {
      for (const previous of context.ast.statements(parent)) {
        if (previous === current) break;
        if (!enter()) return undefined;
        if (previous === undefined || !context.ast.is.IsIfStatement(previous)) continue;
        const statement = context.ast.as.AsIfStatement(previous);
        const thenExits = sourceStatementAlwaysExits(context.ast, statement?.ThenStatement, () => undefined, enter);
        const elseExits = sourceStatementAlwaysExits(context.ast, statement?.ElseStatement, () => undefined, enter);
        if (thenExits !== elseExits) retain(statement?.Expression, elseExits);
      }
    }
    if (remaining < 0) return undefined;
    current = parent;
  }
  return remaining < 0 ? undefined : Object.freeze({ reference, conditions: Object.freeze(conditions) });
}
