import { type IrExpression, type IrType } from "@tsonic/frontend";
import { resolveEffectiveExpressionType } from "../core/semantic/narrowed-expression-types.js";
import { tryResolveRuntimeUnionMemberType } from "../core/semantic/narrowed-expression-types.js";
import type { CSharpExpressionAst } from "../core/format/backend-ast/types.js";
import { contextSurfaceIncludesJs, type EmitterContext } from "../types.js";
import { sameTypeAstSurface } from "../core/format/backend-ast/utils.js";
import {
  matchesExpectedEmissionType,
  requiresValueTypeMaterialization,
} from "../core/semantic/expected-type-matching.js";
import {
  maybeCastNumericToExpectedIntegralAst,
  maybeCastNullishTypeParamAst,
  maybeConvertCharToStringAst,
  maybeBoxJsNumberAsObjectAst,
  maybeUnwrapNullableValueTypeAst,
  isNumericFactoryCreateCheckedAst,
  simplifyRedundantObjectBridgeCastsAst,
} from "./post-emission-adaptation.js";
import {
  isExactArrayCreationToType,
  isExactExpressionToType,
  tryEmitExactComparisonTargetAst,
} from "./exact-comparison.js";
import {
  maybeNarrowRuntimeUnionExpressionAst,
  maybeAdaptDictionaryUnionValueAst,
  maybeAdaptRuntimeUnionExpressionAst,
} from "./runtime-union-adaptation.js";
import { tryAdaptAwaitableValueAst } from "./awaitable-adaptation.js";
import {
  resolveDirectStorageExpressionType,
  resolveDirectStorageIrType,
  resolveExactStorageSurfaceExpressionType,
  resolveIdentifierRuntimeCarrierType,
  resolveRuntimeCarrierExpressionAst,
  resolveRuntimeCarrierIrType,
} from "./direct-storage-types.js";
import {
  resolveDirectRuntimeCarrierType,
  resolveDirectValueSurfaceType,
} from "../core/semantic/direct-value-surfaces.js";
import { getAsyncWrapperSourceResultType } from "../core/semantic/async-wrapper-types.js";
import { tryAdaptStructuralExpressionAst } from "./structural-adaptation.js";
import { hasMatchingRuntimeCarrierElementType } from "./structural-collection-adaptation.js";
import { matchesEmittedStorageSurface } from "./identifier-storage.js";
import { resolveRuntimeMaterializationTargetType } from "../core/semantic/runtime-materialization-targets.js";
import {
  buildRuntimeUnionLayout,
  buildRuntimeUnionTypeAst,
  findExactRuntimeUnionMemberIndices,
} from "../core/semantic/runtime-unions.js";
import { resolveComparableType } from "../core/semantic/comparable-types.js";
import {
  isStorageErasedBroadObjectPassThroughType,
  isBroadObjectSlotType,
} from "../core/semantic/broad-object-types.js";
import {
  adaptMatch,
  adaptNoMatch,
  adaptValueOrUndefined,
  type AdaptResult,
} from "../core/semantic/adapt-result.js";
import { willCarryAsRuntimeUnion } from "../core/semantic/union-semantics.js";
import {
  getRuntimeUnionAliasReferenceKey,
  runtimeUnionAliasReferencesMatch,
} from "../core/semantic/runtime-union-alias-identity.js";
import { getMemberAccessNarrowKey } from "../core/semantic/narrowing-keys.js";
import {
  isDefinitelyValueType,
  resolveTypeAlias,
  splitRuntimeNullishUnionMembers,
  stripNullish,
} from "../core/semantic/type-resolution.js";
import { emitTypeAst } from "../type-emitter.js";
import { unwrapTransparentExpression } from "../core/semantic/transparent-expressions.js";
import { identifierExpression } from "../core/format/backend-ast/builders.js";
import { escapeCSharpIdentifier } from "../emitter-types/index.js";
import { referenceTypeHasClrIdentity } from "../core/semantic/clr-type-identity.js";
import { areIrTypesEquivalent } from "../core/semantic/type-equivalence.js";
import { tryStripConditionalNullishGuardAst } from "../core/semantic/narrowing-builders.js";
import { resolveStructuralViewMethodSurface } from "../core/semantic/structural-view-types.js";
import {
  getArrayElementType,
  getDictionaryValueType,
} from "./structural-type-shapes.js";
import { isCompilerGeneratedStructuralReferenceType } from "../core/semantic/structural-shape-matching.js";

const JS_NUMERIC_ADAPTATION_CLR_NAMES = new Set([
  "System.Int32",
  "global::System.Int32",
  "System.Double",
  "global::System.Double",
]);

const isNumericTypeParameterType = (
  type: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!type) {
    return false;
  }

  const resolved = resolveTypeAlias(stripNullish(type), context);
  return (
    resolved.kind === "typeParameterType" &&
    (context.typeParamConstraints?.get(resolved.name) ?? "unconstrained") ===
      "numeric"
  );
};

const isJsNumberStorageTarget = (
  type: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!type) {
    return false;
  }

  const resolved = resolveTypeAlias(stripNullish(type), context);
  return (
    (resolved.kind === "primitiveType" && resolved.name === "number") ||
    (resolved.kind === "referenceType" &&
      (resolved.name === "double" ||
        referenceTypeHasClrIdentity(resolved, [
          "System.Double",
          "global::System.Double",
        ])))
  );
};

const isBroadCarrierPreservingTarget = (
  type: IrType | undefined,
  context: EmitterContext
): boolean =>
  !!type &&
  isBroadObjectSlotType(type, context) &&
  !willCarryAsRuntimeUnion(type, context);

const isCarrierPreservingExpectedType = (
  type: IrType | undefined,
  context: EmitterContext
): type is IrType =>
  !!type &&
  (isBroadObjectSlotType(type, context) ||
    willCarryAsRuntimeUnion(type, context) ||
    (splitRuntimeNullishUnionMembers(type)?.hasRuntimeNullish ?? false));

const matchesRuntimeUnionCarrierSurface = (
  actualType: IrType,
  expectedType: IrType,
  context: EmitterContext
): boolean => {
  if (
    !willCarryAsRuntimeUnion(actualType, context) &&
    !willCarryAsRuntimeUnion(expectedType, context)
  ) {
    const actualExactSurface = tryEmitExactComparisonTargetAst(
      actualType,
      context
    );
    if (!actualExactSurface) {
      return false;
    }
    const expectedExactSurface = tryEmitExactComparisonTargetAst(
      expectedType,
      actualExactSurface[1]
    );
    return (
      !!expectedExactSurface &&
      sameTypeAstSurface(actualExactSurface[0], expectedExactSurface[0])
    );
  }

  const [actualLayout, actualLayoutContext] = buildRuntimeUnionLayout(
    actualType,
    context,
    emitTypeAst
  );
  const [expectedLayout] = buildRuntimeUnionLayout(
    expectedType,
    actualLayoutContext,
    emitTypeAst
  );

  if (!actualLayout || !expectedLayout) {
    return actualLayout === expectedLayout;
  }

  return sameTypeAstSurface(
    buildRuntimeUnionTypeAst(actualLayout),
    buildRuntimeUnionTypeAst(expectedLayout)
  );
};

const runtimeUnionCarrierSurfaceDiffers = (
  actualType: IrType | undefined,
  expectedType: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!actualType || !expectedType) {
    return false;
  }

  const [actualLayout, actualLayoutContext] = buildRuntimeUnionLayout(
    actualType,
    context,
    emitTypeAst
  );
  const [expectedLayout] = buildRuntimeUnionLayout(
    expectedType,
    actualLayoutContext,
    emitTypeAst
  );
  if (!actualLayout || !expectedLayout) {
    return false;
  }

  return !sameTypeAstSurface(
    buildRuntimeUnionTypeAst(actualLayout),
    buildRuntimeUnionTypeAst(expectedLayout)
  );
};

