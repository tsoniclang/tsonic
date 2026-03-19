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
import { resolveEffectiveExpressionType } from "../core/semantic/narrowed-expression-types.js";
import {
  resolveTypeAlias,
  stripNullish,
} from "../core/semantic/type-resolution.js";
import { adaptStorageErasedValueAst } from "../core/semantic/storage-erased-adaptation.js";
import type { CSharpExpressionAst } from "../core/format/backend-ast/types.js";

const isBroadStorageTarget = (
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

  if (matchesExpectedEmissionType(storageType, effectiveType, context)) {
    return [identifierExpression(remappedLocal), context];
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

  if (!matchesExpectedEmissionType(storageType, narrowed.type, context)) {
    const [sameSurface, nextContext] = matchesEmittedStorageSurface(
      storageType,
      narrowed.type,
      context
    );
    if (!sameSurface) {
      return undefined;
    }
    return [narrowed.storageExprAst, nextContext];
  }

  return [narrowed.storageExprAst, context];
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

  if (matchesExpectedEmissionType(storageType, narrowed.type, context)) {
    return [identifierExpression(remappedLocal), context];
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
  if (!matchesExpectedEmissionType(effectiveType, expectedType, context)) {
    return undefined;
  }

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
  if (!narrowed.storageExprAst || !narrowed.type) {
    return undefined;
  }

  const storageType = context.localValueTypes?.get(expr.name);
  if (!storageType) {
    return undefined;
  }

  const targetType = expectedType ?? narrowed.type;
  if (!matchesExpectedEmissionType(storageType, targetType, context)) {
    const [sameSurface, nextContext] = matchesEmittedStorageSurface(
      storageType,
      targetType,
      context
    );
    if (!sameSurface) {
      return undefined;
    }
    return [narrowed.storageExprAst, nextContext];
  }

  return [narrowed.storageExprAst, context];
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

  return materializeDirectNarrowingAst(
    narrowed.exprAst,
    effectiveType,
    expectedType,
    context
  );
};

const matchesEmittedStorageSurface = (
  actualType: IrType | undefined,
  expectedType: IrType | undefined,
  context: EmitterContext
): [boolean, EmitterContext] => {
  if (!actualType || !expectedType) {
    return [false, context];
  }

  if (requiresValueTypeMaterialization(actualType, expectedType, context)) {
    return [false, context];
  }

  const strippedActual = stripNullish(actualType);
  const strippedExpected = stripNullish(expectedType);
  const [actualTypeAst, actualTypeContext] = emitTypeAst(
    strippedActual,
    context
  );
  const [expectedTypeAst, expectedTypeContext] = emitTypeAst(
    strippedExpected,
    actualTypeContext
  );

  return [
    stableTypeKeyFromAst(actualTypeAst) ===
      stableTypeKeyFromAst(expectedTypeAst),
    expectedTypeContext,
  ];
};
