/**
 * Structural guard detectors: in-guard, predicate-guard, and instanceof-guard.
 * Handles tryResolveInGuard, tryResolvePredicateGuard, and tryResolveInstanceofGuard.
 */

import { IrExpression } from "@tsonic/frontend";
import { EmitterContext } from "../../../types.js";
import { emitExpressionAst } from "../../../expression-emitter.js";
import { emitIdentifier } from "../../../expressions/identifiers.js";
import { resolveIdentifierCarrierStorageType } from "../../../expressions/direct-storage-types.js";
import { emitTypeAst } from "../../../type-emitter.js";
import type { CSharpTypeAst } from "../../../core/format/backend-ast/types.js";
import { hasDeterministicPropertyMembership } from "../../../core/semantic/type-resolution.js";
import {
  findExactRuntimeUnionMemberIndices,
  findRuntimeUnionMemberIndices,
  findRuntimeUnionInstanceofMemberIndices,
} from "../../../core/semantic/runtime-unions.js";
import { resolveAlignedRuntimeUnionMembers } from "../../../core/semantic/narrowed-union-resolution.js";
import { escapeCSharpIdentifier } from "../../../emitter-types/index.js";
import { emitRemappedLocalName } from "../../../core/format/local-names.js";
import { buildRuntimeSubsetExpressionAst } from "../../../core/semantic/narrowing-builders.js";
import {
  getMemberAccessNarrowKey,
  makeNarrowedLocalName,
} from "../../../core/semantic/narrowing-keys.js";
import { normalizeInstanceofTargetType } from "../../../core/semantic/instanceof-targets.js";
import { unwrapTransparentNarrowingTarget } from "../../../core/semantic/transparent-expressions.js";
import { buildSubsetUnionType } from "./branch-context.js";
import type {
  GuardInfo,
  InstanceofGuardInfo,
  InGuardInfo,
} from "./guard-types.js";
import {
  extractTransparentIdentifierTarget,
  resolveGuardRuntimeUnionFrame,
  buildRenameNarrowedMap,
  withoutNarrowedBinding,
} from "./guard-types.js";

/**
 * Try to extract guard info from an `("prop" in x)` binary expression.
 */
export const tryResolveInGuard = (
  condition: IrExpression,
  context: EmitterContext
): InGuardInfo | undefined => {
  if (condition.kind !== "binary") return undefined;
  if (condition.operator !== "in") return undefined;

  // LHS must be a string literal
  if (condition.left.kind !== "literal") return undefined;
  if (typeof condition.left.value !== "string") return undefined;

  // RHS must be a bindable identifier, even if transparent assertion wrappers
  // were introduced around it during earlier contextual typing/narrowing passes.
  const target = extractTransparentIdentifierTarget(condition.right);
  if (!target) return undefined;

  const propertyName = condition.left.value;
  const originalName = target.name;

  const unionSourceType = condition.right.inferredType ?? target.inferredType;
  if (!unionSourceType) return undefined;

  const frame = resolveGuardRuntimeUnionFrame(
    originalName,
    unionSourceType,
    target,
    context
  );
  if (!frame) return undefined;

  const { members, candidateMemberNs, runtimeUnionArity } = frame;
  const unionArity = members.length;
  if (unionArity < 2) return undefined;

  // Find which union members contain the property.
  const matchingIndices: number[] = [];
  const matchingMemberNs: number[] = [];
  for (let i = 0; i < members.length; i++) {
    const member = members[i];
    if (!member || member.kind !== "referenceType") continue;
    if (
      hasDeterministicPropertyMembership(member, propertyName, context) === true
    ) {
      matchingIndices.push(i);
      matchingMemberNs.push(candidateMemberNs[i] ?? i + 1);
    }
  }

  // Only support the common "exactly one matching member" narrowing case.
  if (matchingMemberNs.length !== 1) return undefined;

  const memberN = matchingMemberNs[0];
  if (!memberN) return undefined;
  const matchingIndex = matchingIndices[0];
  if (matchingIndex === undefined) return undefined;

  const nextId = (context.tempVarId ?? 0) + 1;
  const ctxWithId: EmitterContext = { ...context, tempVarId: nextId };

  const narrowedName = makeNarrowedLocalName(
    originalName,
    memberN ?? "subset",
    nextId
  );
  const escapedOrig = emitRemappedLocalName(originalName, context);
  const escapedNarrow = escapeCSharpIdentifier(narrowedName);
  const memberType = members[matchingIndex];
  if (!memberType) return undefined;
  const narrowedMap = buildRenameNarrowedMap(
    originalName,
    narrowedName,
    memberType,
    unionSourceType,
    ctxWithId
  );

  return {
    originalName,
    propertyName,
    memberN,
    unionArity,
    runtimeUnionArity,
    candidateMemberNs,
    candidateMembers: members,
    ctxWithId,
    narrowedName,
    escapedOrig,
    escapedNarrow,
    narrowedMap,
  };
};

