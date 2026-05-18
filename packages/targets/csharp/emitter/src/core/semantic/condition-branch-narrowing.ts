import { IrExpression } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import {
  type BranchTruthiness,
  type EmitExprAstFn,
} from "./narrowing-builders.js";
import {
  applyDirectTypeofRefinement,
  applySimpleNullableRefinement,
  applyTruthinessNullishRefinement,
  applyPredicateCallRefinement,
  applyArrayIsArrayRefinement,
  applyInstanceofRefinement,
} from "./narrowing-refinements.js";

const resolveConditionAliasExpression = (
  condition: IrExpression,
  context: EmitterContext,
  seen = new Set<string>()
): IrExpression => {
  if (condition.kind !== "identifier") {
    return condition;
  }

  if (seen.has(condition.name)) {
    return condition;
  }

  const alias = context.conditionAliases?.get(condition.name);
  if (!alias) {
    return condition;
  }

  const nextSeen = new Set(seen);
  nextSeen.add(condition.name);
  return resolveConditionAliasExpression(alias, context, nextSeen);
};

export const applyConditionBranchNarrowing = (
  condition: IrExpression,
  branch: BranchTruthiness,
  context: EmitterContext,
  emitExprAst: EmitExprAstFn
): EmitterContext => {
  const resolvedCondition = resolveConditionAliasExpression(condition, context);
  if (resolvedCondition !== condition) {
    return applyConditionBranchNarrowing(
      resolvedCondition,
      branch,
      context,
      emitExprAst
    );
  }

  if (condition.kind === "unary" && condition.operator === "!") {
    return applyConditionBranchNarrowing(
      condition.expression,
      branch === "truthy" ? "falsy" : "truthy",
      context,
      emitExprAst
    );
  }

  if (condition.kind === "logical") {
    if (condition.operator === "&&") {
      if (branch === "truthy") {
        const leftTruthy = applyConditionBranchNarrowing(
          condition.left,
          "truthy",
          context,
          emitExprAst
        );
        return applyConditionBranchNarrowing(
          condition.right,
          "truthy",
          leftTruthy,
          emitExprAst
        );
      }
      return context;
    }

    if (condition.operator === "||") {
      if (branch === "falsy") {
        const leftFalsy = applyConditionBranchNarrowing(
          condition.left,
          "falsy",
          context,
          emitExprAst
        );
        return applyConditionBranchNarrowing(
          condition.right,
          "falsy",
          leftFalsy,
          emitExprAst
        );
      }
      return context;
    }
  }

  return (
    applyDirectTypeofRefinement(condition, branch, context, emitExprAst) ??
    applySimpleNullableRefinement(condition, branch, context, emitExprAst) ??
    applyTruthinessNullishRefinement(condition, branch, context, emitExprAst) ??
    applyArrayIsArrayRefinement(condition, branch, context, emitExprAst) ??
    applyPredicateCallRefinement(condition, branch, context, emitExprAst) ??
    applyInstanceofRefinement(condition, branch, context, emitExprAst) ??
    context
  );
};

export const applyLogicalOperandNarrowing = (
  left: IrExpression,
  operator: "&&" | "||",
  context: EmitterContext,
  emitExprAst: EmitExprAstFn
): EmitterContext =>
  applyConditionBranchNarrowing(
    left,
    operator === "&&" ? "truthy" : "falsy",
    context,
    emitExprAst
  );
