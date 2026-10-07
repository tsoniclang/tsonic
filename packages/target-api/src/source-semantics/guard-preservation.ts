import type { Node } from "@tsonic/tsts";
import { forEachSourceImmediateEvaluationChild } from "../source-navigation/immediate-evaluation.js";
import { sourceBindingCallableKinds, sourceBindingHasMutableExposure } from "../source-navigation/binding-mutation-exposure.js";
import type { SourceValueFlowQueryContext } from "./value-flow-conditions.js";

export function sourceGuardPreservesBinding(
  context: Pick<SourceValueFlowQueryContext, "ast" | "navigation" | "sourceFacts">,
  condition: Node,
  reference: Node,
  assumed: boolean,
  enter: () => boolean,
): boolean {
  const binding = context.navigation.referenceFor(reference);
  if (binding === undefined || !context.ast.is.IsVariableDeclaration(binding.declaration) &&
    !context.ast.is.IsParameterDeclaration(binding.declaration) && !context.ast.is.IsBindingElement(binding.declaration)) return false;
  const summary = context.navigation.declarationUseSummary(binding.declaration);
  if (summary.exported || sourceBindingHasMutableExposure(context, summary, enter)) return false;
  const capturedWrites = summary.uses.some(use => use.captured && use.role === "write" && !use.throughMember);
  const stable = (node: Node): boolean => {
    if (!enter()) return false;
    const effects = context.navigation.expressionEffects(node);
    return !(capturedWrites && (effects.invokes || effects.suspends)) &&
      (!effects.mutates || context.navigation.bindingWritesWithin(binding.symbol, node).length === 0);
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
    if (context.ast.is.IsBlock(parent)) {
      let found = false;
      for (const previous of context.ast.statements(parent)) {
        if (previous === current) {
          if (found) return true;
          break;
        }
        if (previous === undefined || !enter()) return false;
        const statement = context.ast.is.IsIfStatement(previous) ? context.ast.as.AsIfStatement(previous) : undefined;
        if (!found && statement?.Expression === condition) {
          const branch = assumed ? statement.ThenStatement : statement.ElseStatement;
          if (branch !== undefined && !stable(branch)) return false;
          found = true;
        } else if (found && !stable(previous)) return false;
      }
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