/**
 * Try to extract guard info from a predicate call expression.
 * Returns GuardInfo if:
 * - call.narrowing is typePredicate
 * - predicate arg is identifier
 * - arg.inferredType resolves to unionType
 * - targetType exists in union
 */
export const tryResolvePredicateGuard = (
  call: Extract<IrExpression, { kind: "call" }>,
  context: EmitterContext
): GuardInfo | undefined => {
  const narrowing = call.narrowing;
  if (!narrowing || narrowing.kind !== "typePredicate") return undefined;

  const arg = call.arguments[narrowing.argIndex];
  if (!arg || ("kind" in arg && arg.kind === "spread")) {
    return undefined;
  }

  const target = unwrapTransparentNarrowingTarget(arg);
  if (!target) return undefined;

  const originalName =
    target.kind === "identifier"
      ? target.name
      : getMemberAccessNarrowKey(target);
  if (!originalName) return undefined;
  const unionSourceType = arg.inferredType ?? target.inferredType;
  if (!unionSourceType) return undefined;

  const frame = resolveGuardRuntimeUnionFrame(
    originalName,
    unionSourceType,
    target.kind === "identifier" ? target : undefined,
    context
  );
  if (!frame) return undefined;

  const matchingIndices = findRuntimeUnionMemberIndices(
    frame.members,
    narrowing.targetType,
    context
  );
  if (matchingIndices.length === 0) return undefined;

  const memberNs = matchingIndices
    .map((index) => frame.candidateMemberNs[index] ?? index + 1)
    .filter((memberN): memberN is number => memberN !== undefined);
  if (memberNs.length === 0) return undefined;

  const idx = matchingIndices[0];
  const memberN =
    matchingIndices.length === 1 && idx !== undefined
      ? (frame.candidateMemberNs[idx] ?? idx + 1)
      : undefined;
  const unionArity = frame.members.length;

  const nextId = (context.tempVarId ?? 0) + 1;
  const ctxWithId: EmitterContext = { ...context, tempVarId: nextId };

  const narrowedName = makeNarrowedLocalName(
    originalName,
    memberN ?? "subset",
    nextId
  );
  const rawContext = withoutNarrowedBinding(context, originalName);
  const [argAst] = emitExpressionAst(target, rawContext, unionSourceType);
  const escapedNarrow = escapeCSharpIdentifier(narrowedName);
  const currentSubsetBinding = context.narrowedBindings?.get(originalName);
  const sourceType =
    currentSubsetBinding?.sourceType ??
    currentSubsetBinding?.type ??
    buildSubsetUnionType(frame.members) ??
    unionSourceType;
  const narrowedMap = buildRenameNarrowedMap(
    originalName,
    narrowedName,
    narrowing.targetType,
    sourceType,
    ctxWithId
  );
  const hasExplicitSourceFrame =
    currentSubsetBinding?.kind === "runtimeSubset" &&
    currentSubsetBinding.sourceMembers &&
    currentSubsetBinding.sourceCandidateMemberNs &&
    currentSubsetBinding.sourceMembers.length ===
      currentSubsetBinding.sourceCandidateMemberNs.length;
  const sourceMembers = hasExplicitSourceFrame
    ? currentSubsetBinding.sourceMembers
    : frame.runtimeUnionArity === frame.members.length
      ? frame.members
      : undefined;
  const sourceCandidateMemberNs = hasExplicitSourceFrame
    ? currentSubsetBinding.sourceCandidateMemberNs
    : frame.runtimeUnionArity === frame.candidateMemberNs.length
      ? frame.candidateMemberNs
      : undefined;

  return {
    originalName,
    receiverAst: argAst,
    targetType: narrowing.targetType,
    memberN,
    memberNs,
    unionArity,
    runtimeUnionArity: frame.runtimeUnionArity,
    candidateMemberNs: frame.candidateMemberNs,
    candidateMembers: frame.members,
    ctxWithId,
    narrowedName,
    escapedNarrow,
    narrowedMap,
    sourceType,
    sourceMembers,
    sourceCandidateMemberNs,
  };
};

