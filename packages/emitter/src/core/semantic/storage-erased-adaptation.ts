import type { IrType } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import type { CSharpExpressionAst } from "../format/backend-ast/types.js";
import { sameTypeAstSurface } from "../format/backend-ast/utils.js";
import type { EmitTypeAstFn } from "./runtime-reification.js";
import { buildRuntimeUnionLayout } from "./runtime-unions.js";
import {
  matchesExpectedEmissionType,
  matchesSemanticExpectedType,
} from "./expected-type-matching.js";
import { tryBuildRuntimeReificationPlan } from "./runtime-reification.js";
import { getArrayLikeElementType } from "./type-resolution.js";

const requiresRuntimeUnionArrayElementMaterialization = (
  storageType: IrType,
  expectedType: IrType,
  context: EmitterContext,
  emitTypeAst: EmitTypeAstFn
): [boolean, EmitterContext] => {
  const sourceElementType = getArrayLikeElementType(storageType, context);
  const targetElementType = getArrayLikeElementType(expectedType, context);
  if (!sourceElementType || !targetElementType) {
    return [false, context];
  }

  const [sourceLayout, sourceLayoutContext] = buildRuntimeUnionLayout(
    sourceElementType,
    context,
    emitTypeAst
  );
  if (!sourceLayout) {
    return [false, sourceLayoutContext];
  }

  const [sourceElementTypeAst, sourceTypeContext] = emitTypeAst(
    sourceElementType,
    sourceLayoutContext
  );
  const [targetElementTypeAst, targetTypeContext] = emitTypeAst(
    targetElementType,
    sourceTypeContext
  );

  return [
    !sameTypeAstSurface(sourceElementTypeAst, targetElementTypeAst),
    targetTypeContext,
  ];
};

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

  if (!expectedType || !semanticType || !storageType) {
    return undefined;
  }
  const [needsArrayElementMaterialization, needsPlanContext] =
    requiresRuntimeUnionArrayElementMaterialization(
      storageType,
      expectedType,
      context,
      emitTypeAst
    );
  if (
    !matchesSemanticExpectedType(
      semanticType,
      expectedType,
      needsPlanContext
    ) &&
    !needsArrayElementMaterialization
  ) {
    return undefined;
  }

  if (
    matchesExpectedEmissionType(storageType, expectedType, needsPlanContext) &&
    !needsArrayElementMaterialization
  ) {
    return [valueAst, needsPlanContext];
  }

  const plan = tryBuildRuntimeReificationPlan(
    valueAst,
    expectedType,
    needsPlanContext,
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
