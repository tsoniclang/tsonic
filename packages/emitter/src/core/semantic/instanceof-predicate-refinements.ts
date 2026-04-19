/**
 * Instanceof and type-predicate narrowing refinements.
 * Handles applyInstanceofRefinement and applyPredicateCallRefinement.
 */

import { IrExpression, IrType, stableIrTypeKey } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import type { CSharpExpressionAst } from "../format/backend-ast/types.js";
import { emitTypeAst } from "../../type-emitter.js";
import { getMemberAccessNarrowKey } from "./narrowing-keys.js";
import {
  findExactRuntimeUnionMemberIndices,
  findRuntimeUnionInstanceofMemberIndices,
} from "./runtime-unions.js";
import { normalizeInstanceofTargetType } from "./instanceof-targets.js";
import { unwrapTransparentNarrowingTarget } from "./transparent-expressions.js";
import { resolveEffectiveExpressionType } from "./narrowed-expression-types.js";
import {
  type BranchTruthiness,
  type EmitExprAstFn,
  buildUnionNarrowAst,
  buildSubsetUnionType,
  withoutNarrowedBinding,
  applyBinding,
  buildProjectedExprBinding,
  narrowTypeByNotAssignableTarget,
  currentNarrowedType,
  resolveRuntimeUnionFrame,
  resolveRuntimeSubsetSourceInfo,
  resolveExistingNarrowingSourceType,
  buildRuntimeUnionComplementBinding,
  applyDirectTypeNarrowing,
} from "./narrowing-builders.js";
import { SYSTEM_ARRAY_STORAGE_TYPE } from "./broad-array-storage.js";

export const applyInstanceofRefinement = (
  condition: IrExpression,
  branch: BranchTruthiness,
  context: EmitterContext,
  emitExprAst: EmitExprAstFn
): EmitterContext | undefined => {
  const resolveExactInstanceofTargetType = (
    expr: IrExpression
  ): IrType | undefined => {
    const normalized = normalizeInstanceofTargetType(expr.inferredType);
    if (!normalized) {
      return undefined;
    }

    if (
      normalized.kind === "referenceType" &&
      !normalized.resolvedClrType &&
      "resolvedClrType" in expr &&
      typeof expr.resolvedClrType === "string"
    ) {
      return {
        ...normalized,
        resolvedClrType: expr.resolvedClrType,
      };
    }

    return normalized;
  };

  const guard = (() => {
    if (condition.kind !== "binary" || condition.operator !== "instanceof") {
      return undefined;
    }

    const target = unwrapTransparentNarrowingTarget(condition.left);
    if (!target) return undefined;

    const originalName =
      target.kind === "identifier"
        ? target.name
        : getMemberAccessNarrowKey(target);
    if (!originalName) return undefined;

    const [lhsAst, ctxAfterLhs] = emitExprAst(
      target,
      withoutNarrowedBinding(context, originalName)
    );
    const inferredRhsType = resolveExactInstanceofTargetType(condition.right);
    if (!inferredRhsType) {
      return undefined;
    }

    const currentType = currentNarrowedType(
      originalName,
      resolveEffectiveExpressionType(target, context) ??
        target.inferredType ??
        condition.left.inferredType,
      context
    );
    const runtimeUnionFrame =
      currentType &&
      resolveRuntimeUnionFrame(originalName, currentType, context);
    const runtimeMatchIndices =
      runtimeUnionFrame && inferredRhsType
        ? findRuntimeUnionInstanceofMemberIndices(
            runtimeUnionFrame.members,
            inferredRhsType,
            context
          )
        : undefined;
    const runtimeMatchIndex = runtimeMatchIndices?.[0];
    const memberNeedsPatternCheck =
      runtimeUnionFrame &&
      runtimeMatchIndex !== undefined &&
      inferredRhsType &&
      runtimeUnionFrame.members[runtimeMatchIndex]
        ? findExactRuntimeUnionMemberIndices(
            [runtimeUnionFrame.members[runtimeMatchIndex]],
            inferredRhsType,
            context
          ).length === 0
        : false;
    const memberN =
      runtimeUnionFrame && runtimeMatchIndex !== undefined
        ? (runtimeUnionFrame.candidateMemberNs[runtimeMatchIndex] ??
          runtimeMatchIndex + 1)
        : undefined;

    return {
      originalName,
      targetExpr: target,
      receiverAst: lhsAst,
      targetType: inferredRhsType,
      memberN,
      memberNeedsPatternCheck,
      runtimeUnionArity: runtimeUnionFrame?.runtimeUnionArity,
      candidateMemberNs: runtimeUnionFrame?.candidateMemberNs,
      candidateMembers: runtimeUnionFrame?.members,
      currentType,
      contextAfter: ctxAfterLhs,
    };
  })();
  if (!guard) {
    return undefined;
  }

  if (branch === "falsy") {
    if (
      guard.memberN === undefined ||
      guard.memberNeedsPatternCheck ||
      !guard.candidateMemberNs ||
      !guard.candidateMembers ||
      !guard.runtimeUnionArity
    ) {
      if (!guard.currentType) {
        return undefined;
      }
      const complementType = narrowTypeByNotAssignableTarget(
        guard.currentType,
        guard.targetType,
        context
      );
      if (!complementType) {
        return undefined;
      }
      if (
        stableIrTypeKey(complementType) === stableIrTypeKey(guard.currentType)
      ) {
        return context;
      }
      return applyDirectTypeNarrowing(
        guard.originalName,
        guard.targetExpr,
        complementType,
        context,
        emitExprAst
      );
    }

    const currentType = guard.currentType;
    if (!currentType) {
      return undefined;
    }
    const runtimeUnionFrame = {
      members: guard.candidateMembers,
      candidateMemberNs: guard.candidateMemberNs,
      runtimeUnionArity: guard.runtimeUnionArity,
    };
    const sourceInfo = resolveRuntimeSubsetSourceInfo(
      guard.originalName,
      currentType,
      runtimeUnionFrame,
      context
    );

    const complementBinding = buildRuntimeUnionComplementBinding(
      guard.receiverAst,
      runtimeUnionFrame,
      currentType,
      buildSubsetUnionType(
        guard.candidateMembers.filter((_, index) => {
          const candidateMemberN =
            guard.candidateMemberNs?.[index] ?? index + 1;
          return candidateMemberN !== guard.memberN;
        })
      ) ?? { kind: "unknownType" },
      guard.memberN,
      guard.contextAfter,
      sourceInfo
    );
    if (!complementBinding) {
      return undefined;
    }
    return applyBinding(
      guard.originalName,
      complementBinding,
      guard.contextAfter
    );
  }

  if (!guard.targetType) {
    return undefined;
  }

  let exprAst: CSharpExpressionAst;
  if (guard.memberN !== undefined) {
    exprAst = buildUnionNarrowAst(guard.receiverAst, guard.memberN);
  } else {
    const [targetTypeAst] = emitTypeAst(guard.targetType, guard.contextAfter);
    exprAst = {
      kind: "castExpression",
      type: targetTypeAst,
      expression: guard.receiverAst,
    };
  }

  if (guard.memberN !== undefined) {
    const [targetTypeAst] = emitTypeAst(guard.targetType, guard.contextAfter);
    exprAst = {
      kind: "castExpression",
      type: targetTypeAst,
      expression: exprAst,
    };
  }

  return applyBinding(
    guard.originalName,
    buildProjectedExprBinding(
      exprAst,
      guard.targetType,
      resolveExistingNarrowingSourceType(
        guard.originalName,
        guard.currentType,
        context
      ),
      guard.receiverAst
    ),
    guard.contextAfter
  );
};

