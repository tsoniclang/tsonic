import type { Node, ResolvedSourceFlowCondition, ResolvedSourceFlowConditionInfo } from "@tsonic/tsts";
import type { SourceProductionResult } from "./descriptor-contracts.js";
import type { SourceGuardContext } from "./value-flow-model.js";
import type { SourceResult } from "../public/source/contracts.js";
import { sourceGuardPreservesBinding } from "./guard-preservation.js";
import { sourceStatementAlwaysExits } from "./native-control-flow.js";

export function resolveSourceFlowConditions(
  context: Pick<SourceGuardContext, "ast" | "navigation" | "protocols" | "enclosing">,
  reference: Node,
  checked: ResolvedSourceFlowConditionInfo | undefined,
): SourceProductionResult<ResolvedSourceFlowConditionInfo | undefined> {
  const resolved = <Value>(value: Value): SourceResult<Value> => Object.freeze({ kind: "resolved", value });
  if (checked === undefined || checked.reference !== reference) return resolved(undefined);
  const conditions = [...checked.conditions];
  let remaining = 2_048;
  const enter = (): boolean => --remaining >= 0;
  const retain = (expression: Node | undefined, assumed: boolean): SourceResult<void> => {
    if (expression === undefined || conditions.some(condition => condition.expression === expression && condition.assumed === assumed)) return resolved(undefined);
    const preserved = sourceGuardPreservesBinding(context, expression, reference, assumed, enter);
    if (preserved.kind === "refused") return preserved;
    if (preserved.value) {
      const condition: ResolvedSourceFlowCondition = Object.freeze({ expression, assumed, assignments: Object.freeze([]) });
      conditions.push(condition);
    }
    return resolved(undefined);
  };
  let current = reference;
  const execution = context.enclosing(reference, "execution", enter);
  while (enter()) {
    const parent = context.ast.parent(current);
    if (parent === undefined || parent === execution) break;
    if (context.ast.is.IsIfStatement(parent)) {
      const statement = context.ast.as.AsIfStatement(parent);
      const retained = statement?.ThenStatement === current ? retain(statement.Expression, true)
        : statement?.ElseStatement === current ? retain(statement.Expression, false) : resolved(undefined);
      if (retained.kind === "refused") return retained;
    } else if (context.ast.is.IsConditionalExpression(parent)) {
      const expression = context.ast.as.AsConditionalExpression(parent);
      const retained = expression?.WhenTrue === current ? retain(expression.Condition, true)
        : expression?.WhenFalse === current ? retain(expression.Condition, false) : resolved(undefined);
      if (retained.kind === "refused") return retained;
    } else if (context.ast.is.IsBinaryExpression(parent)) {
      const expression = context.ast.as.AsBinaryExpression(parent);
      const operator = context.ast.operatorKindName(parent);
      if (expression?.Right === current && (operator === "KindAmpersandAmpersandToken" || operator === "KindBarBarToken")) {
        const retained = retain(expression.Left, operator === "KindAmpersandAmpersandToken");
        if (retained.kind === "refused") return retained;
      }
    } else if (context.ast.is.IsBlock(parent)) {
      for (const previous of context.ast.statements(parent)) {
        if (previous === current) break;
        if (!enter()) return resolved(undefined);
        if (previous === undefined || !context.ast.is.IsIfStatement(previous)) continue;
        const statement = context.ast.as.AsIfStatement(previous);
        const unknown = () => Object.freeze({ kind: "resolved" as const, value: undefined });
        const thenExits = sourceStatementAlwaysExits(context.ast, statement?.ThenStatement, unknown, enter);
        if (thenExits.kind !== "resolved") return thenExits;
        const elseExits = sourceStatementAlwaysExits(context.ast, statement?.ElseStatement, unknown, enter);
        if (elseExits.kind !== "resolved") return elseExits;
        if (thenExits.value !== elseExits.value) {
          const retained = retain(statement?.Expression, elseExits.value);
          if (retained.kind === "refused") return retained;
        }
      }
    }
    if (remaining < 0) return resolved(undefined);
    current = parent;
  }
  return resolved(remaining < 0 ? undefined : Object.freeze({ reference, conditions: Object.freeze(conditions) }));
}