const hasMatchingRuntimeCarrierFamily = (
  actualType: IrType | undefined,
  expectedType: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!actualType || !expectedType) {
    return false;
  }

  const resolvedActual = resolveTypeAlias(stripNullish(actualType), context);
  const resolvedExpected = resolveTypeAlias(
    stripNullish(expectedType),
    context
  );
  if (
    resolvedActual.kind !== "unionType" ||
    resolvedExpected.kind !== "unionType"
  ) {
    return false;
  }

  return (
    resolvedActual.runtimeCarrierFamilyKey !== undefined &&
    resolvedActual.runtimeCarrierFamilyKey ===
      resolvedExpected.runtimeCarrierFamilyKey
  );
};

export const hasMismatchedCollectionElementCarrier = (
  sourceType: IrType,
  targetType: IrType,
  context: EmitterContext
): boolean => {
  const sourceArrayElementType = getArrayElementType(sourceType, context);
  const targetArrayElementType = getArrayElementType(targetType, context);
  if (sourceArrayElementType && targetArrayElementType) {
    return !hasMatchingRuntimeCarrierElementType(
      sourceArrayElementType,
      targetArrayElementType,
      context
    );
  }

  const sourceDictionaryValueType = getDictionaryValueType(sourceType, context);
  const targetDictionaryValueType = getDictionaryValueType(targetType, context);
  if (sourceDictionaryValueType && targetDictionaryValueType) {
    return !hasMatchingRuntimeCarrierElementType(
      sourceDictionaryValueType,
      targetDictionaryValueType,
      context
    );
  }

  return false;
};

export const resolveCarrierPreservingSourceType = (
  sourceType: IrType | undefined,
  carrierTargetType: IrType | undefined,
  context: EmitterContext
): IrType | undefined => {
  if (!sourceType || !carrierTargetType) {
    return undefined;
  }

  const strippedSourceType = stripNullish(sourceType);
  const strippedCarrierTargetType = stripNullish(carrierTargetType);
  const sourceHasRuntimeNullish =
    splitRuntimeNullishUnionMembers(sourceType)?.hasRuntimeNullish ?? false;
  const targetHasRuntimeNullish =
    splitRuntimeNullishUnionMembers(carrierTargetType)?.hasRuntimeNullish ??
    false;
  if (sourceHasRuntimeNullish && !targetHasRuntimeNullish) {
    return undefined;
  }
  if (
    isNumericTypeParameterType(strippedSourceType, context) &&
    isJsNumberStorageTarget(strippedCarrierTargetType, context)
  ) {
    return undefined;
  }
  if (
    hasMismatchedCollectionElementCarrier(
      strippedSourceType,
      strippedCarrierTargetType,
      context
    )
  ) {
    return undefined;
  }
  return matchesExpectedEmissionType(
    strippedSourceType,
    strippedCarrierTargetType,
    context
  ) &&
    matchesRuntimeUnionCarrierSurface(
      strippedSourceType,
      strippedCarrierTargetType,
      context
    )
    ? sourceHasRuntimeNullish && targetHasRuntimeNullish
      ? sourceType
      : strippedSourceType
    : undefined;
};

const resolveRawRuntimeUnionProjectionSourceType = (
  sourceType: IrType | undefined,
  carrierTargetType: IrType | undefined,
  context: EmitterContext
): IrType | undefined => {
  if (!sourceType || !carrierTargetType) {
    return undefined;
  }

  const strippedSourceType = stripNullish(sourceType);
  const strippedCarrierTargetType = stripNullish(carrierTargetType);
  if (
    !willCarryAsRuntimeUnion(strippedSourceType, context) ||
    !willCarryAsRuntimeUnion(strippedCarrierTargetType, context)
  ) {
    return undefined;
  }

  if (
    !matchesExpectedEmissionType(
      strippedSourceType,
      strippedCarrierTargetType,
      context
    )
  ) {
    return undefined;
  }

  if (
    matchesRuntimeUnionCarrierSurface(
      strippedSourceType,
      strippedCarrierTargetType,
      context
    )
  ) {
    return undefined;
  }

  return sourceType;
};

const resolveActiveCarrierSourceType = (
  carrierType: IrType | undefined,
  effectiveExpressionType: IrType | undefined
): IrType | undefined => {
  if (!carrierType) {
    return undefined;
  }

  const carrierHasRuntimeNullish =
    splitRuntimeNullishUnionMembers(carrierType)?.hasRuntimeNullish ?? false;
  const effectiveHasRuntimeNullish =
    (effectiveExpressionType
      ? splitRuntimeNullishUnionMembers(effectiveExpressionType)
          ?.hasRuntimeNullish
      : false) ?? false;

  return carrierHasRuntimeNullish && !effectiveHasRuntimeNullish
    ? stripNullish(carrierType)
    : carrierType;
};

const stillUsesRawRuntimeProjectionSourceType = (
  effectiveExpressionType: IrType | undefined,
  rawProjectionSourceType: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!effectiveExpressionType || !rawProjectionSourceType) {
    return false;
  }

  return (
    runtimeUnionAliasReferencesMatch(
      effectiveExpressionType,
      rawProjectionSourceType,
      context
    ) ||
    resolveCarrierPreservingSourceType(
      effectiveExpressionType,
      rawProjectionSourceType,
      context
    ) !== undefined ||
    resolveCarrierPreservingSourceType(
      rawProjectionSourceType,
      effectiveExpressionType,
      context
    ) !== undefined
  );
};

const unwrapTransparentAst = (
  ast: CSharpExpressionAst
): CSharpExpressionAst => {
  let current = ast;
  while (
    current.kind === "parenthesizedExpression" ||
    current.kind === "castExpression" ||
    current.kind === "asExpression"
  ) {
    current = current.expression;
  }
  return current;
};

const isCompilerGeneratedStructuralType = (
  type: IrType | undefined
): boolean => {
  const stripped = type ? stripNullish(type) : undefined;
  return (
    stripped?.kind === "referenceType" &&
    isCompilerGeneratedStructuralReferenceType(stripped)
  );
};

const isNamedStructuralReferenceType = (type: IrType | undefined): boolean => {
  const stripped = type ? stripNullish(type) : undefined;
  return (
    stripped?.kind === "referenceType" &&
    stripped.structuralOrigin === "namedReference" &&
    (stripped.structuralMembers?.length ?? 0) > 0
  );
};

const resolveSourceLocalName = (
  emittedIdentifier: string,
  context: EmitterContext
): string => {
  for (const [sourceName, localName] of context.localNameMap ?? []) {
    if (localName === emittedIdentifier) {
      return sourceName;
    }
  }

  return emittedIdentifier;
};

const identifierAlreadyHasExpectedSurface = (
  valueAst: CSharpExpressionAst,
  expectedType: IrType,
  context: EmitterContext
): boolean => {
  if (valueAst.kind !== "identifierExpression") {
    return false;
  }

  const sourceName = resolveSourceLocalName(valueAst.identifier, context);
  const localType =
    context.localValueTypes?.get(sourceName) ??
    context.localSemanticTypes?.get(sourceName);
  if (!localType) {
    return false;
  }

  if (
    areIrTypesEquivalent(
      stripNullish(localType),
      stripNullish(expectedType),
      context
    )
  ) {
    return true;
  }

  try {
    const [localTypeAst, localTypeContext] = emitTypeAst(
      stripNullish(localType),
      context
    );
    const [expectedTypeAst] = emitTypeAst(
      stripNullish(expectedType),
      localTypeContext
    );
    return sameTypeAstSurface(localTypeAst, expectedTypeAst);
  } catch {
    return false;
  }
};

