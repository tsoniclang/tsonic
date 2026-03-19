/**
 * Runtime-union adaptation and projection helpers.
 * Adapts expressions between different runtime union carrier layouts via Match(),
 * including widening, narrowing, projection, and the main expected-type upcast
 * orchestration.
 */

import type { IrExpression, IrType } from "@tsonic/frontend";
import { stableIrTypeKey } from "@tsonic/frontend";
import type { EmitterContext } from "../types.js";
import { emitTypeAst } from "../type-emitter.js";
import {
  buildRuntimeUnionLayout,
  buildRuntimeUnionTypeAst,
  findRuntimeUnionMemberIndex,
} from "../core/semantic/runtime-unions.js";
import { isSemanticUnion } from "../core/semantic/union-semantics.js";
import { resolveEffectiveExpressionType } from "../core/semantic/narrowed-expression-types.js";
import {
  buildRuntimeUnionFactoryCallAst,
  buildInvalidRuntimeUnionCastExpression,
  tryBuildRuntimeUnionProjectionToLayoutAst,
} from "../core/semantic/runtime-union-projection.js";
import {
  resolveComparableType,
  unwrapComparableType,
} from "../core/semantic/comparable-types.js";
import { resolveDirectValueSurfaceType } from "../core/semantic/direct-value-surfaces.js";
import { areIrTypesEquivalent } from "../core/semantic/type-equivalence.js";
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
import { identifierExpression } from "../core/format/backend-ast/builders.js";
import { tryAdaptStructuralExpressionAst } from "./structural-adaptation.js";
import {
  isExactExpressionToType,
  isExactArrayCreationToType,
  isExactNullableValueAccessToType,
  tryEmitExactComparisonTargetAst,
  canUseImplicitOptionalSurfaceConversion,
} from "./exact-comparison.js";

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

