import { IrExpression, IrType } from "@tsonic/frontend";
import { EmitterContext, NarrowedBinding } from "../types.js";
import { emitTypeAst } from "../type-emitter.js";
import { escapeCSharpIdentifier } from "../emitter-types/index.js";
import { identifierExpression } from "../core/format/backend-ast/builders.js";
import { stableTypeKeyFromAst } from "../core/format/backend-ast/utils.js";
import {
  matchesExpectedEmissionType,
  requiresValueTypeMaterialization,
} from "../core/semantic/expected-type-matching.js";
import { materializeDirectNarrowingAst } from "../core/semantic/materialized-narrowing.js";
import {
  RuntimeMaterializationSourceFrame,
  tryBuildRuntimeMaterializationAst,
} from "../core/semantic/runtime-reification.js";
import { buildRuntimeUnionLayout } from "../core/semantic/runtime-unions.js";
import { resolveEffectiveExpressionType } from "../core/semantic/narrowed-expression-types.js";
import { tryResolveRuntimeUnionMemberType } from "../core/semantic/narrowed-expression-types.js";
import {
  normalizeStructuralEmissionType,
  resolveTypeAlias,
  stripNullish,
} from "../core/semantic/type-resolution.js";
import { adaptStorageErasedValueAst } from "../core/semantic/storage-erased-adaptation.js";
import { resolveStructuralReferenceType } from "../core/semantic/structural-shape-matching.js";
import type { CSharpExpressionAst } from "../core/format/backend-ast/types.js";
import { willCarryAsRuntimeUnion } from "../core/semantic/union-semantics.js";
import {
  getArrayElementType,
  getDictionaryValueType,
  isSameNominalType,
} from "./structural-type-shapes.js";

const needsStructuralCollectionMaterialization = (
  actualType: IrType | undefined,
  expectedType: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!actualType || !expectedType) {
    return false;
  }

  const actualArrayElement = getArrayElementType(actualType, context);
  const expectedArrayElement = getArrayElementType(expectedType, context);
  if (actualArrayElement && expectedArrayElement) {
    const actualStructuralElement =
      resolveStructuralReferenceType(actualArrayElement, context) ??
      stripNullish(actualArrayElement);
    const expectedStructuralElement =
      resolveStructuralReferenceType(expectedArrayElement, context) ??
      stripNullish(expectedArrayElement);

    if (
      (actualStructuralElement.kind === "objectType" ||
        expectedStructuralElement.kind === "objectType") &&
      !isSameNominalType(actualArrayElement, expectedArrayElement, context)
    ) {
      return true;
    }
  }

  const actualDictionaryValue = getDictionaryValueType(actualType, context);
  const expectedDictionaryValue = getDictionaryValueType(expectedType, context);
  if (actualDictionaryValue && expectedDictionaryValue) {
    const actualStructuralValue =
      resolveStructuralReferenceType(actualDictionaryValue, context) ??
      stripNullish(actualDictionaryValue);
    const expectedStructuralValue =
      resolveStructuralReferenceType(expectedDictionaryValue, context) ??
      stripNullish(expectedDictionaryValue);

    if (
      (actualStructuralValue.kind === "objectType" ||
        expectedStructuralValue.kind === "objectType") &&
      !isSameNominalType(
        actualDictionaryValue,
        expectedDictionaryValue,
        context
      )
    ) {
      return true;
    }
  }

  return false;
};

export const isBroadStorageTarget = (
  expectedType: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!expectedType) {
    return false;
  }

  const resolved = resolveTypeAlias(stripNullish(expectedType), context);
  return (
    resolved.kind === "unknownType" ||
    resolved.kind === "anyType" ||
    resolved.kind === "objectType" ||
    (resolved.kind === "referenceType" && resolved.name === "object")
  );
};

const wrapMaterializedTargetAst = (
  valueAst: CSharpExpressionAst,
  targetType: IrType,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  if (
    valueAst.kind === "castExpression" ||
    (valueAst.kind === "memberAccessExpression" &&
      valueAst.memberName === "Value")
  ) {
    return [valueAst, context];
  }

  const [targetTypeAst, nextContext] = emitTypeAst(targetType, context);
  return [
    {
      kind: "castExpression",
      type: targetTypeAst,
      expression: valueAst,
    },
    nextContext,
  ];
};

