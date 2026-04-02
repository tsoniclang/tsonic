import type { IrExpression, IrType } from "@tsonic/frontend";
import { resolveEffectiveExpressionType } from "../core/semantic/narrowed-expression-types.js";
import { tryResolveRuntimeUnionMemberType } from "../core/semantic/narrowed-expression-types.js";
import type { CSharpExpressionAst } from "../core/format/backend-ast/types.js";
import type { EmitterContext } from "../types.js";
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
import { resolveDirectStorageExpressionType } from "./direct-storage-types.js";
import { tryAdaptStructuralExpressionAst } from "./structural-adaptation.js";
import { resolveRuntimeMaterializationTargetType } from "../core/semantic/runtime-materialization-targets.js";
import {
  buildRuntimeUnionLayout,
  findExactRuntimeUnionMemberIndices,
} from "../core/semantic/runtime-unions.js";
import { resolveComparableType } from "../core/semantic/comparable-types.js";
import { isBroadObjectSlotType } from "../core/semantic/js-value-types.js";
import { willCarryAsRuntimeUnion } from "../core/semantic/union-semantics.js";
import { getMemberAccessNarrowKey } from "../core/semantic/narrowing-keys.js";
import { stripNullish } from "../core/semantic/type-resolution.js";
import { emitTypeAst } from "../type-emitter.js";

const isBroadCarrierPreservingTarget = (
  type: IrType | undefined,
  context: EmitterContext
): boolean => isBroadObjectSlotType(type, context);

const isBroadCarrierPassThroughActualType = (
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
    case "referenceType":
    case "objectType":
    case "arrayType":
    case "tupleType":
    case "dictionaryType":
      return true;
    case "literalType":
      return typeof resolved.value === "string";
    case "primitiveType":
      return resolved.name === "string";
    case "unionType":
      return resolved.types.every((member) => {
        const comparableMember = resolveComparableType(member, context);
        return (
          comparableMember.kind === "primitiveType" &&
            comparableMember.name === "null" ||
          comparableMember.kind === "primitiveType" &&
            comparableMember.name === "undefined" ||
          isBroadCarrierPassThroughActualType(member, context, seen)
        );
      });
    default:
      return false;
  }
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
          comparableMember.kind === "primitiveType" &&
            comparableMember.name === "null" ||
          comparableMember.kind === "primitiveType" &&
            comparableMember.name === "undefined" ||
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
      return right.kind === "identifierExpression" && left.identifier === right.identifier;
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

  const narrowedCarrierSourceType =
    valueAst.kind === "identifierExpression"
      ? (() => {
          const narrowed = context.narrowedBindings?.get(valueAst.identifier);
          if (narrowed?.kind !== "expr" || !narrowed.carrierExprAst) {
            return undefined;
          }
          if (!matchesDirectCarrierAst(valueAst, narrowed.carrierExprAst)) {
            return undefined;
          }
          if (
            !isBroadCarrierPreservingTarget(expectedType, context) &&
            !willCarryAsRuntimeUnion(expectedType, context)
          ) {
            return undefined;
          }
          const carrierSourceType = narrowed.sourceType;
          if (!carrierSourceType) {
            return undefined;
          }
          const strippedCarrierType = stripNullish(carrierSourceType);
          return matchesExpectedEmissionType(
            strippedCarrierType,
            expectedType,
            context
          )
            ? strippedCarrierType
            : undefined;
        })()
      : undefined;
  if (narrowedCarrierSourceType) {
    return [valueAst, context];
  }

  if (
    isBroadCarrierPreservingTarget(expectedType, context) &&
    isBroadCarrierPassThroughActualType(actualType, context)
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
  const directStorageType =
    expectedType && isBroadCarrierPreservingTarget(expectedType, castedContext)
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
      directCarrierNarrowed.sourceType ?? directStorageType;
    return carrierSourceType ? stripNullish(carrierSourceType) : undefined;
  })();
  if (
    narrowedCarrierSourceType &&
    expectedType &&
    matchesExpectedEmissionType(
      narrowedCarrierSourceType,
      expectedType,
      castedContext
    )
  ) {
    return [castedAst, castedContext];
  }
  if (
    directStorageType &&
    expectedType &&
    matchesExpectedEmissionType(directStorageType, expectedType, castedContext)
  ) {
    return [castedAst, castedContext];
  }
  const actualType =
    preservedTypeForAdaptation ??
    (expr.kind === "typeAssertion" ? expr.targetType : undefined) ??
    tryResolveRuntimeUnionMemberType(
      resolveDirectStorageExpressionType(
        adaptationSourceExpr,
        castedAst,
        castedContext
      ) ?? resolveEffectiveExpressionType(adaptationSourceExpr, castedContext),
      castedAst,
      castedContext
    ) ??
    resolveDirectStorageExpressionType(
      adaptationSourceExpr,
      castedAst,
      castedContext
    ) ??
    resolveEffectiveExpressionType(adaptationSourceExpr, castedContext);

  const [dictionaryAdjustedAst, dictionaryAdjustedContext] =
    maybeAdaptDictionaryUnionValueAst(
      expr,
      castedAst,
      castedContext,
      expectedType
    );

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
