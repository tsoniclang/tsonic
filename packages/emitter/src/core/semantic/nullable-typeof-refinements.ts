/** Nullable and closed-carrier narrowing refinements. */

import { IrExpression, normalizedUnionType, type IrType } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import { getMemberAccessNarrowKey } from "./narrowing-keys.js";
import { resolveEffectiveExpressionType } from "./narrowed-expression-types.js";
import {
  matchesTypeofTag,
  narrowTypeByTypeofTag,
  narrowTypeByNotTypeofTag,
  stripNullish,
  isDefinitelyValueType,
  resolveTypeAlias,
  splitRuntimeNullishUnionMembers,
} from "./type-resolution.js";
import { unwrapTransparentNarrowingTarget } from "./transparent-expressions.js";
import {
  type BranchTruthiness,
  type EmitExprAstFn,
  buildUnionNarrowAst,
  withoutNarrowedBinding,
  applyBinding,
  buildExprBinding,
  buildProjectedExprBinding,
  tryStripConditionalNullishGuardAst,
  currentNarrowedType,
  resolveRuntimeUnionFrame,
  resolveRuntimeSubsetSourceInfo,
  resolveExistingNarrowingSourceType,
  isNullOrUndefined,
  buildRuntimeUnionComplementBinding,
  applyDirectTypeNarrowing,
} from "./narrowing-builders.js";
import { materializeDirectNarrowingAst } from "./materialized-narrowing.js";
import { resolveIdentifierRuntimeCarrierType } from "./direct-storage-ir-types.js";
import {
  resolveRuntimeArrayMemberStorageType,
  SYSTEM_ARRAY_STORAGE_TYPE,
} from "./broad-array-storage.js";
import { areIrTypesEquivalent } from "./type-equivalence.js";
import { isBroadObjectSlotType } from "./broad-object-types.js";
import { willCarryAsRuntimeUnion } from "./union-semantics.js";

const BROAD_OBJECT_ARRAY_TYPE: IrType = {
  kind: "arrayType",
  elementType: {
    kind: "referenceType",
    name: "object",
    resolvedClrType: "global::System.Object",
  },
};

const stripNullishForRefinement = (
  type: IrType,
  context: EmitterContext
): IrType => {
  const stripped = stripNullish(type);
  if (willCarryAsRuntimeUnion(stripped, context)) {
    return stripped;
  }

  const resolved = resolveTypeAlias(stripped, context);
  if (resolved === stripped) {
    return stripped;
  }

  const resolvedStripped = stripNullish(resolved);
  return willCarryAsRuntimeUnion(resolvedStripped, context)
    ? stripped
    : resolvedStripped;
};

const isArrayLikeNarrowingCandidate = (
  type: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!type) {
    return false;
  }
  const resolved = resolveTypeAlias(stripNullish(type), context);
  return (
    resolved.kind === "arrayType" ||
    resolved.kind === "tupleType" ||
    (resolved.kind === "referenceType" &&
      (resolved.name === "Array" || resolved.name === "ReadonlyArray"))
  );
};

const narrowTypeByArrayShape = (
  currentType: IrType | undefined,
  wantArray: boolean,
  context: EmitterContext
): IrType | undefined => {
  if (!currentType) {
    return undefined;
  }

  const resolved = resolveTypeAlias(stripNullish(currentType), context);
  if (resolved.kind === "unionType") {
    const hasBroadArrayFallback =
      wantArray &&
      resolved.types.some((member) => {
        if (!member) {
          return false;
        }
        const resolvedMember = resolveTypeAlias(stripNullish(member), context);
        return (
          resolvedMember.kind === "unknownType" ||
          resolvedMember.kind === "anyType" ||
          resolvedMember.kind === "objectType" ||
          isBroadObjectSlotType(resolvedMember, context)
        );
      });
    const kept = resolved.types.filter((member): member is IrType => {
      if (!member) {
        return false;
      }
      const isArrayLike = isArrayLikeNarrowingCandidate(member, context);
      return wantArray ? isArrayLike : !isArrayLike;
    });
    const narrowed = hasBroadArrayFallback
      ? [...kept, BROAD_OBJECT_ARRAY_TYPE]
      : kept;
    if (narrowed.length === 0) {
      return undefined;
    }
    return narrowed.length === 1 ? narrowed[0] : normalizedUnionType(narrowed);
  }

  const isArrayLike = isArrayLikeNarrowingCandidate(resolved, context);
  if (
    wantArray &&
    (resolved.kind === "unknownType" ||
      resolved.kind === "anyType" ||
      resolved.kind === "objectType" ||
      isBroadObjectSlotType(resolved, context))
  ) {
    return BROAD_OBJECT_ARRAY_TYPE;
  }
  return wantArray === isArrayLike ? resolved : undefined;
};