/**
 * Try to extract guard info from an `instanceof` binary expression.
 * Returns guard info if:
 * - condition is `binary` with operator `instanceof`
 * - lhs is identifier
 *
 * Note: rhs is emitted as a type name (C# pattern).
 */
export const tryResolveInstanceofGuard = (
  condition: IrExpression,
  context: EmitterContext
): InstanceofGuardInfo | undefined => {
  if (condition.kind !== "binary") return undefined;
  if (condition.operator !== "instanceof") return undefined;

  const target = unwrapTransparentNarrowingTarget(condition.left);
  if (!target) return undefined;

  const originalName =
    target.kind === "identifier"
      ? target.name
      : getMemberAccessNarrowKey(target);
  if (!originalName) return undefined;

  const unionSourceType = condition.left.inferredType ?? target.inferredType;
  const currentType =
    context.narrowedBindings?.get(originalName)?.type ?? unionSourceType;
  const activeNarrowedBinding = context.narrowedBindings?.get(originalName);
  const [lhsAst, ctxAfterLhs] = (() => {
    if (target.kind !== "identifier") {
      return emitExpressionAst(target, context, currentType);
    }

    if (activeNarrowedBinding?.kind === "expr") {
      return [activeNarrowedBinding.exprAst, context] as const;
    }

    if (activeNarrowedBinding?.kind === "runtimeSubset") {
      const subsetAst = buildRuntimeSubsetExpressionAst(
        target,
        activeNarrowedBinding,
        context
      );
      if (subsetAst) {
        return subsetAst;
      }
    }

    return emitIdentifier(target, context, currentType);
  })();
  const escapedOrig =
    target.kind === "identifier"
      ? emitRemappedLocalName(originalName, context)
      : originalName;

  const nextId = (ctxAfterLhs.tempVarId ?? 0) + 1;
  const ctxWithId: EmitterContext = { ...ctxAfterLhs, tempVarId: nextId };

  const [rhsAst, rhsCtxAfterExpr] = emitExpressionAst(
    condition.right,
    ctxWithId
  );

  const inferredRhsType = normalizeInstanceofTargetType(
    condition.right.inferredType
  );
  let rhsTypeAst: CSharpTypeAst | undefined;
  let ctxAfterRhs = rhsCtxAfterExpr;

  if (rhsAst.kind === "typeReferenceExpression") {
    rhsTypeAst = rhsAst.type;
  } else if (inferredRhsType) {
    const [emittedTypeAst, nextCtx] = emitTypeAst(
      inferredRhsType,
      rhsCtxAfterExpr
    );
    rhsTypeAst = emittedTypeAst;
    ctxAfterRhs = nextCtx;
  }

  if (!rhsTypeAst) {
    return undefined;
  }

  // Pattern variable name for the narrowed value.
  const narrowedName = makeNarrowedLocalName(originalName, "is", nextId);
  const escapedNarrow = escapeCSharpIdentifier(narrowedName);
  const carrierSourceType =
    (target.kind === "identifier"
      ? resolveIdentifierCarrierStorageType(target, context)
      : undefined) ??
    context.narrowedBindings?.get(originalName)?.sourceType ??
    unionSourceType;
  const narrowedMap = new Map(ctxAfterRhs.narrowedBindings ?? []);
  narrowedMap.set(originalName, {
    kind: "rename",
    name: narrowedName,
    type: inferredRhsType ?? undefined,
    sourceType: carrierSourceType,
  });
  const runtimeUnionFrame =
    currentType && inferredRhsType
      ? resolveAlignedRuntimeUnionMembers(
          originalName,
          currentType,
          carrierSourceType,
          context
        )
      : undefined;
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
  const receiverAst =
    runtimeUnionFrame && target.kind === "identifier"
      ? {
          kind: "identifierExpression" as const,
          identifier: escapedOrig,
        }
      : lhsAst;

  return {
    originalName,
    receiverAst,
    rhsTypeAst,
    ctxWithId,
    ctxAfterRhs,
    narrowedName,
    escapedOrig,
    escapedNarrow,
    narrowedMap,
    targetType: inferredRhsType ?? undefined,
    memberN,
    memberNeedsPatternCheck,
    runtimeUnionArity: runtimeUnionFrame?.runtimeUnionArity,
    candidateMemberNs: runtimeUnionFrame?.candidateMemberNs,
    candidateMembers: runtimeUnionFrame?.members,
  };
};
