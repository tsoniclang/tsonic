import type { IrExpression, IrType } from "@tsonic/frontend";
import { resolveEffectiveExpressionType } from "../core/semantic/narrowed-expression-types.js";
import type { CSharpExpressionAst } from "../core/format/backend-ast/types.js";
import type { EmitterContext } from "../types.js";
import {
  maybeCastNullishTypeParamAst,
  maybeConvertCharToStringAst,
  maybeBoxJsNumberAsObjectAst,
  maybeUnwrapNullableValueTypeAst,
} from "./post-emission-adaptation.js";
import {
  maybeNarrowRuntimeUnionExpressionAst,
  maybeAdaptDictionaryUnionValueAst,
  maybeAdaptRuntimeUnionExpressionAst,
} from "./runtime-union-adaptation.js";
import { resolveDirectStorageExpressionType } from "./direct-storage-types.js";
import { tryAdaptStructuralExpressionAst } from "./structural-adaptation.js";

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

  const actualType =
    resolveDirectStorageExpressionType(expr, castedAst, castedContext) ??
    resolveEffectiveExpressionType(expr, castedContext);

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

  const [boxedNumericAst, boxedNumericContext] = maybeBoxJsNumberAsObjectAst(
    expectedAdjustedAst,
    expr,
    actualType,
    expectedAdjustedContext,
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
