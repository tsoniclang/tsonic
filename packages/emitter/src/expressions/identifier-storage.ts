import { IrExpression, IrType } from "@tsonic/frontend";
import { EmitterContext, NarrowedBinding } from "../types.js";
import { emitTypeAst } from "../type-emitter.js";
import { escapeCSharpIdentifier } from "../emitter-types/index.js";
import { identifierExpression } from "../core/format/backend-ast/builders.js";
import {
  sameTypeAstSurface,
  stableTypeKeyFromAst,
  stripNullableTypeAst,
} from "../core/format/backend-ast/utils.js";
import {
  matchesExpectedEmissionType,
  matchesSemanticExpectedType,
  requiresValueTypeMaterialization,
} from "../core/semantic/expected-type-matching.js";
import { materializeDirectNarrowingAst } from "../core/semantic/materialized-narrowing.js";
import {
  RuntimeMaterializationSourceFrame,
  tryBuildRuntimeMaterializationAst,
} from "../core/semantic/runtime-reification.js";
import {
  buildRuntimeUnionLayout,
  buildRuntimeUnionTypeAst,
  getCanonicalRuntimeUnionMembers,
} from "../core/semantic/runtime-unions.js";
import { buildRuntimeUnionFactoryCallAst } from "../core/semantic/runtime-union-projection.js";
import { resolveEffectiveExpressionType } from "../core/semantic/narrowed-expression-types.js";
import { tryResolveRuntimeUnionMemberType } from "../core/semantic/narrowed-expression-types.js";
import {
  normalizeStructuralEmissionType,
  resolveTypeAlias,
  stripNullish,
} from "../core/semantic/type-resolution.js";
import { resolveDirectValueSurfaceType } from "../core/semantic/direct-value-surfaces.js";
import { adaptStorageErasedValueAst } from "../core/semantic/storage-erased-adaptation.js";
import { resolveStructuralReferenceType } from "../core/semantic/structural-shape-matching.js";
import type { CSharpExpressionAst } from "../core/format/backend-ast/types.js";
import { willCarryAsRuntimeUnion } from "../core/semantic/union-semantics.js";
import { isStorageErasedBroadObjectPassThroughType } from "../core/semantic/broad-object-types.js";
import { runtimeUnionAliasReferencesMatch } from "../core/semantic/runtime-union-alias-identity.js";
import { referenceTypeHasClrIdentity } from "../core/semantic/clr-type-identity.js";
import {
  getArrayElementType,
  getDictionaryValueType,
  isSameNominalType,
} from "./structural-type-shapes.js";
import { describeIrTypeForDiagnostics } from "../core/semantic/deterministic-type-keys.js";
import { isExactExpressionToType } from "./exact-comparison.js";

const SYSTEM_OBJECT_CLR_NAMES = new Set([
  "System.Object",
  "global::System.Object",
]);

const buildStorageSurfaceDiagnosticContext = (
  actualType: IrType,
  expectedType: IrType,
  strippedActual: IrType,
  strippedExpected: IrType,
  context: EmitterContext
): string =>
  `[storage-surface originalActual=${describeIrTypeForDiagnostics(
    actualType,
    context
  )} originalExpected=${describeIrTypeForDiagnostics(
    expectedType,
    context
  )} actual=${describeIrTypeForDiagnostics(
    strippedActual,
    context
  )} expected=${describeIrTypeForDiagnostics(strippedExpected, context)}]`;

const isSystemObjectReferenceType = (type: IrType): boolean =>
  type.kind === "referenceType" &&
  (type.name === "object" ||
    referenceTypeHasClrIdentity(type, SYSTEM_OBJECT_CLR_NAMES));

