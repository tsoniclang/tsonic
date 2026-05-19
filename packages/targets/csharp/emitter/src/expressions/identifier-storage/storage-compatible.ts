import { IrExpression, IrType } from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import { matchesExpectedEmissionType } from "../../core/semantic/expected-type-matching.js";
import { resolveEffectiveExpressionType } from "../../core/semantic/narrowed-expression-types.js";
import { willCarryAsRuntimeUnion } from "../../core/semantic/union-semantics.js";
import { stripNullish } from "../../core/semantic/type-resolution.js";
import type { CSharpExpressionAst } from "../../core/format/backend-ast/types.js";
import { isBroadStorageTarget } from "./broad-storage-target.js";
import { matchesEmittedStorageSurface } from "./storage-surface-match.js";
import {
  getStorageIdentifierAst,
  needsStructuralCollectionMaterialization,
} from "./storage-surface-shared.js";

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
