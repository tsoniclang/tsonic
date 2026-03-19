import { IrExpression, IrType, normalizedUnionType } from "@tsonic/frontend";
import type { EmitterContext, NarrowedBinding } from "../../types.js";
import type {
  CSharpExpressionAst,
  CSharpTypeAst,
} from "../format/backend-ast/types.js";
import { identifierExpression } from "../format/backend-ast/builders.js";
import { emitTypeAst } from "../../type-emitter.js";
import { nullLiteral } from "../format/backend-ast/builders.js";
import { escapeCSharpIdentifier } from "../../emitter-types/index.js";
import {
  splitRuntimeNullishUnionMembers,
  stripNullish,
  resolveTypeAlias,
  unionMemberMatchesTarget,
} from "./type-resolution.js";
import { stableIrTypeKey } from "@tsonic/frontend";
import { buildRuntimeUnionLayout } from "./runtime-unions.js";
import {
  resolveNarrowedUnionMembers,
  type NarrowedUnionMembers,
} from "./narrowed-union-resolution.js";
import {
  buildInvalidRuntimeUnionCastExpression,
  tryBuildRuntimeUnionProjectionToLayoutAst,
} from "./runtime-union-projection.js";
import { materializeDirectNarrowingAst } from "./materialized-narrowing.js";
import {
  RuntimeMaterializationSourceFrame,
  tryBuildRuntimeMaterializationAst,
} from "./runtime-reification.js";

export type BranchTruthiness = "truthy" | "falsy";

export type EmitExprAstFn = (
  expr: IrExpression,
  context: EmitterContext
) => [CSharpExpressionAst, EmitterContext];

export type RuntimeUnionFrame = NarrowedUnionMembers;

export const toReceiverAst = (
  receiver: string | CSharpExpressionAst
): CSharpExpressionAst =>
  typeof receiver === "string"
    ? { kind: "identifierExpression", identifier: receiver }
    : receiver;

export const buildUnionNarrowAst = (
  receiver: string | CSharpExpressionAst,
  memberN: number
): CSharpExpressionAst => ({
  kind: "parenthesizedExpression",
  expression: {
    kind: "invocationExpression",
    expression: {
      kind: "memberAccessExpression",
      expression: toReceiverAst(receiver),
      memberName: `As${memberN}`,
    },
    arguments: [],
  },
});

export const buildSubsetUnionType = (
  members: readonly IrType[]
): IrType | undefined => {
  if (members.length === 0) return undefined;
  if (members.length === 1) return members[0];
  return normalizedUnionType(members);
};

export const withoutNarrowedBinding = (
  context: EmitterContext,
  bindingKey: string
): EmitterContext => {
  if (!context.narrowedBindings?.has(bindingKey)) {
    return context;
  }

  const narrowedBindings = new Map(context.narrowedBindings);
  narrowedBindings.delete(bindingKey);

  return {
    ...context,
    narrowedBindings,
  };
};

export const applyBinding = (
  bindingKey: string,
  binding: NarrowedBinding,
  context: EmitterContext
): EmitterContext => {
  const narrowedBindings = new Map(context.narrowedBindings ?? []);
  narrowedBindings.set(bindingKey, binding);
  return {
    ...context,
    narrowedBindings,
  };
};

export const buildExprBinding = (
  exprAst: CSharpExpressionAst,
  type: IrType | undefined,
  sourceType: IrType | undefined,
  storageExprAst?: CSharpExpressionAst
): Extract<NarrowedBinding, { kind: "expr" }> => ({
  kind: "expr",
  exprAst,
  storageExprAst,
  type,
  sourceType,
});

