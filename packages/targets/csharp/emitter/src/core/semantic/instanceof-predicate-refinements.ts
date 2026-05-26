/**
 * Instanceof and type-predicate narrowing refinements.
 * Handles applyInstanceofRefinement and applyPredicateCallRefinement.
 */

import { IrExpression, IrType, normalizedUnionType } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import type { CSharpExpressionAst } from "../format/backend-ast/types.js";
import { emitTypeAst } from "../../type-emitter.js";
import { getMemberAccessNarrowKey } from "./narrowing-keys.js";
import {
  findExactRuntimeUnionMemberIndices,
  findRuntimeUnionMemberIndices,
  findRuntimeUnionInstanceofMemberIndices,
} from "./runtime-union-matching.js";
import { areIrTypesEquivalent } from "./type-equivalence.js";
import { normalizeInstanceofTargetType } from "./instanceof-targets.js";
import { unwrapTransparentNarrowingTarget } from "./transparent-expressions.js";
import { resolveEffectiveExpressionType } from "./narrowed-expression-types.js";
import {
  type BranchTruthiness,
  type EmitExprAstFn,
  buildUnionNarrowAst,
  buildSubsetUnionType,
  applyBinding,
  buildProjectedExprBinding,
  emitCurrentNarrowingReceiverAst,
  narrowTypeByNotAssignableTarget,
  currentNarrowedType,
  resolveRuntimeUnionFrame,
  resolveRuntimeSubsetSourceInfo,
  resolveExistingNarrowingSourceType,
  buildRuntimeUnionComplementBinding,
  applyDirectTypeNarrowing,
} from "./narrowing-builders.js";
import {
  resolveTypeAlias,
  stripNullish,
  unionMemberMatchesTarget,
} from "./type-resolution.js";

const narrowTypeByPredicateTarget = (
  currentType: IrType,
  targetType: IrType,
  context: EmitterContext
): IrType => {
  const resolvedCurrent = resolveTypeAlias(stripNullish(currentType), context);
  const resolvedTarget = resolveTypeAlias(stripNullish(targetType), context);

  if (resolvedCurrent.kind === "unionType") {
    const kept = resolvedCurrent.types.filter((member): member is IrType => {
      if (!member) return false;
      return unionMemberMatchesTarget(member, resolvedTarget, context);
    });
    if (kept.length === 1 && kept[0]) return kept[0];
    if (kept.length > 1) return normalizedUnionType(kept) ?? resolvedTarget;
  }

  return unionMemberMatchesTarget(resolvedCurrent, resolvedTarget, context)
    ? resolvedCurrent
    : resolvedTarget;
};

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
      !normalized.providerQualifiedName &&
      "providerQualifiedName" in expr &&
      typeof expr.providerQualifiedName === "string"
    ) {
      return {
        ...normalized,
        providerQualifiedName: expr.providerQualifiedName,
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
    const [lhsAst, ctxAfterLhs] = emitCurrentNarrowingReceiverAst(
      originalName,
      target,
      context,
      emitExprAst
    );
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
      if (areIrTypesEquivalent(complementType, guard.currentType, context)) {
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
      ? narrowTypeByPredicateTarget(currentType, narrowing.targetType, context)
      : narrowTypeByNotAssignableTarget(
          currentType,
          narrowing.targetType,
          context
        );
  if (!narrowedType) {
    return undefined;
  }

  if (branch === "falsy") {
    const runtimeUnionFrame = resolveRuntimeUnionFrame(
      bindingKey,
      currentType,
      context
    );
    const matchingRuntimeMemberIndices = runtimeUnionFrame
      ? findRuntimeUnionMemberIndices(
          runtimeUnionFrame.members,
          narrowing.targetType,
          context
        )
      : [];
    const [matchingRuntimeMemberIndex] = matchingRuntimeMemberIndices;
    const matchingRuntimeMemberN =
      matchingRuntimeMemberIndex !== undefined
        ? runtimeUnionFrame?.candidateMemberNs[matchingRuntimeMemberIndex]
        : undefined;
    if (
      runtimeUnionFrame &&
      matchingRuntimeMemberIndices.length === 1 &&
      matchingRuntimeMemberN !== undefined
    ) {
      const [receiverAst, receiverContext] = emitCurrentNarrowingReceiverAst(
        bindingKey,
        target,
        context,
        emitExprAst
      );
      const complementBinding = buildRuntimeUnionComplementBinding(
        receiverAst,
        runtimeUnionFrame,
        currentType,
        narrowedType,
        matchingRuntimeMemberN,
        receiverContext,
        resolveRuntimeSubsetSourceInfo(
          bindingKey,
          currentType,
          runtimeUnionFrame,
          context
        )
      );
      if (complementBinding) {
        return applyBinding(bindingKey, complementBinding, receiverContext);
      }
    }
  }

  return applyDirectTypeNarrowing(
    bindingKey,
    target,
    narrowedType,
    context,
    emitExprAst
  );
};
