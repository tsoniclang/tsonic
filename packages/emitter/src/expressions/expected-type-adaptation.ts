import {
  stableIrTypeKey,
  type IrExpression,
  type IrType,
} from "@tsonic/frontend";
import { resolveEffectiveExpressionType } from "../core/semantic/narrowed-expression-types.js";
import { tryResolveRuntimeUnionMemberType } from "../core/semantic/narrowed-expression-types.js";
import type { CSharpExpressionAst } from "../core/format/backend-ast/types.js";
import type { EmitterContext } from "../types.js";
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
import {
  resolveDirectStorageExpressionType,
  resolveDirectStorageIrType,
  resolveIdentifierRuntimeCarrierType,
  resolveRuntimeCarrierExpressionAst,
  resolveRuntimeCarrierIrType,
} from "./direct-storage-types.js";
import { resolveDirectValueSurfaceType } from "../core/semantic/direct-value-surfaces.js";
import { tryAdaptStructuralExpressionAst } from "./structural-adaptation.js";
import { matchesEmittedStorageSurface } from "./identifier-storage.js";
import { resolveRuntimeMaterializationTargetType } from "../core/semantic/runtime-materialization-targets.js";
import {
  buildRuntimeUnionLayout,
  buildRuntimeUnionTypeAst,
  findExactRuntimeUnionMemberIndices,
} from "../core/semantic/runtime-unions.js";
import { resolveComparableType } from "../core/semantic/comparable-types.js";
import {
  isBroadObjectPassThroughType,
  isBroadObjectSlotType,
} from "../core/semantic/js-value-types.js";
import { willCarryAsRuntimeUnion } from "../core/semantic/union-semantics.js";
import { runtimeUnionAliasReferencesMatch } from "../core/semantic/runtime-union-alias-identity.js";
import { getMemberAccessNarrowKey } from "../core/semantic/narrowing-keys.js";
import {
  resolveTypeAlias,
  splitRuntimeNullishUnionMembers,
  stripNullish,
} from "../core/semantic/type-resolution.js";
import { emitTypeAst } from "../type-emitter.js";
import { unwrapTransparentExpression } from "../core/semantic/transparent-expressions.js";
import { identifierExpression } from "../core/format/backend-ast/builders.js";
import { escapeCSharpIdentifier } from "../emitter-types/index.js";

