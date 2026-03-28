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
import type { CSharpExpressionAst } from "../core/format/backend-ast/types.js";
import { maybeAdaptRuntimeUnionExpressionAst } from "./runtime-union-adaptation-upcast.js";

export const maybeWidenRuntimeUnionExpressionAst = (
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
      maybeAdaptRuntimeUnionExpressionAst(
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

export const maybeProjectRuntimeUnionMemberExpressionAst = (
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

  const [expectedTypeAst, expectedTypeContext] = emitTypeAst(
    expectedType,
    actualLayoutContext
  );

  const actualTypeContext = expectedTypeContext;

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
      const nested = maybeAdaptRuntimeUnionExpressionAst(
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
      typeArguments: [expectedTypeAst],
      arguments: lambdaArgs,
    },
    currentContext,
  ];
};