const isCurrentInstanceSelfTarget = (
  expr: IrExpression,
  ast: CSharpExpressionAst,
  expectedType: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (expr.kind !== "this" || !expectedType || !context.declaringTypeName) {
    return false;
  }

  const unwrappedAst = unwrapTransparentAst(ast);
  if (
    unwrappedAst.kind !== "identifierExpression" ||
    unwrappedAst.identifier !== (context.objectLiteralThisIdentifier ?? "this")
  ) {
    return false;
  }

  const declaringType: IrType = {
    kind: "referenceType",
    name: context.declaringTypeName,
    ...(context.declaringTypeParameterNames &&
    context.declaringTypeParameterNames.length > 0
      ? {
          typeArguments: context.declaringTypeParameterNames.map(
            (name): IrType => ({ kind: "typeParameterType", name })
          ),
        }
      : {}),
  };

  const targetType = stripNullish(expectedType);
  const candidateThisTypes = [expr.inferredType, declaringType].filter(
    (candidate): candidate is IrType => candidate !== undefined
  );

  return candidateThisTypes.some((candidate) =>
    areIrTypesEquivalent(candidate, targetType, context)
  );
};

export const resolveCarrierPreservingRawExpectedType = (opts: {
  readonly expr: IrExpression;
  readonly selectedExpectedType: IrType | undefined;
  readonly contextualExpectedType: IrType | undefined;
  readonly surfaceExpectedType: IrType | undefined;
  readonly finalExpectedType: IrType | undefined;
  readonly context: EmitterContext;
}): IrType | undefined => {
  const {
    expr,
    selectedExpectedType,
    contextualExpectedType,
    surfaceExpectedType,
    finalExpectedType,
    context,
  } = opts;
  const transparentExpr = unwrapTransparentExpression(expr);
  const carrierTargetType = isCarrierPreservingExpectedType(
    surfaceExpectedType,
    context
  )
    ? surfaceExpectedType
    : finalExpectedType;
  if (!isCarrierPreservingExpectedType(carrierTargetType, context)) {
    return contextualExpectedType;
  }
  const narrowKey =
    transparentExpr.kind === "identifier"
      ? transparentExpr.name
      : transparentExpr.kind === "memberAccess"
        ? getMemberAccessNarrowKey(transparentExpr)
        : undefined;
  const narrowed = narrowKey
    ? context.narrowedBindings?.get(narrowKey)
    : undefined;
  const hasProjectedNarrowing =
    narrowed?.kind === "expr" || narrowed?.kind === "runtimeSubset";
  const effectiveExpressionType =
    resolveEffectiveExpressionType(transparentExpr, context) ??
    transparentExpr.inferredType;
  const expressionStillCarriesRuntimeUnion =
    !!effectiveExpressionType &&
    willCarryAsRuntimeUnion(stripNullish(effectiveExpressionType), context);
  if (
    hasProjectedNarrowing &&
    effectiveExpressionType &&
    expressionStillCarriesRuntimeUnion &&
    resolveCarrierPreservingSourceType(
      effectiveExpressionType,
      carrierTargetType,
      context
    )
  ) {
    return carrierTargetType;
  }
  if (!hasProjectedNarrowing) {
    const directStorageType = resolveDirectStorageIrType(
      transparentExpr,
      context
    );

    if (
      directStorageType &&
      resolveCarrierPreservingSourceType(
        directStorageType,
        carrierTargetType,
        context
      )
    ) {
      return carrierTargetType;
    }

    const directRawProjectionSourceType =
      resolveRawRuntimeUnionProjectionSourceType(
        directStorageType,
        carrierTargetType,
        context
      );
    if (
      directRawProjectionSourceType &&
      expressionStillCarriesRuntimeUnion &&
      stillUsesRawRuntimeProjectionSourceType(
        effectiveExpressionType ?? directStorageType,
        directRawProjectionSourceType,
        context
      )
    ) {
      return directRawProjectionSourceType;
    }

    if (transparentExpr.kind === "identifier") {
      const storageType = resolveIdentifierRuntimeCarrierType(
        transparentExpr,
        context
      );
      if (
        resolveCarrierPreservingSourceType(
          storageType,
          carrierTargetType,
          context
        )
      ) {
        return carrierTargetType;
      }
      const rawProjectionSourceType =
        resolveRawRuntimeUnionProjectionSourceType(
          storageType,
          carrierTargetType,
          context
        );
      if (
        rawProjectionSourceType &&
        expressionStillCarriesRuntimeUnion &&
        stillUsesRawRuntimeProjectionSourceType(
          effectiveExpressionType ?? storageType,
          rawProjectionSourceType,
          context
        )
      ) {
        return rawProjectionSourceType;
      }
    }
  } else if (narrowed?.kind === "expr") {
    const narrowedCarrierType = resolveActiveCarrierSourceType(
      resolveRuntimeCarrierIrType(transparentExpr, context) ??
        narrowed.sourceType ??
        narrowed.storageType ??
        narrowed.type,
      effectiveExpressionType
    );
    if (
      resolveCarrierPreservingSourceType(
        narrowedCarrierType,
        carrierTargetType,
        context
      )
    ) {
      return carrierTargetType;
    }
    const rawProjectionSourceType = resolveRawRuntimeUnionProjectionSourceType(
      narrowedCarrierType,
      carrierTargetType,
      context
    );
    if (
      rawProjectionSourceType &&
      expressionStillCarriesRuntimeUnion &&
      stillUsesRawRuntimeProjectionSourceType(
        effectiveExpressionType ?? narrowedCarrierType,
        rawProjectionSourceType,
        context
      )
    ) {
      return rawProjectionSourceType;
    }
  }

  if (
    selectedExpectedType &&
    !areIrTypesEquivalent(selectedExpectedType, carrierTargetType, context) &&
    (() => {
      const [carrierLayout, layoutContext] = buildRuntimeUnionLayout(
        carrierTargetType,
        context,
        emitTypeAst
      );
      if (carrierLayout) {
        const exactMemberIndices = findExactRuntimeUnionMemberIndices(
          carrierLayout.members,
          selectedExpectedType,
          layoutContext
        );
        if (exactMemberIndices.length === 1) {
          return true;
        }

        const emissionMatchingMembers = carrierLayout.members.filter((member) =>
          matchesExpectedEmissionType(
            selectedExpectedType,
            member,
            layoutContext
          )
        );
        if (emissionMatchingMembers.length === 1) {
          return true;
        }
      }

      return matchesExpectedEmissionType(
        selectedExpectedType,
        carrierTargetType,
        context
      );
    })()
  ) {
    return selectedExpectedType;
  }

  if (
    carrierTargetType &&
    willCarryAsRuntimeUnion(carrierTargetType, context)
  ) {
    return undefined;
  }

  return contextualExpectedType;
};

export const resolveDirectStorageCompatibleExpressionType = (opts: {
  readonly expr: IrExpression;
  readonly valueAst: CSharpExpressionAst;
  readonly context: EmitterContext;
}): IrType | undefined =>
  resolveDirectStorageExpressionType(opts.expr, opts.valueAst, opts.context);

export const resolveDirectStorageCompatibleIrType = (opts: {
  readonly expr: IrExpression;
  readonly context: EmitterContext;
}): IrType | undefined => resolveDirectStorageIrType(opts.expr, opts.context);

export const resolveRuntimeCarrierCompatibleExpressionAst = (opts: {
  readonly expr: IrExpression;
  readonly context: EmitterContext;
}): CSharpExpressionAst | undefined =>
  resolveRuntimeCarrierExpressionAst(opts.expr, opts.context);

export const resolveRuntimeCarrierCompatibleIrType = (opts: {
  readonly expr: IrExpression;
  readonly context: EmitterContext;
}): IrType | undefined => resolveRuntimeCarrierIrType(opts.expr, opts.context);

