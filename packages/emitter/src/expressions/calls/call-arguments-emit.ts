/**
 * Call argument emission.
 * Handles the main emitCallArguments function and function-value call argument emission.
 */

import { IrExpression, IrType, IrParameter } from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import { emitExpressionAst } from "../../expression-emitter.js";
import { emitTypeAst } from "../../type-emitter.js";
import { escapeCSharpIdentifier } from "../../emitter-types/index.js";
import { emitCSharpName } from "../../naming-policy.js";
import type {
  CSharpExpressionAst,
  CSharpLambdaParameterAst,
  CSharpTypeAst,
} from "../../core/format/backend-ast/types.js";
import { identifierExpression } from "../../core/format/backend-ast/builders.js";
import {
  extractCalleeNameFromAst,
  sameTypeAstSurface,
} from "../../core/format/backend-ast/utils.js";
import {
  resolveEffectiveExpressionType,
  resolveRuntimeSubsetMemberNs,
} from "../../core/semantic/narrowed-expression-types.js";
import {
  containsTypeParameter,
  getArrayLikeElementType,
} from "../../core/semantic/type-resolution.js";
import { matchesExpectedEmissionType } from "../../core/semantic/expected-type-matching.js";
import { getAcceptedParameterType } from "../../core/semantic/defaults.js";
import { unwrapParameterModifierType } from "../../core/semantic/parameter-modifier-types.js";
import {
  resolveTypeAlias,
  splitRuntimeNullishUnionMembers,
  stripNullish,
} from "../../core/semantic/type-resolution.js";
import { resolveComparableType } from "../../core/semantic/comparable-types.js";
import {
  resolveArrayLiteralContextType,
  resolveEmptyArrayLiteralContextType,
} from "../../core/semantic/array-expected-types.js";
import { resolveRuntimeMaterializationTargetType } from "../../core/semantic/runtime-materialization-targets.js";
import { isBroadObjectSlotType } from "../../core/semantic/broad-object-types.js";
import { referenceTypeHasClrIdentity } from "../../core/semantic/clr-type-identity.js";
import { runtimeUnionMemberCanAcceptValue } from "../../core/semantic/runtime-union-matching.js";
import { willCarryAsRuntimeUnion } from "../../core/semantic/union-semantics.js";
import {
  getContextualTypeVisitKey,
  tryContextualTypeIdentityKey,
} from "../../core/semantic/deterministic-type-keys.js";
import { unwrapTransparentExpression } from "../../core/semantic/transparent-expressions.js";
import {
  buildRuntimeUnionLayout,
  buildRuntimeUnionTypeAst,
} from "../../core/semantic/runtime-unions.js";
import { runtimeUnionAliasReferencesMatch } from "../../core/semantic/runtime-union-alias-identity.js";
import { getPassingModifierFromCast, isLValue } from "./call-analysis.js";
import {
  adaptValueToExpectedTypeAst,
  resolveDirectStorageCompatibleExpressionType,
  resolveDirectStorageCompatibleIrType,
  resolveCarrierPreservingRawExpectedType,
  resolveCarrierPreservingSourceType,
  resolveRuntimeCarrierCompatibleExpressionAst,
  resolveRuntimeCarrierCompatibleIrType,
  tryEmitCarrierPreservingExpressionAst,
  hasMismatchedCollectionElementCarrier,
} from "../expected-type-adaptation.js";
import {
  isExactArrayCreationToType,
  isExactExpressionToType,
  tryEmitExactComparisonTargetAst,
} from "../exact-comparison.js";
import { getDirectIterableElementType } from "../structural-type-shapes.js";
import {
  normalizeCallArgumentExpectedType,
  expandTupleLikeSpreadArguments,
  getTransparentRestSpreadPassthroughExpression,
  wrapArgModifier,
  emitFlattenedRestArguments,
} from "./call-arguments-helpers.js";
import { shouldPreferRuntimeExpectedType } from "./runtime-expected-type-preference.js";
import { collectStructuralProperties } from "../structural-property-model.js";
import { isSameNominalType } from "../structural-type-shapes.js";
import { areIrTypesEquivalent } from "../../core/semantic/type-equivalence.js";
import {
  isExpectedJsNumberIrType,
  isExpectedIntegralIrType,
  isNumericSourceIrType,
  maybeCastNumericToExpectedIntegralAst,
  maybeCastNumericToExpectedJsNumberAst,
} from "../post-emission-adaptation.js";

const NUMERIC_BINDING_CLR_NAMES = new Set([
  "System.SByte",
  "global::System.SByte",
  "System.Byte",
  "global::System.Byte",
  "System.Int16",
  "global::System.Int16",
  "System.UInt16",
  "global::System.UInt16",
  "System.Int32",
  "global::System.Int32",
  "System.UInt32",
  "global::System.UInt32",
  "System.Int64",
  "global::System.Int64",
  "System.UInt64",
  "global::System.UInt64",
  "System.Single",
  "global::System.Single",
  "System.Double",
  "global::System.Double",
  "System.Decimal",
  "global::System.Decimal",
  "System.Half",
  "global::System.Half",
]);

const getFunctionValueSignature = (
  expr: Extract<IrExpression, { kind: "call" }>,
  context: EmitterContext
): Extract<IrType, { kind: "functionType" }> | undefined => {
  if (expr.callee.kind === "identifier") {
    const localType =
      context.localSemanticTypes?.get(expr.callee.name) ??
      context.localValueTypes?.get(expr.callee.name);
    const resolvedLocalType = resolveFunctionType(localType, context);
    if (resolvedLocalType) {
      return resolvedLocalType;
    }

    const symbolType = context.valueSymbols?.get(expr.callee.name)?.type;
    const resolvedSymbolType = resolveFunctionType(symbolType, context);
    if (resolvedSymbolType) {
      return resolvedSymbolType;
    }
  }

  const calleeType = expr.callee.inferredType;
  if (!calleeType || calleeType.kind !== "functionType") return undefined;

  if (expr.callee.kind === "identifier" && expr.callee.resolvedClrType) {
    return undefined;
  }

  if (expr.callee.kind === "memberAccess" && expr.callee.memberBinding) {
    return undefined;
  }

  return calleeType;
};

const emitOutDiscardArgument = (
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  const nextId = (context.tempVarId ?? 0) + 1;
  return [
    wrapArgModifier("out", {
      kind: "declarationExpression",
      designation: `__tsonic_out_discard_${nextId}`,
    }),
    {
      ...context,
      tempVarId: nextId,
    },
  ];
};

const resolveFunctionType = (
  type: IrType | undefined,
  context: EmitterContext
): Extract<IrType, { kind: "functionType" }> | undefined => {
  if (!type) {
    return undefined;
  }

  const unwrapped = unwrapParameterModifierType(type) ?? type;
  const resolved = resolveTypeAlias(stripNullish(unwrapped), context);
  return resolved.kind === "functionType" ? resolved : undefined;
};

const getRuntimeSurfaceParameterTypes = (
  expr: Extract<IrExpression, { kind: "call" }>,
  fallback: readonly (IrType | undefined)[]
): readonly (IrType | undefined)[] => {
  if (
    expr.sourceBackedSurfaceParameterTypes &&
    expr.sourceBackedSurfaceParameterTypes.length > 0
  ) {
    return expr.sourceBackedSurfaceParameterTypes;
  }

  if (expr.surfaceParameterTypes && expr.surfaceParameterTypes.length > 0) {
    return expr.surfaceParameterTypes;
  }

  return fallback;
};

const getRuntimeRestParameter = (
  expr: Extract<IrExpression, { kind: "call" }>
):
  | {
      readonly index: number;
      readonly arrayType: IrType | undefined;
      readonly elementType: IrType | undefined;
    }
  | undefined =>
  expr.sourceBackedRestParameter ??
  expr.surfaceRestParameter ??
  expr.restParameter;

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

const resolveCarrierPassThroughArgumentType = (
  arg: IrExpression,
  valueAst: CSharpExpressionAst,
  expectedType: IrType | undefined,
  context: EmitterContext
): IrType | undefined => {
  if (!expectedType) {
    return undefined;
  }

  const effectiveExpressionType =
    resolveEffectiveExpressionType(arg, context) ?? arg.inferredType;
  if (
    effectiveExpressionType &&
    hasMismatchedCollectionElementCarrier(
      effectiveExpressionType,
      expectedType,
      context
    )
  ) {
    return undefined;
  }
  if (
    isBroadObjectSlotType(expectedType, context) &&
    effectiveExpressionType &&
    willCarryAsRuntimeUnion(stripNullish(effectiveExpressionType), context)
  ) {
    return undefined;
  }

  if (arg.kind === "identifier") {
    const storageType = context.localValueTypes?.get(arg.name);
    const storageIdentifier =
      context.localNameMap?.get(arg.name) ?? escapeCSharpIdentifier(arg.name);
    const carrierSourceType = resolveCarrierPreservingSourceType(
      storageType,
      expectedType,
      context
    );
    if (
      carrierSourceType &&
      matchesDirectCarrierAst(
        valueAst,
        identifierExpression(storageIdentifier)
      ) &&
      matchesExpectedEmissionType(storageType, expectedType, context)
    ) {
      return carrierSourceType;
    }
  }

  if (
    !isBroadObjectSlotType(expectedType, context) &&
    !willCarryAsRuntimeUnion(expectedType, context)
  ) {
    return undefined;
  }

  const carrierAst = resolveRuntimeCarrierCompatibleExpressionAst({
    expr: arg,
    context,
  });
  const carrierType = resolveRuntimeCarrierCompatibleIrType({
    expr: arg,
    context,
  });
  if (!carrierAst || !carrierType) {
    return undefined;
  }
  if (!matchesDirectCarrierAst(valueAst, carrierAst)) {
    return undefined;
  }
  return resolveCarrierPreservingSourceType(carrierType, expectedType, context);
};

const tryEmitSelectedRuntimeCarrierSourceAst = (opts: {
  readonly arg: IrExpression;
  readonly expectedType: IrType | undefined;
  readonly selectedSourceMemberNs: ReadonlySet<number> | undefined;
  readonly context: EmitterContext;
}):
  | {
      readonly ast: CSharpExpressionAst;
      readonly context: EmitterContext;
      readonly actualType: IrType;
    }
  | undefined => {
  const { arg, expectedType, selectedSourceMemberNs, context } = opts;
  if (
    !expectedType ||
    !selectedSourceMemberNs ||
    selectedSourceMemberNs.size === 0 ||
    !willCarryAsRuntimeUnion(expectedType, context)
  ) {
    return undefined;
  }

  const narrowedMemberNs = resolveRuntimeSubsetMemberNs(arg, context);
  if (
    !narrowedMemberNs ||
    !intersectSelectedSourceMemberNs(narrowedMemberNs, selectedSourceMemberNs)
  ) {
    return undefined;
  }

  const carrierAst = resolveRuntimeCarrierCompatibleExpressionAst({
    expr: arg,
    context,
  });
  const carrierType =
    resolveRuntimeCarrierCompatibleIrType({ expr: arg, context }) ??
    resolveDirectStorageCompatibleIrType({ expr: arg, context });
  if (
    !carrierAst ||
    !carrierType ||
    !willCarryAsRuntimeUnion(stripNullish(carrierType), context)
  ) {
    return undefined;
  }

  return {
    ast: carrierAst,
    context,
    actualType: carrierType,
  };
};

const resolveContextualAdaptedArgumentType = (
  valueAst: CSharpExpressionAst,
  contextualExpectedType: IrType | undefined,
  context: EmitterContext
): IrType | undefined => {
  if (!contextualExpectedType) {
    return undefined;
  }

  const exactContextualTarget = tryEmitExactComparisonTargetAst(
    contextualExpectedType,
    context
  );
  if (
    exactContextualTarget &&
    (isExactExpressionToType(valueAst, exactContextualTarget[0]) ||
      isExactArrayCreationToType(valueAst, exactContextualTarget[0]))
  ) {
    return contextualExpectedType;
  }

  const directIterableElementType = getDirectIterableElementType(
    contextualExpectedType,
    context
  );
  if (!directIterableElementType) {
    return undefined;
  }

  const iteratorMethodName = emitCSharpName(
    "[symbol:iterator]",
    "methods",
    context
  );
  const iteratorPropertyName = emitCSharpName(
    "[symbol:iterator]",
    "properties",
    context
  );
  const calleeName =
    valueAst.kind === "invocationExpression"
      ? extractCalleeNameFromAst(valueAst.expression)
      : undefined;
  if (
    calleeName === "global::System.Linq.Enumerable.Select" ||
    (valueAst.kind === "memberAccessExpression" &&
      (valueAst.memberName === iteratorMethodName ||
        valueAst.memberName === iteratorPropertyName)) ||
    (valueAst.kind === "invocationExpression" &&
      valueAst.expression.kind === "memberAccessExpression" &&
      valueAst.expression.memberName === iteratorMethodName)
  ) {
    return contextualExpectedType;
  }

  return undefined;
};