const narrowTypeByNotAssignableTarget = (
  currentType: IrType | undefined,
  targetType: IrType | undefined,
  context: EmitterContext
): IrType | undefined => {
  if (!currentType || !targetType) {
    return undefined;
  }

  const resolvedCurrent = resolveTypeAlias(stripNullish(currentType), context);
  const resolvedTarget = resolveTypeAlias(stripNullish(targetType), context);
  if (resolvedCurrent.kind !== "unionType") {
    return areIrTypesEquivalent(resolvedCurrent, resolvedTarget, context)
      ? undefined
      : resolvedCurrent;
  }

  const kept = resolvedCurrent.types.filter((member): member is IrType => {
    if (!member) {
      return false;
    }
    return !areIrTypesEquivalent(
      resolveTypeAlias(stripNullish(member), context),
      resolvedTarget,
      context
    );
  });
  if (kept.length === 0) {
    return undefined;
  }
  return kept.length === 1 ? kept[0] : normalizedUnionType(kept);
};

const resolveRefinementCurrentType = (
  bindingKey: string,
  targetExpr: Extract<IrExpression, { kind: "identifier" | "memberAccess" }>,
  context: EmitterContext
) =>
  currentNarrowedType(
    bindingKey,
    resolveEffectiveExpressionType(targetExpr, context) ??
      targetExpr.inferredType,
    context
  );

const resolveNullishRefinementCurrentType = (
  bindingKey: string,
  targetExpr: Extract<IrExpression, { kind: "identifier" | "memberAccess" }>,
  context: EmitterContext
): IrType | undefined => {
  const semanticType = resolveRefinementCurrentType(
    bindingKey,
    targetExpr,
    context
  );
  if (targetExpr.kind !== "identifier") {
    return semanticType;
  }

  const storageType = context.localValueTypes?.get(targetExpr.name);
  const storageSplit = storageType
    ? splitRuntimeNullishUnionMembers(storageType)
    : undefined;
  if (!storageType || !storageSplit?.hasRuntimeNullish) {
    return semanticType;
  }

  const semanticSplit = semanticType
    ? splitRuntimeNullishUnionMembers(semanticType)
    : undefined;
  if (semanticSplit?.hasRuntimeNullish) {
    return semanticType;
  }

  const storageBase = stripNullish(storageType);
  const semanticBase = semanticType ? stripNullish(semanticType) : undefined;
  return !semanticBase ||
    areIrTypesEquivalent(storageBase, semanticBase, context)
    ? storageType
    : semanticType;
};

const supportsDeterministicTruthyNullishRefinement = (
  type: IrType,
  context: EmitterContext
): boolean => {
  const resolved = resolveTypeAlias(stripNullish(type), context);
  if (isDefinitelyValueType(resolved)) {
    return false;
  }

  switch (resolved.kind) {
    case "referenceType":
    case "objectType":
    case "arrayType":
    case "tupleType":
    case "dictionaryType":
    case "functionType":
      return true;
    case "unionType":
      return resolved.types.every((member) =>
        supportsDeterministicTruthyNullishRefinement(member, context)
      );
    case "intersectionType":
      return resolved.types.every((member) =>
        supportsDeterministicTruthyNullishRefinement(member, context)
      );
    default:
      return false;
  }
};

