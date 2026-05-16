/**
 * Runtime-union conversion orchestration and dictionary adaptation helpers.
 * Handles the main runtime-union adaptation entry point and dictionary
 * union-value lifting.
 */

import { type IrExpression, type IrType } from "@tsonic/frontend";
import type { EmitterContext } from "../types.js";
import { emitTypeAst } from "../type-emitter.js";
import {
  buildRuntimeUnionLayout,
  buildRuntimeUnionTypeAst,
  findExactRuntimeUnionMemberIndices,
  findRuntimeUnionAssignableMemberIndices,
  findRuntimeUnionMemberIndices,
  findRuntimeUnionMemberIndex,
} from "../core/semantic/runtime-unions.js";
import { runtimeUnionMemberCanAcceptValue } from "../core/semantic/runtime-union-matching.js";
import {
  tryBuildRuntimeMaterializationAst,
  tryBuildRuntimeReificationPlan,
} from "../core/semantic/runtime-reification.js";
import { resolveEmittableMaterializationType } from "../core/semantic/materialized-narrowing.js";
import { resolveEffectiveExpressionType } from "../core/semantic/narrowed-expression-types.js";
import { tryResolveRuntimeUnionMemberType } from "../core/semantic/narrowed-expression-types.js";
import { buildRuntimeUnionFactoryCallAst } from "../core/semantic/runtime-union-projection.js";
import {
  resolveComparableType,
  unwrapComparableType,
} from "../core/semantic/comparable-types.js";
import {
  resolveDirectRuntimeCarrierType,
  resolveDirectValueSurfaceType,
} from "../core/semantic/direct-value-surfaces.js";
import { areIrTypesEquivalent } from "../core/semantic/type-equivalence.js";
import { matchesExpectedEmissionType } from "../core/semantic/expected-type-matching.js";
import { isBroadObjectSlotType } from "../core/semantic/broad-object-types.js";
import {
  isDefinitelyValueType,
  resolveStructuralReferenceType,
  splitRuntimeNullishUnionMembers,
  stripNullish,
} from "../core/semantic/type-resolution.js";
import type {
  CSharpExpressionAst,
  CSharpTypeAst,
} from "../core/format/backend-ast/types.js";
import {
  getIdentifierTypeName,
  stableTypeKeyFromAst,
  stripNullableTypeAst,
  sameTypeAstSurface,
} from "../core/format/backend-ast/utils.js";
import {
  identifierExpression,
  identifierType,
  nullLiteral,
} from "../core/format/backend-ast/builders.js";
import {
  collectStructuralProperties,
  tryAdaptStructuralExpressionAst,
} from "./structural-adaptation.js";
import {
  isExactExpressionToType,
  isExactArrayCreationToType,
  isExactNullableValueAccessToType,
  tryEmitExactComparisonTargetAst,
  canUseImplicitOptionalSurfaceConversion,
} from "./exact-comparison.js";
import {
  isNumericSourceIrType,
  maybeCastNumericToExpectedIntegralAst,
} from "./post-emission-adaptation.js";
import {
  maybeWidenRuntimeUnionExpressionAst,
  maybeProjectRuntimeUnionMemberExpressionAst,
} from "./runtime-union-adaptation-projection.js";
import { resolveAnonymousStructuralReferenceType } from "./structural-anonymous-targets.js";
import { willCarryAsRuntimeUnion } from "../core/semantic/union-semantics.js";
import { resolveDirectStorageCompatibleExpressionType } from "./expected-type-adaptation.js";
import { getContextualTypeVisitKey } from "../core/semantic/deterministic-type-keys.js";
import { rebuildUnionTypePreservingCarrierFamily } from "../core/semantic/runtime-union-family-preservation.js";
import {
  getRuntimeUnionAliasReferenceKey,
  runtimeUnionAliasReferencesMatch,
} from "../core/semantic/runtime-union-alias-identity.js";
import { referenceTypesShareClrIdentity } from "../core/semantic/clr-type-identity.js";
import { tryAdaptAwaitableValueAst } from "./awaitable-adaptation.js";

const normalizeRuntimeUnionEmissionType = (
  type: IrType,
  context: EmitterContext
): IrType => {
  const cache = new Map<IrType, IrType>();
  const active = new Set<IrType>();

  const normalize = (current: IrType): IrType => {
    const cached = cache.get(current);
    if (cached) {
      return cached;
    }
    if (active.has(current)) {
      return current;
    }

    if (current.kind !== "referenceType") {
      const anonymousReference = resolveAnonymousStructuralReferenceType(
        current,
        context
      );
      if (anonymousReference) {
        cache.set(current, anonymousReference);
        return anonymousReference;
      }
    }

    const structuralReference = resolveStructuralReferenceType(
      current,
      context
    );
    if (structuralReference) {
      cache.set(current, structuralReference);
      return structuralReference;
    }

    active.add(current);
    const normalized = (() => {
      switch (current.kind) {
        case "arrayType": {
          const elementType = normalize(current.elementType);
          const tuplePrefixElementTypes =
            current.tuplePrefixElementTypes?.map(normalize);
          const tupleRestElementType = current.tupleRestElementType
            ? normalize(current.tupleRestElementType)
            : undefined;
          const changed =
            elementType !== current.elementType ||
            (!!tuplePrefixElementTypes &&
              tuplePrefixElementTypes.some(
                (member, index) =>
                  member !== current.tuplePrefixElementTypes?.[index]
              )) ||
            tupleRestElementType !== current.tupleRestElementType;
          return changed
            ? {
                ...current,
                elementType,
                ...(tuplePrefixElementTypes ? { tuplePrefixElementTypes } : {}),
                ...(tupleRestElementType ? { tupleRestElementType } : {}),
              }
            : current;
        }
        case "dictionaryType": {
          const keyType = normalize(current.keyType);
          const valueType = normalize(current.valueType);
          return keyType === current.keyType && valueType === current.valueType
            ? current
            : { ...current, keyType, valueType };
        }
        case "tupleType": {
          const elementTypes = current.elementTypes.map(normalize);
          return elementTypes.every(
            (member, index) => member === current.elementTypes[index]
          )
            ? current
            : { ...current, elementTypes };
        }
        case "functionType": {
          const parameters = current.parameters.map((parameter) =>
            parameter.type
              ? { ...parameter, type: normalize(parameter.type) }
              : parameter
          );
          const returnType = normalize(current.returnType);
          return returnType === current.returnType &&
            parameters.every(
              (parameter, index) => parameter === current.parameters[index]
            )
            ? current
            : { ...current, parameters, returnType };
        }
        case "objectType": {
          const members = current.members.map((member) => {
            if (member.kind === "propertySignature") {
              const memberType = normalize(member.type);
              return memberType === member.type
                ? member
                : { ...member, type: memberType };
            }

            const parameters = member.parameters.map((parameter) =>
              parameter.type
                ? { ...parameter, type: normalize(parameter.type) }
                : parameter
            );
            const returnType = member.returnType
              ? normalize(member.returnType)
              : undefined;
            return returnType === member.returnType &&
              parameters.every(
                (parameter, index) => parameter === member.parameters[index]
              )
              ? member
              : {
                  ...member,
                  parameters,
                  ...(returnType ? { returnType } : {}),
                };
          });
          return members.every(
            (member, index) => member === current.members[index]
          )
            ? current
            : { ...current, members };
        }
        case "unionType": {
          const types = current.types.map(normalize);
          return types.every((member, index) => member === current.types[index])
            ? current
            : rebuildUnionTypePreservingCarrierFamily(current, types);
        }
        case "intersectionType": {
          const types = current.types.map(normalize);
          return types.every((member, index) => member === current.types[index])
            ? current
            : { ...current, types };
        }
        case "referenceType": {
          const typeArguments = current.typeArguments?.map(normalize);
          return typeArguments &&
            typeArguments.some(
              (member, index) => member !== current.typeArguments?.[index]
            )
            ? { ...current, typeArguments }
            : current;
        }
        case "primitiveType":
        case "typeParameterType":
        case "literalType":
        case "anyType":
        case "unknownType":
        case "voidType":
        case "neverType":
          return current;
      }
    })();
    active.delete(current);
    cache.set(current, normalized);
    return normalized;
  };

  return normalize(type);
};