const isBroadCarrierPreservingTarget = (
  type: IrType | undefined,
  context: EmitterContext
): boolean => isBroadObjectSlotType(type, context);

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
  return matchesExpectedEmissionType(
    strippedSourceType,
    strippedCarrierTargetType,
    context
  ) &&
    (matchesRuntimeUnionCarrierSurface(
      strippedSourceType,
      strippedCarrierTargetType,
      context
    ) ||
      hasMatchingRuntimeCarrierFamily(
        strippedSourceType,
        strippedCarrierTargetType,
        context
      ))
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
    ) ||
    hasMatchingRuntimeCarrierFamily(
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
    stableIrTypeKey(selectedExpectedType) !==
      stableIrTypeKey(carrierTargetType) &&
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
    case "referenceType":
      return (
        resolved.name === "double" ||
        resolved.name === "int" ||
        resolved.resolvedClrType === "System.Double" ||
        resolved.resolvedClrType === "global::System.Double" ||
        resolved.resolvedClrType === "System.Int32" ||
        resolved.resolvedClrType === "global::System.Int32"
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
  context.options.surface === "@tsonic/js" &&
  isBroadObjectSlotType(expectedType, context) &&
  isJsNumericAdaptationSource(actualType, context);

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

const preferNarrowedEffectiveActualType = (
  directStorageType: IrType | undefined,
  effectiveExpressionType: IrType | undefined,
  context: EmitterContext
): IrType | undefined => {
  if (!directStorageType) {
    return effectiveExpressionType;
  }

  if (!effectiveExpressionType) {
    return directStorageType;
  }

  if (isBroadObjectSlotType(directStorageType, context)) {
    return directStorageType;
  }

  return stableIrTypeKey(effectiveExpressionType) !==
    stableIrTypeKey(directStorageType) &&
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

export const adaptValueToExpectedTypeAst = (opts: {
  readonly valueAst: CSharpExpressionAst;
  readonly actualType: IrType | undefined;
  readonly context: EmitterContext;
  readonly expectedType: IrType | undefined;
  readonly visited?: ReadonlySet<string>;
  readonly allowUnionNarrowing?: boolean;
  readonly selectedSourceMemberNs?: ReadonlySet<number>;
}): [CSharpExpressionAst, EmitterContext] | undefined => {
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
    return undefined;
  }

  if (runtimeUnionAliasReferencesMatch(actualType, expectedType, context)) {
    return [valueAst, context];
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
    return [valueAst, exactExpectedSurface[1]];
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
      return [valueAst, exactRuntimeUnionContext];
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
    return [valueAst, context];
  }

  if (
    isBroadCarrierPreservingTarget(expectedType, context) &&
    isBroadObjectPassThroughType(actualType, context)
  ) {
    return [valueAst, context];
  }

  if (
    isBroadCarrierPreservingTarget(expectedType, context) &&
    matchesExpectedEmissionType(actualType, expectedType, context) &&
    !requiresJsNumberBoxingAdaptation(actualType, expectedType, context) &&
    !requiresValueTypeMaterialization(actualType, expectedType, context) &&
    !willCarryAsRuntimeUnion(actualType, context)
  ) {
    return [valueAst, context];
  }

  const directValueSurfaceType = resolveDirectValueSurfaceType(
    valueAst,
    context
  );
  if (
    directValueSurfaceType &&
    resolveCarrierPreservingSourceType(
      directValueSurfaceType,
      expectedType,
      context
    )
  ) {
    return [valueAst, context];
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
    return structuralAdjusted;
  }
  if (unionAdjusted) {
    return unionAdjusted;
  }
  if (!allowUnionNarrowing) {
    return undefined;
  }

  return maybeNarrowRuntimeUnionExpressionAst(
    valueAst,
    actualType,
    context,
    expectedType,
    visited,
    selectedSourceMemberNs
  );
};

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

  const exactExpectedSurface = expectedType
    ? tryEmitExactComparisonTargetAst(expectedType, castedContext)
    : undefined;
  const matchesExactExpectedSurface =
    !!exactExpectedSurface &&
    (isExactExpressionToType(castedAst, exactExpectedSurface[0]) ||
      isExactArrayCreationToType(castedAst, exactExpectedSurface[0]));
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
    return [castedAst, exactExpectedSurface[1]];
  }
  const preservesExpectedSurface =
    expr.kind === "typeAssertion" && matchesExactExpectedSurface;
  const preservesAssertedSurface =
    expr.kind === "typeAssertion" &&
    !!exactAssertedSurface &&
    (isExactExpressionToType(castedAst, exactAssertedSurface[0]) ||
      isExactArrayCreationToType(castedAst, exactAssertedSurface[0]));
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
    castedAst.kind !== "castExpression" &&
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

    const unwrappedCastedAst = unwrapTransparentAst(castedAst);
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
      context.localSemanticTypes?.get(adaptationSourceExpr.name) ??
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
      !isBroadObjectPassThroughType(originalCarrierType, castedContext)
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
  const directStorageType =
    expectedType &&
    (isBroadCarrierPreservingTarget(expectedType, castedContext) ||
      willCarryAsRuntimeUnion(expectedType, castedContext) ||
      (splitRuntimeNullishUnionMembers(expectedType)?.hasRuntimeNullish ??
        false))
      ? resolveDirectStorageExpressionType(
          adaptationSourceExpr,
          castedAst,
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
    if (!matchesDirectCarrierAst(castedAst, directCarrierNarrowed.exprAst)) {
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
      !matchesDirectCarrierAst(castedAst, directCarrierNarrowed.exprAst)
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
      !isBroadObjectPassThroughType(originalCarrierType, castedContext)
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
      !matchesDirectCarrierAst(castedAst, directCarrierNarrowed.carrierExprAst)
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
    return [castedAst, castedContext];
  }
  if (directStorageType && expectedType) {
    const [sameStorageSurface, storageSurfaceContext] =
      matchesEmittedStorageSurface(
        directStorageType,
        expectedType,
        castedContext
      );
    if (sameStorageSurface) {
      return [castedAst, storageSurfaceContext];
    }
  }
  const directStorageExpressionType = resolveDirectStorageExpressionType(
    adaptationSourceExpr,
    castedAst,
    castedContext
  );
  const effectiveExpressionType = resolveEffectiveExpressionType(
    adaptationSourceExpr,
    castedContext
  );
  const actualType =
    preservedTypeForAdaptation ??
    (expr.kind === "typeAssertion" ? expr.targetType : undefined) ??
    (expr.kind === "call" || expr.kind === "new"
      ? expr.sourceBackedReturnType
      : undefined) ??
    preferNarrowedEffectiveActualType(
      directStorageExpressionType,
      effectiveExpressionType,
      castedContext
    ) ??
    tryResolveRuntimeUnionMemberType(
      effectiveExpressionType,
      castedAst,
      castedContext
    ) ??
    effectiveExpressionType;

  const [dictionaryAdjustedAst, dictionaryAdjustedContext] =
    maybeAdaptDictionaryUnionValueAst(
      expr,
      castedAst,
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

  const [integralAdjustedAst, integralAdjustedContext] =
    maybeCastNumericToExpectedIntegralAst(
      expectedAdjustedAst,
      actualType,
      expectedAdjustedContext,
      expectedType
    );

  const [boxedNumericAst, boxedNumericContext] = maybeBoxJsNumberAsObjectAst(
    integralAdjustedAst,
    expr,
    actualType,
    integralAdjustedContext,
    expectedType
  );

  const [stringAdjustedAst, stringAdjustedContext] =
    maybeConvertCharToStringAst(
      expr,
      boxedNumericAst,
      boxedNumericContext,
      expectedType
    );

  return maybeUnwrapNullableValueTypeAst(
    expr,
    stringAdjustedAst,
    stringAdjustedContext,
    expectedType
  );
};