const resolveExactRawEmittedExpectedType = (opts: {
  readonly arg: IrExpression;
  readonly rawArgAst: CSharpExpressionAst;
  readonly rawEmitExpectedType: IrType | undefined;
  readonly adaptationExpectedType: IrType | undefined;
  readonly context: EmitterContext;
}): IrType | undefined => {
  const {
    arg,
    rawArgAst,
    rawEmitExpectedType,
    adaptationExpectedType,
    context,
  } = opts;
  if (
    !adaptationExpectedType ||
    !rawEmitExpectedType ||
    (arg.kind !== "call" && arg.kind !== "new") ||
    !areIrTypesEquivalent(rawEmitExpectedType, adaptationExpectedType, context)
  ) {
    return undefined;
  }
  const rawActualType =
    (arg.kind === "call" || arg.kind === "new"
      ? arg.sourceBackedReturnType
      : undefined) ??
    resolveEffectiveExpressionType(arg, context) ??
    arg.inferredType;
  if (
    rawActualType &&
    hasMismatchedCollectionElementCarrier(
      rawActualType,
      adaptationExpectedType,
      context
    )
  ) {
    return undefined;
  }

  const exactTarget = tryEmitExactComparisonTargetAst(
    adaptationExpectedType,
    context
  );
  if (
    exactTarget &&
    (isExactExpressionToType(rawArgAst, exactTarget[0]) ||
      isExactArrayCreationToType(rawArgAst, exactTarget[0]))
  ) {
    return adaptationExpectedType;
  }

  const carrierAst = resolveRuntimeCarrierCompatibleExpressionAst({
    expr: arg,
    context,
  });
  const carrierType = resolveRuntimeCarrierCompatibleIrType({
    expr: arg,
    context,
  });
  if (
    carrierAst &&
    carrierType &&
    matchesDirectCarrierAst(rawArgAst, carrierAst) &&
    resolveCarrierPreservingSourceType(
      carrierType,
      adaptationExpectedType,
      context
    )
  ) {
    return adaptationExpectedType;
  }

  return undefined;
};

const isBroadOrStructuralObjectExpectedType = (type: IrType): boolean => {
  const stripped = stripNullish(type);
  return (
    stripped.kind === "unknownType" ||
    stripped.kind === "anyType" ||
    stripped.kind === "objectType" ||
    (stripped.kind === "referenceType" && stripped.name === "object")
  );
};

const getStructuralSurfaceKey = (
  type: IrType | undefined,
  context: EmitterContext
): string | undefined => {
  const stripped = type ? stripNullish(type) : undefined;
  if (!stripped) {
    return undefined;
  }

  if (stripped.kind === "objectType") {
    return tryContextualTypeIdentityKey(stripped, context);
  }

  if (
    stripped.kind === "referenceType" &&
    stripped.structuralMembers &&
    stripped.structuralMembers.length > 0
  ) {
    return tryContextualTypeIdentityKey(
      {
        kind: "objectType",
        members: stripped.structuralMembers,
      },
      context
    );
  }

  return undefined;
};

const hasEquivalentStructuralSurface = (
  left: IrType | undefined,
  right: IrType | undefined,
  context: EmitterContext
): boolean => {
  const leftKey = getStructuralSurfaceKey(left, context);
  const rightKey = getStructuralSurfaceKey(right, context);
  return leftKey !== undefined && leftKey === rightKey;
};

const surfaceUnionMemberContainsSelectedType = (
  member: IrType | undefined,
  selected: IrType | undefined,
  context: EmitterContext,
  seen: ReadonlySet<string> = new Set<string>()
): boolean => {
  if (!member || !selected) {
    return false;
  }

  const resolvedMember = resolveTypeAlias(stripNullish(member), context);
  const resolvedSelected = resolveTypeAlias(stripNullish(selected), context);
  const visitKey = `${getContextualTypeVisitKey(
    resolvedMember,
    context
  )}=>${getContextualTypeVisitKey(resolvedSelected, context)}`;
  if (seen.has(visitKey)) {
    return false;
  }

  const selectedComparable = resolveComparableType(resolvedSelected, context);
  const matchesMember = (candidate: IrType): boolean => {
    const candidateComparable = resolveComparableType(candidate, context);
    if (
      areIrTypesEquivalent(candidateComparable, selectedComparable, context)
    ) {
      return true;
    }

    return (
      hasEquivalentStructuralSurface(candidate, resolvedSelected, context) ||
      runtimeUnionMemberCanAcceptValue(candidate, resolvedSelected, context) ||
      (matchesExpectedEmissionType(candidate, resolvedSelected, context) &&
        matchesExpectedEmissionType(resolvedSelected, candidate, context))
    );
  };

  if (matchesMember(resolvedMember)) {
    return true;
  }

  if (resolvedMember.kind !== "unionType") {
    return false;
  }

  const nextSeen = new Set(seen);
  nextSeen.add(visitKey);
  return resolvedMember.types.some(
    (candidate) =>
      matchesMember(candidate) ||
      surfaceUnionMemberContainsSelectedType(
        candidate,
        resolvedSelected,
        context,
        nextSeen
      )
  );
};

const shouldPreferNamedStructuralTarget = (
  selectedExpectedType: IrType | undefined,
  surfaceExpectedType: IrType | undefined,
  context: EmitterContext
): boolean => {
  void selectedExpectedType;
  void surfaceExpectedType;
  void context;
  return false;
};

const unionMemberAcceptsArrayLiteral = (
  member: IrType,
  context: EmitterContext,
  seen: ReadonlySet<string> = new Set<string>()
): boolean => {
  const resolvedMember = resolveTypeAlias(stripNullish(member), context);
  const visitKey = getContextualTypeVisitKey(resolvedMember, context);
  if (seen.has(visitKey)) {
    return false;
  }

  if (
    getArrayLikeElementType(resolvedMember, context) ||
    getDirectIterableElementType(resolvedMember, context)
  ) {
    return true;
  }

  if (resolvedMember.kind !== "unionType") {
    return false;
  }

  const nextSeen = new Set(seen);
  nextSeen.add(visitKey);
  return resolvedMember.types.some((candidate) =>
    unionMemberAcceptsArrayLiteral(candidate, context, nextSeen)
  );
};

const resolveConcreteArrayLiteralContextType = (
  type: IrType | undefined,
  context: EmitterContext,
  preferEmptyArrayMember = false
): IrType | undefined => {
  if (!type) {
    return undefined;
  }

  const contextualType =
    (preferEmptyArrayMember
      ? resolveEmptyArrayLiteralContextType(type, context)
      : undefined) ?? resolveArrayLiteralContextType(type, context);
  if (!contextualType) {
    return undefined;
  }

  const resolvedContextualType = resolveTypeAlias(
    stripNullish(contextualType),
    context
  );
  if (
    resolvedContextualType.kind === "arrayType" ||
    resolvedContextualType.kind === "tupleType"
  ) {
    return contextualType;
  }

  if (
    resolvedContextualType.kind === "referenceType" &&
    (resolvedContextualType.name === "Array" ||
      resolvedContextualType.name === "ReadonlyArray" ||
      resolvedContextualType.name === "ArrayLike")
  ) {
    return contextualType;
  }

  return undefined;
};

const resolveDeterministicSurfaceUnionMemberNs = (
  selectedExpectedType: IrType | undefined,
  surfaceExpectedType: IrType | undefined,
  context: EmitterContext
): ReadonlySet<number> | undefined => {
  if (!selectedExpectedType || !surfaceExpectedType) {
    return undefined;
  }

  const resolvedSurface = resolveTypeAlias(
    stripNullish(surfaceExpectedType),
    context
  );
  if (resolvedSurface.kind !== "unionType") {
    return undefined;
  }
  const [runtimeLayout] = buildRuntimeUnionLayout(
    resolvedSurface,
    context,
    emitTypeAst
  );
  if (!runtimeLayout) {
    return undefined;
  }

  const resolvedSelected = resolveTypeAlias(
    stripNullish(selectedExpectedType),
    context
  );
  const matchingMemberNs = runtimeLayout.members.flatMap((member, index) => {
    return surfaceUnionMemberContainsSelectedType(
      member,
      resolvedSelected,
      context
    )
      ? [index + 1]
      : [];
  });

  return matchingMemberNs.length === 1 ? new Set(matchingMemberNs) : undefined;
};

const finalExpectedMatchesSurfaceCarrier = (
  finalExpectedType: IrType | undefined,
  surfaceExpectedType: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!finalExpectedType || !surfaceExpectedType) {
    return false;
  }

  return (
    areIrTypesEquivalent(finalExpectedType, surfaceExpectedType, context) ||
    runtimeUnionAliasReferencesMatch(
      finalExpectedType,
      surfaceExpectedType,
      context
    ) ||
    resolveCarrierPreservingSourceType(
      finalExpectedType,
      surfaceExpectedType,
      context
    ) !== undefined ||
    resolveCarrierPreservingSourceType(
      surfaceExpectedType,
      finalExpectedType,
      context
    ) !== undefined
  );
};

const resolveSurfaceSelectedSourceMemberNs = (
  selectedExpectedType: IrType | undefined,
  finalExpectedType: IrType | undefined,
  surfaceExpectedType: IrType | undefined,
  context: EmitterContext
): ReadonlySet<number> | undefined => {
  if (!surfaceExpectedType) {
    return undefined;
  }

  return (
    resolveDeterministicSurfaceUnionMemberNs(
      selectedExpectedType,
      surfaceExpectedType,
      context
    ) ??
    resolveDeterministicSurfaceUnionMemberNs(
      finalExpectedType,
      surfaceExpectedType,
      context
    )
  );
};

const intersectSelectedSourceMemberNs = (
  left: ReadonlySet<number> | undefined,
  right: ReadonlySet<number> | undefined
): ReadonlySet<number> | undefined => {
  if (!left) {
    return right;
  }
  if (!right) {
    return left;
  }

  const intersection = new Set(
    Array.from(left).filter((memberN) => right.has(memberN))
  );
  return intersection.size > 0 ? intersection : undefined;
};

