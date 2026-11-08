import type { Node } from "@tsonic/tsts";
import { forEachSourceImmediateEvaluationChild } from "../source-navigation/immediate-evaluation.js";
import { sourceBindingHasMutableExposure } from "../source-navigation/binding-mutation-exposure.js";
import type { SourceGuardContext } from "./value-flow-model.js";
import type { SourceResult } from "../public/source/contracts.js";

export function sourceGuardPreservesBinding(
  context: Pick<SourceGuardContext, "ast" | "navigation" | "protocols" | "enclosing">,
  condition: Node,
  reference: Node,
  assumed: boolean,
  enter: (node: Node) => boolean,
): SourceResult<boolean> {
  const resolved = (value: boolean): SourceResult<boolean> => Object.freeze({ kind: "resolved", value });
  const binding = context.navigation.referenceFor(reference);
  if (binding === undefined || !context.ast.is.IsVariableDeclaration(binding.declaration) &&
    !context.ast.is.IsParameterDeclaration(binding.declaration) && !context.ast.is.IsBindingElement(binding.declaration)) return resolved(false);
  const summary = context.navigation.declarationUseSummary(binding.declaration);
  if (summary.exported) return resolved(false);
  const exposure = sourceBindingHasMutableExposure(context, summary, enter);
  if (exposure.kind === "refused") return exposure;
  if (exposure.value) return resolved(false);
  const capturedWrites = summary.uses.some(use => use.captured && use.role === "write" && !use.throughMember);
  const stable = (node: Node): boolean => {
    if (!enter(node)) return false;
    const effects = context.navigation.expressionEffects(node);
    return !(capturedWrites && (effects.invokes || effects.suspends)) &&
      (!effects.mutates || context.navigation.declarationWrites(binding.declaration, node).length === 0);
  };
  if (!stable(condition)) return resolved(false);
  let current = reference;
  const execution = context.enclosing(reference, "execution", enter);
  const visited = new Set<Node>();
  while (enter(current) && !visited.has(current)) {
    visited.add(current);
    const parent = context.ast.parent(current);
    if (parent === undefined || parent === execution) return resolved(false);
    if (context.ast.is.IsWhileStatement(parent) || context.ast.is.IsDoStatement(parent) ||
      context.ast.is.IsForStatement(parent) || context.ast.is.IsForInStatement(parent) ||
      context.ast.is.IsForOfStatement(parent)) return resolved(false);
    if (context.ast.is.IsIfStatement(parent)) {
      const statement = context.ast.as.AsIfStatement(parent);
      if (statement?.Expression === condition && (current === statement.ThenStatement || current === statement.ElseStatement)) return resolved(true);
    }
    if (context.ast.is.IsConditionalExpression(parent)) {
      const expression = context.ast.as.AsConditionalExpression(parent);
      if (expression?.Condition === condition && (current === expression.WhenTrue || current === expression.WhenFalse)) return resolved(true);
    }
    if (context.ast.is.IsBinaryExpression(parent)) {
      const expression = context.ast.as.AsBinaryExpression(parent);
      const operator = context.ast.operatorKindName(parent);
      if (expression?.Left === condition && expression.Right === current &&
        (operator === "KindAmpersandAmpersandToken" || operator === "KindBarBarToken")) return resolved(true);
    }
    if (context.ast.is.IsBlock(parent)) {
      let found = false;
      for (const previous of context.ast.statements(parent)) {
        if (previous === current) {
          if (found) return resolved(true);
          break;
        }
        if (previous === undefined || !enter(previous)) return resolved(false);
        const statement = context.ast.is.IsIfStatement(previous) ? context.ast.as.AsIfStatement(previous) : undefined;
        if (!found && statement?.Expression === condition) {
          const branch = assumed ? statement.ThenStatement : statement.ElseStatement;
          if (branch !== undefined && !stable(branch)) return resolved(false);
          found = true;
        } else if (found && !stable(previous)) return resolved(false);
      }
    }
    let reached = false;
    let preserved = true;
    forEachSourceImmediateEvaluationChild(context.ast, parent, child => {
      if (child === current) reached = true;
      else if (!reached && preserved) preserved = stable(child);
    });
    if (!reached || !preserved) return resolved(false);
    current = parent;
  }
  return resolved(false);
}