const isValueTypeStructuralObjectEmissionOnlyMatch = (
  actualType: IrType,
  memberType: IrType,
  context: EmitterContext
): boolean =>
  isDefinitelyValueType(actualType) &&
  resolveComparableType(memberType, context).kind === "objectType";

const structuralObjectEmissionCompatibility = (
  actualType: IrType,
  memberType: IrType,
  context: EmitterContext
): boolean | undefined => {
  const actualProps = collectStructuralProperties(actualType, context);
  const memberProps = collectStructuralProperties(memberType, context);
  if (!actualProps || !memberProps) {
    return undefined;
  }

  const actualPropByName = new Map(
    actualProps.map((prop) => [prop.name, prop])
  );
  for (const memberProp of memberProps) {
    const actualProp = actualPropByName.get(memberProp.name);
    if (!actualProp) {
      if (memberProp.isOptional) {
        continue;
      }
      return false;
    }

    if (!memberProp.isOptional && actualProp.isOptional) {
      return false;
    }

    if (
      !matchesExpectedEmissionType(actualProp.type, memberProp.type, context)
    ) {
      return false;
    }
  }

  return true;
};

const runtimeUnionMemberIsEmissionCompatible = (
  actualType: IrType,
  memberType: IrType,
  context: EmitterContext
): boolean => {
  if (!matchesExpectedEmissionType(actualType, memberType, context)) {
    return false;
  }

  if (
    isValueTypeStructuralObjectEmissionOnlyMatch(
      actualType,
      memberType,
      context
    )
  ) {
    return false;
  }

  return (
    structuralObjectEmissionCompatibility(actualType, memberType, context) !==
    false
  );
};

const isObjectLikeTypeAst = (type: CSharpTypeAst | undefined): boolean => {
  if (!type) return false;
  const concrete = stripNullableTypeAst(type);
  if (concrete.kind === "predefinedType") {
    return concrete.keyword === "object";
  }
  const name = getIdentifierTypeName(concrete);
  return (
    name === "object" ||
    name === "System.Object" ||
    name === "global::System.Object"
  );
};

const isBroadReificationSourceType = (
  type: IrType,
  context: EmitterContext
): boolean => isBroadObjectSlotType(type, context);

const canUseRuntimeUnionMemberCast = (
  actualType: IrType,
  context: EmitterContext
): boolean => {
  const comparableActual = resolveComparableType(actualType, context);
  return (
    comparableActual.kind === "anyType" ||
    comparableActual.kind === "unknownType" ||
    isBroadObjectSlotType(comparableActual, context)
  );
};

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

const isDoubleTypeAst = (typeAst: CSharpTypeAst): boolean => {
  const concreteTypeAst = stripNullableTypeAst(typeAst);
  if (concreteTypeAst.kind === "predefinedType") {
    return concreteTypeAst.keyword === "double";
  }

  const identifierName = getIdentifierTypeName(concreteTypeAst);
  return (
    identifierName === "double" ||
    identifierName === "System.Double" ||
    identifierName === "global::System.Double"
  );
};

const maybeCastNumericToExpectedJsNumberAst = (
  ast: CSharpExpressionAst,
  actualType: IrType,
  memberTypeAst: CSharpTypeAst,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] | undefined => {
  if (!isDoubleTypeAst(memberTypeAst)) {
    return undefined;
  }

  if (!isNumericSourceIrType(actualType, context)) {
    return undefined;
  }

  if (isNumericLiteralAst(ast)) {
    return undefined;
  }

  const concreteMemberTypeAst = stripNullableTypeAst(memberTypeAst);
  if (
    ast.kind === "castExpression" &&
    sameTypeAstSurface(ast.type, concreteMemberTypeAst)
  ) {
    return [ast, context];
  }

  return [
    {
      kind: "castExpression",
      type: concreteMemberTypeAst,
      expression: ast,
    },
    context,
  ];
};

const runtimeUnionCarrierSurfaceDiffers = (
  carrierType: IrType | undefined,
  expectedType: IrType,
  context: EmitterContext
): boolean => {
  if (!carrierType) {
    return false;
  }

  const [carrierLayout, carrierLayoutContext] = buildRuntimeUnionLayout(
    carrierType,
    context,
    emitTypeAst
  );
  const [expectedLayout] = buildRuntimeUnionLayout(
    expectedType,
    carrierLayoutContext,
    emitTypeAst
  );
  if (!carrierLayout || !expectedLayout) {
    return false;
  }

  return !sameTypeAstSurface(
    buildRuntimeUnionTypeAst(carrierLayout),
    buildRuntimeUnionTypeAst(expectedLayout)
  );
};

