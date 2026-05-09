/**
 * Runtime-union projection helpers.
 * Handles widening, narrowing, and member-projection of runtime union expressions
 * via Match().
 */

import type { IrType } from "@tsonic/frontend";
import type { EmitterContext } from "../types.js";
import { emitTypeAst } from "../type-emitter.js";
import { buildRuntimeUnionLayout } from "../core/semantic/runtime-unions.js";
import { isSemanticUnion } from "../core/semantic/union-semantics.js";
import {
  buildInvalidRuntimeUnionCastExpression,
  tryBuildRuntimeUnionProjectionToLayoutAst,
} from "../core/semantic/runtime-union-projection.js";
import { resolveComparableType } from "../core/semantic/comparable-types.js";
import { areIrTypesEquivalent } from "../core/semantic/type-equivalence.js";
import {
  isBroadObjectPassThroughType,
  isBroadObjectSlotType,
  normalizeBroadObjectSinkType,
} from "../core/semantic/broad-object-types.js";
import type { CSharpExpressionAst } from "../core/format/backend-ast/types.js";
import { stableTypeKeyFromAst } from "../core/format/backend-ast/utils.js";

const isRuntimeUnionMemberProjectionAst = (
  valueAst: CSharpExpressionAst
): boolean => {
  let target = valueAst;
  while (target.kind === "parenthesizedExpression") {
    target = target.expression;
  }

  return (
    target.kind === "invocationExpression" &&
    target.arguments.length === 0 &&
    target.expression.kind === "memberAccessExpression" &&
    /^As\d+$/.test(target.expression.memberName)
  );
};
import { maybeAdaptRuntimeUnionExpressionAst } from "./runtime-union-adaptation-upcast.js";
import { tryResolveRuntimeUnionCastSourceIndices } from "../core/semantic/runtime-reification-helpers.js";
import { runtimeUnionAliasReferencesMatch } from "../core/semantic/runtime-union-alias-identity.js";
import { maybeBoxJsNumberAsObjectAst } from "./post-emission-adaptation.js";

export const maybeWidenRuntimeUnionExpressionAst = (
  ast: CSharpExpressionAst,
  actualType: IrType,
  context: EmitterContext,
  expectedType: IrType,
  visited: ReadonlySet<string>,
  selectedSourceMemberNs?: ReadonlySet<number>
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
    selectedSourceMemberNs,
    buildMappedMemberValue: ({
      actualMember,
      parameterExpr,
      targetMember,
      context: nextContext,
    }) =>
      maybeAdaptRuntimeUnionExpressionAst(
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
  visited: ReadonlySet<string>,
  selectedSourceMemberNs?: ReadonlySet<number>
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
    selectedSourceMemberNs,
    buildMappedMemberValue: ({
      actualMember,
      parameterExpr,
      targetMember,
      context: nextContext,
    }) =>
      maybeAdaptRuntimeUnionExpressionAst(
        parameterExpr,
        actualMember,
        nextContext,
        targetMember,
        visited
      ) ?? [parameterExpr, nextContext],
    buildExcludedMemberBody: ({ actualMember }) =>
      buildInvalidRuntimeUnionCastExpression(actualMember, expectedType),
    buildUnmappedMemberBody: ({ actualMember }) =>
      buildInvalidRuntimeUnionCastExpression(actualMember, expectedType),
  });
};