const runtimeUnionCarrierSurfacesDiffer = (
  actualType: IrType | undefined,
  expectedType: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!actualType || !expectedType) {
    return false;
  }

  const [actualLayout, actualLayoutContext] = buildRuntimeUnionLayout(
    stripNullish(actualType),
    context,
    emitTypeAst
  );
  const [expectedLayout] = buildRuntimeUnionLayout(
    stripNullish(expectedType),
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

const shouldSkipRuntimeUnionArgumentMaterialization = (opts: {
  readonly carrierPassThroughArgumentType: IrType | undefined;
  readonly carrierPassThroughType: IrType | undefined;
  readonly exactFinalExpectedArgumentType: IrType | undefined;
  readonly materializationActualArgumentType: IrType | undefined;
  readonly adaptationExpectedType: IrType | undefined;
  readonly context: EmitterContext;
}): boolean => {
  const {
    carrierPassThroughArgumentType,
    carrierPassThroughType,
    exactFinalExpectedArgumentType,
    materializationActualArgumentType,
    adaptationExpectedType,
    context,
  } = opts;
  if (exactFinalExpectedArgumentType) {
    return !runtimeUnionCarrierSurfacesDiffer(
      materializationActualArgumentType,
      adaptationExpectedType,
      context
    );
  }

  const passThroughType =
    carrierPassThroughArgumentType ?? carrierPassThroughType;
  if (!passThroughType) {
    return false;
  }

  return !runtimeUnionCarrierSurfacesDiffer(
    passThroughType,
    adaptationExpectedType,
    context
  );
};

const resolveSelectedSourceMemberNs = (
  arg: IrExpression,
  selectedExpectedType: IrType | undefined,
  finalExpectedType: IrType | undefined,
  surfaceExpectedType: IrType | undefined,
  context: EmitterContext
): ReadonlySet<number> | undefined =>
  intersectSelectedSourceMemberNs(
    resolveRuntimeSubsetMemberNs(arg, context),
    resolveSurfaceSelectedSourceMemberNs(
      selectedExpectedType,
      finalExpectedType,
      surfaceExpectedType,
      context
    )
  );

const resolveAdaptationExpectedType = (
  selectedExpectedType: IrType | undefined,
  finalExpectedType: IrType | undefined,
  surfaceExpectedType: IrType | undefined,
  context: EmitterContext
): IrType | undefined => {
  if (!finalExpectedType) {
    return surfaceExpectedType;
  }

  if (!surfaceExpectedType) {
    return finalExpectedType;
  }

  if (
    resolveSurfaceSelectedSourceMemberNs(
      selectedExpectedType,
      finalExpectedType,
      surfaceExpectedType,
      context
    )
  ) {
    return surfaceExpectedType;
  }

  return finalExpectedMatchesSurfaceCarrier(
    finalExpectedType,
    surfaceExpectedType,
    context
  )
    ? surfaceExpectedType
    : finalExpectedType;
};

const resolveFinalCallArgumentExpectedType = (
  selectedExpectedType: IrType | undefined,
  surfaceExpectedType: IrType | undefined,
  actualArgumentType: IrType | undefined,
  context: EmitterContext
): IrType | undefined => {
  if (!surfaceExpectedType) {
    return selectedExpectedType;
  }

  if (!selectedExpectedType) {
    return surfaceExpectedType;
  }

  if (
    shouldPreferNamedStructuralTarget(
      selectedExpectedType,
      surfaceExpectedType,
      context
    )
  ) {
    return selectedExpectedType;
  }

  if (
    resolveDeterministicSurfaceUnionMemberNs(
      selectedExpectedType,
      surfaceExpectedType,
      context
    )
  ) {
    return surfaceExpectedType;
  }

  if (
    preservesSurfaceRuntimeMaterialization(
      surfaceExpectedType,
      selectedExpectedType,
      context
    )
  ) {
    return selectedExpectedType;
  }

  if (
    isBroadOrStructuralObjectExpectedType(surfaceExpectedType) &&
    !preservesSurfaceRuntimeMaterialization(
      surfaceExpectedType,
      selectedExpectedType,
      context
    ) &&
    (!actualArgumentType ||
      matchesExpectedEmissionType(
        actualArgumentType,
        selectedExpectedType,
        context
      ))
  ) {
    return selectedExpectedType;
  }

  return surfaceExpectedType;
};

const shouldPreserveSurfaceRuntimeExpectedType = (opts: {
  readonly selectedExpectedType: IrType | undefined;
  readonly surfaceExpectedType: IrType | undefined;
  readonly context: EmitterContext;
}): boolean => {
  const { selectedExpectedType, surfaceExpectedType, context } = opts;
  if (!selectedExpectedType || !surfaceExpectedType) {
    return false;
  }

  return (
    willCarryAsRuntimeUnion(surfaceExpectedType, context) &&
    !preservesSurfaceRuntimeMaterialization(
      surfaceExpectedType,
      selectedExpectedType,
      context
    )
  );
};

const resolvePreEmitStorageAwareArgumentType = (
  arg: IrExpression,
  semanticArgumentType: IrType | undefined,
  context: EmitterContext
): IrType | undefined =>
  resolveDirectStorageCompatibleIrType({
    expr: arg,
    context,
  }) ?? semanticArgumentType;

const shouldPreserveOptionalSurfaceCarrierPassThrough = (opts: {
  readonly arg: IrExpression;
  readonly selectedExpectedType: IrType | undefined;
  readonly surfaceExpectedType: IrType | undefined;
  readonly context: EmitterContext;
}): boolean => {
  const { arg, selectedExpectedType, surfaceExpectedType, context } = opts;
  if (!selectedExpectedType || !surfaceExpectedType) {
    return false;
  }

  const surfaceNullishSplit =
    splitRuntimeNullishUnionMembers(surfaceExpectedType);
  const selectedNullishSplit =
    splitRuntimeNullishUnionMembers(selectedExpectedType);
  if (!surfaceNullishSplit?.hasRuntimeNullish) {
    return false;
  }

  if (selectedNullishSplit?.hasRuntimeNullish) {
    return false;
  }

  return !!tryEmitCarrierPreservingExpressionAst({
    expr: arg,
    expectedType: surfaceExpectedType,
    context,
  });
};

const isExplicitRuntimeNullishArgument = (arg: IrExpression): boolean =>
  (arg.kind === "identifier" &&
    (arg.name === "undefined" || arg.name === "null")) ||
  (arg.kind === "literal" && (arg.value === undefined || arg.value === null));

const resolveExplicitNullishSurfaceExpectedType = (opts: {
  readonly arg: IrExpression;
  readonly surfaceExpectedType: IrType | undefined;
}): IrType | undefined => {
  const { arg, surfaceExpectedType } = opts;
  if (!surfaceExpectedType || !isExplicitRuntimeNullishArgument(arg)) {
    return undefined;
  }

  return splitRuntimeNullishUnionMembers(surfaceExpectedType)?.hasRuntimeNullish
    ? surfaceExpectedType
    : undefined;
};

const shouldPreserveOptionalSurfaceRawEmission = (opts: {
  readonly arg: IrExpression;
  readonly selectedExpectedType: IrType | undefined;
  readonly surfaceExpectedType: IrType | undefined;
  readonly context: EmitterContext;
}): boolean => {
  const { arg, selectedExpectedType, surfaceExpectedType, context } = opts;
  if (!selectedExpectedType || !surfaceExpectedType) {
    return false;
  }

  const surfaceNullishSplit =
    splitRuntimeNullishUnionMembers(surfaceExpectedType);
  const selectedNullishSplit =
    splitRuntimeNullishUnionMembers(selectedExpectedType);
  if (
    !surfaceNullishSplit?.hasRuntimeNullish ||
    selectedNullishSplit?.hasRuntimeNullish
  ) {
    return false;
  }

  const transparentArg = unwrapTransparentExpression(arg);
  if (
    transparentArg.kind !== "identifier" &&
    transparentArg.kind !== "memberAccess"
  ) {
    return false;
  }

  const actualType =
    resolveEffectiveExpressionType(arg, context) ??
    resolveEffectiveExpressionType(transparentArg, context) ??
    arg.inferredType ??
    transparentArg.inferredType;
  const directStorageType =
    resolveDirectStorageCompatibleIrType({
      expr: arg,
      context,
    }) ??
    resolveDirectStorageCompatibleIrType({
      expr: transparentArg,
      context,
    });
  const candidateSourceType = directStorageType ?? actualType;
  if (!candidateSourceType) {
    return false;
  }

  return (
    resolveCarrierPreservingSourceType(
      candidateSourceType,
      surfaceExpectedType,
      context
    ) !== undefined
  );
};

const shouldUseSurfaceCarrierForRawEmission = (opts: {
  readonly arg: IrExpression;
  readonly adaptationExpectedType: IrType | undefined;
  readonly surfaceExpectedType: IrType | undefined;
  readonly context: EmitterContext;
}): boolean => {
  const { arg, adaptationExpectedType, surfaceExpectedType, context } = opts;
  if (!adaptationExpectedType || !surfaceExpectedType) {
    return false;
  }

  if (surfaceExpectedType.kind !== "referenceType") {
    return false;
  }

  if (!willCarryAsRuntimeUnion(surfaceExpectedType, context)) {
    return false;
  }

  const rawCarrierSourceType =
    resolveRuntimeCarrierCompatibleIrType({ expr: arg, context }) ??
    resolveDirectStorageCompatibleIrType({ expr: arg, context });
  if (
    !resolveCarrierPreservingSourceType(
      rawCarrierSourceType,
      surfaceExpectedType,
      context
    )
  ) {
    return false;
  }

  return finalExpectedMatchesSurfaceCarrier(
    adaptationExpectedType,
    surfaceExpectedType,
    context
  );
};

const shouldDeferStructuralObjectArgumentMaterialization = (opts: {
  readonly arg: IrExpression;
  readonly rawExpectedType: IrType | undefined;
  readonly context: EmitterContext;
}): boolean => {
  const { arg, rawExpectedType, context } = opts;
  if (!rawExpectedType) {
    return false;
  }

  if (arg.kind !== "identifier" && arg.kind !== "memberAccess") {
    return false;
  }

  const actualType =
    resolveDirectStorageCompatibleIrType({ expr: arg, context }) ??
    resolveEffectiveExpressionType(arg, context) ??
    arg.inferredType;
  if (!actualType) {
    return false;
  }

  if (isSameNominalType(actualType, rawExpectedType, context)) {
    return false;
  }

  const actualProps = collectStructuralProperties(actualType, context);
  const expectedProps = collectStructuralProperties(rawExpectedType, context);
  return (
    actualProps !== undefined &&
    actualProps.length > 0 &&
    expectedProps !== undefined &&
    expectedProps.length > 0
  );
};

const selectAdaptationActualArgumentType = (opts: {
  readonly carrierPassThroughType: IrType | undefined;
  readonly exactFinalExpectedArgumentType: IrType | undefined;
  readonly directStorageArgumentType: IrType | undefined;
  readonly contextualAdaptedActualType: IrType | undefined;
  readonly resolvedFunctionArgumentType: IrType | undefined;
  readonly effectiveArgumentType: IrType | undefined;
  readonly inferredArgumentType: IrType | undefined;
  readonly selectedSourceMemberNs?: ReadonlySet<number>;
  readonly context: EmitterContext;
}): IrType | undefined => {
  const {
    carrierPassThroughType,
    exactFinalExpectedArgumentType,
    directStorageArgumentType,
    contextualAdaptedActualType,
    resolvedFunctionArgumentType,
    effectiveArgumentType,
    inferredArgumentType,
    selectedSourceMemberNs,
    context,
  } = opts;

  if (carrierPassThroughType) {
    return carrierPassThroughType;
  }

  if (exactFinalExpectedArgumentType) {
    return exactFinalExpectedArgumentType;
  }

  if (
    selectedSourceMemberNs &&
    selectedSourceMemberNs.size > 0 &&
    effectiveArgumentType &&
    directStorageArgumentType &&
    willCarryAsRuntimeUnion(stripNullish(directStorageArgumentType), context) &&
    matchesExpectedEmissionType(
      effectiveArgumentType,
      directStorageArgumentType,
      context
    ) &&
    !matchesExpectedEmissionType(
      directStorageArgumentType,
      effectiveArgumentType,
      context
    )
  ) {
    return directStorageArgumentType;
  }

  const shouldPreferEffectiveArgumentType =
    !!effectiveArgumentType &&
    !!directStorageArgumentType &&
    !areIrTypesEquivalent(
      effectiveArgumentType,
      directStorageArgumentType,
      context
    ) &&
    !(
      willCarryAsRuntimeUnion(stripNullish(effectiveArgumentType), context) &&
      !willCarryAsRuntimeUnion(stripNullish(directStorageArgumentType), context)
    ) &&
    matchesExpectedEmissionType(
      effectiveArgumentType,
      directStorageArgumentType,
      context
    ) &&
    !matchesExpectedEmissionType(
      directStorageArgumentType,
      effectiveArgumentType,
      context
    );

  if (shouldPreferEffectiveArgumentType) {
    return effectiveArgumentType;
  }

  if (isBroadObjectSlotType(directStorageArgumentType, context)) {
    return directStorageArgumentType;
  }

  return (
    directStorageArgumentType ??
    contextualAdaptedActualType ??
    resolvedFunctionArgumentType ??
    effectiveArgumentType ??
    inferredArgumentType
  );
};

const selectCollectionMaterializationActualArgumentType = (opts: {
  readonly arg: IrExpression;
  readonly preferredSourceType: IrType | undefined;
  readonly selectedActualType: IrType | undefined;
  readonly expectedType: IrType | undefined;
  readonly context: EmitterContext;
}): IrType | undefined => {
  const {
    arg,
    preferredSourceType,
    selectedActualType,
    expectedType,
    context,
  } = opts;
  if (!expectedType) {
    return selectedActualType;
  }

  const sourceBackedReturnType =
    arg.kind === "call" || arg.kind === "new"
      ? arg.sourceBackedReturnType
      : undefined;
  const sourceType = sourceBackedReturnType ?? preferredSourceType;
  return sourceType &&
    hasMismatchedCollectionElementCarrier(sourceType, expectedType, context)
    ? sourceType
    : selectedActualType;
};

const selectNumericCastArgumentType = (
  candidates: readonly (IrType | undefined)[],
  context: EmitterContext
): IrType | undefined =>
  candidates.find((candidate) => isNumericSourceIrType(candidate, context));

const hasRuntimeNullishSurface = (type: IrType | undefined): boolean =>
  type !== undefined &&
  (splitRuntimeNullishUnionMembers(type)?.hasRuntimeNullish ?? false);

const numericCoreTypesMatch = (
  left: IrType | undefined,
  right: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!left || !right) {
    return false;
  }

  const strippedLeft = stripNullish(left);
  const strippedRight = stripNullish(right);
  return (
    areIrTypesEquivalent(strippedLeft, strippedRight, context) ||
    (matchesExpectedEmissionType(strippedLeft, strippedRight, context) &&
      matchesExpectedEmissionType(strippedRight, strippedLeft, context))
  );
};