const unwrapComparableTypeForEmission = (
  type: IrType,
  context: EmitterContext
): IrType =>
  willCarryAsRuntimeUnion(type, context) ? type : unwrapComparableType(type);

const referenceTypesHaveSameNominalIdentity = (
  actualType: IrType,
  memberType: IrType,
  context: EmitterContext
): boolean => {
  const actual = stripNullish(actualType);
  const member = stripNullish(memberType);
  if (actual.kind !== "referenceType" || member.kind !== "referenceType") {
    return false;
  }

  if (!referenceTypesShareClrIdentity(actual, member)) {
    return false;
  }

  const actualArgs = actual.typeArguments ?? [];
  const memberArgs = member.typeArguments ?? [];
  return (
    actualArgs.length === memberArgs.length &&
    actualArgs.every((actualArg, index) => {
      const memberArg = memberArgs[index];
      return !!memberArg && areIrTypesEquivalent(actualArg, memberArg, context);
    })
  );
};

const tryAdaptRuntimeUnionMemberValueAst = (opts: {
  readonly ast: CSharpExpressionAst;
  readonly actualType: IrType;
  readonly memberType: IrType;
  readonly memberTypeAst: CSharpTypeAst;
  readonly context: EmitterContext;
  readonly visited: ReadonlySet<string>;
}): [CSharpExpressionAst, EmitterContext] | undefined => {
  const { ast, actualType, memberType, memberTypeAst, context, visited } = opts;
  const actualAliasKey = getRuntimeUnionAliasReferenceKey(actualType, context);
  if (
    actualAliasKey !== undefined &&
    !runtimeUnionAliasReferencesMatch(actualType, memberType, context)
  ) {
    return undefined;
  }

  const nestedRuntimeUnionAdaptation = maybeAdaptRuntimeUnionExpressionAst(
    ast,
    actualType,
    context,
    memberType,
    visited
  );
  if (nestedRuntimeUnionAdaptation) {
    return nestedRuntimeUnionAdaptation;
  }

  const exactActualSurface = (() => {
    try {
      return emitTypeAst(actualType, context);
    } catch {
      return undefined;
    }
  })();
  if (exactActualSurface) {
    const [actualTypeAst, actualTypeContext] = exactActualSurface;
    if (
      stableTypeKeyFromAst(stripNullableTypeAst(actualTypeAst)) ===
      stableTypeKeyFromAst(stripNullableTypeAst(memberTypeAst))
    ) {
      return [ast, actualTypeContext];
    }
  }

  if (referenceTypesHaveSameNominalIdentity(actualType, memberType, context)) {
    return [ast, context];
  }

  const awaitableAdaptation = tryAdaptAwaitableValueAst({
    ast,
    actualType,
    expectedType: memberType,
    expectedTypeAst: memberTypeAst,
    context,
    visited,
    adaptAwaitedValueAst: maybeAdaptRuntimeUnionExpressionAst,
  });
  if (awaitableAdaptation) {
    return awaitableAdaptation;
  }

  const upcastWithVisited = (
    nestedAst: CSharpExpressionAst,
    nestedActualType: IrType | undefined,
    nestedContext: EmitterContext,
    nestedExpectedType: IrType | undefined,
    nestedVisited?: ReadonlySet<string>
  ): [CSharpExpressionAst, EmitterContext] | undefined =>
    maybeAdaptRuntimeUnionExpressionAst(
      nestedAst,
      nestedActualType,
      nestedContext,
      nestedExpectedType,
      nestedVisited && nestedVisited.size > 0
        ? new Set([...visited, ...nestedVisited])
        : visited
    );

  const structuralAdaptation = tryAdaptStructuralExpressionAst(
    ast,
    actualType,
    context,
    memberType,
    upcastWithVisited
  );
  if (structuralAdaptation) {
    return structuralAdaptation;
  }

  const [numericAdjustedAst, numericAdjustedContext] =
    maybeCastNumericToExpectedIntegralAst(ast, actualType, context, memberType);
  if (numericAdjustedAst !== ast) {
    return [numericAdjustedAst, numericAdjustedContext];
  }

  const numericJsNumberAdjusted = maybeCastNumericToExpectedJsNumberAst(
    ast,
    actualType,
    memberTypeAst,
    context
  );
  if (numericJsNumberAdjusted) {
    return numericJsNumberAdjusted;
  }

  if (
    isExactExpressionToType(ast, stripNullableTypeAst(memberTypeAst)) ||
    isExactArrayCreationToType(ast, memberTypeAst)
  ) {
    return [ast, context];
  }

  const emittableActualType = resolveEmittableMaterializationType(
    actualType,
    context
  );

  const memberEmissionCompatible = runtimeUnionMemberIsEmissionCompatible(
    emittableActualType,
    memberType,
    context
  );
  if (!memberEmissionCompatible) {
    if (canUseRuntimeUnionMemberCast(actualType, context)) {
      return [
        {
          kind: "castExpression",
          type: memberTypeAst,
          expression: ast,
        },
        context,
      ];
    }
    return undefined;
  }

  if (
    resolveComparableType(emittableActualType, context).kind === "objectType"
  ) {
    return undefined;
  }

  const [emittableActualTypeAst, emittableActualTypeContext] = emitTypeAst(
    emittableActualType,
    context
  );
  const emittableActualSurfaceMatches =
    stableTypeKeyFromAst(stripNullableTypeAst(emittableActualTypeAst)) ===
    stableTypeKeyFromAst(stripNullableTypeAst(memberTypeAst));
  if (emittableActualSurfaceMatches) {
    return [ast, emittableActualTypeContext];
  }

  if (memberEmissionCompatible) {
    return [ast, context];
  }

  if (canUseRuntimeUnionMemberCast(actualType, context)) {
    return [
      {
        kind: "castExpression",
        type: memberTypeAst,
        expression: ast,
      },
      context,
    ];
  }

  return undefined;
};

const isBareTypeParameterLike = (
  type: IrType,
  context: EmitterContext
): boolean =>
  type.kind === "typeParameterType" ||
  (type.kind === "referenceType" &&
    (context.typeParameters?.has(type.name) ?? false) &&
    (!type.typeArguments || type.typeArguments.length === 0));

