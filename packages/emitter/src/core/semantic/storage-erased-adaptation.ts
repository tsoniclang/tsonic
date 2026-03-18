import type { IrType } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import type {
  CSharpExpressionAst,
} from "../format/backend-ast/types.js";
import { sameTypeAstSurface } from "../format/backend-ast/utils.js";
import type { EmitTypeAstFn } from "./runtime-reification.js";
import {
  matchesExpectedEmissionType,
  matchesSemanticExpectedType,
} from "./expected-type-matching.js";
import { tryBuildRuntimeReificationPlan } from "./runtime-reification.js";

export const adaptStorageErasedValueAst = (opts: {
  readonly valueAst: CSharpExpressionAst;
  readonly semanticType: IrType | undefined;
  readonly storageType: IrType | undefined;
  readonly expectedType: IrType | undefined;
  readonly context: EmitterContext;
  readonly emitTypeAst: EmitTypeAstFn;
  readonly allowCastFallback?: boolean;
}): [CSharpExpressionAst, EmitterContext] | undefined => {
  const {
    valueAst,
    semanticType,
    storageType,
    expectedType,
    context,
    emitTypeAst,
    allowCastFallback = true,
  } = opts;

  if (
    !expectedType ||
    !semanticType ||
    !storageType ||
    !matchesSemanticExpectedType(semanticType, expectedType, context)
  ) {
    return undefined;
  }

  if (matchesExpectedEmissionType(storageType, expectedType, context)) {
    return [valueAst, context];
  }

  const plan = tryBuildRuntimeReificationPlan(
    valueAst,
    expectedType,
    context,
    emitTypeAst
  );
  if (plan) {
    return [plan.value, plan.context];
  }

  if (!allowCastFallback) {
    return undefined;
  }

  const [expectedTypeAst, expectedTypeContext] = emitTypeAst(
    expectedType,
    context
  );
  if (
    valueAst.kind === "castExpression" &&
    sameTypeAstSurface(valueAst.type, expectedTypeAst)
  ) {
    return [valueAst, expectedTypeContext];
  }

  return [
    {
      kind: "castExpression",
      type: expectedTypeAst,
      expression: valueAst,
    },
    expectedTypeContext,
  ];
};
