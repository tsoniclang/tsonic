/**
 * Nullable and typeof narrowing refinements.
 * Handles applySimpleNullableRefinement, applyDirectTypeofRefinement,
 * and applyArrayIsArrayRefinement.
 */

import { IrExpression, type IrType } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import { stableIrTypeKey } from "@tsonic/frontend";
import { getMemberAccessNarrowKey } from "./narrowing-keys.js";
import { resolveEffectiveExpressionType } from "./narrowed-expression-types.js";
import {
  matchesTypeofTag,
  narrowTypeByTypeofTag,
  narrowTypeByNotTypeofTag,
  stripNullish,
  isDefinitelyValueType,
  resolveTypeAlias,
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
  narrowTypeByArrayShape,
  narrowTypeByNotAssignableTarget,
  isArrayLikeNarrowingCandidate,
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

  const currentType = resolveRefinementCurrentType(bindingKey, target, context);
  if (!currentType) {
    return undefined;
  }

  const strippedType = stripNullish(currentType);
  if (stableIrTypeKey(strippedType) === stableIrTypeKey(currentType)) {
    return undefined;
  }

  if (!supportsDeterministicTruthyNullishRefinement(strippedType, context)) {
    return undefined;
  }

  const existingBinding = context.narrowedBindings?.get(bindingKey);
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
    (existingBinding?.kind === "expr"
      ? existingBinding.carrierType
      : undefined) ??
    rawIdentifierCarrierType ??
    sourceType ??
    storageType;
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
      sourceType,
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

    const idType = resolveRefinementCurrentType(key, operand, context);
    if (!idType) return undefined;
    const stripped = stripNullish(idType);
    if (stableIrTypeKey(stripped) === stableIrTypeKey(idType)) {
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

  const currentType = resolveRefinementCurrentType(
    nullableGuard.key,
    nullableGuard.targetExpr,
    context
  );
  if (!currentType) {
    return undefined;
  }

  const strippedType = stripNullish(currentType);
  if (stableIrTypeKey(strippedType) === stableIrTypeKey(currentType)) {
    return undefined;
  }

  const existingBinding = context.narrowedBindings?.get(nullableGuard.key);
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
    (existingBinding?.kind === "expr"
      ? existingBinding.carrierType
      : undefined) ??
    rawIdentifierCarrierType ??
    sourceType ??
    storageType;
  const projectedExprAst =
    existingBinding?.kind === "expr"
      ? existingBinding.exprAst
      : projectedTargetAst;

  const [materializedExprAst, materializedContext] =
    nullableGuard.isValueType || isDefinitelyValueType(strippedType)
      ? materializeDirectNarrowingAst(
          rawTargetAst,
          currentType,
          strippedType,
          rawTargetContext
        )
      : [
          tryStripConditionalNullishGuardAst(projectedExprAst) ??
            projectedExprAst,
          projectedTargetContext,
        ];
  const storageCompatibleExprAst = materializedExprAst;
  const storageCompatibleType = strippedType;

  return applyBinding(
    nullableGuard.key,
    buildExprBinding(
      materializedExprAst,
      strippedType,
      sourceType,
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
          narrowedType,
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

    void memberType;
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

  const narrowedType =
    narrowTypeByArrayShape(currentType, wantArray, context) ??
    narrowTypeByArrayShape(
      direct.targetExpr.inferredType,
      wantArray,
      context
    ) ??
    (wantArray
      ? predicateTargetType
      : narrowTypeByNotAssignableTarget(
          currentType,
          predicateTargetType,
          context
        ));
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
