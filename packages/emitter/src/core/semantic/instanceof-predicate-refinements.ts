/**
 * Instanceof and type-predicate narrowing refinements.
 * Handles applyInstanceofRefinement and applyPredicateCallRefinement.
 */

import { IrExpression, stableIrTypeKey } from "@tsonic/frontend";
import type { EmitterContext, NarrowedBinding } from "../../types.js";
import type { CSharpExpressionAst } from "../format/backend-ast/types.js";
import { emitTypeAst } from "../../type-emitter.js";
import { getMemberAccessNarrowKey } from "./narrowing-keys.js";
import {
  findExactRuntimeUnionMemberIndices,
  findRuntimeUnionInstanceofMemberIndices,
  findRuntimeUnionMemberIndices,
} from "./runtime-unions.js";
import { normalizeInstanceofTargetType } from "./instanceof-targets.js";
import { unwrapTransparentNarrowingTarget } from "./transparent-expressions.js";
import {
  type BranchTruthiness,
  type EmitExprAstFn,
  buildUnionNarrowAst,
  buildSubsetUnionType,
  withoutNarrowedBinding,
  applyBinding,
  buildExprBinding,
  narrowTypeByNotAssignableTarget,
  currentNarrowedType,
  resolveRuntimeUnionFrame,
  resolveRuntimeSubsetSourceInfo,
  buildRuntimeUnionComplementBinding,
  applyDirectTypeNarrowing,
} from "./narrowing-builders.js";

export const applyInstanceofRefinement = (
  condition: IrExpression,
  branch: BranchTruthiness,
  context: EmitterContext,
  emitExprAst: EmitExprAstFn
): EmitterContext | undefined => {
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
    const inferredRhsType = normalizeInstanceofTargetType(
      condition.right.inferredType
    );
    if (!inferredRhsType) {
      return undefined;
    }

    const currentType = currentNarrowedType(
      originalName,
      target.inferredType ?? condition.left.inferredType,
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
    buildExprBinding(
      exprAst,
      guard.targetType,
      guard.currentType,
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
    target.inferredType ?? arg.inferredType,
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

  const [rawTargetAst, rawTargetContext] = emitExprAst(
    target,
    withoutNarrowedBinding(context, bindingKey)
  );
  const runtimeUnionFrame = resolveRuntimeUnionFrame(
    bindingKey,
    currentType,
    rawTargetContext
  );

  if (runtimeUnionFrame) {
    const matchingIndices = findRuntimeUnionMemberIndices(
      runtimeUnionFrame.members,
      narrowing.targetType,
      rawTargetContext
    );
    const singleMatchIndex =
      matchingIndices.length === 1 ? matchingIndices[0] : undefined;
    const selectedMemberN =
      singleMatchIndex !== undefined
        ? (runtimeUnionFrame.candidateMemberNs[singleMatchIndex] ??
          singleMatchIndex + 1)
        : undefined;

    if (selectedMemberN !== undefined) {
      if (branch === "truthy") {
        return applyDirectTypeNarrowing(
          bindingKey,
          target,
          narrowedType,
          context,
          emitExprAst
        );
      }

      const complementBinding = buildRuntimeUnionComplementBinding(
        rawTargetAst,
        runtimeUnionFrame,
        currentType,
        narrowedType,
        selectedMemberN,
        rawTargetContext,
        resolveRuntimeSubsetSourceInfo(
          bindingKey,
          currentType,
          runtimeUnionFrame,
          context
        )
      );
      if (complementBinding) {
        return applyBinding(bindingKey, complementBinding, rawTargetContext);
      }
    }

    // Multi-slot predicate targets: a semantic alias (e.g., PathSpec)
    // may map to multiple runtime carrier slots after alias expansion.
    // Build runtimeSubset bindings so that both branches carry correct
    // runtime-slot knowledge.
    if (matchingIndices.length > 1) {
      const matchedMemberNs = matchingIndices
        .map((index) => runtimeUnionFrame.candidateMemberNs[index] ?? index + 1)
        .filter((n): n is number => n !== undefined);
      const complementMemberNs = runtimeUnionFrame.candidateMemberNs.filter(
        (memberN) => !matchedMemberNs.includes(memberN)
      );

      if (branch === "truthy" && matchedMemberNs.length > 0) {
        const sourceInfo = resolveRuntimeSubsetSourceInfo(
          bindingKey,
          currentType,
          runtimeUnionFrame,
          context
        );
        const subsetBinding: NarrowedBinding = {
          kind: "runtimeSubset",
          runtimeMemberNs: matchedMemberNs,
          runtimeUnionArity: runtimeUnionFrame.runtimeUnionArity,
          sourceMembers: sourceInfo.sourceMembers
            ? [...sourceInfo.sourceMembers]
            : undefined,
          sourceCandidateMemberNs: sourceInfo.sourceCandidateMemberNs
            ? [...sourceInfo.sourceCandidateMemberNs]
            : undefined,
          type: narrowedType,
          sourceType: sourceInfo.sourceType,
        };
        return applyBinding(bindingKey, subsetBinding, rawTargetContext);
      }

      if (branch === "falsy" && complementMemberNs.length > 0) {
        const sourceInfo = resolveRuntimeSubsetSourceInfo(
          bindingKey,
          currentType,
          runtimeUnionFrame,
          context
        );
        const complementBinding: NarrowedBinding = {
          kind: "runtimeSubset",
          runtimeMemberNs: complementMemberNs,
          runtimeUnionArity: runtimeUnionFrame.runtimeUnionArity,
          sourceMembers: sourceInfo.sourceMembers
            ? [...sourceInfo.sourceMembers]
            : undefined,
          sourceCandidateMemberNs: sourceInfo.sourceCandidateMemberNs
            ? [...sourceInfo.sourceCandidateMemberNs]
            : undefined,
          type: narrowedType,
          sourceType: sourceInfo.sourceType,
        };
        return applyBinding(bindingKey, complementBinding, rawTargetContext);
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
