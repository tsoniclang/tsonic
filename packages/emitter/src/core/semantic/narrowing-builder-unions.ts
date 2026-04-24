/**
 * Runtime union narrowing binding builders and direct type narrowing.
 *
 * Builds narrowed bindings for runtime Union<T1..Tn> types:
 * - complement bindings (remaining members after excluding one)
 * - subset bindings (selected members matching a target type)
 * - direct type narrowing with materialization
 */

import { IrExpression, IrType } from "@tsonic/frontend";
import type { EmitterContext, NarrowedBinding } from "../../types.js";
import type {
  CSharpExpressionAst,
  CSharpTypeAst,
} from "../format/backend-ast/types.js";
import { identifierExpression } from "../format/backend-ast/builders.js";
import { emitTypeAst } from "../../type-emitter.js";
import { escapeCSharpIdentifier } from "../../emitter-types/index.js";
import {
  splitRuntimeNullishUnionMembers,
  resolveTypeAlias,
  unionMemberMatchesTarget,
} from "./type-resolution.js";
import { resolveEffectiveExpressionType } from "./narrowed-expression-types.js";
import { buildRuntimeUnionLayout } from "./runtime-unions.js";
import {
  buildInvalidRuntimeUnionCastExpression,
  tryBuildRuntimeUnionProjectionToLayoutAst,
} from "./runtime-union-projection.js";
import { materializeDirectNarrowingAst } from "./materialized-narrowing.js";
import { tryBuildRuntimeMaterializationAst } from "./runtime-reification.js";
import { willCarryAsRuntimeUnion } from "./union-semantics.js";
import { resolveIdentifierRuntimeCarrierType } from "./direct-storage-ir-types.js";
import {
  type RuntimeUnionFrame,
  type RuntimeSubsetSourceInfo,
  type EmitExprAstFn,
  buildUnionNarrowAst,
  buildSubsetUnionType,
  toReceiverAst,
  withoutNarrowedBinding,
  applyBinding,
  buildExprBinding,
  buildProjectedExprBinding,
  buildConditionalNullishGuardAst,
  currentNarrowedType,
  resolveRuntimeSubsetSourceInfo,
  resolveRuntimeUnionFrame,
} from "./narrowing-builder-core.js";
import { areIrTypesEquivalent } from "./type-equivalence.js";

