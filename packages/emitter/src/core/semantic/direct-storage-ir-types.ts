import type { IrExpression, IrType } from "@tsonic/frontend";
import type { EmitterContext, NarrowedBinding } from "../../types.js";
import { resolveIdentifierValueSurfaceType } from "./direct-value-surfaces.js";
import { getMemberAccessNarrowKey } from "./narrowing-keys.js";
import { resolveEffectiveExpressionType } from "./narrowed-expression-types.js";
import { getAcceptedSurfaceType } from "./defaults.js";
import {
  getPropertyType,
  resolveTypeAlias,
  stripNullish,
} from "./type-resolution.js";
import { normalizeRuntimeStorageType } from "./storage-types.js";
import { getRuntimeUnionReferenceMembers } from "./runtime-union-shared.js";
import { unwrapTransparentExpression } from "./transparent-expressions.js";
import { resolveTypeMemberKind } from "./member-surfaces.js";

const withOptionalUndefined = (type: IrType): IrType =>
  type.kind === "unionType" &&
  type.types.some(
    (member) => member.kind === "primitiveType" && member.name === "undefined"
  )
    ? type
    : {
        kind: "unionType",
        types: [type, { kind: "primitiveType", name: "undefined" }],
      };

const resolveMemberAccessStorageType = (
  expr: Extract<IrExpression, { kind: "memberAccess" }>,
  context: EmitterContext
): IrType | undefined => {
  if (expr.isComputed) {
    const transparentReceiver = unwrapTransparentExpression(expr.object);
    const storageOwnerType =
      transparentReceiver.kind === "identifier"
        ? resolveIdentifierCarrierStorageType(transparentReceiver, context)
        : transparentReceiver.kind === "memberAccess"
          ? resolveMemberAccessStorageType(transparentReceiver, context)
          : (resolveEffectiveExpressionType(transparentReceiver, context) ??
            transparentReceiver.inferredType);
    const memberOwnerType =
      expr.isOptional && storageOwnerType
        ? stripNullish(storageOwnerType)
        : storageOwnerType;
    const resolvedMemberOwnerType = memberOwnerType
      ? resolveTypeAlias(memberOwnerType, context)
      : undefined;

    if (
      expr.accessKind === "dictionary" &&
      resolvedMemberOwnerType?.kind === "dictionaryType"
    ) {
      const acceptsMissingValue =
        expr.isOptional || context.options.surface === "@tsonic/js";
      return (
        getAcceptedSurfaceType(
          resolvedMemberOwnerType.valueType,
          acceptsMissingValue
        ) ?? resolvedMemberOwnerType.valueType
      );
    }

    return undefined;
  }

  if (typeof expr.property !== "string") {
    return undefined;
  }

  const semanticOwnerType =
    resolveEffectiveExpressionType(expr.object, context) ??
    expr.object.inferredType;
  let storageOwnerType = semanticOwnerType;
  const transparentReceiver = unwrapTransparentExpression(expr.object);
  const transparentReceiverType =
    resolveEffectiveExpressionType(transparentReceiver, context) ??
    transparentReceiver.inferredType;
  const transparentMemberOwnerType =
    expr.isOptional && transparentReceiverType
      ? stripNullish(transparentReceiverType)
      : transparentReceiverType;

  if (
    transparentMemberOwnerType &&
    resolveTypeMemberKind(
      transparentMemberOwnerType,
      expr.property,
      context
    ) !== undefined
  ) {
    storageOwnerType = transparentReceiverType;
  }

  const propertyType =
    getPropertyType(storageOwnerType, expr.property, context) ??
    expr.inferredType;
  const optionalAwarePropertyType =
    propertyType && expr.isOptional
      ? withOptionalUndefined(propertyType)
      : propertyType;
  return optionalAwarePropertyType
    ? (normalizeRuntimeStorageType(optionalAwarePropertyType, context) ??
        optionalAwarePropertyType)
    : undefined;
};

const resolveNarrowedStorageType = (
  narrowed: NarrowedBinding | undefined,
  fallbackType: IrType | undefined
): IrType | undefined => {
  if (!narrowed) {
    return fallbackType;
  }

  switch (narrowed.kind) {
    case "expr":
      return (
        narrowed.storageType ??
        fallbackType ??
        narrowed.sourceType ??
        narrowed.type
      );
    case "runtimeSubset":
      return fallbackType ?? narrowed.sourceType ?? narrowed.type;
    case "rename":
      return narrowed.type ?? narrowed.sourceType ?? fallbackType;
  }
};