export const tryEmitCarrierPreservingExpressionAst = (opts: {
  readonly expr: IrExpression;
  readonly expectedType: IrType | undefined;
  readonly context: EmitterContext;
}):
  | {
      readonly ast: CSharpExpressionAst;
      readonly context: EmitterContext;
      readonly actualType: IrType;
    }
  | undefined => {
  const { expr, expectedType, context } = opts;
  if (!isCarrierPreservingExpectedType(expectedType, context)) {
    return undefined;
  }

  const transparentExpr = unwrapTransparentExpression(expr);
  const carrierAst = resolveRuntimeCarrierExpressionAst(
    transparentExpr,
    context
  );
  const effectiveExpressionType =
    resolveEffectiveExpressionType(transparentExpr, context) ??
    transparentExpr.inferredType;
  if (
    isBroadObjectSlotType(expectedType, context) &&
    effectiveExpressionType &&
    willCarryAsRuntimeUnion(stripNullish(effectiveExpressionType), context)
  ) {
    return undefined;
  }
  const carrierType = resolveActiveCarrierSourceType(
    resolveRuntimeCarrierIrType(transparentExpr, context),
    effectiveExpressionType
  );
  const carrierSourceType = resolveCarrierPreservingSourceType(
    carrierType,
    expectedType,
    context
  );
  if (carrierSourceType && carrierAst) {
    return {
      ast: carrierAst,
      context,
      actualType: carrierSourceType,
    };
  }

  return undefined;
};

const isJsNumericAdaptationSource = (
  type: IrType | undefined,
  context: EmitterContext,
  seen = new Set<IrType>()
): boolean => {
  if (!type || seen.has(type)) {
    return false;
  }
  seen.add(type);

  const resolved = resolveComparableType(type, context);
  switch (resolved.kind) {
    case "literalType":
      return typeof resolved.value === "number";
    case "primitiveType":
      return resolved.name === "number" || resolved.name === "int";
    case "typeParameterType":
      return (
        (context.typeParamConstraints?.get(resolved.name) ??
          "unconstrained") === "numeric"
      );
    case "referenceType":
      return (
        resolved.name === "double" ||
        resolved.name === "int" ||
        referenceTypeHasClrIdentity(resolved, JS_NUMERIC_ADAPTATION_CLR_NAMES)
      );
    case "unionType":
      return resolved.types.every((member) => {
        const comparableMember = resolveComparableType(member, context);
        return (
          (comparableMember.kind === "primitiveType" &&
            comparableMember.name === "null") ||
          (comparableMember.kind === "primitiveType" &&
            comparableMember.name === "undefined") ||
          isJsNumericAdaptationSource(member, context, seen)
        );
      });
    default:
      return false;
  }
};

const requiresJsNumberBoxingAdaptation = (
  actualType: IrType | undefined,
  expectedType: IrType | undefined,
  context: EmitterContext
): boolean =>
  contextSurfaceIncludesJs(context) &&
  isBroadObjectSlotType(expectedType, context) &&
  isJsNumericAdaptationSource(actualType, context);

const isNumericLiteralAst = (ast: CSharpExpressionAst): boolean => {
  if (ast.kind === "numericLiteralExpression") {
    return true;
  }

  return (
    ast.kind === "prefixUnaryExpression" &&
    (ast.operatorToken === "-" || ast.operatorToken === "+") &&
    isNumericLiteralAst(ast.operand)
  );
};

const isJsNumberExpectedType = (
  type: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!type) {
    return false;
  }

  const resolved = resolveTypeAlias(stripNullish(type), context);
  return (
    (resolved.kind === "primitiveType" && resolved.name === "number") ||
    (resolved.kind === "referenceType" &&
      (resolved.name === "double" ||
        referenceTypeHasClrIdentity(resolved, ["System.Double"])))
  );
};

const maybeCastNumericToExpectedJsNumberAst = (
  ast: CSharpExpressionAst,
  actualType: IrType | undefined,
  context: EmitterContext,
  expectedType: IrType | undefined
): [CSharpExpressionAst, EmitterContext] => {
  if (
    !expectedType ||
    !isJsNumberExpectedType(expectedType, context) ||
    !isJsNumericAdaptationSource(actualType, context) ||
    isNumericLiteralAst(ast) ||
    isNumericFactoryCreateCheckedAst(ast, expectedType, context) ||
    (actualType &&
      areIrTypesEquivalent(
        stripNullish(actualType),
        stripNullish(expectedType),
        context
      ))
  ) {
    return [ast, context];
  }

  const resolvedActual = actualType
    ? resolveTypeAlias(stripNullish(actualType), context)
    : undefined;
  if (
    resolvedActual?.kind === "typeParameterType" &&
    (context.typeParamConstraints?.get(resolvedActual.name) ??
      "unconstrained") === "numeric"
  ) {
    return [
      {
        kind: "invocationExpression",
        expression: {
          kind: "memberAccessExpression",
          expression: identifierExpression("global::System.Double"),
          memberName: "CreateChecked",
        },
        arguments: [ast],
      },
      context,
    ];
  }

  const [expectedTypeAst, expectedTypeContext] = emitTypeAst(
    expectedType,
    context
  );
  if (
    ast.kind === "castExpression" &&
    sameTypeAstSurface(ast.type, expectedTypeAst)
  ) {
    return [ast, expectedTypeContext];
  }

  return [
    {
      kind: "castExpression",
      type: expectedTypeAst,
      expression: ast,
    },
    expectedTypeContext,
  ];
};

const matchesDirectCarrierAst = (
  left: CSharpExpressionAst,
  right: CSharpExpressionAst
): boolean => {
  if (left.kind !== right.kind) {
    return false;
  }

  switch (left.kind) {
    case "identifierExpression":
      return (
        right.kind === "identifierExpression" &&
        left.identifier === right.identifier
      );
    case "parenthesizedExpression":
      return (
        right.kind === "parenthesizedExpression" &&
        matchesDirectCarrierAst(left.expression, right.expression)
      );
    case "castExpression":
      return (
        right.kind === "castExpression" &&
        left.type.kind === right.type.kind &&
        matchesDirectCarrierAst(left.expression, right.expression)
      );
    case "memberAccessExpression":
      return (
        right.kind === "memberAccessExpression" &&
        left.memberName === right.memberName &&
        matchesDirectCarrierAst(left.expression, right.expression)
      );
    default:
      return false;
  }
};

const getSingleRuntimeNullishBaseType = (
  type: IrType | undefined
): IrType | undefined => {
  if (!type || type.kind !== "unionType") {
    return undefined;
  }

  const nonNullish = type.types.filter(
    (member) =>
      !(
        member.kind === "primitiveType" &&
        (member.name === "null" || member.name === "undefined")
      )
  );
  return nonNullish.length === 1 ? (nonNullish[0] ?? undefined) : undefined;
};

const hasRuntimeNullishType = (type: IrType | undefined): boolean =>
  (type ? splitRuntimeNullishUnionMembers(type)?.hasRuntimeNullish : false) ??
  false;

const stripDeadRuntimeNullishFallbackAst = (
  ast: CSharpExpressionAst
): CSharpExpressionAst => {
  const stripped = tryStripConditionalNullishGuardAst(ast);
  if (stripped) {
    return stripped;
  }

  if (ast.kind === "parenthesizedExpression") {
    const expression = stripDeadRuntimeNullishFallbackAst(ast.expression);
    return expression === ast.expression ? ast : { ...ast, expression };
  }

  if (ast.kind === "castExpression") {
    const strippedExpression = tryStripConditionalNullishGuardAst(
      ast.expression
    );
    if (strippedExpression) {
      return strippedExpression;
    }

    const expression = stripDeadRuntimeNullishFallbackAst(ast.expression);
    return expression === ast.expression ? ast : { ...ast, expression };
  }

  return ast;
};

const hasExplicitRuntimeUnionCarrierIdentity = (
  type: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!type) {
    return false;
  }

  if (getRuntimeUnionAliasReferenceKey(type, context) !== undefined) {
    return true;
  }

  const resolved = resolveTypeAlias(stripNullish(type), context);
  return (
    resolved.kind === "unionType" &&
    resolved.runtimeCarrierFamilyKey !== undefined
  );
};