export const buildRuntimeUnionComplementBinding = (
  receiver: CSharpExpressionAst,
  runtimeUnionFrame: RuntimeUnionFrame,
  sourceType: IrType,
  narrowedType: IrType,
  selectedMemberN: number,
  context: EmitterContext,
  sourceInfo?: RuntimeSubsetSourceInfo
): NarrowedBinding | undefined => {
  const remainingPairs = runtimeUnionFrame.candidateMemberNs.flatMap(
    (runtimeMemberN, index) => {
      if (runtimeMemberN === selectedMemberN) {
        return [];
      }

      const memberType = runtimeUnionFrame.members[index];
      if (!memberType) {
        return [];
      }

      return [{ runtimeMemberN, memberType }];
    }
  );

  if (remainingPairs.length === 0) {
    return undefined;
  }

  const split = splitRuntimeNullishUnionMembers(narrowedType);
  const hasRuntimeNullish = split?.hasRuntimeNullish ?? false;

  if (remainingPairs.length === 1) {
    const remaining = remainingPairs[0];
    if (!remaining) return undefined;
    const carrierSourceType = sourceInfo?.sourceType ?? sourceType;

    const narrowedExpr = buildUnionNarrowAst(
      receiver,
      remaining.runtimeMemberN
    );
    if (!hasRuntimeNullish) {
      return buildProjectedExprBinding(
        narrowedExpr,
        narrowedType,
        carrierSourceType,
        toReceiverAst(receiver),
        undefined,
        carrierSourceType
      );
    }

    const [nullAwareExpr] = buildConditionalNullishGuardAst(
      receiver,
      narrowedExpr,
      narrowedType,
      context
    );
    return buildProjectedExprBinding(
      nullAwareExpr,
      narrowedType,
      carrierSourceType,
      toReceiverAst(receiver),
      undefined,
      carrierSourceType
    );
  }

  if (hasRuntimeNullish) {
    const carrierSourceType = sourceInfo?.sourceType ?? sourceType;
    const sourceFrame =
      sourceInfo?.sourceMembers &&
      sourceInfo.sourceCandidateMemberNs &&
      sourceInfo.sourceMembers.length ===
        sourceInfo.sourceCandidateMemberNs.length
        ? {
            members: sourceInfo.sourceMembers,
            candidateMemberNs: sourceInfo.sourceCandidateMemberNs,
          }
        : runtimeUnionFrame.runtimeUnionArity ===
            runtimeUnionFrame.members.length
          ? {
              members: runtimeUnionFrame.members,
              candidateMemberNs: runtimeUnionFrame.candidateMemberNs,
            }
          : undefined;
    const selectedSourceMemberNs = new Set(
      remainingPairs.map((pair) => pair.runtimeMemberN)
    );
    const materialized = tryBuildRuntimeMaterializationAst(
      receiver,
      carrierSourceType,
      narrowedType,
      context,
      emitTypeAst,
      selectedSourceMemberNs,
      sourceFrame
    );
    if (!materialized) {
      return undefined;
    }

    const [nullAwareExpr] = buildConditionalNullishGuardAst(
      receiver,
      materialized[0],
      narrowedType,
      materialized[1]
    );
    return buildProjectedExprBinding(
      nullAwareExpr,
      narrowedType,
      carrierSourceType,
      toReceiverAst(receiver),
      undefined,
      carrierSourceType
    );
  }

  return {
    kind: "runtimeSubset",
    runtimeMemberNs: remainingPairs.map((pair) => pair.runtimeMemberN),
    runtimeUnionArity: runtimeUnionFrame.runtimeUnionArity,
    storageExprAst: toReceiverAst(receiver),
    sourceMembers: sourceInfo?.sourceMembers
      ? [...sourceInfo.sourceMembers]
      : runtimeUnionFrame.runtimeUnionArity === runtimeUnionFrame.members.length
        ? [...runtimeUnionFrame.members]
        : undefined,
    sourceCandidateMemberNs: sourceInfo?.sourceCandidateMemberNs
      ? [...sourceInfo.sourceCandidateMemberNs]
      : runtimeUnionFrame.runtimeUnionArity ===
          runtimeUnionFrame.candidateMemberNs.length
        ? [...runtimeUnionFrame.candidateMemberNs]
        : undefined,
    type: narrowedType,
    sourceType: sourceInfo?.sourceType ?? sourceType,
  };
};