const selectPostMaterializationNumericCastArgumentType = (opts: {
  readonly rawArgAst: CSharpExpressionAst;
  readonly materializedArgAst: CSharpExpressionAst;
  readonly carrierPassThroughArgumentType: IrType | undefined;
  readonly carrierPassThroughType: IrType | undefined;
  readonly exactFinalExpectedArgumentType: IrType | undefined;
  readonly adaptationExpectedType: IrType | undefined;
  readonly fallbackCandidates: readonly (IrType | undefined)[];
  readonly context: EmitterContext;
}): IrType | undefined => {
  if (
    opts.exactFinalExpectedArgumentType &&
    opts.adaptationExpectedType &&
    hasRuntimeNullishSurface(opts.adaptationExpectedType) &&
    numericCoreTypesMatch(
      opts.exactFinalExpectedArgumentType,
      opts.adaptationExpectedType,
      opts.context
    )
  ) {
    return opts.adaptationExpectedType;
  }

  const postMaterializationType =
    opts.carrierPassThroughArgumentType ??
    opts.carrierPassThroughType ??
    opts.exactFinalExpectedArgumentType ??
    (opts.materializedArgAst === opts.rawArgAst
      ? undefined
      : opts.adaptationExpectedType);

  if (postMaterializationType) {
    return isNumericSourceIrType(postMaterializationType, opts.context)
      ? postMaterializationType
      : undefined;
  }

  return selectNumericCastArgumentType(opts.fallbackCandidates, opts.context);
};

const selectNumericCastExpectedType = (
  candidates: readonly (IrType | undefined)[],
  context: EmitterContext,
  actualType?: IrType
): IrType | undefined => {
  const numericCandidates = candidates.filter(
    (candidate) =>
      isExpectedIntegralIrType(candidate, context) ||
      isExpectedJsNumberIrType(candidate, context)
  );
  if (actualType && hasRuntimeNullishSurface(actualType)) {
    const nullishCandidate = numericCandidates.find(
      (candidate) =>
        hasRuntimeNullishSurface(candidate) &&
        numericCoreTypesMatch(candidate, actualType, context)
    );
    if (nullishCandidate) {
      return nullishCandidate;
    }
  }

  return numericCandidates[0];
};

const resolveContextualCallArgumentExpectedType = (
  arg: IrExpression,
  selectedExpectedType: IrType | undefined,
  runtimeExpectedType: IrType | undefined,
  actualArgumentType: IrType | undefined,
  context: EmitterContext
): IrType | undefined => {
  if (!runtimeExpectedType) {
    return selectedExpectedType;
  }

  if (!selectedExpectedType) {
    return runtimeExpectedType;
  }

  if (
    shouldPreferNamedStructuralTarget(
      selectedExpectedType,
      runtimeExpectedType,
      context
    )
  ) {
    return selectedExpectedType;
  }

  if (arg.kind === "identifier") {
    const storageType = context.localValueTypes?.get(arg.name);
    if (
      storageType &&
      matchesExpectedEmissionType(storageType, runtimeExpectedType, context) &&
      matchesExpectedEmissionType(
        selectedExpectedType,
        runtimeExpectedType,
        context
      )
    ) {
      return runtimeExpectedType;
    }
  }

  if (
    actualArgumentType &&
    matchesExpectedEmissionType(
      actualArgumentType,
      runtimeExpectedType,
      context
    )
  ) {
    return runtimeExpectedType;
  }

  if (
    shouldPreferRuntimeExpectedType(
      arg,
      actualArgumentType,
      runtimeExpectedType,
      context
    )
  ) {
    return runtimeExpectedType;
  }

  if (
    runtimeExpectedType.kind === "unknownType" ||
    runtimeExpectedType.kind === "anyType" ||
    (runtimeExpectedType.kind === "referenceType" &&
      runtimeExpectedType.name === "object")
  ) {
    return runtimeExpectedType;
  }

  return selectedExpectedType;
};

const countRequiredParameters = (
  parameters: readonly IrParameter[]
): number => {
  let required = 0;
  for (const parameter of parameters) {
    if (!parameter) continue;
    if (
      parameter.isRest ||
      parameter.isOptional ||
      parameter.initializer !== undefined
    ) {
      break;
    }
    required += 1;
  }
  return required;
};

const isNumericBindingParameterType = (
  type: IrType,
  context: EmitterContext
): boolean => {
  const resolved = resolveTypeAlias(stripNullish(type), context);
  if (resolved.kind === "primitiveType") {
    return resolved.name === "number" || resolved.name === "int";
  }

  if (resolved.kind === "literalType") {
    return typeof resolved.value === "number";
  }

  if (resolved.kind !== "referenceType") {
    return false;
  }

  return (
    resolved.name === "sbyte" ||
    resolved.name === "byte" ||
    resolved.name === "short" ||
    resolved.name === "ushort" ||
    resolved.name === "int" ||
    resolved.name === "uint" ||
    resolved.name === "long" ||
    resolved.name === "ulong" ||
    resolved.name === "float" ||
    resolved.name === "double" ||
    resolved.name === "decimal" ||
    resolved.name === "Half" ||
    resolved.name === "SByte" ||
    resolved.name === "Byte" ||
    resolved.name === "Int16" ||
    resolved.name === "UInt16" ||
    resolved.name === "Int32" ||
    resolved.name === "UInt32" ||
    resolved.name === "Int64" ||
    resolved.name === "UInt64" ||
    resolved.name === "Single" ||
    resolved.name === "Double" ||
    resolved.name === "Decimal" ||
    referenceTypeHasClrIdentity(resolved, NUMERIC_BINDING_CLR_NAMES)
  );
};

const requiresDelegateArityAdaptation = (
  actualType: Extract<IrType, { kind: "functionType" }>,
  expectedType: Extract<IrType, { kind: "functionType" }>
): boolean => {
  const actualHasRest = actualType.parameters.some(
    (parameter) => parameter?.isRest
  );
  const expectedHasRest = expectedType.parameters.some(
    (parameter) => parameter?.isRest
  );

  if (actualHasRest || expectedHasRest) {
    return false;
  }

  if (actualType.parameters.length === expectedType.parameters.length) {
    return false;
  }

  const actualRequired = countRequiredParameters(actualType.parameters);
  return actualRequired <= expectedType.parameters.length;
};

const getExpectedParameterBaseName = (
  parameter: IrParameter | undefined,
  index: number
): string => {
  if (parameter?.pattern.kind === "identifierPattern") {
    return escapeCSharpIdentifier(parameter.pattern.name);
  }
  return `arg${index}`;
};

const buildDelegateAdapterParameterName = (
  parameter: IrParameter | undefined,
  index: number,
  preserveExisting: boolean
): string =>
  preserveExisting
    ? getExpectedParameterBaseName(parameter, index)
    : `__unused_${getExpectedParameterBaseName(parameter, index)}`;

const shouldEmitExplicitDelegateAdapterTypes = (
  expectedType: Extract<IrType, { kind: "functionType" }>
): boolean =>
  expectedType.parameters.every(
    (parameter) =>
      parameter?.type !== undefined &&
      parameter.type.kind !== "unknownType" &&
      parameter.type.kind !== "anyType" &&
      !containsTypeParameter(parameter.type)
  );

const wrapOptionalDelegateParameterTypeAst = (
  typeAst: CSharpTypeAst,
  parameter: IrParameter | undefined
): CSharpTypeAst =>
  parameter?.isOptional && typeAst.kind !== "nullableType"
    ? { kind: "nullableType", underlyingType: typeAst }
    : typeAst;

const emitDelegateAdapterParameters = (
  expectedType: Extract<IrType, { kind: "functionType" }>,
  parameterNames: readonly string[],
  context: EmitterContext
): [readonly CSharpLambdaParameterAst[], EmitterContext] => {
  let currentContext = context;
  const emitExplicitTypes =
    shouldEmitExplicitDelegateAdapterTypes(expectedType);
  const emitted: CSharpLambdaParameterAst[] = [];

  for (let index = 0; index < expectedType.parameters.length; index += 1) {
    const parameter = expectedType.parameters[index];
    if (!parameter) continue;

    const modifier =
      parameter.passing !== "value" ? parameter.passing : undefined;
    if (emitExplicitTypes && parameter.type) {
      const [typeAst, nextContext] = emitTypeAst(
        parameter.type,
        currentContext
      );
      currentContext = nextContext;
      emitted.push(
        modifier
          ? {
              name: parameterNames[index] ?? `__arg${index}`,
              modifier,
              type: wrapOptionalDelegateParameterTypeAst(typeAst, parameter),
            }
          : {
              name: parameterNames[index] ?? `__arg${index}`,
              type: wrapOptionalDelegateParameterTypeAst(typeAst, parameter),
            }
      );
      continue;
    }

    emitted.push(
      modifier
        ? { name: parameterNames[index] ?? `__arg${index}`, modifier }
        : { name: parameterNames[index] ?? `__arg${index}` }
    );
  }

  return [emitted, currentContext];
};

