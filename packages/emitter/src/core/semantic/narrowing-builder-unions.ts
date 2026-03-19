/**
 * Runtime union narrowing binding builders and direct type narrowing.
 *
 * Builds narrowed bindings for runtime Union<T1..Tn> types:
 * - complement bindings (remaining members after excluding one)
 * - subset bindings (selected members matching a target type)
 * - direct type narrowing with materialization
 */

import { IrExpression, IrType } from "@tsonic/frontend";
import { stableIrTypeKey } from "@tsonic/frontend";
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
import { buildRuntimeUnionLayout } from "./runtime-unions.js";
import {
  buildInvalidRuntimeUnionCastExpression,
  tryBuildRuntimeUnionProjectionToLayoutAst,
} from "./runtime-union-projection.js";
import { materializeDirectNarrowingAst } from "./materialized-narrowing.js";
import {
  type RuntimeUnionFrame,
  type EmitExprAstFn,
  buildUnionNarrowAst,
  buildSubsetUnionType,
  toReceiverAst,
  withoutNarrowedBinding,
  applyBinding,
  buildExprBinding,
  buildConditionalNullishGuardAst,
  buildRuntimeSubsetExpressionAst,
  currentNarrowedType,
  resolveRuntimeUnionFrame,
} from "./narrowing-builder-core.js";

export const buildRuntimeUnionComplementBinding = (
  receiver: CSharpExpressionAst,
  runtimeUnionFrame: RuntimeUnionFrame,
  sourceType: IrType,
  narrowedType: IrType,
  selectedMemberN: number,
  context: EmitterContext
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

    const narrowedExpr = buildUnionNarrowAst(
      receiver,
      remaining.runtimeMemberN
    );
    if (!hasRuntimeNullish) {
      return buildExprBinding(
        narrowedExpr,
        narrowedType,
        sourceType,
        toReceiverAst(receiver)
      );
    }

    const [nullAwareExpr] = buildConditionalNullishGuardAst(
      receiver,
      narrowedExpr,
      narrowedType,
      context
    );
    return buildExprBinding(
      nullAwareExpr,
      narrowedType,
      sourceType,
      toReceiverAst(receiver)
    );
  }

  if (hasRuntimeNullish) {
    return undefined;
  }

  return {
    kind: "runtimeSubset",
    runtimeMemberNs: remainingPairs.map((pair) => pair.runtimeMemberN),
    runtimeUnionArity: runtimeUnionFrame.runtimeUnionArity,
    sourceMembers: [...runtimeUnionFrame.members],
    sourceCandidateMemberNs: [...runtimeUnionFrame.candidateMemberNs],
    type: narrowedType,
    sourceType,
  };
};

export const buildRuntimeUnionSubsetBinding = (
  receiverAst: CSharpExpressionAst,
  runtimeUnionFrame: RuntimeUnionFrame,
  sourceType: IrType,
  narrowedType: IrType,
  context: EmitterContext
): [NarrowedBinding, EmitterContext] | undefined => {
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
      buildExprBinding(
        buildUnionNarrowAst(receiverAst, selected.runtimeMemberN),
        narrowedType,
        sourceType,
        receiverAst
      ),
      context,
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
        receiverAst,
        sourceType,
        narrowedType,
        context
      );
    return [
      buildExprBinding(
        materializedExprAst,
        narrowedType,
        sourceType,
        receiverAst
      ),
      materializedContext,
    ];
  }

  const subsetTypeContext = subsetLayoutContext;
  const selectedRuntimeMembers = new Set(
    selectedPairs.map((pair) => pair.runtimeMemberN)
  );
  const sourceMemberTypeAsts: CSharpTypeAst[] = [];
  let sourceLayoutContext = subsetTypeContext;
  for (const member of runtimeUnionFrame.members) {
    const [typeAst, nextContext] = emitTypeAst(member, sourceLayoutContext);
    sourceMemberTypeAsts.push(typeAst);
    sourceLayoutContext = nextContext;
  }

  const projectedSubset = tryBuildRuntimeUnionProjectionToLayoutAst({
    valueAst: receiverAst,
    sourceLayout: {
      members: runtimeUnionFrame.members,
      memberTypeAsts: sourceMemberTypeAsts,
      runtimeUnionArity: runtimeUnionFrame.runtimeUnionArity,
    },
    targetLayout: subsetLayout,
    context: sourceLayoutContext,
    candidateMemberNs: runtimeUnionFrame.candidateMemberNs,
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
        receiverAst,
        matchExpr,
        narrowedType,
        matchContext
      )[0]
    : matchExpr;

  return [
    buildExprBinding(exprAst, narrowedType, sourceType, receiverAst),
    matchContext,
  ];
};

export const applyDirectTypeNarrowing = (
  bindingKey: string,
  targetExpr: Extract<IrExpression, { kind: "identifier" | "memberAccess" }>,
  narrowedType: IrType,
  context: EmitterContext,
  emitExprAst: EmitExprAstFn
): EmitterContext => {
  const existingBinding = context.narrowedBindings?.get(bindingKey);
  if (
    existingBinding?.type &&
    stableIrTypeKey(resolveTypeAlias(existingBinding.type, context)) ===
      stableIrTypeKey(resolveTypeAlias(narrowedType, context))
  ) {
    return context;
  }

  const currentType = currentNarrowedType(
    bindingKey,
    targetExpr.inferredType,
    context
  );
  const [rawTargetAst, rawTargetContext] = emitExprAst(
    targetExpr,
    withoutNarrowedBinding(context, bindingKey)
  );
  const [carrierAst, carrierContext] = (() => {
    if (!existingBinding) {
      return [rawTargetAst, rawTargetContext] as const;
    }

    if (existingBinding.kind === "rename") {
      return [
        identifierExpression(escapeCSharpIdentifier(existingBinding.name)),
        context,
      ] as const;
    }

    if (existingBinding.kind === "expr") {
      return [existingBinding.exprAst, context] as const;
    }

    if (
      existingBinding.kind === "runtimeSubset" &&
      targetExpr.kind === "identifier"
    ) {
      const subsetAst = buildRuntimeSubsetExpressionAst(
        targetExpr,
        existingBinding,
        context
      );
      if (subsetAst) {
        return subsetAst;
      }
    }

    return [rawTargetAst, rawTargetContext] as const;
  })();

  const runtimeUnionFrame = currentType
    ? resolveRuntimeUnionFrame(bindingKey, currentType, context)
    : undefined;

  if (runtimeUnionFrame && currentType) {
    const subsetBinding = buildRuntimeUnionSubsetBinding(
      carrierAst,
      runtimeUnionFrame,
      currentType,
      narrowedType,
      carrierContext
    );
    if (subsetBinding) {
      const [binding, subsetContext] = subsetBinding;
      return applyBinding(bindingKey, binding, subsetContext);
    }
  }

  const [materializedExprAst, materializedContext] =
    materializeDirectNarrowingAst(
      carrierAst,
      currentType,
      narrowedType,
      carrierContext
    );

  return applyBinding(
    bindingKey,
    buildExprBinding(
      materializedExprAst,
      narrowedType,
      currentType,
      carrierAst
    ),
    materializedContext
  );
};