export const buildRuntimeUnionSubsetBinding = (
  receiverAst: CSharpExpressionAst,
  runtimeUnionFrame: RuntimeUnionFrame,
  sourceType: IrType,
  narrowedType: IrType,
  context: EmitterContext,
  sourceInfo?: RuntimeSubsetSourceInfo
): [NarrowedBinding, EmitterContext] | undefined => {
  const resolvedSource = resolveTypeAlias(sourceType, context);
  const shouldReifyBroadCarrier =
    resolvedSource.kind === "unknownType" ||
    resolvedSource.kind === "anyType" ||
    resolvedSource.kind === "objectType" ||
    (resolvedSource.kind === "referenceType" &&
      resolvedSource.name === "object");
  let narrowedReceiverAst = receiverAst;
  let narrowedReceiverContext = context;
  let narrowedReceiverSourceType = sourceType;
  if (shouldReifyBroadCarrier) {
    const runtimeCarrierType =
      buildSubsetUnionType(runtimeUnionFrame.members) ?? sourceType;
    const [reifiedCarrierAst, reifiedCarrierContext] =
      materializeDirectNarrowingAst(
        receiverAst,
        sourceType,
        runtimeCarrierType,
        context
      );
    narrowedReceiverAst = reifiedCarrierAst;
    narrowedReceiverContext = reifiedCarrierContext;
    narrowedReceiverSourceType = runtimeCarrierType;
  }

  const split = splitRuntimeNullishUnionMembers(narrowedType);
  const nonNullishTarget =
    split?.nonNullishMembers && split.nonNullishMembers.length > 0
      ? (buildSubsetUnionType(split.nonNullishMembers) ?? narrowedType)
      : narrowedType;

  const selectedPairs = runtimeUnionFrame.candidateMemberNs.flatMap(
    (runtimeMemberN, index) => {
      const memberType = runtimeUnionFrame.members[index];
      if (!memberType) {
        return [];
      }

      return unionMemberMatchesTarget(memberType, nonNullishTarget, context)
        ? [{ runtimeMemberN, memberType }]
        : [];
    }
  );

  if (selectedPairs.length === 0) {
    return undefined;
  }

  if (selectedPairs.length === 1 && !(split?.hasRuntimeNullish ?? false)) {
    const selected = selectedPairs[0];
    if (!selected) {
      return undefined;
    }
    return [
      buildProjectedExprBinding(
        buildUnionNarrowAst(narrowedReceiverAst, selected.runtimeMemberN),
        narrowedType,
        narrowedReceiverSourceType,
        narrowedReceiverAst,
        undefined,
        narrowedReceiverSourceType
      ),
      narrowedReceiverContext,
    ];
  }

  const [subsetLayout, subsetLayoutContext] = buildRuntimeUnionLayout(
    nonNullishTarget,
    context,
    emitTypeAst
  );
  if (!subsetLayout) {
    const [materializedExprAst, materializedContext] =
      materializeDirectNarrowingAst(
        narrowedReceiverAst,
        narrowedReceiverSourceType,
        narrowedType,
        narrowedReceiverContext
      );
    return [
      buildProjectedExprBinding(
        materializedExprAst,
        narrowedType,
        narrowedReceiverSourceType,
        narrowedReceiverAst,
        undefined,
        narrowedReceiverSourceType
      ),
      materializedContext,
    ];
  }

  const subsetTypeContext = subsetLayoutContext;
  const selectedRuntimeMembers = new Set(
    selectedPairs.map((pair) => pair.runtimeMemberN)
  );
  const explicitSourceFrame =
    sourceInfo?.sourceMembers &&
    sourceInfo.sourceCandidateMemberNs &&
    sourceInfo.sourceMembers.length ===
      sourceInfo.sourceCandidateMemberNs.length
      ? {
          members: sourceInfo.sourceMembers,
          candidateMemberNs: sourceInfo.sourceCandidateMemberNs,
          runtimeUnionArity: sourceInfo.sourceCandidateMemberNs.length,
        }
      : runtimeUnionFrame.runtimeUnionArity ===
            runtimeUnionFrame.members.length &&
          runtimeUnionFrame.members.length ===
            runtimeUnionFrame.candidateMemberNs.length
        ? {
            members: runtimeUnionFrame.members,
            candidateMemberNs: runtimeUnionFrame.candidateMemberNs,
            runtimeUnionArity: runtimeUnionFrame.runtimeUnionArity,
          }
        : undefined;
  const sourceMembers =
    explicitSourceFrame?.members ?? runtimeUnionFrame.members;
  const sourceCandidateMemberNs =
    explicitSourceFrame?.candidateMemberNs ??
    runtimeUnionFrame.candidateMemberNs;
  const sourceRuntimeUnionArity =
    explicitSourceFrame?.runtimeUnionArity ??
    runtimeUnionFrame.runtimeUnionArity;

  const sourceMemberTypeAsts: CSharpTypeAst[] = [];
  let sourceLayoutContext = subsetTypeContext;
  for (const member of sourceMembers) {
    const [typeAst, nextContext] = emitTypeAst(member, sourceLayoutContext);
    sourceMemberTypeAsts.push(typeAst);
    sourceLayoutContext = nextContext;
  }

  const projectedSubset = tryBuildRuntimeUnionProjectionToLayoutAst({
    valueAst: narrowedReceiverAst,
    sourceLayout: {
      members: sourceMembers,
      memberTypeAsts: sourceMemberTypeAsts,
      carrierTypeArgumentAsts: sourceMemberTypeAsts,
      runtimeUnionArity: sourceRuntimeUnionArity,
    },
    targetLayout: subsetLayout,
    context: sourceLayoutContext,
    candidateMemberNs: sourceCandidateMemberNs,
    selectedSourceMemberNs: selectedRuntimeMembers,
    buildMappedMemberValue: ({ parameterExpr, context: nextContext }) => [
      parameterExpr,
      nextContext,
    ],
    buildExcludedMemberBody: ({ actualMember }) =>
      buildInvalidRuntimeUnionCastExpression(actualMember, narrowedType),
    buildUnmappedMemberBody: ({ actualMember }) =>
      buildInvalidRuntimeUnionCastExpression(actualMember, narrowedType),
  });
  if (!projectedSubset) {
    return undefined;
  }

  const [matchExpr, matchContext] = projectedSubset;

  const exprAst = split?.hasRuntimeNullish
    ? buildConditionalNullishGuardAst(
        narrowedReceiverAst,
        matchExpr,
        narrowedType,
        matchContext
      )[0]
    : matchExpr;

  return [
    buildProjectedExprBinding(
      exprAst,
      narrowedType,
      narrowedReceiverSourceType,
      narrowedReceiverAst,
      undefined,
      narrowedReceiverSourceType
    ),
    matchContext,
  ];
};