const preferNarrowedEffectiveActualType = (
  directStorageType: IrType | undefined,
  effectiveExpressionType: IrType | undefined,
  expectedType: IrType | undefined,
  context: EmitterContext
): IrType | undefined => {
  if (!directStorageType) {
    return effectiveExpressionType;
  }

  if (!effectiveExpressionType) {
    return directStorageType;
  }

  const directPreservesExpectedCarrier =
    expectedType !== undefined &&
    resolveCarrierPreservingSourceType(
      directStorageType,
      expectedType,
      context
    ) !== undefined;
  const effectivePreservesExpectedCarrier =
    expectedType !== undefined &&
    resolveCarrierPreservingSourceType(
      effectiveExpressionType,
      expectedType,
      context
    ) !== undefined;
  if (directPreservesExpectedCarrier && !effectivePreservesExpectedCarrier) {
    return directStorageType;
  }

  if (isBroadObjectSlotType(directStorageType, context)) {
    return directStorageType;
  }

  const directNullableBase = getSingleRuntimeNullishBaseType(directStorageType);
  if (
    directNullableBase &&
    areIrTypesEquivalent(
      directNullableBase,
      effectiveExpressionType,
      context
    ) &&
    isDefinitelyValueType(resolveTypeAlias(directNullableBase, context))
  ) {
    const expectedRetainsRuntimeNullish = expectedType
      ? (splitRuntimeNullishUnionMembers(expectedType)?.hasRuntimeNullish ??
        false)
      : true;
    if (
      !expectedRetainsRuntimeNullish &&
      expectedType &&
      matchesExpectedEmissionType(
        effectiveExpressionType,
        expectedType,
        context
      )
    ) {
      return effectiveExpressionType;
    }
    return directStorageType;
  }

  const effectiveHasExplicitCarrierIdentity =
    hasExplicitRuntimeUnionCarrierIdentity(effectiveExpressionType, context);
  const directHasExplicitCarrierIdentity =
    hasExplicitRuntimeUnionCarrierIdentity(directStorageType, context);
  const effectiveAliasReferenceKey = getRuntimeUnionAliasReferenceKey(
    effectiveExpressionType,
    context
  );
  const directAliasReferenceKey = getRuntimeUnionAliasReferenceKey(
    directStorageType,
    context
  );
  const directMatchesEffectiveCarrierSurface =
    matchesExpectedEmissionType(
      directStorageType,
      effectiveExpressionType,
      context
    ) ||
    matchesRuntimeUnionCarrierSurface(
      directStorageType,
      effectiveExpressionType,
      context
    ) ||
    hasMatchingRuntimeCarrierFamily(
      directStorageType,
      effectiveExpressionType,
      context
    );

  if (
    directAliasReferenceKey &&
    effectiveHasExplicitCarrierIdentity &&
    directMatchesEffectiveCarrierSurface &&
    directAliasReferenceKey !== effectiveAliasReferenceKey
  ) {
    return directStorageType;
  }

  if (
    effectiveHasExplicitCarrierIdentity &&
    directMatchesEffectiveCarrierSurface &&
    (!directHasExplicitCarrierIdentity ||
      runtimeUnionAliasReferencesMatch(
        directStorageType,
        effectiveExpressionType,
        context
      ) ||
      hasMatchingRuntimeCarrierFamily(
        directStorageType,
        effectiveExpressionType,
        context
      ))
  ) {
    return effectiveExpressionType;
  }

  return !areIrTypesEquivalent(
    effectiveExpressionType,
    directStorageType,
    context
  ) &&
    matchesExpectedEmissionType(
      effectiveExpressionType,
      directStorageType,
      context
    ) &&
    !matchesExpectedEmissionType(
      directStorageType,
      effectiveExpressionType,
      context
    )
    ? effectiveExpressionType
    : directStorageType;
};

const trySelectExactRuntimeUnionMembers = (
  actualType: IrType | undefined,
  expectedType: IrType | undefined,
  context: EmitterContext
): {
  readonly selectedSourceMemberNs?: ReadonlySet<number>;
  readonly context: EmitterContext;
} => {
  if (!actualType || !expectedType) {
    return { context };
  }

  const [runtimeLayout, layoutContext] = buildRuntimeUnionLayout(
    expectedType,
    context,
    emitTypeAst
  );
  if (!runtimeLayout) {
    return { context: layoutContext };
  }

  const exactIndices = findExactRuntimeUnionMemberIndices(
    runtimeLayout.members,
    actualType,
    layoutContext
  );
  if (exactIndices.length !== 1) {
    return { context: layoutContext };
  }

  const exactIndex = exactIndices[0];
  if (exactIndex === undefined) {
    return { context: layoutContext };
  }

  return {
    context: layoutContext,
    selectedSourceMemberNs: new Set([exactIndex + 1]),
  };
};