export const applyTruthinessNullishRefinement = (
  condition: IrExpression,
  branch: BranchTruthiness,
  context: EmitterContext,
  emitExprAst: EmitExprAstFn
): EmitterContext | undefined => {
  if (branch !== "truthy") {
    return undefined;
  }

  const target = unwrapTransparentNarrowingTarget(condition);
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

  const currentType = resolveNullishRefinementCurrentType(
    bindingKey,
    target,
    context
  );
  if (!currentType) {
    return undefined;
  }

  const strippedType = stripNullishForRefinement(currentType, context);
  if (
    !(splitRuntimeNullishUnionMembers(currentType)?.hasRuntimeNullish ?? false)
  ) {
    return undefined;
  }

  if (!supportsDeterministicTruthyNullishRefinement(strippedType, context)) {
    return undefined;
  }

  const existingBinding = context.narrowedBindings?.get(bindingKey);
  if (existingBinding?.kind === "runtimeSubset") {
    return applyBinding(
      bindingKey,
      {
        ...existingBinding,
        type: strippedType,
      },
      context
    );
  }

  const [projectedTargetAst, projectedTargetContext] = emitExprAst(
    target,
    context
  );
  const [rawTargetAst, rawTargetContext] = emitExprAst(
    target,
    withoutNarrowedBinding(context, bindingKey)
  );
  const sourceType = resolveExistingNarrowingSourceType(
    bindingKey,
    currentType,
    context
  );
  const carrierExprAst =
    existingBinding?.kind === "expr"
      ? (existingBinding.carrierExprAst ?? rawTargetAst)
      : rawTargetAst;
  const rawIdentifierStorageType =
    target.kind === "identifier"
      ? rawTargetContext.localValueTypes?.get(target.name)
      : undefined;
  const rawIdentifierCarrierType =
    target.kind === "identifier"
      ? resolveIdentifierRuntimeCarrierType(target, rawTargetContext)
      : undefined;
  const storageType =
    (existingBinding?.kind === "expr"
      ? existingBinding.storageType
      : undefined) ??
    rawIdentifierStorageType ??
    currentType ??
    target.inferredType;
  const carrierType =
    rawIdentifierCarrierType ??
    rawIdentifierStorageType ??
    target.inferredType ??
    (existingBinding?.kind === "expr"
      ? existingBinding.carrierType
      : undefined) ??
    sourceType ??
    storageType;
  const bindingSourceType = carrierType ?? sourceType;
  const projectedExprAst =
    existingBinding?.kind === "expr"
      ? existingBinding.exprAst
      : projectedTargetAst;
  const tightenedExprAst =
    tryStripConditionalNullishGuardAst(projectedExprAst) ?? projectedExprAst;

  return applyBinding(
    bindingKey,
      buildExprBinding(
        tightenedExprAst,
        strippedType,
        bindingSourceType,
        tightenedExprAst,
        strippedType,
        carrierExprAst,
        carrierType
    ),
    projectedTargetContext
  );
};