const buildTopLevelNullishConditionAst = (
  ast: CSharpExpressionAst,
  actualType: IrType,
  context: EmitterContext
): CSharpExpressionAst => {
  const nonNullishActualType = stripNullish(actualType);
  const needsObjectCast =
    willCarryAsRuntimeUnion(nonNullishActualType, context) ||
    isDefinitelyValueType(nonNullishActualType) ||
    isBareTypeParameterLike(nonNullishActualType, context);

  const left: CSharpExpressionAst = needsObjectCast
    ? {
        kind: "parenthesizedExpression",
        expression: {
          kind: "castExpression",
          type: identifierType("global::System.Object"),
          expression: {
            kind: "parenthesizedExpression",
            expression: ast,
          },
        },
      }
    : ast;

  return {
    kind: "binaryExpression",
    operatorToken: "==",
    left,
    right: nullLiteral(),
  };
};

const maybeAdaptTopLevelNullishOptionalUnionAst = (
  ast: CSharpExpressionAst,
  actualType: IrType,
  context: EmitterContext,
  expectedType: IrType,
  visited: ReadonlySet<string>,
  selectedSourceMemberNs?: ReadonlySet<number>
): [CSharpExpressionAst, EmitterContext] | undefined => {
  const actualNullishSplit = splitRuntimeNullishUnionMembers(actualType);
  const expectedNullishSplit = splitRuntimeNullishUnionMembers(expectedType);
  if (isBroadObjectSlotType(expectedType, context)) {
    return undefined;
  }
  if (
    !actualNullishSplit?.hasRuntimeNullish ||
    !expectedNullishSplit?.hasRuntimeNullish
  ) {
    return undefined;
  }

  const nonNullishActualType = stripNullish(actualType);
  const nonNullishExpectedType = stripNullish(expectedType);
  const [nonNullishExpectedLayout, layoutContext] = buildRuntimeUnionLayout(
    nonNullishExpectedType,
    context,
    emitTypeAst
  );
  if (!nonNullishExpectedLayout) {
    return undefined;
  }

  const nonNullishAdapted =
    maybeAdaptRuntimeUnionExpressionAst(
      ast,
      nonNullishActualType,
      layoutContext,
      nonNullishExpectedType,
      visited,
      selectedSourceMemberNs
    ) ??
    (matchesExpectedEmissionType(
      nonNullishActualType,
      nonNullishExpectedType,
      layoutContext
    )
      ? ([ast, layoutContext] satisfies [CSharpExpressionAst, EmitterContext])
      : undefined);
  if (!nonNullishAdapted) {
    return undefined;
  }

  const [expectedTypeAst, expectedTypeContext] = emitTypeAst(
    expectedType,
    nonNullishAdapted[1]
  );

  return [
    {
      kind: "conditionalExpression",
      condition: buildTopLevelNullishConditionAst(
        ast,
        actualType,
        expectedTypeContext
      ),
      whenTrue: {
        kind: "defaultExpression",
        type: expectedTypeAst,
      },
      whenFalse: nonNullishAdapted[0],
    },
    expectedTypeContext,
  ];
};

export const maybeAdaptDictionaryUnionValueAst = (
  expr: IrExpression,
  ast: CSharpExpressionAst,
  context: EmitterContext,
  expectedType: IrType | undefined
): [CSharpExpressionAst, EmitterContext] => {
  const actualType =
    resolveDirectStorageCompatibleExpressionType({
      expr,
      valueAst: ast,
      context,
    }) ?? resolveEffectiveExpressionType(expr, context);
  if (!expectedType || !actualType) return [ast, context];

  const expected = resolveComparableType(expectedType, context);
  const actual = resolveComparableType(actualType, context);
  if (expected.kind !== "dictionaryType" || actual.kind !== "dictionaryType") {
    return [ast, context];
  }

  if (!areIrTypesEquivalent(expected.keyType, actual.keyType, context)) {
    return [ast, context];
  }

  const expectedValue = resolveComparableType(expected.valueType, context);
  if (expectedValue.kind !== "unionType") return [ast, context];

  const actualValue = resolveComparableType(actual.valueType, context);
  if (areIrTypesEquivalent(expectedValue, actualValue, context)) {
    return [ast, context];
  }

  const [runtimeLayout, layoutCtx] = buildRuntimeUnionLayout(
    expectedValue,
    context,
    emitTypeAst
  );
  if (!runtimeLayout) return [ast, context];

  const runtimeMemberIndex = findRuntimeUnionMemberIndex(
    runtimeLayout.members,
    actualValue,
    layoutCtx
  );
  if (runtimeMemberIndex === undefined) return [ast, context];

  const [unionValueTypeAst, ctx1] = emitTypeAst(expected.valueType, layoutCtx);
  const kvpId = "kvp";
  const keySelector: CSharpExpressionAst = {
    kind: "lambdaExpression",
    isAsync: false,
    parameters: [{ name: kvpId }],
    body: {
      kind: "memberAccessExpression",
      expression: { kind: "identifierExpression", identifier: kvpId },
      memberName: "Key",
    },
  };
  const valueSelector: CSharpExpressionAst = {
    kind: "lambdaExpression",
    isAsync: false,
    parameters: [{ name: kvpId }],
    body: buildRuntimeUnionFactoryCallAst(
      unionValueTypeAst,
      runtimeMemberIndex + 1,
      {
        kind: "memberAccessExpression",
        expression: { kind: "identifierExpression", identifier: kvpId },
        memberName: "Value",
      }
    ),
  };

  const converted: CSharpExpressionAst = {
    kind: "invocationExpression",
    expression: {
      kind: "memberAccessExpression",
      expression: {
        ...identifierExpression("global::System.Linq.Enumerable"),
      },
      memberName: "ToDictionary",
    },
    arguments: [ast, keySelector, valueSelector],
  };

  return [converted, ctx1];
};