const adaptValueToExpectedTypeAstResult = (opts: {
  readonly valueAst: CSharpExpressionAst;
  readonly actualType: IrType | undefined;
  readonly context: EmitterContext;
  readonly expectedType: IrType | undefined;
  readonly visited?: ReadonlySet<string>;
  readonly allowUnionNarrowing?: boolean;
  readonly selectedSourceMemberNs?: ReadonlySet<number>;
}): AdaptResult<[CSharpExpressionAst, EmitterContext]> => {
  const {
    valueAst,
    actualType,
    context,
    expectedType,
    visited = new Set<string>(),
    allowUnionNarrowing = true,
    selectedSourceMemberNs,
  } = opts;

  if (!actualType || !expectedType) {
    return adaptNoMatch();
  }

  if (runtimeUnionAliasReferencesMatch(actualType, expectedType, context)) {
    return adaptMatch([valueAst, context]);
  }

  if (identifierAlreadyHasExpectedSurface(valueAst, expectedType, context)) {
    return adaptMatch([valueAst, context]);
  }

  const exactExpectedSurface = tryEmitExactComparisonTargetAst(
    expectedType,
    context
  );
  if (
    exactExpectedSurface &&
    (isExactExpressionToType(valueAst, exactExpectedSurface[0]) ||
      isExactArrayCreationToType(valueAst, exactExpectedSurface[0]))
  ) {
    return adaptMatch([valueAst, exactExpectedSurface[1]]);
  }

  const [exactRuntimeUnionLayout, exactRuntimeUnionContext] =
    buildRuntimeUnionLayout(expectedType, context, emitTypeAst);
  if (exactRuntimeUnionLayout) {
    const exactRuntimeUnionTypeAst = buildRuntimeUnionTypeAst(
      exactRuntimeUnionLayout
    );
    if (
      isExactExpressionToType(valueAst, exactRuntimeUnionTypeAst) ||
      isExactArrayCreationToType(valueAst, exactRuntimeUnionTypeAst)
    ) {
      return adaptMatch([valueAst, exactRuntimeUnionContext]);
    }
  }

  const narrowedCarrierSourceType =
    valueAst.kind === "identifierExpression"
      ? (() => {
          const narrowed = context.narrowedBindings?.get(valueAst.identifier);
          if (narrowed?.kind !== "expr") {
            return undefined;
          }
          const narrowedStorageAst =
            narrowed.storageExprAst ?? narrowed.exprAst;
          if (!narrowedStorageAst) {
            return undefined;
          }
          if (!matchesDirectCarrierAst(valueAst, narrowedStorageAst)) {
            return undefined;
          }
          if (
            !isBroadCarrierPreservingTarget(expectedType, context) &&
            !willCarryAsRuntimeUnion(expectedType, context)
          ) {
            return undefined;
          }
          const carrierSourceType =
            narrowed.storageType ??
            (narrowed.storageExprAst ? narrowed.type : undefined);
          if (!carrierSourceType) {
            return undefined;
          }
          return resolveCarrierPreservingSourceType(
            carrierSourceType,
            expectedType,
            context
          );
        })()
      : undefined;
  if (narrowedCarrierSourceType) {
    return adaptMatch([valueAst, context]);
  }

  const directValueSurfaceType = resolveDirectValueSurfaceType(
    valueAst,
    context
  );
  const directRuntimeCarrierType = resolveDirectRuntimeCarrierType(
    valueAst,
    context
  );
  const directRuntimeCarrierRequiresMaterialization =
    runtimeUnionCarrierSurfaceDiffers(
      directRuntimeCarrierType,
      expectedType,
      context
    );
  if (
    directRuntimeCarrierType &&
    resolveCarrierPreservingSourceType(
      directRuntimeCarrierType,
      expectedType,
      context
    ) &&
    (!directValueSurfaceType ||
      resolveCarrierPreservingSourceType(
        directValueSurfaceType,
        expectedType,
        context
      ))
  ) {
    return adaptMatch([valueAst, context]);
  }

  if (
    isBroadCarrierPreservingTarget(expectedType, context) &&
    isStorageErasedBroadObjectPassThroughType(actualType, context)
  ) {
    return adaptMatch([stripDeadRuntimeNullishFallbackAst(valueAst), context]);
  }

  if (
    isBroadCarrierPreservingTarget(expectedType, context) &&
    matchesExpectedEmissionType(actualType, expectedType, context) &&
    !requiresJsNumberBoxingAdaptation(actualType, expectedType, context) &&
    !requiresValueTypeMaterialization(actualType, expectedType, context) &&
    !willCarryAsRuntimeUnion(actualType, context)
  ) {
    return adaptMatch([valueAst, context]);
  }

  if (
    directValueSurfaceType &&
    !directRuntimeCarrierRequiresMaterialization &&
    resolveCarrierPreservingSourceType(
      directValueSurfaceType,
      expectedType,
      context
    )
  ) {
    return adaptMatch([valueAst, context]);
  }

  const awaitableAdjusted = tryAdaptAwaitableValueAst({
    ast: valueAst,
    actualType,
    expectedType,
    context,
    visited,
    adaptAwaitedValueAst: maybeAdaptRuntimeUnionExpressionAst,
  });
  if (awaitableAdjusted) {
    return adaptMatch(awaitableAdjusted);
  }

  const unionAdjusted = maybeAdaptRuntimeUnionExpressionAst(
    valueAst,
    actualType,
    context,
    expectedType,
    visited,
    selectedSourceMemberNs
  );
  const unionAdjustedAst = unionAdjusted?.[0] ?? valueAst;
  const unionAdjustedContext = unionAdjusted?.[1] ?? context;
  const structuralSourceType =
    unionAdjusted && unionAdjustedAst !== valueAst ? expectedType : actualType;

  const structuralAdjusted = tryAdaptStructuralExpressionAst(
    unionAdjustedAst,
    structuralSourceType,
    unionAdjustedContext,
    expectedType,
    maybeAdaptRuntimeUnionExpressionAst
  );
  if (structuralAdjusted) {
    return adaptMatch(structuralAdjusted);
  }
  if (unionAdjusted) {
    return adaptMatch(unionAdjusted);
  }
  if (!allowUnionNarrowing) {
    return adaptNoMatch();
  }

  const narrowedUnion = maybeNarrowRuntimeUnionExpressionAst(
    valueAst,
    actualType,
    context,
    expectedType,
    visited,
    selectedSourceMemberNs
  );
  return narrowedUnion ? adaptMatch(narrowedUnion) : adaptNoMatch();
};

export const adaptValueToExpectedTypeAst = (opts: {
  readonly valueAst: CSharpExpressionAst;
  readonly actualType: IrType | undefined;
  readonly context: EmitterContext;
  readonly expectedType: IrType | undefined;
  readonly visited?: ReadonlySet<string>;
  readonly allowUnionNarrowing?: boolean;
  readonly selectedSourceMemberNs?: ReadonlySet<number>;
}): [CSharpExpressionAst, EmitterContext] | undefined =>
  adaptValueOrUndefined(adaptValueToExpectedTypeAstResult(opts));