const getStorageIdentifierAst = (
  expr: Extract<IrExpression, { kind: "identifier" }>,
  context: EmitterContext
): CSharpExpressionAst | undefined => {
  const remappedLocal = context.localNameMap?.get(expr.name);
  if (remappedLocal) {
    return identifierExpression(remappedLocal);
  }

  if (context.localValueTypes?.has(expr.name)) {
    return identifierExpression(escapeCSharpIdentifier(expr.name));
  }

  return undefined;
};

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
    (resolved.kind === "unionType" &&
      resolved.types.some(
        (member) =>
          member.kind === "objectType" || isSystemObjectReferenceType(member)
      ) &&
      resolved.types.every(
        (member) =>
          member.kind === "objectType" ||
          member.kind === "primitiveType" ||
          member.kind === "literalType" ||
          isSystemObjectReferenceType(member)
      )) ||
    isSystemObjectReferenceType(resolved)
  );
};

const wrapMaterializedTargetAst = (
  valueAst: CSharpExpressionAst,
  targetType: IrType,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  const [targetTypeAst, nextContext] = emitTypeAst(targetType, context);
  if (isExactExpressionToType(valueAst, stripNullableTypeAst(targetTypeAst))) {
    return [valueAst, nextContext];
  }

  if (
    valueAst.kind === "castExpression" ||
    (valueAst.kind === "memberAccessExpression" &&
      valueAst.memberName === "Value")
  ) {
    return [valueAst, context];
  }

  return [
    {
      kind: "castExpression",
      type: targetTypeAst,
      expression: valueAst,
    },
    nextContext,
  ];
};

