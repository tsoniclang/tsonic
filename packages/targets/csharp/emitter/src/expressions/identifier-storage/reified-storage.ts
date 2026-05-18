import { IrExpression, IrType } from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import { emitTypeAst } from "../../type-emitter.js";
import { identifierExpression } from "../../core/format/backend-ast/builders.js";
import { matchesSemanticExpectedType } from "../../core/semantic/expected-type-matching.js";
import { resolveEffectiveExpressionType } from "../../core/semantic/narrowed-expression-types.js";
import { adaptStorageErasedValueAst } from "../../core/semantic/storage-erased-adaptation.js";
import type { CSharpExpressionAst } from "../../core/format/backend-ast/types.js";

export const tryEmitReifiedStorageIdentifier = (
  expr: Extract<IrExpression, { kind: "identifier" }>,
  context: EmitterContext,
  expectedType: IrType | undefined
): [CSharpExpressionAst, EmitterContext] | undefined => {
  const remappedLocal = context.localNameMap?.get(expr.name);
  const storageType = context.localValueTypes?.get(expr.name);
  if (!remappedLocal || !storageType) {
    return undefined;
  }

  const effectiveType = resolveEffectiveExpressionType(expr, context);
  const expressionType = expr.inferredType;
  const expressionMatchesExpected = matchesSemanticExpectedType(
    expressionType,
    expectedType,
    context
  );
  return adaptStorageErasedValueAst({
    valueAst: identifierExpression(remappedLocal),
    semanticType: expressionMatchesExpected ? expressionType : effectiveType,
    storageType,
    expectedType,
    context,
    emitTypeAst,
    allowCastFallback: expressionMatchesExpected,
  });
};