export const applySimpleNullableRefinement = (
  condition: IrExpression,
  branch: BranchTruthiness,
  context: EmitterContext,
  emitExprAst: EmitExprAstFn
): EmitterContext | undefined => {
  const nullableGuard = (() => {
    if (condition.kind !== "binary") return undefined;

    const op = condition.operator;
    const isNotEqual = op === "!==" || op === "!=";
    const isEqual = op === "===" || op === "==";
    if (!isNotEqual && !isEqual) return undefined;

    let operand:
      | Extract<IrExpression, { kind: "identifier" | "memberAccess" }>
      | undefined;
    let key: string | undefined;

    if (isNullOrUndefined(condition.right)) {
      operand = unwrapTransparentNarrowingTarget(condition.left);
    } else if (isNullOrUndefined(condition.left)) {
      operand = unwrapTransparentNarrowingTarget(condition.right);
    }

    if (!operand) return undefined;

    key =
      operand.kind === "identifier"
        ? operand.name
        : getMemberAccessNarrowKey(operand);
    if (!key) return undefined;

    const idType = resolveNullishRefinementCurrentType(key, operand, context);
    if (!idType) return undefined;
    const stripped = stripNullishForRefinement(idType, context);
    if (
      !(splitRuntimeNullishUnionMembers(idType)?.hasRuntimeNullish ?? false)
    ) {
      return undefined;
    }

    return {
      key,
      targetExpr: operand,
      strippedType: stripped,
      narrowsInThen: isNotEqual,
      isValueType: isDefinitelyValueType(stripped),
    };
  })();
  if (!nullableGuard) {
    return undefined;
  }

  const shouldNarrowToNonNull =
    branch === "truthy"
      ? nullableGuard.narrowsInThen
      : !nullableGuard.narrowsInThen;
  if (!shouldNarrowToNonNull) {
    return undefined;
  }

  const currentType = resolveNullishRefinementCurrentType(
    nullableGuard.key,
    nullableGuard.targetExpr,
    context
  );
  if (!currentType) {
    return undefined;
  }

  const strippedType = stripNullishForRefinement(currentType, context);
  if (
    !(splitRuntimeNullishUnionMembers(currentType)?.hasRuntimeNullish ?? false)
  ) {
    const existingBinding = context.narrowedBindings?.get(nullableGuard.key);
    if (existingBinding?.kind === "expr") {
      const strippedExprAst = tryStripConditionalNullishGuardAst(
        existingBinding.exprAst
      );
      if (strippedExprAst) {
        return applyBinding(
          nullableGuard.key,
          buildExprBinding(
            strippedExprAst,
            existingBinding.type ?? strippedType,
            existingBinding.sourceType ?? currentType,
            strippedExprAst,
            existingBinding.type ?? strippedType,
            existingBinding.carrierExprAst,
            existingBinding.carrierType
          ),
          context
        );
      }
    }
    return undefined;
  }

  const existingBinding = context.narrowedBindings?.get(nullableGuard.key);
  if (existingBinding?.kind === "runtimeSubset") {
    return applyBinding(
      nullableGuard.key,
      {
        ...existingBinding,
        type: strippedType,
      },
      context
    );
  }

  const [projectedTargetAst, projectedTargetContext] = emitExprAst(
    nullableGuard.targetExpr,
    context
  );
  const [rawTargetAst, rawTargetContext] = emitExprAst(
    nullableGuard.targetExpr,
    withoutNarrowedBinding(context, nullableGuard.key)
  );
  const sourceType = resolveExistingNarrowingSourceType(
    nullableGuard.key,
    currentType,
    context
  );
  const carrierExprAst =
    existingBinding?.kind === "expr"
      ? (existingBinding.carrierExprAst ??
        existingBinding.storageExprAst ??
        rawTargetAst)
      : rawTargetAst;
  const rawIdentifierStorageType =
    nullableGuard.targetExpr.kind === "identifier"
      ? rawTargetContext.localValueTypes?.get(nullableGuard.targetExpr.name)
      : undefined;
  const rawIdentifierCarrierType =
    nullableGuard.targetExpr.kind === "identifier"
      ? resolveIdentifierRuntimeCarrierType(
          nullableGuard.targetExpr,
          rawTargetContext
        )
      : undefined;
  const storageType =
    (existingBinding?.kind === "expr"
      ? existingBinding.storageType
      : undefined) ??
    rawIdentifierStorageType ??
    currentType ??
    nullableGuard.targetExpr.inferredType;
  const carrierType =
    rawIdentifierCarrierType ??
    rawIdentifierStorageType ??
    nullableGuard.targetExpr.inferredType ??
    (existingBinding?.kind === "expr"
      ? existingBinding.carrierType
      : undefined) ??
    sourceType ??
    storageType;
  const bindingSourceType = carrierType ?? sourceType;
  const projectedExprAst =
    existingBinding?.kind === "expr"
      ? existingBinding.exprAst
      : projectedTargetAst;
  const strippedProjectedExprAst =
    tryStripConditionalNullishGuardAst(projectedExprAst) ?? projectedExprAst;

  const [materializedExprAst, materializedContext] =
    nullableGuard.isValueType || isDefinitelyValueType(strippedType)
      ? materializeDirectNarrowingAst(
          rawTargetAst,
          currentType,
          strippedType,
          rawTargetContext
        )
      : [strippedProjectedExprAst, projectedTargetContext];
  const storageCompatibleExprAst = materializedExprAst;
  const storageCompatibleType = strippedType;

  return applyBinding(
    nullableGuard.key,
      buildExprBinding(
        materializedExprAst,
        strippedType,
        bindingSourceType,
        storageCompatibleExprAst,
        storageCompatibleType,
        carrierExprAst,
      carrierType
    ),
    materializedContext
  );
};