const resolveNarrowedCarrierType = (
  narrowed: NarrowedBinding | undefined,
  semanticFallbackType: IrType | undefined,
  storageFallbackType: IrType | undefined,
  context: EmitterContext
): IrType | undefined => {
  const pickPreferredCarrierCandidate = (
    ...candidates: (IrType | undefined)[]
  ): IrType | undefined => {
    const hasExplicitRuntimeCarrierIdentity = (
      candidate: IrType | undefined
    ): candidate is IrType => {
      if (!candidate) {
        return false;
      }

      if (
        candidate.kind === "referenceType" &&
        getRuntimeUnionReferenceMembers(candidate) !== undefined
      ) {
        return true;
      }

      const resolved = resolveTypeAlias(candidate, context);
      return (
        resolved.kind === "unionType" &&
        resolved.runtimeCarrierFamilyKey !== undefined
      );
    };

    return (
      candidates.find((candidate) =>
        hasExplicitRuntimeCarrierIdentity(candidate)
      ) ??
      candidates.find(
        (candidate): candidate is IrType => candidate !== undefined
      )
    );
  };

  if (!narrowed) {
    return pickPreferredCarrierCandidate(
      storageFallbackType,
      semanticFallbackType
    );
  }

  switch (narrowed.kind) {
    case "expr":
      return narrowed.carrierExprAst
        ? pickPreferredCarrierCandidate(
            narrowed.carrierType,
            narrowed.sourceType,
            semanticFallbackType,
            narrowed.type,
            narrowed.storageType,
            storageFallbackType
          )
        : pickPreferredCarrierCandidate(
            narrowed.sourceType,
            semanticFallbackType,
            narrowed.type,
            narrowed.storageType,
            storageFallbackType
          );
    case "runtimeSubset":
      return pickPreferredCarrierCandidate(
        narrowed.sourceType,
        semanticFallbackType,
        narrowed.type,
        storageFallbackType
      );
    case "rename":
      return pickPreferredCarrierCandidate(
        narrowed.sourceType,
        semanticFallbackType,
        narrowed.type,
        storageFallbackType
      );
  }
};

export const resolveNamedRuntimeCarrierType = (
  name: string,
  context: EmitterContext
): IrType | undefined => {
  const localSemanticType = context.localSemanticTypes?.get(name);
  const localStorageType = context.localValueTypes?.get(name);
  const narrowed = context.narrowedBindings?.get(name);
  return resolveNarrowedCarrierType(
    narrowed,
    localSemanticType,
    localStorageType,
    context
  );
};

export const resolveIdentifierCarrierStorageType = (
  expr: Extract<IrExpression, { kind: "identifier" }>,
  context: EmitterContext
): IrType | undefined => {
  const localStorageType = context.localValueTypes?.get(expr.name);
  const narrowed = context.narrowedBindings?.get(expr.name);
  return (
    resolveNarrowedStorageType(narrowed, localStorageType) ??
    resolveIdentifierValueSurfaceType(expr, context)
  );
};

export const resolveIdentifierRuntimeCarrierType = (
  expr: Extract<IrExpression, { kind: "identifier" }>,
  context: EmitterContext
): IrType | undefined => {
  return (
    resolveNamedRuntimeCarrierType(expr.name, context) ??
    resolveIdentifierValueSurfaceType(expr, context)
  );
};

export const resolveDirectStorageIrType = (
  expr: IrExpression,
  context: EmitterContext
): IrType | undefined => {
  if (expr.kind === "identifier") {
    return resolveIdentifierCarrierStorageType(expr, context);
  }

  if (expr.kind === "memberAccess") {
    return resolveMemberAccessStorageType(expr, context);
  }

  return undefined;
};

const resolveMemberAccessRuntimeCarrierType = (
  expr: Extract<IrExpression, { kind: "memberAccess" }>,
  context: EmitterContext
): IrType | undefined => {
  const narrowKey = getMemberAccessNarrowKey(expr);
  const narrowed = narrowKey
    ? context.narrowedBindings?.get(narrowKey)
    : undefined;
  const semanticFallbackType =
    resolveEffectiveExpressionType(expr, context) ?? expr.inferredType;
  const storageFallbackType = resolveMemberAccessStorageType(expr, context);
  return (
    resolveNarrowedCarrierType(
      narrowed,
      semanticFallbackType,
      storageFallbackType,
      context
    ) ??
    semanticFallbackType ??
    storageFallbackType
  );
};

export const resolveRuntimeCarrierIrType = (
  expr: IrExpression,
  context: EmitterContext
): IrType | undefined => {
  if (expr.kind === "identifier") {
    return resolveIdentifierRuntimeCarrierType(expr, context);
  }

  if (expr.kind === "memberAccess") {
    return resolveMemberAccessRuntimeCarrierType(expr, context);
  }

  return undefined;
};