export const applyPredicateCallRefinement = (
  condition: IrExpression,
  branch: BranchTruthiness,
  context: EmitterContext,
  emitExprAst: EmitExprAstFn
): EmitterContext | undefined => {
  if (condition.kind !== "call") {
    return undefined;
  }

  const narrowing = condition.narrowing;
  if (!narrowing || narrowing.kind !== "typePredicate") {
    return undefined;
  }

  const arg = condition.arguments[narrowing.argIndex];
  if (!arg || ("kind" in arg && arg.kind === "spread")) {
    return undefined;
  }

  const target = unwrapTransparentNarrowingTarget(arg);
  if (!target) {
    return undefined;
  }

  const bindingKey =
    target.kind === "identifier"
      ? target.name
      : getMemberAccessNarrowKey(target);
  if (!bindingKey) {
    return undefined;
  }

  const currentType = currentNarrowedType(
    bindingKey,
    resolveEffectiveExpressionType(target, context) ??
      target.inferredType ??
      arg.inferredType,
    context
  );
  if (!currentType) {
    return undefined;
  }

  const narrowedType =
    branch === "truthy"
      ? narrowing.targetType
      : narrowTypeByNotAssignableTarget(
          currentType,
          narrowing.targetType,
          context
        );
  if (!narrowedType) {
    return undefined;
  }

  const isArrayIsArrayPredicate =
    condition.callee.kind === "memberAccess" &&
    !condition.callee.isComputed &&
    condition.callee.property === "isArray" &&
    condition.callee.object.kind === "identifier" &&
    condition.callee.object.name === "Array";

  return applyDirectTypeNarrowing(
    bindingKey,
    target,
    narrowedType,
    context,
    emitExprAst,
    branch === "truthy" && isArrayIsArrayPredicate
      ? SYSTEM_ARRAY_STORAGE_TYPE
      : undefined
  );
};