export const maybeProjectRuntimeUnionMemberExpressionAst = (
  ast: CSharpExpressionAst,
  actualType: IrType,
  context: EmitterContext,
  expectedType: IrType,
  visited: ReadonlySet<string>,
  selectedSourceMemberNs?: ReadonlySet<number>
): [CSharpExpressionAst, EmitterContext] | undefined => {
  const projectionExpectedType =
    normalizeBroadObjectSinkType(expectedType, context) ?? expectedType;
  const normalizedExpected = resolveComparableType(
    projectionExpectedType,
    context
  );
  const expectedOwnsRuntimeCarrier =
    projectionExpectedType.kind === "unionType" &&
    typeof projectionExpectedType.runtimeCarrierFamilyKey === "string" &&
    projectionExpectedType.runtimeCarrierFamilyKey.length > 0;
  if (
    (projectionExpectedType.kind === "unionType" &&
      !expectedOwnsRuntimeCarrier) ||
    (normalizedExpected.kind === "unionType" &&
      projectionExpectedType.kind !== "referenceType" &&
      !expectedOwnsRuntimeCarrier)
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
    projectionExpectedType,
    actualLayoutContext,
    emitTypeAst
  );
  if (
    expectedLayout &&
    actualLayout.carrierFullName === expectedLayout.carrierFullName &&
    actualLayout.carrierTypeArgumentAsts.length ===
      expectedLayout.carrierTypeArgumentAsts.length &&
    actualLayout.carrierTypeArgumentAsts.every(
      (typeArgument, index) =>
        stableTypeKeyFromAst(typeArgument) ===
        stableTypeKeyFromAst(expectedLayout.carrierTypeArgumentAsts[index]!)
    )
  ) {
    return [ast, expectedLayoutContext];
  }

  const restrictedIndices = tryResolveRuntimeUnionCastSourceIndices(
    ast,
    actualLayout.memberTypeAsts
  );
  const effectiveMembers = restrictedIndices
    ? restrictedIndices.flatMap((index) => {
        const member = actualLayout.members[index];
        return member ? [member] : [];
      })
    : actualLayout.members;
  const candidateMemberNs = restrictedIndices?.map((index) => index + 1);

  const [expectedTypeAst, expectedTypeContext] = emitTypeAst(
    projectionExpectedType,
    expectedLayoutContext
  );

  const actualTypeContext = expectedTypeContext;

  const lambdaArgs: CSharpExpressionAst[] = [];
  let currentContext = actualTypeContext;
  let sawMatch = false;

  for (let index = 0; index < effectiveMembers.length; index += 1) {
    const actualMember = effectiveMembers[index];
    if (!actualMember) continue;

    const parameterName = `__tsonic_union_member_${index + 1}`;
    const parameterExpr: CSharpExpressionAst = {
      kind: "identifierExpression",
      identifier: parameterName,
    };

    let body: CSharpExpressionAst = buildInvalidRuntimeUnionCastExpression(
      actualMember,
      projectionExpectedType
    );

    if (
      selectedSourceMemberNs &&
      !selectedSourceMemberNs.has(candidateMemberNs?.[index] ?? index + 1)
    ) {
      lambdaArgs.push({
        kind: "lambdaExpression",
        isAsync: false,
        parameters: [{ name: parameterName }],
        body,
      });
      continue;
    }

    if (
      runtimeUnionAliasReferencesMatch(
        actualMember,
        projectionExpectedType,
        currentContext
      )
    ) {
      body = parameterExpr;
      sawMatch = true;
    } else if (
      areIrTypesEquivalent(actualMember, projectionExpectedType, currentContext)
    ) {
      body = parameterExpr;
      sawMatch = true;
    } else if (
      isBroadObjectSlotType(projectionExpectedType, currentContext) &&
      isBroadObjectPassThroughType(actualMember, currentContext)
    ) {
      body = parameterExpr;
      sawMatch = true;
    } else if (isBroadObjectSlotType(projectionExpectedType, currentContext)) {
      const [boxedNumericAst, boxedNumericContext] =
        maybeBoxJsNumberAsObjectAst(
          parameterExpr,
          undefined,
          actualMember,
          currentContext,
          projectionExpectedType
        );
      if (boxedNumericAst !== parameterExpr) {
        body = boxedNumericAst;
        currentContext = boxedNumericContext;
        sawMatch = true;
      } else {
        const nested = maybeAdaptRuntimeUnionExpressionAst(
          parameterExpr,
          actualMember,
          currentContext,
          projectionExpectedType,
          visited
        );
        if (nested) {
          body = nested[0];
          currentContext = nested[1];
          sawMatch = true;
        }
      }
    } else {
      const nested = maybeAdaptRuntimeUnionExpressionAst(
        parameterExpr,
        actualMember,
        currentContext,
        projectionExpectedType,
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
        expression: isRuntimeUnionMemberProjectionAst(ast)
          ? {
              kind: "parenthesizedExpression",
              expression: ast,
            }
          : ast,
        memberName: "Match",
      },
      typeArguments: [expectedTypeAst],
      arguments: lambdaArgs,
    },
    currentContext,
  ];
};