export const maybeUpcastDictionaryUnionValueAst = (
  expr: IrExpression,
  ast: CSharpExpressionAst,
  context: EmitterContext,
  expectedType: IrType | undefined
): [CSharpExpressionAst, EmitterContext] => {
  const actualType = resolveEffectiveExpressionType(expr, context);
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

const maybeWidenRuntimeUnionExpressionAst = (
  ast: CSharpExpressionAst,
  actualType: IrType,
  context: EmitterContext,
  expectedType: IrType,
  visited: ReadonlySet<string>
): [CSharpExpressionAst, EmitterContext] | undefined => {
  const [actualLayout, actualLayoutContext] = buildRuntimeUnionLayout(
    actualType,
    context,
    emitTypeAst
  );
  if (!actualLayout) {
    return undefined;
  }
  const [expectedLayout, expectedLayoutContext] = buildRuntimeUnionLayout(
    expectedType,
    actualLayoutContext,
    emitTypeAst
  );
  if (!expectedLayout) {
    return undefined;
  }

  return tryBuildRuntimeUnionProjectionToLayoutAst({
    valueAst: ast,
    sourceLayout: actualLayout,
    targetLayout: expectedLayout,
    context: expectedLayoutContext,
    buildMappedMemberValue: ({
      actualMember,
      parameterExpr,
      targetMember,
      context: nextContext,
    }) =>
      maybeUpcastExpressionToExpectedTypeAst(
        parameterExpr,
        actualMember,
        nextContext,
        targetMember,
        visited
      ) ?? [parameterExpr, nextContext],
  });
};

export const maybeNarrowRuntimeUnionExpressionAst = (
  ast: CSharpExpressionAst,
  actualType: IrType,
  context: EmitterContext,
  expectedType: IrType,
  visited: ReadonlySet<string>
): [CSharpExpressionAst, EmitterContext] | undefined => {
  // Semantic gate: only project via Match() when both the actual and
  // expected types are semantic unions (explicit unionType in IR).
  // Alias references like MiddlewareLike must not be treated as unions
  // here — they are single semantic types, even if they alias a union.
  if (
    !isSemanticUnion(actualType, context) ||
    !isSemanticUnion(expectedType, context)
  ) {
    return undefined;
  }

  const [actualLayout, actualLayoutContext] = buildRuntimeUnionLayout(
    actualType,
    context,
    emitTypeAst
  );
  if (!actualLayout) {
    return undefined;
  }

  const [expectedLayout, expectedLayoutContext] = buildRuntimeUnionLayout(
    expectedType,
    actualLayoutContext,
    emitTypeAst
  );
  if (!expectedLayout) {
    return undefined;
  }

  return tryBuildRuntimeUnionProjectionToLayoutAst({
    valueAst: ast,
    sourceLayout: actualLayout,
    targetLayout: expectedLayout,
    context: expectedLayoutContext,
    buildMappedMemberValue: ({
      actualMember,
      parameterExpr,
      targetMember,
      context: nextContext,
    }) =>
      maybeUpcastExpressionToExpectedTypeAst(
        parameterExpr,
        actualMember,
        nextContext,
        targetMember,
        visited
      ) ?? [parameterExpr, nextContext],
    buildUnmappedMemberBody: ({ actualMember }) =>
      buildInvalidRuntimeUnionCastExpression(actualMember, expectedType),
  });
};

const maybeProjectRuntimeUnionMemberExpressionAst = (
  ast: CSharpExpressionAst,
  actualType: IrType,
  context: EmitterContext,
  expectedType: IrType,
  visited: ReadonlySet<string>
): [CSharpExpressionAst, EmitterContext] | undefined => {
  const normalizedExpected = resolveComparableType(expectedType, context);
  if (normalizedExpected.kind === "unionType") {
    return undefined;
  }

  const [actualLayout, actualLayoutContext] = buildRuntimeUnionLayout(
    actualType,
    context,
    emitTypeAst
  );
  if (!actualLayout) {
    return undefined;
  }

  const actualTypeContext = actualLayoutContext;

  const lambdaArgs: CSharpExpressionAst[] = [];
  let currentContext = actualTypeContext;
  let sawMatch = false;

  for (let index = 0; index < actualLayout.members.length; index += 1) {
    const actualMember = actualLayout.members[index];
    if (!actualMember) continue;

    const parameterName = `__tsonic_union_member_${index + 1}`;
    const parameterExpr: CSharpExpressionAst = {
      kind: "identifierExpression",
      identifier: parameterName,
    };

    let body: CSharpExpressionAst = buildInvalidRuntimeUnionCastExpression(
      actualMember,
      expectedType
    );

    if (areIrTypesEquivalent(actualMember, expectedType, currentContext)) {
      body = parameterExpr;
      sawMatch = true;
    } else {
      const nested = maybeUpcastExpressionToExpectedTypeAst(
        parameterExpr,
        actualMember,
        currentContext,
        expectedType,
        visited
      );
      if (nested) {
        body = nested[0];
        currentContext = nested[1];
        sawMatch = true;
      }
    }

    lambdaArgs.push({
      kind: "lambdaExpression",
      isAsync: false,
      parameters: [{ name: parameterName }],
      body,
    });
  }

  if (!sawMatch) {
    return undefined;
  }

  return [
    {
      kind: "invocationExpression",
      expression: {
        kind: "memberAccessExpression",
        expression: ast,
        memberName: "Match",
      },
      arguments: lambdaArgs,
    },
    currentContext,
  ];
};

export const maybeUpcastExpressionToExpectedTypeAst = (
  ast: CSharpExpressionAst,
  actualType: IrType | undefined,
  context: EmitterContext,
  expectedType: IrType | undefined,
  visited: ReadonlySet<string> = new Set<string>()
): [CSharpExpressionAst, EmitterContext] | undefined => {
  if (!actualType || !expectedType) return undefined;

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
  const preferredActualType = (() => {
    if (!directValueSurfaceType) {
      return actualType;
    }

    const [directLayout, directLayoutContext] = buildRuntimeUnionLayout(
      directValueSurfaceType,
      context,
      emitTypeAst
    );
    const [actualLayout] = buildRuntimeUnionLayout(
      actualType,
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
      return directValueSurfaceType;
    }

    return !areIrTypesEquivalent(directValueSurfaceType, actualType, context)
      ? directValueSurfaceType
      : actualType;
  })();

  const emissionActualType = unwrapComparableType(preferredActualType);
  const emissionExpectedType = unwrapComparableType(expectedType);
  const normalizedActualType = resolveComparableType(
    preferredActualType,
    context
  );
  const normalizedExpectedType = resolveComparableType(expectedType, context);

  const runtimeUnionLayoutsDiffer = (() => {
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
      return false;
    }

    if (!actualLayout || !expectedLayout) {
      return true;
    }

    if (
      actualLayout.memberTypeAsts.length !==
      expectedLayout.memberTypeAsts.length
    ) {
      return true;
    }

    for (
      let index = 0;
      index < actualLayout.memberTypeAsts.length;
      index += 1
    ) {
      const actualMemberAst = actualLayout.memberTypeAsts[index];
      const expectedMemberAst = expectedLayout.memberTypeAsts[index];
      if (!actualMemberAst || !expectedMemberAst) {
        return true;
      }
      if (!sameTypeAstSurface(actualMemberAst, expectedMemberAst)) {
        return true;
      }
      const actualMember = actualLayout.members[index];
      const expectedMember = expectedLayout.members[index];
      if (!actualMember || !expectedMember) {
        return true;
      }
      if (
        !areIrTypesEquivalent(
          resolveComparableType(actualMember, expectedLayoutContext),
          resolveComparableType(expectedMember, expectedLayoutContext),
          expectedLayoutContext
        )
      ) {
        return true;
      }
    }

    return false;
  })();

  const adapted = tryAdaptStructuralExpressionAst(
    ast,
    emissionActualType,
    context,
    emissionExpectedType
  );
  if (adapted) {
    return adapted;
  }

  if (
    areIrTypesEquivalent(
      normalizedActualType,
      normalizedExpectedType,
      context
    ) &&
    !runtimeUnionLayoutsDiffer
  ) {
    return [ast, context];
  }

  if (
    !runtimeUnionLayoutsDiffer &&
    canUseImplicitOptionalSurfaceConversion(
      emissionActualType,
      expectedType,
      context
    )
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
  const visitKey = `${stableIrTypeKey(normalizedActualType)}=>${stableIrTypeKey(normalizedExpected)}`;
  if (visited.has(visitKey)) {
    return undefined;
  }
  const nextVisited = new Set(visited);
  nextVisited.add(visitKey);

  const projectedUnion = maybeProjectRuntimeUnionMemberExpressionAst(
    ast,
    emissionActualType,
    context,
    emissionExpectedType,
    nextVisited
  );
  if (projectedUnion) {
    return projectedUnion;
  }

  if (normalizedExpected.kind !== "unionType") {
    return undefined;
  }

  const widenedUnion = maybeWidenRuntimeUnionExpressionAst(
    ast,
    emissionActualType,
    context,
    emissionExpectedType,
    nextVisited
  );
  if (widenedUnion) {
    return widenedUnion;
  }

  const [actualRuntimeLayout] = buildRuntimeUnionLayout(
    emissionActualType,
    context,
    emitTypeAst
  );
  if (actualRuntimeLayout) {
    return undefined;
  }

  const [runtimeLayout, layoutContext] = buildRuntimeUnionLayout(
    emissionExpectedType,
    context,
    emitTypeAst
  );
  if (!runtimeLayout) {
    return undefined;
  }

  const [actualTypeAst, actualTypeContext] = emitTypeAst(
    emissionActualType,
    layoutContext
  );
  const actualTypeKey = stableTypeKeyFromAst(actualTypeAst);
  const normalizedActual = resolveComparableType(
    emissionActualType,
    actualTypeContext
  );
  const actualSemanticKey = stableIrTypeKey(normalizedActual);

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
      stableIrTypeKey(resolveComparableType(member, actualTypeContext)) ===
        actualSemanticKey
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

    const nested = maybeUpcastExpressionToExpectedTypeAst(
      ast,
      emissionActualType,
      layoutContext,
      member,
      nextVisited
    );
    if (!nested) continue;

    const unionTypeContext = nested[1];
    const concreteUnionTypeAst = buildRuntimeUnionTypeAst(runtimeLayout);

    return [
      buildRuntimeUnionFactoryCallAst(
        concreteUnionTypeAst,
        index + 1,
        nested[0]
      ),
      unionTypeContext,
    ];
  }

  return undefined;
};

export const resolveDirectStorageExpressionType = (
  expr: IrExpression,
  ast: CSharpExpressionAst,
  context: EmitterContext
): IrType | undefined => {
  if (expr.kind !== "identifier" || ast.kind !== "identifierExpression") {
    return undefined;
  }

  const remappedLocal = context.localNameMap?.get(expr.name) ?? expr.name;
  if (ast.identifier !== remappedLocal) {
    return undefined;
  }

  const narrowed = context.narrowedBindings?.get(expr.name);
  if (
    narrowed?.kind === "expr" &&
    narrowed.storageExprAst?.kind === "identifierExpression" &&
    narrowed.storageExprAst.identifier === remappedLocal &&
    narrowed.sourceType
  ) {
    return narrowed.sourceType;
  }

  if (narrowed?.kind === "runtimeSubset" && narrowed.sourceType) {
    return narrowed.sourceType;
  }

  return context.localValueTypes?.get(expr.name);
};
