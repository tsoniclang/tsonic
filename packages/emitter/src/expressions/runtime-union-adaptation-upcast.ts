/**
 * Runtime-union upcast orchestration and dictionary/storage helpers.
 * Handles the main maybeUpcastExpressionToExpectedTypeAst entry point,
 * dictionary union value upcasting, and direct storage expression type resolution.
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
import { resolveEffectiveExpressionType } from "../core/semantic/narrowed-expression-types.js";
import {
  buildRuntimeUnionFactoryCallAst,
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
import {
  maybeWidenRuntimeUnionExpressionAst,
  maybeProjectRuntimeUnionMemberExpressionAst,
} from "./runtime-union-adaptation-projection.js";

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