export const applyDirectTypeofRefinement = (
  condition: IrExpression,
  branch: BranchTruthiness,
  context: EmitterContext,
  emitExprAst: EmitExprAstFn
): EmitterContext | undefined => {
  if (condition.kind !== "binary") return undefined;
  if (
    condition.operator !== "===" &&
    condition.operator !== "==" &&
    condition.operator !== "!==" &&
    condition.operator !== "!="
  ) {
    return undefined;
  }

  const extract = (
    left: IrExpression,
    right: IrExpression
  ):
    | {
        readonly bindingKey: string;
        readonly targetExpr: Extract<
          IrExpression,
          { kind: "identifier" | "memberAccess" }
        >;
        readonly tag: string;
      }
    | undefined => {
    if (left.kind !== "unary" || left.operator !== "typeof") return undefined;
    const target = unwrapTransparentNarrowingTarget(left.expression);
    if (!target) return undefined;
    if (right.kind !== "literal" || typeof right.value !== "string") {
      return undefined;
    }
    const bindingKey =
      target.kind === "identifier"
        ? target.name
        : getMemberAccessNarrowKey(target);
    if (!bindingKey) return undefined;
    return {
      bindingKey,
      targetExpr: target,
      tag: right.value,
    };
  };

  const directGuard =
    extract(condition.left, condition.right) ??
    extract(condition.right, condition.left);
  if (!directGuard) return undefined;

  const matchesInTruthyBranch =
    condition.operator === "===" || condition.operator === "==";
  const matchTag =
    branch === "truthy" ? matchesInTruthyBranch : !matchesInTruthyBranch;

  const currentType = resolveRefinementCurrentType(
    directGuard.bindingKey,
    directGuard.targetExpr,
    context
  );
  const narrowedType = matchTag
    ? narrowTypeByTypeofTag(currentType, directGuard.tag, context)
    : narrowTypeByNotTypeofTag(currentType, directGuard.tag, context);
  if (!narrowedType) {
    return undefined;
  }

  const rawCarrierContext = withoutNarrowedBinding(
    context,
    directGuard.bindingKey
  );
  const [rawTargetAst, rawTargetContext] = emitExprAst(
    directGuard.targetExpr,
    rawCarrierContext
  );
  const runtimeFrameContext = {
    ...rawTargetContext,
    narrowedBindings: context.narrowedBindings,
  };
  const runtimeUnionFrame = currentType
    ? resolveRuntimeUnionFrame(
        directGuard.bindingKey,
        currentType,
        runtimeFrameContext
      )
    : undefined;
  const matchingRuntimeMemberIndex =
    runtimeUnionFrame?.members.findIndex((member) =>
      matchesTypeofTag(member, directGuard.tag, rawTargetContext)
    ) ?? -1;

  if (
    runtimeUnionFrame &&
    matchingRuntimeMemberIndex >= 0 &&
    runtimeUnionFrame.members.filter((member) =>
      matchesTypeofTag(member, directGuard.tag, rawTargetContext)
    ).length === 1
  ) {
    const memberN =
      runtimeUnionFrame.candidateMemberNs[matchingRuntimeMemberIndex] ??
      matchingRuntimeMemberIndex + 1;
    const memberType =
      runtimeUnionFrame.members[matchingRuntimeMemberIndex] ?? narrowedType;

    if (matchTag) {
      return applyBinding(
        directGuard.bindingKey,
        buildProjectedExprBinding(
          buildUnionNarrowAst(rawTargetAst, memberN),
          memberType,
          resolveExistingNarrowingSourceType(
            directGuard.bindingKey,
            currentType,
            context
          ),
          rawTargetAst
        ),
        rawTargetContext
      );
    }

    const complementBinding = buildRuntimeUnionComplementBinding(
      rawTargetAst,
      runtimeUnionFrame,
      currentType ?? narrowedType,
      narrowedType,
      memberN,
      rawTargetContext,
      currentType
        ? resolveRuntimeSubsetSourceInfo(
            directGuard.bindingKey,
            currentType,
            runtimeUnionFrame,
            context
          )
        : undefined
    );
    if (complementBinding) {
      return applyBinding(
        directGuard.bindingKey,
        complementBinding,
        rawTargetContext
      );
    }
  }

  return applyDirectTypeNarrowing(
    directGuard.bindingKey,
    directGuard.targetExpr,
    narrowedType,
    context,
    emitExprAst
  );
};