export const applyDirectTypeNarrowing = (
  bindingKey: string,
  targetExpr: Extract<IrExpression, { kind: "identifier" | "memberAccess" }>,
  narrowedType: IrType,
  context: EmitterContext,
  emitExprAst: EmitExprAstFn,
  storageType?: IrType
): EmitterContext => {
  const existingBinding = context.narrowedBindings?.get(bindingKey);
  if (
    existingBinding?.type &&
    areIrTypesEquivalent(
      resolveTypeAlias(existingBinding.type, context),
      resolveTypeAlias(narrowedType, context),
      context
    )
  ) {
    return context;
  }

  const currentType = currentNarrowedType(
    bindingKey,
    resolveEffectiveExpressionType(targetExpr, context) ??
      targetExpr.inferredType,
    context
  );
  const [rawTargetAst, rawTargetContext] = emitExprAst(
    targetExpr,
    withoutNarrowedBinding(context, bindingKey)
  );
  const identifierStorageType =
    targetExpr.kind === "identifier"
      ? rawTargetContext.localValueTypes?.get(targetExpr.name)
      : undefined;
  const identifierCarrierType =
    targetExpr.kind === "identifier"
      ? resolveIdentifierRuntimeCarrierType(targetExpr, rawTargetContext)
      : undefined;
  const rawCarrierType =
    identifierCarrierType ??
    currentType ??
    targetExpr.inferredType ??
    identifierStorageType;
  const [carrierAst, carrierContext, carrierType] = (() => {
    if (!existingBinding) {
      return [rawTargetAst, rawTargetContext, rawCarrierType] as const;
    }

    if (existingBinding.kind === "rename") {
      return [
        identifierExpression(escapeCSharpIdentifier(existingBinding.name)),
        context,
        existingBinding.type ??
          existingBinding.sourceType ??
          currentType ??
          targetExpr.inferredType,
      ] as const;
    }

    if (existingBinding.kind === "expr") {
      const exprCarrierType = existingBinding.carrierExprAst
        ? (existingBinding.carrierType ??
          existingBinding.sourceType ??
          identifierCarrierType ??
          existingBinding.type ??
          existingBinding.storageType ??
          currentType ??
          targetExpr.inferredType)
        : (existingBinding.sourceType ??
          identifierCarrierType ??
          existingBinding.type ??
          currentType ??
          targetExpr.inferredType);
      const exprCarrierFrame = currentType
        ? resolveRuntimeUnionFrame(bindingKey, currentType, context)
        : undefined;
      if (existingBinding.storageExprAst && exprCarrierFrame) {
        const existingCarrierAst =
          existingBinding.carrierExprAst ?? existingBinding.storageExprAst;
        const existingBindingType =
          existingBinding.type &&
          resolveTypeAlias(existingBinding.type, context);
        const resolvedCurrentType =
          currentType && resolveTypeAlias(currentType, context);
        const existingBindingSourceType =
          existingBinding.sourceType &&
          resolveTypeAlias(existingBinding.sourceType, context);
        const sourceCarrierStillUsesRuntimeUnion =
          !!existingBinding.sourceType &&
          willCarryAsRuntimeUnion(existingBinding.sourceType, context);
        const shouldPreferOriginalStorageCarrier =
          existingBindingType !== undefined &&
          resolvedCurrentType !== undefined &&
          areIrTypesEquivalent(
            existingBindingType,
            resolvedCurrentType,
            context
          ) &&
          existingBindingSourceType !== undefined &&
          !areIrTypesEquivalent(
            existingBindingSourceType,
            resolvedCurrentType,
            context
          ) &&
          sourceCarrierStillUsesRuntimeUnion;
        if (shouldPreferOriginalStorageCarrier) {
          return [existingCarrierAst, context, exprCarrierType] as const;
        }
        if (
          existingBindingType !== undefined &&
          resolvedCurrentType !== undefined &&
          areIrTypesEquivalent(
            existingBindingType,
            resolvedCurrentType,
            context
          )
        ) {
          return [existingBinding.exprAst, context, exprCarrierType] as const;
        }
        return [existingCarrierAst, context, exprCarrierType] as const;
      }

      return [existingBinding.exprAst, context, exprCarrierType] as const;
    }

    if (existingBinding.kind === "runtimeSubset") {
      const subsetCarrierType =
        existingBinding.sourceType ??
        existingBinding.type ??
        currentType ??
        targetExpr.inferredType;
      return [
        existingBinding.storageExprAst ?? rawTargetAst,
        context,
        subsetCarrierType,
      ] as const;
    }

    return [rawTargetAst, rawTargetContext, rawCarrierType] as const;
  })();

  const runtimeUnionFrame = currentType
    ? resolveRuntimeUnionFrame(bindingKey, currentType, context)
    : undefined;
  const carrierSourceType =
    carrierType ?? currentType ?? targetExpr.inferredType;
  const runtimeSubsetSourceInfo =
    currentType && runtimeUnionFrame
      ? resolveRuntimeSubsetSourceInfo(
          bindingKey,
          currentType,
          runtimeUnionFrame,
          context
        )
      : undefined;

  if (runtimeUnionFrame && currentType) {
    const subsetBinding = buildRuntimeUnionSubsetBinding(
      carrierAst,
      runtimeUnionFrame,
      carrierSourceType ?? currentType,
      narrowedType,
      carrierContext,
      runtimeSubsetSourceInfo
    );
    if (subsetBinding) {
      const [binding, subsetContext] = subsetBinding;
      return applyBinding(bindingKey, binding, subsetContext);
    }
  }

  const [materializedExprAst, materializedContext] =
    materializeDirectNarrowingAst(
      carrierAst,
      carrierSourceType,
      narrowedType,
      carrierContext
    );
  const carrierStorageAst =
    existingBinding?.kind === "expr"
      ? (existingBinding.storageExprAst ??
        existingBinding.carrierExprAst ??
        carrierAst)
      : carrierAst;
  const preservedCarrierAst =
    existingBinding?.kind === "expr"
      ? (existingBinding.carrierExprAst ??
        existingBinding.storageExprAst ??
        carrierAst)
      : carrierAst;
  const effectiveStorageType =
    storageType ??
    (existingBinding?.kind === "expr"
      ? existingBinding.storageType
      : undefined) ??
    identifierStorageType ??
    rawCarrierType;

  if (effectiveStorageType) {
    return applyBinding(
      bindingKey,
      buildExprBinding(
        materializedExprAst,
        narrowedType,
        carrierSourceType,
        carrierStorageAst,
        effectiveStorageType,
        preservedCarrierAst,
        carrierType
      ),
      materializedContext
    );
  }

  return applyBinding(
    bindingKey,
    buildProjectedExprBinding(
      materializedExprAst,
      narrowedType,
      carrierSourceType,
      preservedCarrierAst,
      undefined,
      carrierType
    ),
    materializedContext
  );
};