const preservesMaterializedValueTypeNarrowing = (
  narrowed: Extract<NarrowedBinding, { kind: "expr" }>,
  context: EmitterContext
): boolean => {
  const sourceType =
    narrowed.sourceType ?? narrowed.storageType ?? narrowed.carrierType;
  return (
    !!sourceType &&
    !!narrowed.type &&
    requiresValueTypeMaterialization(sourceType, narrowed.type, context)
  );
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

  const sourceFrame: RuntimeMaterializationSourceFrame | undefined = (() => {
    const sourceValueAst =
      narrowed.storageExprAst ??
      identifierExpression(escapeCSharpIdentifier(expr.name));
    if (
      narrowed.sourceMembers &&
      narrowed.sourceCandidateMemberNs &&
      narrowed.sourceMembers.length === narrowed.sourceCandidateMemberNs.length
    ) {
      const explicitFrame = {
        members: narrowed.sourceMembers,
        candidateMemberNs: narrowed.sourceCandidateMemberNs,
        runtimeUnionArity: narrowed.runtimeUnionArity,
      };
      const storageType = context.localValueTypes?.get(expr.name);
      const storageMembers =
        sourceValueAst.kind === "identifierExpression" && storageType
          ? getCanonicalRuntimeUnionMembers(storageType, context)
          : undefined;
      return storageMembers &&
        storageMembers.length > (explicitFrame.runtimeUnionArity ?? 0)
        ? {
            members: storageMembers,
            candidateMemberNs: storageMembers.map((_, index) => index + 1),
            runtimeUnionArity: storageMembers.length,
          }
        : explicitFrame;
    }

    const inferredMembers = narrowed.type
      ? getCanonicalRuntimeUnionMembers(narrowed.type, context)
      : undefined;
    return inferredMembers &&
      inferredMembers.length === narrowed.runtimeMemberNs.length
      ? {
          members: inferredMembers,
          candidateMemberNs: narrowed.runtimeMemberNs,
          runtimeUnionArity: narrowed.runtimeUnionArity,
        }
      : undefined;
  })();
  const sourceValueAst =
    narrowed.storageExprAst ??
    identifierExpression(escapeCSharpIdentifier(expr.name));

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

export const tryEmitRuntimeSubsetMemberProjectionIdentifier = (
  expr: Extract<IrExpression, { kind: "identifier" }>,
  narrowed: Extract<NarrowedBinding, { kind: "runtimeSubset" }>,
  context: EmitterContext,
  expectedType: IrType | undefined
): [CSharpExpressionAst, EmitterContext] | undefined => {
  if (
    !expectedType ||
    isBroadStorageTarget(expectedType, context) ||
    willCarryAsRuntimeUnion(expectedType, context) ||
    narrowed.runtimeMemberNs.length !== 1
  ) {
    return undefined;
  }

  const [sourceMemberN] = narrowed.runtimeMemberNs;
  if (sourceMemberN === undefined || sourceMemberN < 1) {
    return undefined;
  }

  const sourceType = narrowed.sourceType ?? expr.inferredType;
  if (!sourceType) {
    return undefined;
  }

  const [sourceLayout, sourceLayoutContext] = buildRuntimeUnionLayout(
    sourceType,
    context,
    emitTypeAst
  );
  const sourceMember = sourceLayout?.members[sourceMemberN - 1];
  if (!sourceLayout || !sourceMember) {
    return undefined;
  }

  const [sourceMemberAst, sourceMemberContext] = emitTypeAst(
    sourceMember,
    sourceLayoutContext
  );
  const [expectedAst, expectedContext] = emitTypeAst(
    expectedType,
    sourceMemberContext
  );
  if (
    stableTypeKeyFromAst(sourceMemberAst) !== stableTypeKeyFromAst(expectedAst)
  ) {
    return undefined;
  }

  const carrierAst =
    narrowed.storageExprAst ??
    identifierExpression(
      context.localNameMap?.get(expr.name) ?? escapeCSharpIdentifier(expr.name)
    );

  return [
    {
      kind: "invocationExpression",
      expression: {
        kind: "memberAccessExpression",
        expression: carrierAst,
        memberName: `As${sourceMemberN}`,
      },
      arguments: [],
    },
    expectedContext,
  ];
};

export const tryEmitStorageCompatibleIdentifier = (
  expr: Extract<IrExpression, { kind: "identifier" }>,
  context: EmitterContext,
  expectedType: IrType | undefined
): CSharpExpressionAst | undefined => {
  if (!expectedType) {
    return undefined;
  }

  const storageType = context.localValueTypes?.get(expr.name);
  const storageIdentifierAst = getStorageIdentifierAst(expr, context);
  if (!storageIdentifierAst || !storageType) {
    return undefined;
  }

  if (isBroadStorageTarget(expectedType, context)) {
    return storageIdentifierAst;
  }

  const effectiveType =
    context.localSemanticTypes?.get(expr.name) ??
    resolveEffectiveExpressionType(expr, context);
  const strippedEffectiveType = effectiveType
    ? stripNullish(effectiveType)
    : undefined;
  const strippedExpectedType = stripNullish(expectedType);
  const effectiveNamedStructuralAliasMatchesExpected =
    strippedEffectiveType?.kind === "referenceType" &&
    strippedExpectedType.kind === "referenceType" &&
    strippedEffectiveType.structuralOrigin === "namedReference" &&
    (strippedEffectiveType.structuralMembers?.length ?? 0) > 0 &&
    strippedEffectiveType.name === strippedExpectedType.name;
  if (
    !isBroadStorageTarget(expectedType, context) &&
    !willCarryAsRuntimeUnion(expectedType, context) &&
    matchesExpectedEmissionType(effectiveType, expectedType, context)
  ) {
    return effectiveNamedStructuralAliasMatchesExpected
      ? storageIdentifierAst
      : undefined;
  }

  if (!matchesExpectedEmissionType(storageType, expectedType, context)) {
    return undefined;
  }

  if (
    willCarryAsRuntimeUnion(expectedType, context) &&
    !willCarryAsRuntimeUnion(storageType, context)
  ) {
    return undefined;
  }

  if (
    needsStructuralCollectionMaterialization(storageType, expectedType, context)
  ) {
    return undefined;
  }

  return storageIdentifierAst;
};

export const tryEmitCollapsedStorageIdentifier = (
  expr: Extract<IrExpression, { kind: "identifier" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] | undefined => {
  const storageType = context.localValueTypes?.get(expr.name);
  const storageIdentifierAst = getStorageIdentifierAst(expr, context);
  if (!storageIdentifierAst || !storageType) {
    return undefined;
  }

  const effectiveType = resolveEffectiveExpressionType(expr, context);
  if (!effectiveType) {
    return undefined;
  }

  let sameSurfaceResult: [boolean, EmitterContext];
  try {
    sameSurfaceResult = matchesEmittedStorageSurface(
      storageType,
      effectiveType,
      context
    );
  } catch (err) {
    if (err instanceof Error) {
      throw new Error(`${err.message} [identifier=${expr.name}]`);
    }
    throw err;
  }
  const [sameSurface, nextContext] = sameSurfaceResult;
  if (!sameSurface) {
    return undefined;
  }

  return [storageIdentifierAst, nextContext];
};

export const tryEmitImplicitNarrowedStorageIdentifier = (
  expr: Extract<IrExpression, { kind: "identifier" }>,
  narrowed: Extract<NarrowedBinding, { kind: "expr" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] | undefined => {
  if (!narrowed.storageExprAst || !narrowed.type) {
    return undefined;
  }

  const storageType =
    narrowed.storageType ?? context.localValueTypes?.get(expr.name);
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
  const expressionType = expr.inferredType;
  const expressionMatchesExpected = matchesSemanticExpectedType(
    expressionType,
    expectedType,
    context
  );
  return adaptStorageErasedValueAst({
    valueAst: identifierExpression(remappedLocal),
    semanticType: expressionMatchesExpected ? expressionType : effectiveType,
    storageType,
    expectedType,
    context,
    emitTypeAst,
    allowCastFallback: expressionMatchesExpected,
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
  const storageType =
    narrowed.storageType ?? context.localValueTypes?.get(expr.name);
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
  const shouldAvoidBroadCarrierReuseForProjectedNarrowing =
    !!expectedType &&
    isBroadStorageTarget(expectedType, context) &&
    narrowed.carrierExprAst !== undefined &&
    narrowed.carrierExprAst !== narrowed.exprAst;
  const shouldPreserveMaterializedValueNarrowing =
    preservesMaterializedValueTypeNarrowing(narrowed, context);
  const shouldAvoidStorageReuse =
    shouldAvoidBroadStorageReuse ||
    shouldAvoidProjectedRuntimeUnionStorageReuse ||
    shouldAvoidBroadCarrierReuseForProjectedNarrowing ||
    shouldPreserveMaterializedValueNarrowing;
  const originalRuntimeCarrierAst =
    narrowed.carrierExprAst ??
    narrowed.storageExprAst ??
    (remappedLocal ? identifierExpression(remappedLocal) : undefined);
  const originalRuntimeCarrierType = narrowed.carrierExprAst
    ? (narrowed.carrierType ?? context.localValueTypes?.get(expr.name))
    : storageType;
  const [sameSourceCarrierSurface, carrierSurfaceContext] =
    expectedType && originalRuntimeCarrierType
      ? matchesEmittedStorageSurface(
          stripNullish(originalRuntimeCarrierType),
          expectedType,
          context
        )
      : [false, context];
  const canReuseOriginalRuntimeCarrier =
    !!expectedType &&
    !!originalRuntimeCarrierAst &&
    !!originalRuntimeCarrierType &&
    willCarryAsRuntimeUnion(expectedType, context) &&
    sameSourceCarrierSurface &&
    !shouldAvoidStorageReuse &&
    (!narrowedProjectionType ||
      !willCarryAsRuntimeUnion(narrowedProjectionType, context));
  const canReuseOriginalCarrierSurface =
    !!expectedType &&
    !!originalRuntimeCarrierAst &&
    !!originalRuntimeCarrierType &&
    sameSourceCarrierSurface &&
    !shouldAvoidStorageReuse &&
    !requiresValueTypeMaterialization(
      originalRuntimeCarrierType,
      expectedType,
      carrierSurfaceContext
    );
  if (
    expectedType &&
    isBroadStorageTarget(expectedType, context) &&
    !shouldAvoidStorageReuse
  ) {
    const originalSourceCarrierType =
      narrowed.carrierType ??
      narrowed.sourceType ??
      context.localValueTypes?.get(expr.name);
    if (
      originalSourceCarrierType &&
      !willCarryAsRuntimeUnion(originalSourceCarrierType, context) &&
      (matchesExpectedEmissionType(
        stripNullish(originalSourceCarrierType),
        expectedType,
        context
      ) ||
        isStorageErasedBroadObjectPassThroughType(
          originalSourceCarrierType,
          context
        ))
    ) {
      return [
        identifierExpression(
          remappedLocal ?? escapeCSharpIdentifier(expr.name)
        ),
        context,
      ];
    }
    if (narrowed.carrierExprAst) {
      return [narrowed.carrierExprAst, context];
    }
    if (remappedLocal) {
      return [identifierExpression(remappedLocal), context];
    }
    if (narrowed.storageExprAst) {
      return [narrowed.storageExprAst, context];
    }
  }
  if (canReuseOriginalRuntimeCarrier) {
    return [originalRuntimeCarrierAst, carrierSurfaceContext];
  }
  if (canReuseOriginalCarrierSurface) {
    return [originalRuntimeCarrierAst, carrierSurfaceContext];
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

  if (shouldAvoidStorageReuse) {
    return undefined;
  }

  return [narrowed.storageExprAst, nextContext];
};

export const tryEmitExactStorageCompatibleNarrowedIdentifier = (
  expr: Extract<IrExpression, { kind: "identifier" }>,
  narrowed: Extract<NarrowedBinding, { kind: "expr" }>,
  context: EmitterContext,
  expectedType: IrType | undefined
): [CSharpExpressionAst, EmitterContext] | undefined => {
  if (!expectedType) {
    return undefined;
  }

  const remappedLocal = context.localNameMap?.get(expr.name);
  const storageType =
    narrowed.storageType ?? context.localValueTypes?.get(expr.name);
  if (!storageType) {
    return undefined;
  }

  const originalRuntimeCarrierAst =
    narrowed.carrierExprAst ??
    narrowed.storageExprAst ??
    (remappedLocal ? identifierExpression(remappedLocal) : undefined);
  const originalRuntimeCarrierType = narrowed.carrierExprAst
    ? (narrowed.carrierType ?? context.localValueTypes?.get(expr.name))
    : storageType;
  const [sameSourceCarrierSurface, carrierSurfaceContext] =
    originalRuntimeCarrierAst && originalRuntimeCarrierType
      ? matchesEmittedStorageSurface(
          stripNullish(originalRuntimeCarrierType),
          expectedType,
          context
        )
      : [false, context];
  if (preservesMaterializedValueTypeNarrowing(narrowed, context)) {
    return undefined;
  }

  if (
    originalRuntimeCarrierAst &&
    willCarryAsRuntimeUnion(expectedType, context) &&
    sameSourceCarrierSurface
  ) {
    return [originalRuntimeCarrierAst, carrierSurfaceContext];
  }
  if (
    originalRuntimeCarrierAst &&
    sameSourceCarrierSurface &&
    originalRuntimeCarrierType &&
    !requiresValueTypeMaterialization(
      originalRuntimeCarrierType,
      expectedType,
      carrierSurfaceContext
    )
  ) {
    return [originalRuntimeCarrierAst, carrierSurfaceContext];
  }

  const [sameStorageSurface, nextContext] = matchesEmittedStorageSurface(
    storageType,
    expectedType,
    context
  );
  if (!sameStorageSurface) {
    return undefined;
  }

  if (
    narrowed.exprAst.kind === "memberAccessExpression" &&
    narrowed.exprAst.memberName === "Value" &&
    narrowed.exprAst.expression === narrowed.storageExprAst
  ) {
    return undefined;
  }

  if (narrowed.storageExprAst) {
    return [narrowed.storageExprAst, nextContext];
  }

  if (!remappedLocal) {
    return undefined;
  }

  return [identifierExpression(remappedLocal), nextContext];
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
    willCarryAsRuntimeUnion(directMemberType, context) &&
    willCarryAsRuntimeUnion(expectedType, context) &&
    runtimeUnionAliasReferencesMatch(directMemberType, expectedType, context)
  ) {
    return [narrowed.exprAst, context];
  }

  const directSurfaceMemberType =
    resolveDirectValueSurfaceType(narrowed.exprAst, context) ??
    directMemberType;

  const directAliasCarrierType = directMemberType ?? directSurfaceMemberType;
  if (
    directAliasCarrierType &&
    willCarryAsRuntimeUnion(directAliasCarrierType, context) &&
    willCarryAsRuntimeUnion(expectedType, context)
  ) {
    const [expectedLayout, expectedLayoutContext] = buildRuntimeUnionLayout(
      expectedType,
      context,
      emitTypeAst
    );
    if (expectedLayout) {
      const aliasMemberIndices = expectedLayout.members.flatMap(
        (member, index) =>
          member &&
          runtimeUnionAliasReferencesMatch(
            member,
            directAliasCarrierType,
            expectedLayoutContext
          )
            ? [index]
            : []
      );
      if (aliasMemberIndices.length === 1) {
        const [memberIndex] = aliasMemberIndices;
        if (memberIndex !== undefined) {
          return [
            buildRuntimeUnionFactoryCallAst(
              buildRuntimeUnionTypeAst(expectedLayout),
              memberIndex + 1,
              narrowed.exprAst
            ),
            expectedLayoutContext,
          ];
        }
      }
    }
  }

  if (
    directSurfaceMemberType &&
    willCarryAsRuntimeUnion(directSurfaceMemberType, context) &&
    willCarryAsRuntimeUnion(expectedType, context) &&
    runtimeUnionAliasReferencesMatch(
      directSurfaceMemberType,
      expectedType,
      context
    )
  ) {
    return [narrowed.exprAst, context];
  }

  if (
    directSurfaceMemberType &&
    willCarryAsRuntimeUnion(expectedType, context) &&
    !willCarryAsRuntimeUnion(directSurfaceMemberType, context)
  ) {
    const [expectedLayout, expectedLayoutContext] = buildRuntimeUnionLayout(
      expectedType,
      context,
      emitTypeAst
    );
    if (expectedLayout) {
      const [directSurfaceTypeAst, directSurfaceContext] = emitTypeAst(
        directSurfaceMemberType,
        expectedLayoutContext
      );
      const matchingMemberIndices = expectedLayout.memberTypeAsts.flatMap(
        (memberTypeAst, index) =>
          memberTypeAst &&
          sameTypeAstSurface(
            stripNullableTypeAst(directSurfaceTypeAst),
            stripNullableTypeAst(memberTypeAst)
          )
            ? [index]
            : []
      );
      if (matchingMemberIndices.length === 1) {
        const [memberIndex] = matchingMemberIndices;
        if (memberIndex !== undefined) {
          return [
            buildRuntimeUnionFactoryCallAst(
              buildRuntimeUnionTypeAst(expectedLayout),
              memberIndex + 1,
              narrowed.exprAst
            ),
            directSurfaceContext,
          ];
        }
      }
    }
  }

  if (
    directMemberType &&
    matchesExpectedEmissionType(directMemberType, expectedType, context)
  ) {
    return [narrowed.exprAst, context];
  }

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
        (err.message.startsWith("ICE: Unresolved reference type ") ||
          err.message.startsWith(
            "ICE: Non-transparent intersection type reached emitter"
          ) ||
          err.message.startsWith("ICE: 'unknown' type reached emitter") ||
          err.message.startsWith("ICE: 'any' type reached emitter"))
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
  let actualSurface:
    | [ReturnType<typeof emitTypeAst>[0], EmitterContext]
    | undefined;
  try {
    actualSurface = tryEmitSurfaceTypeAst(strippedActual, context);
  } catch (err) {
    if (err instanceof Error) {
      throw new Error(
        `${err.message} ${buildStorageSurfaceDiagnosticContext(
          actualType,
          expectedType,
          strippedActual,
          strippedExpected,
          context
        )}`
      );
    }
    throw err;
  }
  if (!actualSurface) {
    return [false, context];
  }
  const [actualTypeAst, actualTypeContext] = actualSurface;
  let expectedSurface:
    | [ReturnType<typeof emitTypeAst>[0], EmitterContext]
    | undefined;
  try {
    expectedSurface = tryEmitSurfaceTypeAst(
      strippedExpected,
      actualTypeContext
    );
  } catch (err) {
    if (err instanceof Error) {
      throw new Error(
        `${err.message} ${buildStorageSurfaceDiagnosticContext(
          actualType,
          expectedType,
          strippedActual,
          strippedExpected,
          actualTypeContext
        )}`
      );
    }
    throw err;
  }
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
