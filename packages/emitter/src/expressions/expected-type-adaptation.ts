import type { IrExpression, IrType } from "@tsonic/frontend";
import { resolveEffectiveExpressionType } from "../core/semantic/narrowed-expression-types.js";
import { tryResolveRuntimeUnionMemberType } from "../core/semantic/narrowed-expression-types.js";
import type { CSharpExpressionAst } from "../core/format/backend-ast/types.js";
import type { EmitterContext } from "../types.js";
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

export const adaptValueToExpectedTypeAst = (opts: {
  readonly valueAst: CSharpExpressionAst;
  readonly actualType: IrType | undefined;
  readonly context: EmitterContext;
  readonly expectedType: IrType | undefined;
  readonly visited?: ReadonlySet<string>;
  readonly allowUnionNarrowing?: boolean;
}): [CSharpExpressionAst, EmitterContext] | undefined => {
  const {
    valueAst,
    actualType,
    context,
    expectedType,
    visited = new Set<string>(),
    allowUnionNarrowing = true,
  } = opts;

  if (!actualType || !expectedType) {
    return undefined;
  }

  const unionAdjusted = maybeAdaptRuntimeUnionExpressionAst(
    valueAst,
    actualType,
    context,
    expectedType,
    visited
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
    visited
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

  const [expectedAdjustedAst, expectedAdjustedContext] =
    adaptValueToExpectedTypeAst({
      valueAst: dictionaryAdjustedAst,
      actualType,
      context: dictionaryAdjustedContext,
      expectedType,
      allowUnionNarrowing: false,
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