export const buildRuntimeSubsetExpressionAst = (
  expr: Extract<IrExpression, { kind: "identifier" }>,
  narrowed: Extract<NarrowedBinding, { kind: "runtimeSubset" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] | undefined => {
  const sourceType = narrowed.sourceType ?? expr.inferredType;
  const subsetType = narrowed.type;
  if (!sourceType || !subsetType) {
    return undefined;
  }

  const sourceFrame: RuntimeMaterializationSourceFrame | undefined =
    narrowed.sourceMembers &&
    narrowed.sourceCandidateMemberNs &&
    narrowed.sourceMembers.length === narrowed.sourceCandidateMemberNs.length
      ? {
          members: narrowed.sourceMembers,
          candidateMemberNs: narrowed.sourceCandidateMemberNs,
        }
      : undefined;

  return tryBuildRuntimeMaterializationAst(
    identifierExpression(escapeCSharpIdentifier(expr.name)),
    sourceType,
    subsetType,
    context,
    emitTypeAst,
    new Set(narrowed.runtimeMemberNs),
    sourceFrame
  );
};

export const buildConditionalNullishGuardAst = (
  sourceAst: CSharpExpressionAst,
  whenNonNull: CSharpExpressionAst,
  targetType: IrType,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  const [targetTypeAst, nextContext] = emitTypeAst(
    stripNullish(targetType),
    context
  );
  return [
    {
      kind: "conditionalExpression",
      condition: {
        kind: "binaryExpression",
        operatorToken: "==",
        left: {
          kind: "castExpression",
          type: { kind: "predefinedType", keyword: "object" },
          expression: sourceAst,
        },
        right: nullLiteral(),
      },
      whenTrue: {
        kind: "defaultExpression",
        type: targetTypeAst,
      },
      whenFalse: whenNonNull,
    },
    nextContext,
  ];
};

export const tryStripConditionalNullishGuardAst = (
  exprAst: CSharpExpressionAst
): CSharpExpressionAst | undefined => {
  if (exprAst.kind !== "conditionalExpression") {
    return undefined;
  }

  const condition = exprAst.condition;
  if (
    condition.kind !== "binaryExpression" ||
    condition.operatorToken !== "=="
  ) {
    return undefined;
  }

  if (
    condition.left.kind !== "castExpression" ||
    condition.left.type.kind !== "predefinedType" ||
    condition.left.type.keyword !== "object"
  ) {
    return undefined;
  }

  if (condition.right.kind !== "nullLiteralExpression") {
    return undefined;
  }

  if (exprAst.whenTrue.kind !== "defaultExpression") {
    return undefined;
  }

  return exprAst.whenFalse;
};

export const isArrayLikeNarrowingCandidate = (
  type: IrType,
  context: EmitterContext
): boolean => {
  const resolved = resolveTypeAlias(stripNullish(type), context);
  if (resolved.kind === "arrayType" || resolved.kind === "tupleType") {
    return true;
  }
  if (
    resolved.kind === "referenceType" &&
    (resolved.name === "Array" ||
      resolved.name === "ReadonlyArray" ||
      resolved.name === "JSArray")
  ) {
    return true;
  }
  return false;
};

export const narrowTypeByArrayShape = (
  currentType: IrType | undefined,
  wantArray: boolean,
  context: EmitterContext
): IrType | undefined => {
  if (!currentType) return undefined;

  const resolved = resolveTypeAlias(stripNullish(currentType), context);
  if (resolved.kind === "unionType") {
    const kept = resolved.types.filter((member): member is IrType => {
      if (!member) return false;
      const isArrayLike = isArrayLikeNarrowingCandidate(member, context);
      return wantArray ? isArrayLike : !isArrayLike;
    });
    if (kept.length === 0) return undefined;
    if (kept.length === 1) return kept[0];
    return normalizedUnionType(kept);
  }

  return isArrayLikeNarrowingCandidate(currentType, context) === wantArray
    ? currentType
    : undefined;
};

export const narrowTypeByNotAssignableTarget = (
  currentType: IrType | undefined,
  targetType: IrType | undefined,
  context: EmitterContext
): IrType | undefined => {
  if (!currentType || !targetType) return undefined;

  const resolvedCurrent = resolveTypeAlias(stripNullish(currentType), context);
  const resolvedTarget = resolveTypeAlias(stripNullish(targetType), context);

  if (resolvedCurrent.kind === "unionType") {
    const kept = resolvedCurrent.types.filter((member): member is IrType => {
      if (!member) return false;
      return !unionMemberMatchesTarget(member, resolvedTarget, context);
    });
    if (kept.length === 0) return undefined;
    if (kept.length === 1) return kept[0];
    return normalizedUnionType(kept);
  }

  return unionMemberMatchesTarget(resolvedCurrent, resolvedTarget, context)
    ? undefined
    : resolvedCurrent;
};

export const currentNarrowedType = (
  bindingKey: string,
  fallbackType: IrType | undefined,
  context: EmitterContext
): IrType | undefined =>
  context.narrowedBindings?.get(bindingKey)?.type ?? fallbackType;

export const resolveRuntimeUnionFrame = resolveNarrowedUnionMembers;

export const isNullOrUndefined = (expr: IrExpression): boolean => {
  if (
    expr.kind === "literal" &&
    (expr.value === null || expr.value === undefined)
  ) {
    return true;
  }

  return expr.kind === "identifier" && expr.name === "undefined";
};

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