const adaptLambdaArgumentAst = (
  lambdaAst: Extract<CSharpExpressionAst, { kind: "lambdaExpression" }>,
  expectedType: Extract<IrType, { kind: "functionType" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  const parameterNames = expectedType.parameters.map((parameter, index) =>
    index < lambdaAst.parameters.length
      ? (lambdaAst.parameters[index]?.name ?? `__arg${index}`)
      : buildDelegateAdapterParameterName(parameter, index, false)
  );
  const [parameters, nextContext] = emitDelegateAdapterParameters(
    expectedType,
    parameterNames,
    context
  );

  return [
    {
      ...lambdaAst,
      parameters,
    },
    nextContext,
  ];
};

const wrapFunctionValueArgumentAst = (
  originalAst: CSharpExpressionAst,
  actualType: Extract<IrType, { kind: "functionType" }>,
  expectedType: Extract<IrType, { kind: "functionType" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  const parameterNames = expectedType.parameters.map((parameter, index) =>
    buildDelegateAdapterParameterName(
      parameter,
      index,
      index < actualType.parameters.length
    )
  );
  const [parameters, nextContext] = emitDelegateAdapterParameters(
    expectedType,
    parameterNames,
    context
  );

  return [
    {
      kind: "lambdaExpression",
      isAsync: false,
      parameters,
      body: {
        kind: "invocationExpression",
        expression: originalAst,
        arguments: parameterNames
          .slice(0, actualType.parameters.length)
          .map((name) => ({
            kind: "identifierExpression",
            identifier: name,
          })),
      },
    },
    nextContext,
  ];
};

const findMemberBindingExpectedType = (
  expr: Extract<IrExpression, { kind: "call" }>,
  argIndex: number,
  context: EmitterContext
): IrType | undefined => {
  if (expr.callee.kind !== "memberAccess" || !expr.callee.memberBinding) {
    return undefined;
  }

  const calleeBinding = expr.callee.memberBinding;
  const preferredOwner = calleeBinding.type;
  const overloads = context.bindingRegistry?.getMemberOverloads(
    preferredOwner,
    calleeBinding.member,
    preferredOwner
  );
  if (!overloads || overloads.length === 0) {
    return undefined;
  }

  const actualArgumentTypes = expr.arguments.map((argument) =>
    argument.kind === "spread"
      ? undefined
      : (resolveEffectiveExpressionType(argument, context) ??
        argument.inferredType)
  );

  const matchingParameterTypes = overloads
    .filter((overload) => {
      if (
        overload.binding.assembly !== calleeBinding.assembly ||
        overload.binding.type !== calleeBinding.type ||
        overload.binding.member !== calleeBinding.member
      ) {
        return false;
      }

      const parameters = overload.semanticSignature?.parameters;
      if (!parameters) {
        return false;
      }

      const parameterOffset = overload.isExtensionMethod ? 1 : 0;
      const required = countRequiredParameters(parameters);
      const visibleRequired = Math.max(0, required - parameterOffset);
      if (expr.arguments.length < visibleRequired) {
        return false;
      }

      const hasRest = parameters.some((parameter) => parameter?.isRest);
      const visibleParameterCount = Math.max(
        0,
        parameters.length - parameterOffset
      );
      if (!hasRest && expr.arguments.length > visibleParameterCount) {
        return false;
      }

      for (
        let visibleIndex = 0;
        visibleIndex < expr.arguments.length;
        visibleIndex++
      ) {
        const actualArgumentType = actualArgumentTypes[visibleIndex];
        const parameter = parameters[visibleIndex + parameterOffset];
        const parameterType = parameter?.type;
        if (!actualArgumentType || !parameterType) {
          continue;
        }
        if (
          !matchesExpectedEmissionType(
            actualArgumentType,
            parameterType,
            context
          )
        ) {
          return false;
        }
      }

      return parameters[argIndex + parameterOffset]?.type !== undefined;
    })
    .map((overload) => {
      const parameters = overload.semanticSignature?.parameters;
      const parameterOffset = overload.isExtensionMethod ? 1 : 0;
      return parameters?.[argIndex + parameterOffset]?.type;
    })
    .filter(
      (parameterType): parameterType is IrType => parameterType !== undefined
    );

  if (matchingParameterTypes.length === 0) {
    return undefined;
  }

  const uniqueParameterTypes = new Map<string, IrType>();
  for (const parameterType of matchingParameterTypes) {
    const key = tryContextualTypeIdentityKey(
      stripNullish(parameterType),
      context
    );
    if (!key) {
      return undefined;
    }
    uniqueParameterTypes.set(key, parameterType);
  }

  if (uniqueParameterTypes.size === 1) {
    return [...uniqueParameterTypes.values()][0];
  }

  const uniqueNonBroadParameterTypes = new Map<string, IrType>();
  for (const parameterType of uniqueParameterTypes.values()) {
    const stripped = stripNullish(parameterType);
    const isBroadFallback =
      stripped.kind === "anyType" ||
      stripped.kind === "unknownType" ||
      (stripped.kind === "referenceType" && stripped.name === "object");
    if (isBroadFallback) {
      continue;
    }
    const key = tryContextualTypeIdentityKey(stripped, context);
    if (!key) {
      return undefined;
    }
    uniqueNonBroadParameterTypes.set(key, parameterType);
  }

  if (uniqueNonBroadParameterTypes.size === 1) {
    return [...uniqueNonBroadParameterTypes.values()][0];
  }

  const uniqueNumericParameterTypes = new Map<string, IrType>();
  for (const parameterType of uniqueNonBroadParameterTypes.values()) {
    if (!isNumericBindingParameterType(parameterType, context)) {
      continue;
    }
    const key = tryContextualTypeIdentityKey(
      stripNullish(parameterType),
      context
    );
    if (!key) {
      return undefined;
    }
    uniqueNumericParameterTypes.set(key, parameterType);
  }

  return uniqueNumericParameterTypes.size === 1
    ? [...uniqueNumericParameterTypes.values()][0]
    : undefined;
};

const resolveExpectedFunctionTypeForArgument = (
  expr: Extract<IrExpression, { kind: "call" }>,
  argIndex: number,
  expectedType: IrType | undefined,
  context: EmitterContext
): Extract<IrType, { kind: "functionType" }> | undefined =>
  resolveFunctionType(expectedType, context) ??
  resolveFunctionType(
    findMemberBindingExpectedType(expr, argIndex, context),
    context
  );

const resolveActualFunctionTypeForArgument = (
  arg: IrExpression,
  context: EmitterContext
): Extract<IrType, { kind: "functionType" }> | undefined => {
  const trimToDeclaredArity = (
    functionType: Extract<IrType, { kind: "functionType" }> | undefined
  ): Extract<IrType, { kind: "functionType" }> | undefined => {
    if (
      !functionType ||
      (arg.kind !== "arrowFunction" && arg.kind !== "functionExpression")
    ) {
      return functionType;
    }

    const declaredArity = arg.parameters.length;
    if (declaredArity >= functionType.parameters.length) {
      return functionType;
    }

    return {
      ...functionType,
      parameters: functionType.parameters.slice(0, declaredArity),
    };
  };

  if (arg.kind === "identifier") {
    return trimToDeclaredArity(
      resolveFunctionType(
        context.localSemanticTypes?.get(arg.name) ??
          context.localValueTypes?.get(arg.name) ??
          context.valueSymbols?.get(arg.name)?.type ??
          arg.inferredType,
        context
      )
    );
  }

  return trimToDeclaredArity(
    resolveFunctionType(
      resolveEffectiveExpressionType(arg, context) ?? arg.inferredType,
      context
    )
  );
};

const broadObjectIrType: IrType = {
  kind: "referenceType",
  name: "object",
  resolvedClrType: "System.Object",
};

const resolveGenericBroadObjectFallbackExpectedType = (
  expr: Extract<IrExpression, { kind: "call" }>,
  args: readonly IrExpression[],
  argIndex: number,
  context: EmitterContext
): IrType | undefined => {
  const calleeType = expr.callee.inferredType;
  if (!calleeType || calleeType.kind !== "intersectionType") {
    return undefined;
  }
  const argument = args[argIndex];
  if (!argument) {
    return undefined;
  }

  const actualType =
    resolveActualFunctionTypeForArgument(argument, context) ??
    resolveEffectiveExpressionType(argument, context) ??
    argument.inferredType;
  if (!actualType || !isNumericBindingParameterType(actualType, context)) {
    return undefined;
  }

  const actualArgumentTypes = args.map((arg) =>
    arg
      ? (resolveActualFunctionTypeForArgument(arg, context) ??
        resolveEffectiveExpressionType(arg, context) ??
        arg.inferredType)
      : undefined
  );

  for (const candidate of calleeType.types) {
    if (
      candidate.kind !== "functionType" ||
      !candidate.typeParameters ||
      candidate.typeParameters.length === 0
    ) {
      continue;
    }

    if (candidate.parameters.length !== args.length) {
      continue;
    }

    if (
      candidate.parameters.some(
        (parameter) =>
          !parameter ||
          parameter.isRest ||
          parameter.isOptional ||
          parameter.initializer !== undefined
      )
    ) {
      continue;
    }

    const groupedIndices = new Map<string, number[]>();
    for (let index = 0; index < candidate.parameters.length; index += 1) {
      const parameterType = candidate.parameters[index]?.type;
      if (parameterType?.kind !== "typeParameterType") {
        continue;
      }
      const existing = groupedIndices.get(parameterType.name) ?? [];
      existing.push(index);
      groupedIndices.set(parameterType.name, existing);
    }

    for (const indices of groupedIndices.values()) {
      if (!indices.includes(argIndex) || indices.length < 2) {
        continue;
      }

      const hasBroadObjectPeer = indices.some(
        (index) =>
          index !== argIndex &&
          isBroadObjectSlotType(actualArgumentTypes[index], context)
      );
      if (hasBroadObjectPeer) {
        return broadObjectIrType;
      }
    }
  }

  return undefined;
};

const adaptFunctionArgumentAst = (
  expr: Extract<IrExpression, { kind: "call" }>,
  arg: IrExpression,
  argIndex: number,
  argAst: CSharpExpressionAst,
  expectedType: IrType | undefined,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  const expectedFunctionType = resolveExpectedFunctionTypeForArgument(
    expr,
    argIndex,
    expectedType,
    context
  );
  const actualFunctionType = resolveActualFunctionTypeForArgument(arg, context);

  if (
    !expectedFunctionType ||
    !actualFunctionType ||
    !requiresDelegateArityAdaptation(actualFunctionType, expectedFunctionType)
  ) {
    return [argAst, context];
  }

  if (argAst.kind === "lambdaExpression") {
    return adaptLambdaArgumentAst(argAst, expectedFunctionType, context);
  }

  return wrapFunctionValueArgumentAst(
    argAst,
    actualFunctionType,
    expectedFunctionType,
    context
  );
};

const emitFunctionValueCallArguments = (
  args: readonly IrExpression[],
  signature: Extract<IrType, { kind: "functionType" }>,
  expr: Extract<IrExpression, { kind: "call" }>,
  context: EmitterContext
): [readonly CSharpExpressionAst[], EmitterContext] => {
  let currentContext = context;
  const argAsts: CSharpExpressionAst[] = [];
  const parameters = signature.parameters;
  const runtimeOmittableCallArities = (() => {
    if (expr.callee.kind === "identifier") {
      const importBinding = context.importBindings?.get(expr.callee.name);
      if (importBinding?.kind === "value") {
        return new Set(importBinding.runtimeOmittableCallArities ?? []);
      }
      return undefined;
    }

    if (
      expr.callee.kind === "memberAccess" &&
      expr.callee.object.kind === "identifier" &&
      !expr.callee.isComputed &&
      typeof expr.callee.property === "string"
    ) {
      const importBinding = context.importBindings?.get(
        expr.callee.object.name
      );
      if (importBinding?.kind === "namespace") {
        return new Set(
          importBinding.memberCallArities?.get(expr.callee.property) ?? []
        );
      }
    }

    return undefined;
  })();
  const providedArgumentCount = args.length;
  const runtimeSurfaceParameterTypes = getRuntimeSurfaceParameterTypes(
    expr,
    signature.parameters.map((parameter) => parameter?.type)
  );

  for (let i = 0; i < parameters.length; i++) {
    const parameter = parameters[i];
    if (!parameter) continue;

    if (parameter.isRest) {
      const tupleRestResult = tryEmitTupleRestArguments(
        args,
        i,
        parameter.type,
        currentContext
      );
      if (tupleRestResult) {
        const [tupleArgs, tupleContext] = tupleRestResult;
        argAsts.push(...tupleArgs);
        currentContext = tupleContext;
        break;
      }

      const spreadArg = args[i];
      if (args.length === i + 1 && spreadArg && spreadArg.kind === "spread") {
        const transparentPassthrough =
          getTransparentRestSpreadPassthroughExpression(
            spreadArg,
            parameter.type,
            currentContext
          );
        const passthroughContext: EmitterContext = {
          ...currentContext,
          localSemanticTypes: undefined,
          localValueTypes: undefined,
        };
        const [spreadAst, spreadCtx] = emitExpressionAst(
          transparentPassthrough ?? spreadArg.expression,
          transparentPassthrough ? passthroughContext : currentContext,
          transparentPassthrough ? undefined : parameter.type
        );
        argAsts.push(spreadAst);
        currentContext = spreadCtx;
        break;
      }

      const restElementType =
        getArrayLikeElementType(parameter.type, currentContext) ??
        parameter.type;
      if (!restElementType) {
        throw new Error(
          "Internal Compiler Error: function-value rest parameter reached emission without an element type."
        );
      }
      let elementTypeAst: CSharpTypeAst = {
        kind: "predefinedType",
        keyword: "object",
      };
      const [emittedType, typeCtx] = emitTypeAst(
        restElementType,
        currentContext
      );
      elementTypeAst = emittedType;
      currentContext = typeCtx;

      const restArgs = args
        .slice(i)
        .filter((arg): arg is IrExpression => !!arg);
      if (restArgs.some((arg) => arg.kind === "spread")) {
        const restArrayType = parameter.type;
        if (!restArrayType) {
          throw new Error(
            "Internal Compiler Error: function-value rest parameter reached emission without an array type."
          );
        }
        const [flattenedRestArgs, flattenedContext] =
          emitFlattenedRestArguments(
            restArgs,
            restArrayType,
            restElementType,
            currentContext
          );
        argAsts.push(...flattenedRestArgs);
        currentContext = flattenedContext;
        break;
      }

      const restItems: CSharpExpressionAst[] = [];
      for (const arg of restArgs) {
        const [argAst, argCtx] = emitExpressionAst(
          arg,
          currentContext,
          restElementType
        );
        restItems.push(argAst);
        currentContext = argCtx;
      }

      argAsts.push({
        kind: "arrayCreationExpression",
        elementType: elementTypeAst,
        initializer: restItems,
      });
      break;
    }

    const arg = args[i];
    if (arg) {
      const passingMode = expr.argumentPassing?.[i];
      if (passingMode === "out" && !isLValue(arg)) {
        const [discardAst, discardCtx] = emitOutDiscardArgument(currentContext);
        argAsts.push(discardAst);
        currentContext = discardCtx;
        continue;
      }
      const surfaceParameterType = runtimeSurfaceParameterTypes[i];
      const selectedParameterType =
        expr.parameterTypes?.[i] ?? surfaceParameterType ?? parameter?.type;
      const runtimeParameterType = getAcceptedParameterType(
        selectedParameterType,
        !!parameter?.isOptional
      );
      const selectedExpectedType =
        selectedParameterType === undefined
          ? undefined
          : resolveCallArgumentExpectedType(
              expr,
              arg,
              i,
              selectedParameterType,
              currentContext
            );
      const runtimeExpectedType =
        runtimeParameterType === undefined
          ? undefined
          : normalizeCallArgumentExpectedType(
              runtimeParameterType,
              arg,
              currentContext
            );
      const preEmitActualArgumentType =
        resolveActualFunctionTypeForArgument(arg, currentContext) ??
        resolveEffectiveExpressionType(arg, currentContext) ??
        arg.inferredType;
      const preEmitStorageAwareArgumentType =
        resolvePreEmitStorageAwareArgumentType(
          arg,
          preEmitActualArgumentType,
          currentContext
        );
      const contextualExpectedType = resolveContextualCallArgumentExpectedType(
        arg,
        selectedExpectedType,
        runtimeExpectedType,
        preEmitStorageAwareArgumentType,
        currentContext
      );
      const preserveOptionalSurfaceCarrierPassThrough =
        shouldPreserveOptionalSurfaceCarrierPassThrough({
          arg,
          selectedExpectedType,
          surfaceExpectedType: surfaceParameterType,
          context: currentContext,
        });
      const explicitNullishSurfaceExpectedType =
        resolveExplicitNullishSurfaceExpectedType({
          arg,
          surfaceExpectedType: surfaceParameterType,
        });
      const preservedSurfaceRuntimeType =
        preserveOptionalSurfaceCarrierPassThrough
          ? surfaceParameterType
          : shouldPreserveSurfaceRuntimeExpectedType({
                selectedExpectedType,
                surfaceExpectedType: surfaceParameterType,
                context: currentContext,
              })
            ? surfaceParameterType
            : undefined;
      const finalExpectedType =
        explicitNullishSurfaceExpectedType ??
        preservedSurfaceRuntimeType ??
        resolveFinalCallArgumentExpectedType(
          selectedExpectedType,
          runtimeExpectedType,
          preEmitStorageAwareArgumentType,
          currentContext
        ) ??
        runtimeExpectedType ??
        contextualExpectedType;
      const adaptationExpectedType = resolveAdaptationExpectedType(
        selectedExpectedType,
        finalExpectedType,
        surfaceParameterType,
        currentContext
      );
      const selectedSourceMemberNs = resolveSelectedSourceMemberNs(
        arg,
        selectedExpectedType,
        finalExpectedType,
        surfaceParameterType,
        currentContext
      );
      const rawEmitExpectedTypeCandidate =
        explicitNullishSurfaceExpectedType ??
        (shouldPreserveOptionalSurfaceRawEmission({
          arg,
          selectedExpectedType,
          surfaceExpectedType: surfaceParameterType,
          context: currentContext,
        })
          ? surfaceParameterType
          : shouldUseSurfaceCarrierForRawEmission({
                arg,
                adaptationExpectedType,
                surfaceExpectedType: surfaceParameterType,
                context: currentContext,
              })
            ? surfaceParameterType
            : resolveCarrierPreservingRawExpectedType({
                expr: arg,
                selectedExpectedType,
                contextualExpectedType,
                surfaceExpectedType: surfaceParameterType,
                finalExpectedType: adaptationExpectedType,
                context: currentContext,
              }));
      const rawEmitExpectedType =
        shouldDeferStructuralObjectArgumentMaterialization({
          arg,
          rawExpectedType: rawEmitExpectedTypeCandidate,
          context: currentContext,
        })
          ? undefined
          : rawEmitExpectedTypeCandidate;
      const carrierPassThroughArgument = tryEmitCarrierPreservingExpressionAst({
        expr: arg,
        expectedType: adaptationExpectedType,
        context: currentContext,
      });
      const selectedCarrierSourceArgument =
        tryEmitSelectedRuntimeCarrierSourceAst({
          arg,
          expectedType: adaptationExpectedType,
          selectedSourceMemberNs,
          context: currentContext,
        });
      const concreteArrayLiteralRawExpectedType =
        arg.kind === "array"
          ? resolveConcreteArrayLiteralContextType(
              rawEmitExpectedType ??
                adaptationExpectedType ??
                finalExpectedType ??
                contextualExpectedType ??
                selectedExpectedType ??
                surfaceParameterType,
              currentContext,
              arg.elements.length === 0
            )
          : undefined;
      const [rawArgAst, rawArgCtx] = carrierPassThroughArgument
        ? [carrierPassThroughArgument.ast, carrierPassThroughArgument.context]
        : selectedCarrierSourceArgument
          ? [
              selectedCarrierSourceArgument.ast,
              selectedCarrierSourceArgument.context,
            ]
        : emitExpressionAst(
            arg,
            currentContext,
            concreteArrayLiteralRawExpectedType ?? rawEmitExpectedType
          );
      const carrierPassThroughType = resolveCarrierPassThroughArgumentType(
        arg,
        rawArgAst,
        adaptationExpectedType,
        rawArgCtx
      );
      const directStorageArgumentType =
        resolveDirectStorageCompatibleExpressionType({
          expr: arg,
          valueAst: rawArgAst,
          context: rawArgCtx,
        });
      const exactFinalExpectedArgumentType =
        resolveExactRawEmittedExpectedType({
          arg,
          rawArgAst,
          rawEmitExpectedType,
          adaptationExpectedType,
          context: rawArgCtx,
        }) ??
        resolveContextualAdaptedArgumentType(
          rawArgAst,
          adaptationExpectedType,
          rawArgCtx
        );
      const contextualAdaptedActualType = resolveContextualAdaptedArgumentType(
        rawArgAst,
        contextualExpectedType,
        rawArgCtx
      );
      const postEmitEffectiveArgumentType = resolveEffectiveExpressionType(
        arg,
        rawArgCtx
      );
      const effectiveArgumentType =
        postEmitEffectiveArgumentType ?? preEmitActualArgumentType;
      const actualArgumentType =
        carrierPassThroughArgument?.actualType ??
        selectedCarrierSourceArgument?.actualType ??
        selectAdaptationActualArgumentType({
          carrierPassThroughType,
          exactFinalExpectedArgumentType,
          directStorageArgumentType,
          contextualAdaptedActualType,
          resolvedFunctionArgumentType: resolveActualFunctionTypeForArgument(
            arg,
            rawArgCtx
          ),
          effectiveArgumentType,
          inferredArgumentType: arg.inferredType,
          selectedSourceMemberNs,
          context: rawArgCtx,
        });
      const materializationActualArgumentType =
        selectCollectionMaterializationActualArgumentType({
          arg,
          preferredSourceType: preEmitActualArgumentType,
          selectedActualType: actualArgumentType,
          expectedType: adaptationExpectedType,
          context: rawArgCtx,
        });
      const skipRuntimeUnionArgumentMaterialization =
        shouldSkipRuntimeUnionArgumentMaterialization({
          carrierPassThroughArgumentType: carrierPassThroughArgument?.actualType,
          carrierPassThroughType,
          exactFinalExpectedArgumentType,
          materializationActualArgumentType,
          adaptationExpectedType,
          context: rawArgCtx,
        });
      const [materializedArgAst, materializedArgCtx] =
        skipRuntimeUnionArgumentMaterialization
          ? [rawArgAst, rawArgCtx]
          : (adaptValueToExpectedTypeAst({
              valueAst: rawArgAst,
              actualType: materializationActualArgumentType,
              context: rawArgCtx,
              expectedType: adaptationExpectedType,
              selectedSourceMemberNs,
            }) ?? [rawArgAst, rawArgCtx]);
      const numericActualArgumentType =
        selectPostMaterializationNumericCastArgumentType({
          rawArgAst,
          materializedArgAst,
          carrierPassThroughArgumentType:
            carrierPassThroughArgument?.actualType,
          carrierPassThroughType,
          exactFinalExpectedArgumentType,
          adaptationExpectedType,
          fallbackCandidates: [
            actualArgumentType,
            materializationActualArgumentType,
            preEmitStorageAwareArgumentType,
            effectiveArgumentType,
            preEmitActualArgumentType,
            arg.inferredType,
          ],
          context: materializedArgCtx,
        });
      const numericExpectedArgumentType = selectNumericCastExpectedType(
        [
          finalExpectedType,
          adaptationExpectedType,
          contextualExpectedType,
          selectedExpectedType,
        ],
        materializedArgCtx,
        numericActualArgumentType
      );
      const [numericMaterializedArgAst, numericMaterializedArgCtx] =
        maybeCastNumericToExpectedIntegralAst(
          materializedArgAst,
          numericActualArgumentType,
          materializedArgCtx,
          numericExpectedArgumentType
        );
      const [jsNumberMaterializedArgAst, jsNumberMaterializedArgCtx] =
        maybeCastNumericToExpectedJsNumberAst(
          numericMaterializedArgAst,
          numericActualArgumentType,
          numericMaterializedArgCtx,
          numericExpectedArgumentType
        );
      const [argAst, argCtx] = adaptFunctionArgumentAst(
        expr,
        arg,
        i,
        jsNumberMaterializedArgAst,
        finalExpectedType,
        jsNumberMaterializedArgCtx
      );
      const modifier =
        passingMode && passingMode !== "value" && isLValue(arg)
          ? passingMode
          : undefined;
      argAsts.push(wrapArgModifier(modifier, argAst));
      currentContext = argCtx;
      continue;
    }

    if (runtimeOmittableCallArities?.has(providedArgumentCount)) {
      return [argAsts, currentContext];
    }

    if (parameter.initializer) {
      const [defaultAst, defaultCtx] = emitExpressionAst(
        parameter.initializer,
        currentContext,
        parameter.type
      );
      argAsts.push(defaultAst);
      currentContext = defaultCtx;
      continue;
    }

    if (parameter.isOptional) {
      let defaultType: CSharpTypeAst | undefined;
      if (parameter.type) {
        const [emittedType, typeCtx] = emitTypeAst(
          parameter.type,
          currentContext
        );
        currentContext = typeCtx;
        defaultType = parameter.isOptional
          ? emittedType.kind === "nullableType"
            ? emittedType
            : { kind: "nullableType", underlyingType: emittedType }
          : emittedType;
      }
      argAsts.push({ kind: "defaultExpression", type: defaultType });
    }
  }

  return [argAsts, currentContext];
};

const extractTupleRestCandidates = (
  type: IrType | undefined
): readonly (readonly IrType[])[] | undefined => {
  if (!type) return undefined;
  if (type.kind === "tupleType") {
    return [type.elementTypes];
  }
  if (type.kind !== "unionType") {
    return undefined;
  }
  const candidates: (readonly IrType[])[] = [];
  for (const member of type.types) {
    if (!member || member.kind !== "tupleType") {
      return undefined;
    }
    candidates.push(member.elementTypes);
  }
  return candidates;
};

const tryEmitTupleRestArguments = (
  args: readonly (
    | IrExpression
    | { kind: "spread"; expression: IrExpression }
  )[],
  startIndex: number,
  parameterType: IrType | undefined,
  context: EmitterContext
): [readonly CSharpExpressionAst[], EmitterContext] | undefined => {
  const remainingArgs = args.slice(startIndex);
  if (remainingArgs.some((arg) => arg?.kind === "spread")) {
    return undefined;
  }

  const tupleCandidates = extractTupleRestCandidates(parameterType);
  if (!tupleCandidates || tupleCandidates.length === 0) {
    return undefined;
  }

  const matchingCandidates = tupleCandidates.filter(
    (candidate) => candidate.length === remainingArgs.length
  );
  if (matchingCandidates.length !== 1) {
    return undefined;
  }

  const tupleElements = matchingCandidates[0] ?? [];
  const emittedArgs: CSharpExpressionAst[] = [];
  let tupleContext = context;

  for (let index = 0; index < remainingArgs.length; index++) {
    const arg = remainingArgs[index];
    const expectedType = tupleElements[index];
    if (!arg || arg.kind === "spread") continue;
    const [argAst, argContext] = emitExpressionAst(
      arg,
      tupleContext,
      expectedType
    );
    emittedArgs.push(argAst);
    tupleContext = argContext;
  }

  return [emittedArgs, tupleContext];
};

const selectDeterministicUnionParameterMember = (
  expectedType: IrType | undefined,
  arg: IrExpression,
  context: EmitterContext
): IrType | undefined => {
  if (!expectedType) {
    return expectedType;
  }

  const resolvedExpected = resolveTypeAlias(
    stripNullish(expectedType),
    context
  );
  if (resolvedExpected.kind !== "unionType") {
    return expectedType;
  }

  const actualType =
    (arg.kind === "identifier"
      ? context.localValueTypes?.get(arg.name)
      : undefined) ??
    resolveEffectiveExpressionType(arg, context) ??
    arg.inferredType;
  if (!actualType) {
    return expectedType;
  }

  const expectedNullishSplit = splitRuntimeNullishUnionMembers(expectedType);
  const actualIsExplicitRuntimeNullish =
    actualType.kind === "primitiveType" &&
    (actualType.name === "undefined" || actualType.name === "null");
  if (
    expectedNullishSplit?.hasRuntimeNullish &&
    actualIsExplicitRuntimeNullish &&
    expectedNullishSplit.nonNullishMembers.length > 0
  ) {
    return expectedType;
  }

  const resolvedComparableActual = resolveComparableType(actualType, context);
  if (arg.kind === "array") {
    if (arg.elements.length === 0) {
      const emptyArrayMember = resolveConcreteArrayLiteralContextType(
        expectedType,
        context,
        true
      );
      if (emptyArrayMember) {
        return emptyArrayMember;
      }
    }

    const arrayLiteralMembers = resolvedExpected.types.filter((member) =>
      unionMemberAcceptsArrayLiteral(member, context)
    );
    const concreteArrayLiteralMembers = arrayLiteralMembers.filter(
      (member) => !!resolveConcreteArrayLiteralContextType(member, context)
    );
    if (concreteArrayLiteralMembers.length === 1) {
      return concreteArrayLiteralMembers[0];
    }
    if (arrayLiteralMembers.length === 1) {
      return arrayLiteralMembers[0];
    }
  }

  if (resolvedComparableActual.kind === "unionType") {
    return expectedType;
  }

  const matchingMembers = resolvedExpected.types.filter((member) => {
    return areIrTypesEquivalent(
      resolvedComparableActual,
      resolveComparableType(member, context),
      context
    );
  });

  if (matchingMembers.length === 1) {
    return matchingMembers[0];
  }

  const emissionMatchingMembers = resolvedExpected.types.filter((member) =>
    matchesExpectedEmissionType(actualType, member, context)
  );
  if (emissionMatchingMembers.length === 1) {
    return emissionMatchingMembers[0];
  }

  return expectedType;
};

const resolveCallArgumentExpectedType = (
  expr: Extract<IrExpression, { kind: "call" }>,
  arg: IrExpression,
  argIndex: number,
  parameterType: IrType | undefined,
  context: EmitterContext
): IrType | undefined => {
  const expectedType = normalizeCallArgumentExpectedType(
    parameterType,
    arg,
    context
  );
  const bindingExpectedType = (() => {
    const candidate = findMemberBindingExpectedType(expr, argIndex, context);
    return candidate
      ? normalizeCallArgumentExpectedType(candidate, arg, context)
      : undefined;
  })();

  const prefersBindingNumericType = (() => {
    if (!expectedType || !bindingExpectedType) {
      return false;
    }

    const resolvedExpected = resolveTypeAlias(
      stripNullish(expectedType),
      context
    );
    const resolvedBinding = resolveTypeAlias(
      stripNullish(bindingExpectedType),
      context
    );

    const isBroadNumber =
      resolvedExpected.kind === "primitiveType" &&
      resolvedExpected.name === "number";
    if (!isBroadNumber) {
      return false;
    }

    if (resolvedBinding.kind === "primitiveType") {
      return resolvedBinding.name === "int";
    }

    if (resolvedBinding.kind !== "referenceType") {
      return false;
    }

    return (
      resolvedBinding.name === "sbyte" ||
      resolvedBinding.name === "byte" ||
      resolvedBinding.name === "short" ||
      resolvedBinding.name === "ushort" ||
      resolvedBinding.name === "int" ||
      resolvedBinding.name === "uint" ||
      resolvedBinding.name === "long" ||
      resolvedBinding.name === "ulong" ||
      resolvedBinding.name === "SByte" ||
      resolvedBinding.name === "Byte" ||
      resolvedBinding.name === "Int16" ||
      resolvedBinding.name === "UInt16" ||
      resolvedBinding.name === "Int32" ||
      resolvedBinding.name === "UInt32" ||
      resolvedBinding.name === "Int64" ||
      resolvedBinding.name === "UInt64"
    );
  })();
  const narrowedExpectedType =
    !expectedType || prefersBindingNumericType
      ? (bindingExpectedType ?? expectedType)
      : expectedType;

  return selectDeterministicUnionParameterMember(
    narrowedExpectedType,
    arg,
    context
  );
};

const preservesSurfaceRuntimeMaterialization = (
  surfaceExpectedType: IrType | undefined,
  runtimeExpectedType: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!surfaceExpectedType || !runtimeExpectedType) {
    return true;
  }

  const surfaceHasRuntimeNullish =
    splitRuntimeNullishUnionMembers(surfaceExpectedType)?.hasRuntimeNullish ??
    false;
  const runtimeHasRuntimeNullish =
    splitRuntimeNullishUnionMembers(runtimeExpectedType)?.hasRuntimeNullish ??
    false;
  if (
    (surfaceHasRuntimeNullish ||
      willCarryAsRuntimeUnion(surfaceExpectedType, context)) &&
    !areIrTypesEquivalent(surfaceExpectedType, runtimeExpectedType, context)
  ) {
    return false;
  }

  if (runtimeHasRuntimeNullish && !surfaceHasRuntimeNullish) {
    return false;
  }

  return areIrTypesEquivalent(
    resolveRuntimeMaterializationTargetType(surfaceExpectedType, context),
    resolveRuntimeMaterializationTargetType(runtimeExpectedType, context),
    context
  );
};

/**
 * Emit call arguments as typed AST array.
 * Handles spread arrays, castModifier (ref/out from cast), and argumentPassing modes.
 */
const emitCallArguments = (
  args: readonly IrExpression[],
  expr: Extract<IrExpression, { kind: "call" }>,
  context: EmitterContext,
  parameterTypeOverrides?: readonly (IrType | undefined)[]
): [readonly CSharpExpressionAst[], EmitterContext] => {
  const functionValueSignature = getFunctionValueSignature(expr, context);
  const identifierImportBinding =
    expr.callee.kind === "identifier"
      ? context.importBindings?.get(expr.callee.name)
      : undefined;
  const memberObjectImportBinding =
    expr.callee.kind === "memberAccess" &&
    expr.callee.object.kind === "identifier"
      ? context.importBindings?.get(expr.callee.object.name)
      : undefined;
  const importedFunctionValueTarget =
    functionValueSignature &&
    ((expr.callee.kind === "identifier" &&
      identifierImportBinding?.kind === "value" &&
      (identifierImportBinding.valueKind === "variable" ||
        identifierImportBinding.moduleObject === true)) ||
      (expr.callee.kind === "memberAccess" &&
        !expr.callee.isComputed &&
        typeof expr.callee.property === "string" &&
        ((memberObjectImportBinding?.kind === "namespace" &&
          (memberObjectImportBinding.memberKinds?.get(expr.callee.property) ===
            "variable" ||
            memberObjectImportBinding.moduleObject === true)) ||
          (memberObjectImportBinding?.kind === "value" &&
            (memberObjectImportBinding.valueKind === "variable" ||
              memberObjectImportBinding.moduleObject === true)))));
  const directCallableTarget =
    (expr.callee.kind === "identifier" &&
      (context.importBindings?.get(expr.callee.name)?.kind === "value" ||
        context.valueSymbols?.get(expr.callee.name)?.kind === "function")) ||
    (expr.callee.kind === "memberAccess" &&
      !expr.callee.isComputed &&
      typeof expr.callee.property === "string");
  const localFunctionValueTarget =
    expr.callee.kind === "identifier" &&
    ((context.localSemanticTypes?.has(expr.callee.name) ?? false) ||
      (context.localValueTypes?.has(expr.callee.name) ?? false));
  const functionValueHasAuthoredCallSemantics =
    functionValueSignature?.parameters.some(
      (parameter) =>
        parameter?.isRest ||
        parameter?.isOptional ||
        parameter?.initializer !== undefined
    ) ?? false;
  const valueSymbolSignature =
    expr.callee.kind === "identifier"
      ? context.valueSymbols?.get(expr.callee.name)?.type
      : undefined;
  if (
    functionValueSignature &&
    functionValueHasAuthoredCallSemantics &&
    (localFunctionValueTarget ||
      !directCallableTarget ||
      importedFunctionValueTarget)
  ) {
    return emitFunctionValueCallArguments(
      args,
      functionValueSignature,
      expr,
      context
    );
  }

  const selectedParameterTypes =
    parameterTypeOverrides && parameterTypeOverrides.length > 0
      ? parameterTypeOverrides
      : expr.parameterTypes && expr.parameterTypes.length > 0
        ? expr.parameterTypes
        : expr.surfaceParameterTypes && expr.surfaceParameterTypes.length > 0
          ? expr.surfaceParameterTypes
          : ((
              functionValueSignature?.parameters ??
              valueSymbolSignature?.parameters
            )?.map((parameter) => parameter?.type) ?? []);
  const runtimeSurfaceParameterTypes =
    parameterTypeOverrides && parameterTypeOverrides.length > 0
      ? parameterTypeOverrides
      : getRuntimeSurfaceParameterTypes(expr, selectedParameterTypes);
  const runtimeParameterTypes =
    parameterTypeOverrides && parameterTypeOverrides.length > 0
      ? parameterTypeOverrides
      : selectedParameterTypes.map(
          (parameterType, index) =>
            runtimeSurfaceParameterTypes[index] ?? parameterType
        );
  const selectedRestParameter = expr.surfaceRestParameter ?? expr.restParameter;
  const runtimeRestParameter = getRuntimeRestParameter(expr);
  const transparentRestPassthroughExpression =
    runtimeRestParameter?.arrayType &&
    args.length === (runtimeRestParameter.index ?? 0) + 1
      ? getTransparentRestSpreadPassthroughExpression(
          args[runtimeRestParameter.index],
          runtimeRestParameter.arrayType,
          context
        )
      : undefined;
  const normalizedArgs = transparentRestPassthroughExpression
    ? args.map((arg, index) =>
        index === runtimeRestParameter?.index && arg?.kind === "spread"
          ? {
              kind: "spread" as const,
              expression: transparentRestPassthroughExpression,
              inferredType: transparentRestPassthroughExpression.inferredType,
            }
          : arg
      )
    : expandTupleLikeSpreadArguments(args);
  const restInfo:
    | {
        readonly index: number;
        readonly arrayType: IrType;
        readonly elementType: IrType;
      }
    | undefined =
    runtimeRestParameter?.arrayType &&
    runtimeRestParameter.elementType &&
    normalizedArgs
      .slice(runtimeRestParameter.index)
      .some((candidate) => candidate?.kind === "spread")
      ? {
          index: runtimeRestParameter.index,
          arrayType: runtimeRestParameter.arrayType,
          elementType: runtimeRestParameter.elementType,
        }
      : undefined;
  let currentContext = context;
  const argAsts: CSharpExpressionAst[] = [];

  if (runtimeRestParameter) {
    const tupleRestResult = tryEmitTupleRestArguments(
      normalizedArgs,
      runtimeRestParameter.index,
      runtimeRestParameter.arrayType,
      currentContext
    );
    if (tupleRestResult) {
      const [tupleArgs, tupleContext] = tupleRestResult;
      argAsts.push(...tupleArgs);
      return [argAsts, tupleContext];
    }
  }

  for (let i = 0; i < normalizedArgs.length; i++) {
    const arg = normalizedArgs[i];
    if (!arg) continue;

    if (
      restInfo &&
      i === restInfo.index &&
      normalizedArgs
        .slice(restInfo.index)
        .some((candidate) => candidate?.kind === "spread")
    ) {
      const [flattenedRestArgs, flattenedContext] = emitFlattenedRestArguments(
        normalizedArgs.slice(restInfo.index),
        restInfo.arrayType,
        restInfo.elementType,
        currentContext
      );
      argAsts.push(...flattenedRestArgs);
      currentContext = flattenedContext;
      break;
    }

    const selectedRestElementType =
      selectedRestParameter && i >= selectedRestParameter.index
        ? selectedRestParameter.elementType
        : undefined;
    const expectedType =
      selectedRestElementType ??
      (restInfo && i >= restInfo.index
        ? restInfo.elementType
        : resolveCallArgumentExpectedType(
            expr,
            arg,
            i,
            selectedParameterTypes[i],
            currentContext
          ));

    const runtimeRestElementType =
      runtimeRestParameter && i >= runtimeRestParameter.index
        ? runtimeRestParameter.elementType
        : undefined;
    const runtimeParameterType =
      runtimeRestElementType ?? runtimeParameterTypes[i];
    const genericBroadObjectFallbackType =
      resolveGenericBroadObjectFallbackExpectedType(
        expr,
        normalizedArgs,
        i,
        currentContext
      );
    const normalizedRuntime =
      runtimeParameterType === undefined
        ? undefined
        : normalizeCallArgumentExpectedType(
            runtimeParameterType,
            arg,
            currentContext
          );
    const preEmitActualArgumentType =
      resolveActualFunctionTypeForArgument(arg, currentContext) ??
      resolveEffectiveExpressionType(arg, currentContext) ??
      arg.inferredType;
    const preEmitStorageAwareArgumentType =
      resolvePreEmitStorageAwareArgumentType(
        arg,
        preEmitActualArgumentType,
        currentContext
      );
    const surfaceParameterType = runtimeSurfaceParameterTypes[i];
    const contextualExpectedType =
      genericBroadObjectFallbackType ??
      resolveContextualCallArgumentExpectedType(
        arg,
        expectedType,
        normalizedRuntime,
        preEmitStorageAwareArgumentType,
        currentContext
      );
    const preserveOptionalSurfaceCarrierPassThrough =
      shouldPreserveOptionalSurfaceCarrierPassThrough({
        arg,
        selectedExpectedType: expectedType,
        surfaceExpectedType: surfaceParameterType,
        context: currentContext,
      });
    const explicitNullishSurfaceExpectedType =
      resolveExplicitNullishSurfaceExpectedType({
        arg,
        surfaceExpectedType: surfaceParameterType,
      });
    const preservedSurfaceRuntimeType =
      preserveOptionalSurfaceCarrierPassThrough
        ? surfaceParameterType
        : shouldPreserveSurfaceRuntimeExpectedType({
              selectedExpectedType: expectedType,
              surfaceExpectedType: surfaceParameterType,
              context: currentContext,
            })
          ? surfaceParameterType
          : undefined;
    const finalExpectedType =
      explicitNullishSurfaceExpectedType ??
      genericBroadObjectFallbackType ??
      preservedSurfaceRuntimeType ??
      resolveFinalCallArgumentExpectedType(
        expectedType,
        normalizedRuntime,
        preEmitStorageAwareArgumentType,
        currentContext
      ) ??
      contextualExpectedType;
    const adaptationExpectedType = resolveAdaptationExpectedType(
      expectedType,
      finalExpectedType,
      surfaceParameterType,
      currentContext
    );
    const selectedSourceMemberNs = resolveSelectedSourceMemberNs(
      arg,
      expectedType,
      finalExpectedType,
      surfaceParameterType,
      currentContext
    );
    const rawEmitExpectedTypeCandidate =
      explicitNullishSurfaceExpectedType ??
      (shouldPreserveOptionalSurfaceRawEmission({
        arg,
        selectedExpectedType: expectedType,
        surfaceExpectedType: surfaceParameterType,
        context: currentContext,
      })
        ? surfaceParameterType
        : shouldUseSurfaceCarrierForRawEmission({
              arg,
              adaptationExpectedType,
              surfaceExpectedType: surfaceParameterType,
              context: currentContext,
            })
          ? surfaceParameterType
          : resolveCarrierPreservingRawExpectedType({
              expr: arg,
              selectedExpectedType: expectedType,
              contextualExpectedType,
              surfaceExpectedType: surfaceParameterType,
              finalExpectedType: adaptationExpectedType,
              context: currentContext,
            }));
    const rawEmitExpectedType =
      shouldDeferStructuralObjectArgumentMaterialization({
        arg,
        rawExpectedType: rawEmitExpectedTypeCandidate,
        context: currentContext,
      })
        ? undefined
        : rawEmitExpectedTypeCandidate;
    if (arg.kind === "spread") {
      const [spreadAst, ctx] = emitExpressionAst(
        arg.expression,
        currentContext
      );
      argAsts.push(spreadAst);
      currentContext = ctx;
    } else {
      const castModifier = getPassingModifierFromCast(arg);
      if (castModifier === "out" && !isLValue(arg)) {
        const [discardAst, discardCtx] = emitOutDiscardArgument(currentContext);
        argAsts.push(discardAst);
        currentContext = discardCtx;
        continue;
      }
      if (castModifier && isLValue(arg)) {
        const [argAst, ctx] = emitExpressionAst(arg, currentContext);
        argAsts.push(wrapArgModifier(castModifier, argAst));
        currentContext = ctx;
      } else {
        const passingMode = expr.argumentPassing?.[i];
        if (passingMode === "out" && !isLValue(arg)) {
          const [discardAst, discardCtx] =
            emitOutDiscardArgument(currentContext);
          argAsts.push(discardAst);
          currentContext = discardCtx;
          continue;
        }
        const preEmitEffectiveArgumentType =
          resolveEffectiveExpressionType(arg, currentContext) ??
          arg.inferredType;
        const carrierPassThroughArgument =
          tryEmitCarrierPreservingExpressionAst({
            expr: arg,
            expectedType: adaptationExpectedType,
            context: currentContext,
          });
        const selectedCarrierSourceArgument =
          tryEmitSelectedRuntimeCarrierSourceAst({
            arg,
            expectedType: adaptationExpectedType,
            selectedSourceMemberNs,
            context: currentContext,
          });
        const concreteArrayLiteralRawExpectedType =
          arg.kind === "array"
            ? resolveConcreteArrayLiteralContextType(
                rawEmitExpectedType ??
                  adaptationExpectedType ??
                  finalExpectedType ??
                  contextualExpectedType ??
                  expectedType ??
                  surfaceParameterType,
                currentContext,
                arg.elements.length === 0
              )
            : undefined;
        const [rawArgAst, emittedContext] = carrierPassThroughArgument
          ? [carrierPassThroughArgument.ast, carrierPassThroughArgument.context]
          : selectedCarrierSourceArgument
            ? [
                selectedCarrierSourceArgument.ast,
                selectedCarrierSourceArgument.context,
              ]
          : emitExpressionAst(
              arg,
              currentContext,
              concreteArrayLiteralRawExpectedType ?? rawEmitExpectedType
            );
        const carrierPassThroughType = resolveCarrierPassThroughArgumentType(
          arg,
          rawArgAst,
          adaptationExpectedType,
          emittedContext
        );
        const directStorageArgumentType =
          resolveDirectStorageCompatibleExpressionType({
            expr: arg,
            valueAst: rawArgAst,
            context: emittedContext,
          });
        const exactFinalExpectedArgumentType =
          resolveExactRawEmittedExpectedType({
            arg,
            rawArgAst,
            rawEmitExpectedType,
            adaptationExpectedType,
            context: emittedContext,
          }) ??
          resolveContextualAdaptedArgumentType(
            rawArgAst,
            adaptationExpectedType,
            emittedContext
          );
        const contextualAdaptedActualType =
          resolveContextualAdaptedArgumentType(
            rawArgAst,
            contextualExpectedType,
            emittedContext
          );
        const postEmitEffectiveArgumentType = resolveEffectiveExpressionType(
          arg,
          emittedContext
        );
        const effectiveArgumentType =
          postEmitEffectiveArgumentType ?? preEmitEffectiveArgumentType;
        const actualArgumentType =
          carrierPassThroughArgument?.actualType ??
          selectedCarrierSourceArgument?.actualType ??
          selectAdaptationActualArgumentType({
            carrierPassThroughType,
            exactFinalExpectedArgumentType,
            directStorageArgumentType,
            contextualAdaptedActualType,
            resolvedFunctionArgumentType: resolveActualFunctionTypeForArgument(
              arg,
              emittedContext
            ),
            effectiveArgumentType,
            inferredArgumentType: arg.inferredType,
            selectedSourceMemberNs,
            context: emittedContext,
          });
        const materializationActualArgumentType =
          selectCollectionMaterializationActualArgumentType({
            arg,
            preferredSourceType: preEmitEffectiveArgumentType,
            selectedActualType: actualArgumentType,
            expectedType: adaptationExpectedType,
            context: emittedContext,
          });
        const skipRuntimeUnionArgumentMaterialization =
          shouldSkipRuntimeUnionArgumentMaterialization({
            carrierPassThroughArgumentType:
            carrierPassThroughArgument?.actualType,
            carrierPassThroughType,
            exactFinalExpectedArgumentType,
            materializationActualArgumentType,
            adaptationExpectedType,
            context: emittedContext,
          });
        const [materializedArgAst, materializedContext] =
          skipRuntimeUnionArgumentMaterialization
            ? [rawArgAst, emittedContext]
            : (adaptValueToExpectedTypeAst({
                valueAst: rawArgAst,
                actualType: materializationActualArgumentType,
                context: emittedContext,
                expectedType: adaptationExpectedType,
                selectedSourceMemberNs,
              }) ?? [rawArgAst, emittedContext]);
        const numericActualArgumentType =
          selectPostMaterializationNumericCastArgumentType({
            rawArgAst,
            materializedArgAst,
            carrierPassThroughArgumentType:
              carrierPassThroughArgument?.actualType,
            carrierPassThroughType,
            exactFinalExpectedArgumentType,
            adaptationExpectedType,
            fallbackCandidates: [
              actualArgumentType,
              materializationActualArgumentType,
              preEmitStorageAwareArgumentType,
              effectiveArgumentType,
              preEmitEffectiveArgumentType,
              arg.inferredType,
            ],
            context: materializedContext,
          });
        const numericExpectedArgumentType = selectNumericCastExpectedType(
          [
            finalExpectedType,
            adaptationExpectedType,
            contextualExpectedType,
            expectedType,
          ],
          materializedContext,
          numericActualArgumentType
        );
        const [numericMaterializedArgAst, numericMaterializedContext] =
          maybeCastNumericToExpectedIntegralAst(
            materializedArgAst,
            numericActualArgumentType,
            materializedContext,
            numericExpectedArgumentType
          );
        const [jsNumberMaterializedArgAst, jsNumberMaterializedContext] =
          maybeCastNumericToExpectedJsNumberAst(
            numericMaterializedArgAst,
            numericActualArgumentType,
            numericMaterializedContext,
            numericExpectedArgumentType
          );
        const [adaptedArgAst, ctx] = adaptFunctionArgumentAst(
          expr,
          arg,
          i,
          jsNumberMaterializedArgAst,
          finalExpectedType,
          jsNumberMaterializedContext
        );
        const modifier =
          passingMode && passingMode !== "value" && isLValue(arg)
            ? passingMode
            : undefined;
        argAsts.push(wrapArgModifier(modifier, adaptedArgAst));
        currentContext = ctx;
      }
    }
  }

  return [argAsts, currentContext];
};

export { emitCallArguments };