export const applyArrayIsArrayRefinement = (
  condition: IrExpression,
  branch: BranchTruthiness,
  context: EmitterContext,
  emitExprAst: EmitExprAstFn
): EmitterContext | undefined => {
  const extractDirect = (
    expr: IrExpression
  ):
    | {
        readonly bindingKey: string;
        readonly targetExpr: Extract<
          IrExpression,
          { kind: "identifier" | "memberAccess" }
        >;
        readonly narrowsInTruthyBranch: boolean;
      }
    | undefined => {
    if (expr.kind !== "call") return undefined;
    if (expr.arguments.length !== 1) return undefined;
    if (expr.callee.kind !== "memberAccess" || expr.callee.isComputed) {
      return undefined;
    }
    if (expr.callee.property !== "isArray") return undefined;
    if (
      expr.callee.object.kind !== "identifier" ||
      expr.callee.object.name !== "Array"
    ) {
      return undefined;
    }

    const [rawTarget] = expr.arguments;
    if (!rawTarget) return undefined;
    const target = unwrapTransparentNarrowingTarget(rawTarget);
    if (!target) return undefined;
    const bindingKey =
      target.kind === "identifier"
        ? target.name
        : getMemberAccessNarrowKey(target);
    if (!bindingKey) return undefined;

    return {
      bindingKey,
      targetExpr: target,
      narrowsInTruthyBranch: true,
    };
  };

  const direct = extractDirect(condition);
  if (!direct) {
    return undefined;
  }

  const wantArray =
    branch === "truthy"
      ? direct.narrowsInTruthyBranch
      : !direct.narrowsInTruthyBranch;
  const currentType = resolveRefinementCurrentType(
    direct.bindingKey,
    direct.targetExpr,
    context
  );
  const predicateTargetType =
    condition.kind === "call" && condition.narrowing?.kind === "typePredicate"
      ? condition.narrowing.targetType
      : undefined;
  const predicateArrayTargetType =
    wantArray && predicateTargetType
      ? (narrowTypeByArrayShape(predicateTargetType, true, context) ??
        (isArrayLikeNarrowingCandidate(predicateTargetType, context)
          ? predicateTargetType
          : undefined))
      : undefined;

  const explicitNarrowedType =
    narrowTypeByArrayShape(currentType, wantArray, context) ??
    narrowTypeByArrayShape(
      direct.targetExpr.inferredType,
      wantArray,
      context
    ) ??
    (wantArray
      ? predicateArrayTargetType
      : narrowTypeByNotAssignableTarget(
          currentType,
          predicateTargetType,
          context
        ));
  const narrowedType =
    wantArray &&
    explicitNarrowedType &&
    !isArrayLikeNarrowingCandidate(explicitNarrowedType, context)
      ? undefined
      : explicitNarrowedType;
  if (!narrowedType) {
    return undefined;
  }

  const [rawTargetAst, rawTargetContext] = emitExprAst(
    direct.targetExpr,
    withoutNarrowedBinding(context, direct.bindingKey)
  );
  const runtimeUnionFrame =
    currentType &&
    resolveRuntimeUnionFrame(direct.bindingKey, currentType, rawTargetContext);
  const runtimeArrayPairs =
    runtimeUnionFrame?.members.flatMap((member, index) => {
      if (!member || !isArrayLikeNarrowingCandidate(member, rawTargetContext)) {
        return [];
      }
      const runtimeMemberN = runtimeUnionFrame.candidateMemberNs[index];
      if (!runtimeMemberN) return [];
      return [{ memberType: member, runtimeMemberN }];
    }) ?? [];

  if (runtimeUnionFrame && runtimeArrayPairs.length === 1) {
    const runtimeArrayPair = runtimeArrayPairs[0];
    if (!runtimeArrayPair) {
      return undefined;
    }

    if (wantArray) {
      return applyBinding(
        direct.bindingKey,
        buildProjectedExprBinding(
          buildUnionNarrowAst(rawTargetAst, runtimeArrayPair.runtimeMemberN),
          narrowedType,
          resolveExistingNarrowingSourceType(
            direct.bindingKey,
            currentType,
            context
          ),
          rawTargetAst,
          resolveRuntimeArrayMemberStorageType(
            runtimeArrayPair.memberType,
            rawTargetContext
          )
        ),
        rawTargetContext
      );
    }

    const complementBinding = buildRuntimeUnionComplementBinding(
      rawTargetAst,
      runtimeUnionFrame,
      currentType,
      narrowedType,
      runtimeArrayPair.runtimeMemberN,
      rawTargetContext,
      resolveRuntimeSubsetSourceInfo(
        direct.bindingKey,
        currentType,
        runtimeUnionFrame,
        context
      )
    );
    if (complementBinding) {
      return applyBinding(
        direct.bindingKey,
        complementBinding,
        rawTargetContext
      );
    }
  }

  return applyDirectTypeNarrowing(
    direct.bindingKey,
    direct.targetExpr,
    narrowedType,
    context,
    emitExprAst,
    wantArray ? SYSTEM_ARRAY_STORAGE_TYPE : undefined
  );
};