export const buildRuntimeSubsetExpressionAst = (
  expr: Extract<IrExpression, { kind: "identifier" }>,
  narrowed: Extract<NarrowedBinding, { kind: "runtimeSubset" }>,
  context: EmitterContext,
  targetType: IrType | undefined = narrowed.type
): [CSharpExpressionAst, EmitterContext] | undefined => {
  const sourceType = narrowed.sourceType ?? expr.inferredType;
  if (!sourceType || !targetType) {
    return undefined;
  }

  const remappedLocal = context.localNameMap?.get(expr.name);
  if (remappedLocal && isBroadStorageTarget(targetType, context)) {
    return [identifierExpression(remappedLocal), context];
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
  const sourceValueAst =
    narrowed.storageExprAst ?? identifierExpression(escapeCSharpIdentifier(expr.name));

  const materialized = tryBuildRuntimeMaterializationAst(
    sourceValueAst,
    sourceType,
    targetType,
    context,
    emitTypeAst,
    new Set(narrowed.runtimeMemberNs),
    sourceFrame
  );
  if (!materialized) {
    return undefined;
  }

  return wrapMaterializedTargetAst(
    materialized[0],
    targetType,
    materialized[1]
  );
};

export const tryEmitStorageCompatibleIdentifier = (
  expr: Extract<IrExpression, { kind: "identifier" }>,
  context: EmitterContext,
  expectedType: IrType | undefined
): CSharpExpressionAst | undefined => {
  if (!expectedType) {
    return undefined;
  }

  const remappedLocal = context.localNameMap?.get(expr.name);
  const storageType = context.localValueTypes?.get(expr.name);
  if (!remappedLocal || !storageType) {
    return undefined;
  }

  if (isBroadStorageTarget(expectedType, context)) {
    return identifierExpression(remappedLocal);
  }

  const effectiveType = resolveEffectiveExpressionType(expr, context);
  if (
    !isBroadStorageTarget(expectedType, context) &&
    matchesExpectedEmissionType(effectiveType, expectedType, context)
  ) {
    return undefined;
  }

  if (!matchesExpectedEmissionType(storageType, expectedType, context)) {
    return undefined;
  }

  if (
    needsStructuralCollectionMaterialization(storageType, expectedType, context)
  ) {
    return undefined;
  }

  return identifierExpression(remappedLocal);
};

export const tryEmitCollapsedStorageIdentifier = (
  expr: Extract<IrExpression, { kind: "identifier" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] | undefined => {
  const remappedLocal = context.localNameMap?.get(expr.name);
  const storageType = context.localValueTypes?.get(expr.name);
  if (!remappedLocal || !storageType) {
    return undefined;
  }

  const effectiveType = resolveEffectiveExpressionType(expr, context);
  if (!effectiveType) {
    return undefined;
  }

  const [sameSurface, nextContext] = matchesEmittedStorageSurface(
    storageType,
    effectiveType,
    context
  );
  if (!sameSurface) {
    return undefined;
  }

  return [identifierExpression(remappedLocal), nextContext];
};

export const tryEmitImplicitNarrowedStorageIdentifier = (
  expr: Extract<IrExpression, { kind: "identifier" }>,
  narrowed: Extract<NarrowedBinding, { kind: "expr" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] | undefined => {
  if (!narrowed.storageExprAst || !narrowed.type) {
    return undefined;
  }

  const storageType = context.localValueTypes?.get(expr.name);
  if (!storageType) {
    return undefined;
  }

  const narrowedProjectionType =
    narrowed.type ??
    tryResolveRuntimeUnionMemberType(
      narrowed.sourceType ?? storageType,
      narrowed.exprAst,
      context
    );
  const shouldAvoidProjectedRuntimeUnionStorageReuse =
    narrowed.storageExprAst !== undefined &&
    narrowed.storageExprAst !== narrowed.exprAst &&
    willCarryAsRuntimeUnion(storageType, context) &&
    !!narrowedProjectionType &&
    !willCarryAsRuntimeUnion(narrowedProjectionType, context);
  if (shouldAvoidProjectedRuntimeUnionStorageReuse) {
    return undefined;
  }

  const [sameSurface, nextContext] = matchesEmittedStorageSurface(
    storageType,
    narrowed.type,
    context
  );
  if (!sameSurface) {
    return undefined;
  }

  return [narrowed.storageExprAst, nextContext];
};

export const tryEmitImplicitRuntimeSubsetStorageIdentifier = (
  expr: Extract<IrExpression, { kind: "identifier" }>,
  narrowed: Extract<NarrowedBinding, { kind: "runtimeSubset" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] | undefined => {
  if (!narrowed.type) {
    return undefined;
  }

  const remappedLocal = context.localNameMap?.get(expr.name);
  const storageType = context.localValueTypes?.get(expr.name);
  if (!remappedLocal || !storageType) {
    return undefined;
  }

  const [sameSurface, nextContext] = matchesEmittedStorageSurface(
    storageType,
    narrowed.type,
    context
  );
  if (!sameSurface) {
    return undefined;
  }

  return [identifierExpression(remappedLocal), nextContext];
};

export const tryEmitReifiedStorageIdentifier = (
  expr: Extract<IrExpression, { kind: "identifier" }>,
  context: EmitterContext,
  expectedType: IrType | undefined
): [CSharpExpressionAst, EmitterContext] | undefined => {
  const remappedLocal = context.localNameMap?.get(expr.name);
  const storageType = context.localValueTypes?.get(expr.name);
  if (!remappedLocal || !storageType) {
    return undefined;
  }

  const effectiveType = resolveEffectiveExpressionType(expr, context);
  return adaptStorageErasedValueAst({
    valueAst: identifierExpression(remappedLocal),
    semanticType: effectiveType,
    storageType,
    expectedType,
    context,
    emitTypeAst,
    allowCastFallback: false,
  });
};

export const tryEmitStorageCompatibleNarrowedIdentifier = (
  expr: Extract<IrExpression, { kind: "identifier" }>,
  narrowed: Extract<NarrowedBinding, { kind: "expr" }>,
  context: EmitterContext,
  expectedType: IrType | undefined
): [CSharpExpressionAst, EmitterContext] | undefined => {
  if (!narrowed.type && !expectedType) {
    return undefined;
  }

  const remappedLocal = context.localNameMap?.get(expr.name);
  const storageType = context.localValueTypes?.get(expr.name);
  if (!storageType) {
    return undefined;
  }

  const targetType = expectedType ?? narrowed.type;
  if (!targetType) {
    return undefined;
  }

  const narrowedProjectionType =
    narrowed.type ??
    tryResolveRuntimeUnionMemberType(
      narrowed.sourceType ?? storageType,
      narrowed.exprAst,
      context
    );
  const shouldAvoidProjectedRuntimeUnionStorageReuse =
    narrowed.storageExprAst !== undefined &&
    narrowed.storageExprAst !== narrowed.exprAst &&
    willCarryAsRuntimeUnion(storageType, context) &&
    !!narrowedProjectionType &&
    !willCarryAsRuntimeUnion(narrowedProjectionType, context);

  const shouldAvoidBroadStorageReuse =
    !!expectedType &&
    !!narrowed.type &&
    isBroadStorageTarget(expectedType, context) &&
    willCarryAsRuntimeUnion(storageType, context) &&
    !willCarryAsRuntimeUnion(narrowed.type, context);
  const shouldAvoidStorageReuse =
    shouldAvoidBroadStorageReuse ||
    shouldAvoidProjectedRuntimeUnionStorageReuse;
  const canReuseOriginalRuntimeCarrier =
    !!expectedType &&
    !!narrowed.storageExprAst &&
    !!narrowed.sourceType &&
    willCarryAsRuntimeUnion(expectedType, context) &&
    matchesExpectedEmissionType(
      stripNullish(narrowed.sourceType),
      expectedType,
      context
    ) &&
    !!narrowedProjectionType &&
    !willCarryAsRuntimeUnion(narrowedProjectionType, context);
  if (
    expectedType &&
    isBroadStorageTarget(expectedType, context) &&
    matchesExpectedEmissionType(storageType, expectedType, context) &&
    !shouldAvoidStorageReuse
  ) {
    if (narrowed.storageExprAst) {
      return [narrowed.storageExprAst, context];
    }
    if (remappedLocal) {
      return [identifierExpression(remappedLocal), context];
    }
  }
  if (canReuseOriginalRuntimeCarrier) {
    return [narrowed.storageExprAst, context];
  }

  const [sameSurface, nextContext] = matchesEmittedStorageSurface(
    storageType,
    targetType,
    context
  );
  if (!sameSurface) {
    return undefined;
  }

  if (!narrowed.storageExprAst) {
    if (!remappedLocal) {
      return undefined;
    }
    return [identifierExpression(remappedLocal), nextContext];
  }

  if (
    narrowed.exprAst.kind === "memberAccessExpression" &&
    narrowed.exprAst.memberName === "Value" &&
    narrowed.exprAst.expression === narrowed.storageExprAst
  ) {
    return undefined;
  }

  if (
    shouldAvoidStorageReuse
  ) {
    return undefined;
  }

  return [narrowed.storageExprAst, nextContext];
};

export const tryEmitMaterializedNarrowedIdentifier = (
  narrowed: Extract<NarrowedBinding, { kind: "expr" }>,
  context: EmitterContext,
  expectedType: IrType | undefined
): [CSharpExpressionAst, EmitterContext] | undefined => {
  if (!expectedType) {
    return undefined;
  }

  const effectiveType = narrowed.type ?? narrowed.sourceType;
  if (!effectiveType) {
    return undefined;
  }

  const directMemberType = tryResolveRuntimeUnionMemberType(
    narrowed.sourceType ?? effectiveType,
    narrowed.exprAst,
    context
  );
  if (
    directMemberType &&
    willCarryAsRuntimeUnion(expectedType, context) &&
    !willCarryAsRuntimeUnion(directMemberType, context)
  ) {
    const [expectedLayout, expectedLayoutContext] = buildRuntimeUnionLayout(
      expectedType,
      context,
      emitTypeAst
    );
    if (
      expectedLayout?.members.some((member) =>
        matchesExpectedEmissionType(directMemberType, member, context)
      )
    ) {
      return [narrowed.exprAst, expectedLayoutContext];
    }
  }

  const materialized = materializeDirectNarrowingAst(
    narrowed.exprAst,
    effectiveType,
    expectedType,
    context
  );

  return wrapMaterializedTargetAst(
    materialized[0],
    expectedType,
    materialized[1]
  );
};

export const matchesEmittedStorageSurface = (
  actualType: IrType | undefined,
  expectedType: IrType | undefined,
  context: EmitterContext
): [boolean, EmitterContext] => {
  const tryEmitSurfaceTypeAst = (
    type: IrType,
    currentContext: EmitterContext
  ): [ReturnType<typeof emitTypeAst>[0], EmitterContext] | undefined => {
    try {
      return emitTypeAst(type, currentContext);
    } catch (err) {
      if (
        err instanceof Error &&
        err.message.startsWith("ICE: Unresolved reference type ")
      ) {
        return undefined;
      }
      throw err;
    }
  };

  const containsRawObjectType = (
    type: IrType,
    seen = new Set<IrType>()
  ): boolean => {
    if (seen.has(type)) {
      return false;
    }
    seen.add(type);

    switch (type.kind) {
      case "objectType":
        return true;
      case "arrayType":
        return containsRawObjectType(type.elementType, seen);
      case "tupleType":
        return type.elementTypes.some((elementType) =>
          containsRawObjectType(elementType, seen)
        );
      case "dictionaryType":
        return containsRawObjectType(type.valueType, seen);
      case "unionType":
      case "intersectionType":
        return type.types.some((memberType) =>
          containsRawObjectType(memberType, seen)
        );
      case "referenceType":
        return (
          type.typeArguments?.some((typeArgument) =>
            containsRawObjectType(typeArgument, seen)
          ) ?? false
        );
      default:
        return false;
    }
  };

  if (!actualType || !expectedType) {
    return [false, context];
  }

  if (requiresValueTypeMaterialization(actualType, expectedType, context)) {
    return [false, context];
  }

  const strippedActual = normalizeStructuralEmissionType(
    resolveStructuralReferenceType(stripNullish(actualType), context) ??
      stripNullish(actualType),
    context
  );
  const strippedExpected = normalizeStructuralEmissionType(
    resolveStructuralReferenceType(stripNullish(expectedType), context) ??
      stripNullish(expectedType),
    context
  );
  if (
    containsRawObjectType(strippedActual) ||
    containsRawObjectType(strippedExpected)
  ) {
    return [false, context];
  }
  const actualSurface = tryEmitSurfaceTypeAst(strippedActual, context);
  if (!actualSurface) {
    return [false, context];
  }
  const [actualTypeAst, actualTypeContext] = actualSurface;
  const expectedSurface = tryEmitSurfaceTypeAst(
    strippedExpected,
    actualTypeContext
  );
  if (!expectedSurface) {
    return [false, context];
  }
  const [expectedTypeAst, expectedTypeContext] = expectedSurface;

  return [
    stableTypeKeyFromAst(actualTypeAst) ===
      stableTypeKeyFromAst(expectedTypeAst),
    expectedTypeContext,
  ];
};