export const adaptEmittedExpressionAst = (opts: {
  readonly expr: IrExpression;
  readonly valueAst: CSharpExpressionAst;
  readonly context: EmitterContext;
  readonly expectedType: IrType | undefined;
}): [CSharpExpressionAst, EmitterContext] => {
  const { expr, valueAst, context, expectedType } = opts;
  const [castedAst, castedContext] = maybeCastNullishTypeParamAst(
    expr,
    valueAst,
    context,
    expectedType
  );
  const effectiveTypeForDeadNullishFallback =
    resolveEffectiveExpressionType(expr, castedContext) ?? expr.inferredType;
  const normalizedCastedAst =
    effectiveTypeForDeadNullishFallback &&
    !hasRuntimeNullishType(effectiveTypeForDeadNullishFallback)
      ? stripDeadRuntimeNullishFallbackAst(castedAst)
      : castedAst;

  if (
    isCurrentInstanceSelfTarget(
      expr,
      normalizedCastedAst,
      expectedType,
      castedContext
    )
  ) {
    return [normalizedCastedAst, castedContext];
  }

  const exactExpectedSurface = expectedType
    ? tryEmitExactComparisonTargetAst(expectedType, castedContext)
    : undefined;
  const matchesExactExpectedSurface =
    !!exactExpectedSurface &&
    (isExactExpressionToType(normalizedCastedAst, exactExpectedSurface[0]) ||
      isExactArrayCreationToType(normalizedCastedAst, exactExpectedSurface[0]));
  const exactAssertedSurface =
    expr.kind === "typeAssertion"
      ? tryEmitExactComparisonTargetAst(
          resolveRuntimeMaterializationTargetType(
            expr.targetType,
            castedContext
          ),
          castedContext
        )
      : undefined;
  if (matchesExactExpectedSurface && expr.kind !== "typeAssertion") {
    const exactSurfaceAst =
      expectedType &&
      effectiveTypeForDeadNullishFallback &&
      isBroadCarrierPreservingTarget(expectedType, castedContext) &&
      !requiresJsNumberBoxingAdaptation(
        effectiveTypeForDeadNullishFallback,
        expectedType,
        castedContext
      )
        ? stripDeadRuntimeNullishFallbackAst(normalizedCastedAst)
        : normalizedCastedAst;
    return [exactSurfaceAst, exactExpectedSurface[1]];
  }
  const preservesExpectedSurface =
    expr.kind === "typeAssertion" && matchesExactExpectedSurface;
  const preservesAssertedSurface =
    expr.kind === "typeAssertion" &&
    !!exactAssertedSurface &&
    (isExactExpressionToType(normalizedCastedAst, exactAssertedSurface[0]) ||
      isExactArrayCreationToType(normalizedCastedAst, exactAssertedSurface[0]));
  const preservedTypeForAdaptation =
    expr.kind === "typeAssertion"
      ? preservesAssertedSurface
        ? expr.targetType
        : preservesExpectedSurface
          ? expectedType
          : undefined
      : undefined;
  const adaptationSourceExpr =
    expr.kind === "typeAssertion" &&
    normalizedCastedAst.kind !== "castExpression" &&
    !preservedTypeForAdaptation
      ? expr.expression
      : expr;
  const broadPassThroughSourceIdentifier = (() => {
    if (
      !expectedType ||
      !isBroadCarrierPreservingTarget(expectedType, castedContext) ||
      adaptationSourceExpr.kind !== "identifier"
    ) {
      return undefined;
    }

    const unwrappedCastedAst = unwrapTransparentAst(normalizedCastedAst);
    const identifierName =
      castedContext.localNameMap?.get(adaptationSourceExpr.name) ??
      escapeCSharpIdentifier(adaptationSourceExpr.name);
    if (
      unwrappedCastedAst.kind !== "identifierExpression" ||
      unwrappedCastedAst.identifier !== identifierName
    ) {
      return undefined;
    }

    const originalCarrierType =
      context.localValueTypes?.get(adaptationSourceExpr.name) ??
      adaptationSourceExpr.inferredType;
    if (
      !originalCarrierType ||
      willCarryAsRuntimeUnion(originalCarrierType, castedContext)
    ) {
      return undefined;
    }
    if (
      !matchesExpectedEmissionType(
        originalCarrierType,
        expectedType,
        castedContext
      ) &&
      !isStorageErasedBroadObjectPassThroughType(
        originalCarrierType,
        castedContext
      )
    ) {
      return undefined;
    }

    return [identifierExpression(identifierName), castedContext] as [
      CSharpExpressionAst,
      EmitterContext,
    ];
  })();
  if (broadPassThroughSourceIdentifier) {
    return broadPassThroughSourceIdentifier;
  }
  const recoveredNamedStructuralAliasIdentifier = (() => {
    const structuralAliasSourceExpr =
      expr.kind === "typeAssertion" &&
      isCompilerGeneratedStructuralType(expr.targetType)
        ? expr.expression
        : adaptationSourceExpr;
    if (!expectedType || structuralAliasSourceExpr.kind !== "identifier") {
      return undefined;
    }

    const unwrappedCastedAst = unwrapTransparentAst(normalizedCastedAst);
    const identifierName =
      castedContext.localNameMap?.get(structuralAliasSourceExpr.name) ??
      escapeCSharpIdentifier(structuralAliasSourceExpr.name);
    if (
      unwrappedCastedAst.kind !== "identifierExpression" ||
      unwrappedCastedAst.identifier !== identifierName
    ) {
      return undefined;
    }

    const sourceSemanticType =
      castedContext.localSemanticTypes?.get(structuralAliasSourceExpr.name) ??
      castedContext.localValueTypes?.get(structuralAliasSourceExpr.name) ??
      resolveEffectiveExpressionType(structuralAliasSourceExpr, castedContext);
    const strippedSourceSemanticType = sourceSemanticType
      ? stripNullish(sourceSemanticType)
      : undefined;
    const strippedExpectedType = stripNullish(expectedType);
    if (
      !isNamedStructuralReferenceType(strippedSourceSemanticType) ||
      !(
        (strippedSourceSemanticType?.kind === "referenceType" &&
          strippedExpectedType.kind === "referenceType" &&
          strippedSourceSemanticType.name === strippedExpectedType.name) ||
        (strippedSourceSemanticType
          ? areIrTypesEquivalent(
              strippedSourceSemanticType,
              expectedType,
              castedContext
            ) ||
            matchesExpectedEmissionType(
              strippedSourceSemanticType,
              expectedType,
              castedContext
            )
          : false)
      )
    ) {
      return undefined;
    }

    return [identifierExpression(identifierName), castedContext] as [
      CSharpExpressionAst,
      EmitterContext,
    ];
  })();
  if (recoveredNamedStructuralAliasIdentifier) {
    return recoveredNamedStructuralAliasIdentifier;
  }
  const directStorageType =
    expectedType &&
    (isBroadCarrierPreservingTarget(expectedType, castedContext) ||
      willCarryAsRuntimeUnion(expectedType, castedContext) ||
      (splitRuntimeNullishUnionMembers(expectedType)?.hasRuntimeNullish ??
        false))
      ? resolveDirectStorageExpressionType(
          adaptationSourceExpr,
          normalizedCastedAst,
          castedContext
        )
      : undefined;
  const narrowKey =
    adaptationSourceExpr.kind === "identifier"
      ? adaptationSourceExpr.name
      : adaptationSourceExpr.kind === "memberAccess"
        ? getMemberAccessNarrowKey(adaptationSourceExpr)
        : undefined;
  const directCarrierNarrowed =
    narrowKey && castedContext.narrowedBindings
      ? castedContext.narrowedBindings.get(narrowKey)
      : undefined;
  const recoveredNarrowedCarrier = (() => {
    if (!expectedType || directCarrierNarrowed?.kind !== "expr") {
      return undefined;
    }
    const narrowedType = directCarrierNarrowed.type;
    if (
      !narrowedType ||
      !matchesExpectedEmissionType(narrowedType, expectedType, castedContext) ||
      matchesExpectedEmissionType(expectedType, narrowedType, castedContext)
    ) {
      return undefined;
    }
    if (
      !matchesDirectCarrierAst(
        normalizedCastedAst,
        directCarrierNarrowed.exprAst
      )
    ) {
      return undefined;
    }
    const carrierAst =
      directCarrierNarrowed.carrierExprAst ??
      directCarrierNarrowed.storageExprAst;
    const carrierSourceType =
      directCarrierNarrowed.carrierType ??
      directCarrierNarrowed.sourceType ??
      directCarrierNarrowed.storageType;
    if (!carrierAst || !carrierSourceType) {
      return undefined;
    }
    return resolveCarrierPreservingSourceType(
      carrierSourceType,
      expectedType,
      castedContext
    )
      ? ([carrierAst, castedContext] as [CSharpExpressionAst, EmitterContext])
      : undefined;
  })();
  if (recoveredNarrowedCarrier) {
    return recoveredNarrowedCarrier;
  }
  const recoveredBroadPassThroughCarrier = (() => {
    if (!expectedType || directCarrierNarrowed?.kind !== "expr") {
      return undefined;
    }
    if (
      !isBroadCarrierPreservingTarget(expectedType, castedContext) ||
      !matchesDirectCarrierAst(
        normalizedCastedAst,
        directCarrierNarrowed.exprAst
      )
    ) {
      return undefined;
    }
    if (adaptationSourceExpr.kind !== "identifier") {
      return undefined;
    }

    const originalCarrierType =
      directCarrierNarrowed.carrierType ??
      directCarrierNarrowed.sourceType ??
      castedContext.localValueTypes?.get(adaptationSourceExpr.name);
    if (
      !originalCarrierType ||
      willCarryAsRuntimeUnion(originalCarrierType, castedContext)
    ) {
      return undefined;
    }
    if (
      !matchesExpectedEmissionType(
        originalCarrierType,
        expectedType,
        castedContext
      ) &&
      !isStorageErasedBroadObjectPassThroughType(
        originalCarrierType,
        castedContext
      )
    ) {
      return undefined;
    }

    return [
      identifierExpression(
        castedContext.localNameMap?.get(adaptationSourceExpr.name) ??
          escapeCSharpIdentifier(adaptationSourceExpr.name)
      ),
      castedContext,
    ] as [CSharpExpressionAst, EmitterContext];
  })();
  if (recoveredBroadPassThroughCarrier) {
    return recoveredBroadPassThroughCarrier;
  }
  const narrowedCarrierSourceType = (() => {
    if (!expectedType) {
      return undefined;
    }
    if (directCarrierNarrowed?.kind !== "expr") {
      return undefined;
    }
    if (
      !directCarrierNarrowed.carrierExprAst ||
      !matchesDirectCarrierAst(
        normalizedCastedAst,
        directCarrierNarrowed.carrierExprAst
      )
    ) {
      return undefined;
    }
    if (
      !isBroadCarrierPreservingTarget(expectedType, castedContext) &&
      !willCarryAsRuntimeUnion(expectedType, castedContext)
    ) {
      return undefined;
    }
    const carrierSourceType =
      directCarrierNarrowed.carrierType ??
      directCarrierNarrowed.sourceType ??
      directStorageType;
    return carrierSourceType
      ? resolveCarrierPreservingSourceType(
          carrierSourceType,
          expectedType,
          castedContext
        )
      : undefined;
  })();
  if (narrowedCarrierSourceType) {
    return [normalizedCastedAst, castedContext];
  }
  const directRuntimeCarrierType = expectedType
    ? resolveDirectRuntimeCarrierType(normalizedCastedAst, castedContext)
    : undefined;
  if (
    expectedType &&
    directRuntimeCarrierType &&
    resolveCarrierPreservingSourceType(
      directRuntimeCarrierType,
      expectedType,
      castedContext
    )
  ) {
    return [normalizedCastedAst, castedContext];
  }
  const directStorageExpressionType = resolveDirectStorageExpressionType(
    adaptationSourceExpr,
    normalizedCastedAst,
    castedContext
  );
  if (expectedType && directStorageExpressionType) {
    const structuralAdjusted = tryAdaptStructuralExpressionAst(
      normalizedCastedAst,
      directStorageExpressionType,
      castedContext,
      expectedType,
      maybeAdaptRuntimeUnionExpressionAst
    );
    if (structuralAdjusted) {
      return structuralAdjusted;
    }
  }
  if (
    expectedType &&
    directStorageExpressionType &&
    matchesExpectedEmissionType(
      directStorageExpressionType,
      expectedType,
      castedContext
    ) &&
    !requiresJsNumberBoxingAdaptation(
      directStorageExpressionType,
      expectedType,
      castedContext
    ) &&
    !requiresValueTypeMaterialization(
      directStorageExpressionType,
      expectedType,
      castedContext
    ) &&
    !willCarryAsRuntimeUnion(stripNullish(expectedType), castedContext) &&
    !willCarryAsRuntimeUnion(
      stripNullish(directStorageExpressionType),
      castedContext
    )
  ) {
    return [normalizedCastedAst, castedContext];
  }
  const exactStorageSurfaceType = expectedType
    ? resolveExactStorageSurfaceExpressionType(normalizedCastedAst)
    : undefined;
  if (expectedType && exactStorageSurfaceType) {
    const [sameStorageSurface, storageSurfaceContext] =
      matchesEmittedStorageSurface(
        exactStorageSurfaceType,
        expectedType,
        castedContext
      );
    if (sameStorageSurface) {
      return [normalizedCastedAst, storageSurfaceContext];
    }
  }
  if (
    expectedType &&
    directStorageExpressionType &&
    resolveCarrierPreservingSourceType(
      directStorageExpressionType,
      expectedType,
      castedContext
    )
  ) {
    return [normalizedCastedAst, castedContext];
  }
  if (
    expectedType &&
    directStorageExpressionType &&
    isBroadCarrierPreservingTarget(expectedType, castedContext) &&
    isStorageErasedBroadObjectPassThroughType(
      directStorageExpressionType,
      castedContext
    ) &&
    !requiresJsNumberBoxingAdaptation(
      directStorageExpressionType,
      expectedType,
      castedContext
    ) &&
    !requiresValueTypeMaterialization(
      directStorageExpressionType,
      expectedType,
      castedContext
    ) &&
    !willCarryAsRuntimeUnion(directStorageExpressionType, castedContext)
  ) {
    return [
      stripDeadRuntimeNullishFallbackAst(normalizedCastedAst),
      castedContext,
    ];
  }
  const effectiveExpressionType = resolveEffectiveExpressionType(
    adaptationSourceExpr,
    castedContext
  );
  const structuralViewReturnType =
    expr.kind === "call"
      ? resolveStructuralViewMethodSurface(expr.callee, castedContext)
          ?.returnType
      : undefined;
  const actualType =
    preservedTypeForAdaptation ??
    (expr.kind === "typeAssertion" ? expr.targetType : undefined) ??
    (adaptationSourceExpr.kind === "await"
      ? getAsyncWrapperSourceResultType(adaptationSourceExpr.expression)
      : undefined) ??
    structuralViewReturnType ??
    (expr.kind === "call" || expr.kind === "new"
      ? expr.sourceBackedReturnType
      : undefined) ??
    preferNarrowedEffectiveActualType(
      directStorageExpressionType,
      effectiveExpressionType,
      expectedType,
      castedContext
    ) ??
    tryResolveRuntimeUnionMemberType(
      effectiveExpressionType,
      normalizedCastedAst,
      castedContext
    ) ??
    effectiveExpressionType ??
    adaptationSourceExpr.inferredType;

  if (
    expectedType &&
    actualType &&
    isBroadCarrierPreservingTarget(expectedType, castedContext) &&
    isStorageErasedBroadObjectPassThroughType(actualType, castedContext) &&
    !requiresJsNumberBoxingAdaptation(
      actualType,
      expectedType,
      castedContext
    ) &&
    !requiresValueTypeMaterialization(
      actualType,
      expectedType,
      castedContext
    ) &&
    !willCarryAsRuntimeUnion(stripNullish(actualType), castedContext)
  ) {
    return [
      stripDeadRuntimeNullishFallbackAst(normalizedCastedAst),
      castedContext,
    ];
  }

  const [dictionaryAdjustedAst, dictionaryAdjustedContext] =
    maybeAdaptDictionaryUnionValueAst(
      expr,
      normalizedCastedAst,
      castedContext,
      expectedType
    );

  if (
    actualType &&
    expectedType &&
    runtimeUnionAliasReferencesMatch(
      actualType,
      expectedType,
      dictionaryAdjustedContext
    )
  ) {
    return [dictionaryAdjustedAst, dictionaryAdjustedContext];
  }

  const exactRuntimeUnionSelection = trySelectExactRuntimeUnionMembers(
    actualType,
    expectedType,
    dictionaryAdjustedContext
  );

  const [expectedAdjustedAst, expectedAdjustedContext] =
    adaptValueToExpectedTypeAst({
      valueAst: dictionaryAdjustedAst,
      actualType,
      context: exactRuntimeUnionSelection.context,
      expectedType,
      allowUnionNarrowing: false,
      selectedSourceMemberNs: exactRuntimeUnionSelection.selectedSourceMemberNs,
    }) ?? [dictionaryAdjustedAst, dictionaryAdjustedContext];

  const broadNullishStrippedAst =
    expectedType &&
    actualType &&
    isBroadCarrierPreservingTarget(expectedType, expectedAdjustedContext) &&
    !requiresJsNumberBoxingAdaptation(
      actualType,
      expectedType,
      expectedAdjustedContext
    ) &&
    !requiresValueTypeMaterialization(
      actualType,
      expectedType,
      expectedAdjustedContext
    ) &&
    !willCarryAsRuntimeUnion(stripNullish(actualType), expectedAdjustedContext)
      ? stripDeadRuntimeNullishFallbackAst(expectedAdjustedAst)
      : expectedAdjustedAst;

  const [integralAdjustedAst, integralAdjustedContext] =
    maybeCastNumericToExpectedIntegralAst(
      broadNullishStrippedAst,
      actualType,
      expectedAdjustedContext,
      expectedType
    );

  const [numericAdjustedAst, numericAdjustedContext] =
    maybeCastNumericToExpectedJsNumberAst(
      integralAdjustedAst,
      actualType,
      integralAdjustedContext,
      expectedType
    );

  const [boxedNumericAst, boxedNumericContext] = maybeBoxJsNumberAsObjectAst(
    numericAdjustedAst,
    expr,
    actualType,
    numericAdjustedContext,
    expectedType
  );

  const [stringAdjustedAst, stringAdjustedContext] =
    maybeConvertCharToStringAst(
      expr,
      boxedNumericAst,
      boxedNumericContext,
      expectedType
    );

  const [unwrappedAst, unwrappedContext] = maybeUnwrapNullableValueTypeAst(
    expr,
    stringAdjustedAst,
    stringAdjustedContext,
    expectedType
  );
  return [
    simplifyRedundantObjectBridgeCastsAst(
      unwrappedAst,
      actualType,
      unwrappedContext,
      expectedType
    ),
    unwrappedContext,
  ];
};
