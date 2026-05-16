import { IrExpression, IrType } from "@tsonic/frontend";
import { EmitterContext, NarrowedBinding } from "../../types.js";
import { identifierExpression } from "../../core/format/backend-ast/builders.js";
import { escapeCSharpIdentifier } from "../../emitter-types/index.js";
import {
  matchesExpectedEmissionType,
  requiresValueTypeMaterialization,
} from "../../core/semantic/expected-type-matching.js";
import { tryResolveRuntimeUnionMemberType } from "../../core/semantic/narrowed-expression-types.js";
import { willCarryAsRuntimeUnion } from "../../core/semantic/union-semantics.js";
import { stripNullish } from "../../core/semantic/type-resolution.js";
import { isStorageErasedBroadObjectPassThroughType } from "../../core/semantic/broad-object-types.js";
import type { CSharpExpressionAst } from "../../core/format/backend-ast/types.js";
import { isBroadStorageTarget } from "./broad-storage-target.js";
import { matchesEmittedStorageSurface } from "./storage-surface-match.js";
import { preservesMaterializedValueTypeNarrowing } from "./storage-surface-shared.js";

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