export const maybeAdaptRuntimeUnionExpressionAst = (
  ast: CSharpExpressionAst,
  actualType: IrType | undefined,
  context: EmitterContext,
  expectedType: IrType | undefined,
  visited: ReadonlySet<string> = new Set<string>(),
  selectedSourceMemberNs?: ReadonlySet<number>
): [CSharpExpressionAst, EmitterContext] | undefined => {
  if (!actualType || !expectedType) return undefined;

  const selectedSourceMemberKey = selectedSourceMemberNs
    ? Array.from(selectedSourceMemberNs).join(",")
    : "*";
  const rawVisitKey = `${getContextualTypeVisitKey(
    actualType,
    context
  )}=>${getContextualTypeVisitKey(expectedType, context)}=>${selectedSourceMemberKey}`;
  if (visited.has(rawVisitKey)) {
    return undefined;
  }
  const earlyVisited = new Set(visited);
  earlyVisited.add(rawVisitKey);

  const topLevelNullishOptionalUnion =
    maybeAdaptTopLevelNullishOptionalUnionAst(
      ast,
      actualType,
      context,
      expectedType,
      earlyVisited,
      selectedSourceMemberNs
    );
  if (topLevelNullishOptionalUnion) {
    return topLevelNullishOptionalUnion;
  }

  const actualNullishSplit = splitRuntimeNullishUnionMembers(actualType);
  const expectedNullishSplit = splitRuntimeNullishUnionMembers(expectedType);
  if (
    expectedNullishSplit?.hasRuntimeNullish &&
    !actualNullishSplit?.hasRuntimeNullish
  ) {
    const nonNullishExpectedType = stripNullish(expectedType);
    if (!areIrTypesEquivalent(nonNullishExpectedType, expectedType, context)) {
      const adaptedNonNullishOptional = maybeAdaptRuntimeUnionExpressionAst(
        ast,
        actualType,
        context,
        nonNullishExpectedType,
        earlyVisited,
        selectedSourceMemberNs
      );
      if (adaptedNonNullishOptional) {
        return adaptedNonNullishOptional;
      }
    }
  }

  if (
    !willCarryAsRuntimeUnion(actualType, context) &&
    !willCarryAsRuntimeUnion(expectedType, context)
  ) {
    return undefined;
  }

  const extractedMemberType =
    tryResolveRuntimeUnionMemberType(actualType, ast, context) ?? actualType;
  if (
    willCarryAsRuntimeUnion(extractedMemberType, context) &&
    willCarryAsRuntimeUnion(expectedType, context) &&
    runtimeUnionAliasReferencesMatch(extractedMemberType, expectedType, context)
  ) {
    return [ast, context];
  }

  const exactComparisonTargetAst = tryEmitExactComparisonTargetAst(
    expectedType,
    context
  );
  if (
    exactComparisonTargetAst &&
    (isExactExpressionToType(
      ast,
      stripNullableTypeAst(exactComparisonTargetAst[0])
    ) ||
      isExactArrayCreationToType(ast, exactComparisonTargetAst[0]) ||
      isExactNullableValueAccessToType(ast, actualType, expectedType, context))
  ) {
    return [ast, exactComparisonTargetAst[1]];
  }

  const directValueSurfaceType = resolveDirectValueSurfaceType(ast, context);
  const directRuntimeCarrierType = resolveDirectRuntimeCarrierType(
    ast,
    context
  );
  const preferredActualType = (() => {
    if (!directValueSurfaceType) {
      return extractedMemberType;
    }

    const emissionDirectRuntimeCarrierType = directRuntimeCarrierType
      ? normalizeRuntimeUnionEmissionType(directRuntimeCarrierType, context)
      : undefined;
    if (
      emissionDirectRuntimeCarrierType &&
      runtimeUnionCarrierSurfaceDiffers(
        emissionDirectRuntimeCarrierType,
        expectedType,
        context
      )
    ) {
      return emissionDirectRuntimeCarrierType;
    }

    const emissionDirectValueSurfaceType = normalizeRuntimeUnionEmissionType(
      directValueSurfaceType,
      context
    );
    const emissionExtractedMemberType = normalizeRuntimeUnionEmissionType(
      extractedMemberType,
      context
    );
    const comparableDirectValueSurfaceType = resolveComparableType(
      emissionDirectValueSurfaceType,
      context
    );
    if (
      !willCarryAsRuntimeUnion(emissionDirectValueSurfaceType, context) &&
      comparableDirectValueSurfaceType.kind !== "anyType" &&
      comparableDirectValueSurfaceType.kind !== "unknownType" &&
      !isBroadObjectSlotType(comparableDirectValueSurfaceType, context)
    ) {
      return emissionDirectValueSurfaceType;
    }

    const [directLayout, directLayoutContext] = buildRuntimeUnionLayout(
      emissionDirectValueSurfaceType,
      context,
      emitTypeAst
    );
    const [actualLayout] = buildRuntimeUnionLayout(
      emissionExtractedMemberType,
      directLayoutContext,
      emitTypeAst
    );

    const layoutsDiffer = (() => {
      if (!directLayout && !actualLayout) {
        return false;
      }
      if (!directLayout || !actualLayout) {
        return true;
      }
      if (
        directLayout.memberTypeAsts.length !==
        actualLayout.memberTypeAsts.length
      ) {
        return true;
      }
      return directLayout.memberTypeAsts.some((memberTypeAst, index) => {
        const other = actualLayout.memberTypeAsts[index];
        return !other || !sameTypeAstSurface(memberTypeAst, other);
      });
    })();

    if (layoutsDiffer) {
      return emissionDirectValueSurfaceType;
    }

    return emissionExtractedMemberType;
  })();

  const emissionActualType = normalizeRuntimeUnionEmissionType(
    unwrapComparableTypeForEmission(preferredActualType, context),
    context
  );
  const emissionExpectedType = normalizeRuntimeUnionEmissionType(
    unwrapComparableTypeForEmission(expectedType, context),
    context
  );
  const normalizedActualType = resolveComparableType(
    emissionActualType,
    context
  );
  const normalizedExpectedType = resolveComparableType(
    emissionExpectedType,
    context
  );

  const runtimeUnionLayoutComparison = (() => {
    const [actualLayout, actualLayoutContext] = buildRuntimeUnionLayout(
      emissionActualType,
      context,
      emitTypeAst
    );
    const [expectedLayout, expectedLayoutContext] = buildRuntimeUnionLayout(
      emissionExpectedType,
      actualLayoutContext,
      emitTypeAst
    );

    if (!actualLayout && !expectedLayout) {
      return { actualLayout, expectedLayout, differs: false };
    }

    if (!actualLayout || !expectedLayout) {
      return { actualLayout, expectedLayout, differs: true };
    }

    if (
      actualLayout.memberTypeAsts.length !==
      expectedLayout.memberTypeAsts.length
    ) {
      return { actualLayout, expectedLayout, differs: true };
    }

    if (
      !sameTypeAstSurface(
        buildRuntimeUnionTypeAst(actualLayout),
        buildRuntimeUnionTypeAst(expectedLayout)
      )
    ) {
      return { actualLayout, expectedLayout, differs: true };
    }

    for (
      let index = 0;
      index < actualLayout.memberTypeAsts.length;
      index += 1
    ) {
      const actualMemberAst = actualLayout.memberTypeAsts[index];
      const expectedMemberAst = expectedLayout.memberTypeAsts[index];
      if (!actualMemberAst || !expectedMemberAst) {
        return { actualLayout, expectedLayout, differs: true };
      }
      const actualMember = actualLayout.members[index];
      const expectedMember = expectedLayout.members[index];
      if (!actualMember || !expectedMember) {
        return { actualLayout, expectedLayout, differs: true };
      }
      const membersEquivalent = areIrTypesEquivalent(
        resolveComparableType(actualMember, expectedLayoutContext),
        resolveComparableType(expectedMember, expectedLayoutContext),
        expectedLayoutContext
      );
      if (
        !sameTypeAstSurface(actualMemberAst, expectedMemberAst) &&
        !membersEquivalent
      ) {
        return { actualLayout, expectedLayout, differs: true };
      }
      if (!membersEquivalent) {
        return { actualLayout, expectedLayout, differs: true };
      }
    }

    return { actualLayout, expectedLayout, differs: false };
  })();
  const equivalentRuntimeUnionLayouts =
    !runtimeUnionLayoutComparison.differs &&
    !!runtimeUnionLayoutComparison.actualLayout &&
    !!runtimeUnionLayoutComparison.expectedLayout;
  const canReuseEquivalentRuntimeUnionAst = (() => {
    if (
      !equivalentRuntimeUnionLayouts ||
      !runtimeUnionLayoutComparison.expectedLayout
    ) {
      return false;
    }

    const expectedUnionTypeAst = buildRuntimeUnionTypeAst(
      runtimeUnionLayoutComparison.expectedLayout
    );
    if (isExactExpressionToType(ast, expectedUnionTypeAst)) {
      return true;
    }

    if (
      runtimeUnionLayoutComparison.actualLayout &&
      sameTypeAstSurface(
        buildRuntimeUnionTypeAst(runtimeUnionLayoutComparison.actualLayout),
        expectedUnionTypeAst
      )
    ) {
      return true;
    }

    const directRuntimeCarrierSurfaceType =
      directRuntimeCarrierType ?? directValueSurfaceType;
    if (!directRuntimeCarrierSurfaceType) {
      return false;
    }

    const [directSurfaceLayout] = buildRuntimeUnionLayout(
      directRuntimeCarrierSurfaceType,
      context,
      emitTypeAst
    );
    return (
      !!directSurfaceLayout &&
      sameTypeAstSurface(
        buildRuntimeUnionTypeAst(directSurfaceLayout),
        expectedUnionTypeAst
      )
    );
  })();
  const requiresEquivalentRuntimeUnionMaterialization =
    equivalentRuntimeUnionLayouts && !canReuseEquivalentRuntimeUnionAst;

  const structuralUpcastWithVisited = (
    nestedAst: CSharpExpressionAst,
    nestedActualType: IrType | undefined,
    nestedContext: EmitterContext,
    nestedExpectedType: IrType | undefined,
    nestedVisited?: ReadonlySet<string>
  ): [CSharpExpressionAst, EmitterContext] | undefined =>
    maybeAdaptRuntimeUnionExpressionAst(
      nestedAst,
      nestedActualType,
      nestedContext,
      nestedExpectedType,
      nestedVisited && nestedVisited.size > 0
        ? new Set([...earlyVisited, ...nestedVisited])
        : earlyVisited
    );

  const adapted = tryAdaptStructuralExpressionAst(
    ast,
    emissionActualType,
    context,
    emissionExpectedType,
    structuralUpcastWithVisited
  );
  if (adapted && normalizedExpectedType.kind !== "unionType") {
    return adapted;
  }

  if (
    equivalentRuntimeUnionLayouts &&
    !requiresEquivalentRuntimeUnionMaterialization
  ) {
    return [ast, context];
  }

  if (
    areIrTypesEquivalent(
      normalizedActualType,
      normalizedExpectedType,
      context
    ) &&
    !runtimeUnionLayoutComparison.differs &&
    !requiresEquivalentRuntimeUnionMaterialization
  ) {
    return [ast, context];
  }

  if (
    !runtimeUnionLayoutComparison.differs &&
    canUseImplicitOptionalSurfaceConversion(
      emissionActualType,
      expectedType,
      context
    ) &&
    !requiresEquivalentRuntimeUnionMaterialization
  ) {
    return [ast, context];
  }

  if (exactComparisonTargetAst) {
    const concreteExpectedTypeAst = stripNullableTypeAst(
      exactComparisonTargetAst[0]
    );
    if (isExactExpressionToType(ast, concreteExpectedTypeAst)) {
      return [ast, exactComparisonTargetAst[1]];
    }
  }

  const normalizedExpected = normalizedExpectedType;
  const visitKey = `${getContextualTypeVisitKey(
    normalizedActualType,
    context
  )}=>${getContextualTypeVisitKey(normalizedExpected, context)}=>${selectedSourceMemberKey}`;
  if (visited.has(visitKey)) {
    return undefined;
  }
  const nextVisited = new Set(earlyVisited);
  nextVisited.add(visitKey);

  const projectedUnion = maybeProjectRuntimeUnionMemberExpressionAst(
    ast,
    emissionActualType,
    context,
    emissionExpectedType,
    nextVisited,
    selectedSourceMemberNs
  );
  if (projectedUnion) {
    return projectedUnion;
  }

  const [actualRuntimeLayout] = buildRuntimeUnionLayout(
    emissionActualType,
    context,
    emitTypeAst
  );
  if (actualRuntimeLayout) {
    const [expectedRuntimeLayout, expectedRuntimeLayoutContext] =
      buildRuntimeUnionLayout(emissionExpectedType, context, emitTypeAst);
    if (expectedRuntimeLayout) {
      const actualRuntimeTypeAst =
        buildRuntimeUnionTypeAst(actualRuntimeLayout);
      const exactRuntimeCarrierMemberIndices =
        expectedRuntimeLayout.memberTypeAsts.flatMap((memberTypeAst, index) =>
          memberTypeAst &&
          sameTypeAstSurface(memberTypeAst, actualRuntimeTypeAst)
            ? [index]
            : []
        );
      const exactRuntimeCarrierMemberIndex =
        exactRuntimeCarrierMemberIndices.length === 1
          ? exactRuntimeCarrierMemberIndices[0]
          : undefined;
      if (exactRuntimeCarrierMemberIndex !== undefined) {
        return [
          buildRuntimeUnionFactoryCallAst(
            buildRuntimeUnionTypeAst(expectedRuntimeLayout),
            exactRuntimeCarrierMemberIndex + 1,
            ast
          ),
          expectedRuntimeLayoutContext,
        ];
      }
    }

    const materialized = tryBuildRuntimeMaterializationAst(
      ast,
      emissionActualType,
      emissionExpectedType,
      context,
      emitTypeAst,
      selectedSourceMemberNs
    );
    if (materialized) {
      return materialized;
    }
  }

  const [runtimeLayout, layoutContext] = buildRuntimeUnionLayout(
    emissionExpectedType,
    context,
    emitTypeAst
  );
  if (!runtimeLayout) {
    return undefined;
  }

  const widenedUnion = maybeWidenRuntimeUnionExpressionAst(
    ast,
    emissionActualType,
    context,
    emissionExpectedType,
    nextVisited,
    selectedSourceMemberNs
  );
  if (widenedUnion) {
    return widenedUnion;
  }

  if (actualRuntimeLayout) {
    return undefined;
  }

  const exactSurfaceMemberIndices = runtimeLayout.memberTypeAsts.flatMap(
    (memberTypeAst, index) =>
      memberTypeAst &&
      (isExactExpressionToType(ast, stripNullableTypeAst(memberTypeAst)) ||
        isExactArrayCreationToType(ast, memberTypeAst))
        ? [index]
        : []
  );
  if (exactSurfaceMemberIndices.length === 1) {
    const [exactSurfaceIndex] = exactSurfaceMemberIndices;
    if (exactSurfaceIndex !== undefined) {
      const exactSurfaceMember = runtimeLayout.members[exactSurfaceIndex];
      const nestedExactSurfaceAdaptation = exactSurfaceMember
        ? maybeAdaptRuntimeUnionExpressionAst(
            ast,
            emissionActualType,
            layoutContext,
            exactSurfaceMember,
            nextVisited
          )
        : undefined;
      return [
        buildRuntimeUnionFactoryCallAst(
          buildRuntimeUnionTypeAst(runtimeLayout),
          exactSurfaceIndex + 1,
          nestedExactSurfaceAdaptation?.[0] ?? ast
        ),
        nestedExactSurfaceAdaptation?.[1] ?? layoutContext,
      ];
    }
  }

  if (selectedSourceMemberNs && selectedSourceMemberNs.size === 1) {
    const selectedMemberN = Array.from(selectedSourceMemberNs)[0];
    const selectedIndex =
      selectedMemberN !== undefined ? selectedMemberN - 1 : undefined;
    const selectedMember =
      selectedIndex !== undefined
        ? runtimeLayout.members[selectedIndex]
        : undefined;
    const selectedMemberTypeAst =
      selectedIndex !== undefined
        ? runtimeLayout.memberTypeAsts[selectedIndex]
        : undefined;

    if (
      selectedIndex !== undefined &&
      selectedMember &&
      selectedMemberTypeAst
    ) {
      const selectedValue = tryAdaptRuntimeUnionMemberValueAst({
        ast,
        actualType: emissionActualType,
        memberType: selectedMember,
        memberTypeAst: selectedMemberTypeAst,
        context: layoutContext,
        visited: nextVisited,
      });
      const selectedValueAst =
        selectedValue?.[0] ??
        (isExactExpressionToType(
          ast,
          stripNullableTypeAst(selectedMemberTypeAst)
        ) || isExactArrayCreationToType(ast, selectedMemberTypeAst)
          ? ast
          : undefined);

      if (selectedValueAst) {
        return [
          buildRuntimeUnionFactoryCallAst(
            buildRuntimeUnionTypeAst(runtimeLayout),
            selectedIndex + 1,
            selectedValueAst
          ),
          selectedValue?.[1] ?? layoutContext,
        ];
      }
    }
  }

  const materializedMemberCandidates = runtimeLayout.members.flatMap(
    (member, index) => {
      const memberTypeAst = runtimeLayout.memberTypeAsts[index];
      if (!member || !memberTypeAst) {
        return [];
      }

      const memberValue = tryAdaptRuntimeUnionMemberValueAst({
        ast,
        actualType: emissionActualType,
        memberType: member,
        memberTypeAst,
        context: layoutContext,
        visited: nextVisited,
      });
      return memberValue ? [{ index, value: memberValue } as const] : [];
    }
  );
  if (materializedMemberCandidates.length === 1) {
    const [candidate] = materializedMemberCandidates;
    if (candidate) {
      return [
        buildRuntimeUnionFactoryCallAst(
          buildRuntimeUnionTypeAst(runtimeLayout),
          candidate.index + 1,
          candidate.value[0]
        ),
        candidate.value[1],
      ];
    }
  }

  const [actualTypeAst, actualTypeContext] = emitTypeAst(
    emissionActualType,
    layoutContext
  );
  const actualTypeKey = stableTypeKeyFromAst(actualTypeAst);
  const exactEmissionSurfaceMemberIndices =
    runtimeLayout.memberTypeAsts.flatMap((memberTypeAst, index) =>
      memberTypeAst && stableTypeKeyFromAst(memberTypeAst) === actualTypeKey
        ? [index]
        : []
    );
  if (exactEmissionSurfaceMemberIndices.length === 1) {
    const [directIndex] = exactEmissionSurfaceMemberIndices;
    if (directIndex !== undefined) {
      return [
        buildRuntimeUnionFactoryCallAst(
          buildRuntimeUnionTypeAst(runtimeLayout),
          directIndex + 1,
          ast
        ),
        actualTypeContext,
      ];
    }
  }

  const directMatchingMemberIndices = findExactRuntimeUnionMemberIndices(
    runtimeLayout.members,
    emissionActualType,
    layoutContext
  );
  const deterministicDirectMatchingMemberIndices =
    directMatchingMemberIndices.length === 1 ? directMatchingMemberIndices : [];
  if (deterministicDirectMatchingMemberIndices.length === 1) {
    const [directIndex] = deterministicDirectMatchingMemberIndices;
    if (directIndex !== undefined) {
      const directMember = runtimeLayout.members[directIndex];
      const directMemberTypeAst = runtimeLayout.memberTypeAsts[directIndex];
      const directMemberValue =
        directMember && directMemberTypeAst
          ? tryAdaptRuntimeUnionMemberValueAst({
              ast,
              actualType: emissionActualType,
              memberType: directMember,
              memberTypeAst: directMemberTypeAst,
              context: layoutContext,
              visited: nextVisited,
            })
          : undefined;
      const nestedMemberAdaptation = directMember
        ? maybeAdaptRuntimeUnionExpressionAst(
            ast,
            emissionActualType,
            layoutContext,
            directMember,
            nextVisited
          )
        : undefined;
      return [
        buildRuntimeUnionFactoryCallAst(
          buildRuntimeUnionTypeAst(runtimeLayout),
          directIndex + 1,
          directMemberValue?.[0] ?? nestedMemberAdaptation?.[0] ?? ast
        ),
        directMemberValue?.[1] ?? nestedMemberAdaptation?.[1] ?? layoutContext,
      ];
    }
  }

  const deterministicAssignableMemberIndices = actualRuntimeLayout
    ? []
    : (() => {
        const indices = findRuntimeUnionMemberIndices(
          runtimeLayout.members,
          emissionActualType,
          layoutContext
        );
        if (indices.length === 1) {
          return indices;
        }

        const assignableIndices = findRuntimeUnionAssignableMemberIndices(
          runtimeLayout.members,
          emissionActualType,
          layoutContext
        );
        if (assignableIndices.length === 1) {
          return assignableIndices;
        }

        const emissionCompatibleIndices = runtimeLayout.members.flatMap(
          (member, index) =>
            member &&
            runtimeUnionMemberIsEmissionCompatible(
              emissionActualType,
              member,
              layoutContext
            )
              ? [index]
              : []
        );
        return emissionCompatibleIndices.length === 1
          ? emissionCompatibleIndices
          : [];
      })();
  if (deterministicAssignableMemberIndices.length === 1) {
    const [directIndex] = deterministicAssignableMemberIndices;
    if (directIndex !== undefined) {
      const directMember = runtimeLayout.members[directIndex];
      const directMemberTypeAst = runtimeLayout.memberTypeAsts[directIndex];
      if (directMember && directMemberTypeAst) {
        const directMemberValue = tryAdaptRuntimeUnionMemberValueAst({
          ast,
          actualType: emissionActualType,
          memberType: directMember,
          memberTypeAst: directMemberTypeAst,
          context: layoutContext,
          visited: nextVisited,
        });
        const directlyAssignableMemberValue = runtimeUnionMemberCanAcceptValue(
          directMember,
          emissionActualType,
          layoutContext
        )
          ? ast
          : undefined;
        const selectedValueAst =
          directMemberValue?.[0] ??
          directlyAssignableMemberValue ??
          (isExactExpressionToType(
            ast,
            stripNullableTypeAst(directMemberTypeAst)
          ) || isExactArrayCreationToType(ast, directMemberTypeAst)
            ? ast
            : undefined);

        if (selectedValueAst) {
          return [
            buildRuntimeUnionFactoryCallAst(
              buildRuntimeUnionTypeAst(runtimeLayout),
              directIndex + 1,
              selectedValueAst
            ),
            directMemberValue?.[1] ?? layoutContext,
          ];
        }
      }
    }
  }

  if (isBroadReificationSourceType(emissionActualType, layoutContext)) {
    const plan = tryBuildRuntimeReificationPlan(
      ast,
      emissionExpectedType,
      layoutContext,
      emitTypeAst
    );
    if (plan) {
      return [plan.value, plan.context];
    }
  }

  const normalizedActual = resolveComparableType(
    emissionActualType,
    actualTypeContext
  );

  const preferredIndices = new Set<number>();
  for (let index = 0; index < runtimeLayout.memberTypeAsts.length; index += 1) {
    const memberTypeAst = runtimeLayout.memberTypeAsts[index];
    if (!memberTypeAst) continue;
    if (stableTypeKeyFromAst(memberTypeAst) === actualTypeKey) {
      preferredIndices.add(index);
    }
    const member = runtimeLayout.members[index];
    if (
      member &&
      areIrTypesEquivalent(
        resolveComparableType(member, actualTypeContext),
        normalizedActual,
        actualTypeContext
      )
    ) {
      preferredIndices.add(index);
    }
  }

  const candidateIndices = [
    ...preferredIndices,
    ...runtimeLayout.members
      .map((_, index) => index)
      .filter((index) => !preferredIndices.has(index))
      .sort((left, right) => {
        const leftScore = isObjectLikeTypeAst(
          runtimeLayout.memberTypeAsts[left]
        )
          ? 1
          : 0;
        const rightScore = isObjectLikeTypeAst(
          runtimeLayout.memberTypeAsts[right]
        )
          ? 1
          : 0;
        return leftScore - rightScore;
      }),
  ];

  for (const index of candidateIndices) {
    const member = runtimeLayout.members[index];
    if (!member) continue;

    const nested = maybeAdaptRuntimeUnionExpressionAst(
      ast,
      emissionActualType,
      layoutContext,
      member,
      nextVisited
    );
    const numericAdjusted =
      nested ??
      (() => {
        const [numericAdjustedAst, numericAdjustedContext] =
          maybeCastNumericToExpectedIntegralAst(
            ast,
            emissionActualType,
            layoutContext,
            member
          );
        return numericAdjustedAst !== ast
          ? ([numericAdjustedAst, numericAdjustedContext] satisfies [
              CSharpExpressionAst,
              EmitterContext,
            ])
          : undefined;
      })();
    if (!numericAdjusted) continue;

    const unionTypeContext = numericAdjusted[1];
    const concreteUnionTypeAst = buildRuntimeUnionTypeAst(runtimeLayout);

    return [
      buildRuntimeUnionFactoryCallAst(
        concreteUnionTypeAst,
        index + 1,
        numericAdjusted[0]
      ),
      unionTypeContext,
    ];
  }

  return undefined;
};
