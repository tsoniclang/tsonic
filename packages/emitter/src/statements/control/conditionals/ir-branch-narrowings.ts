import type { IrBranchNarrowing } from "@tsonic/frontend";
import type { EmitterContext } from "../../../types.js";
import {
  applyDirectTypeNarrowing,
  type EmitExprAstFn,
} from "../../../core/semantic/narrowing-builders.js";
import { isAssignableToType } from "../../../core/semantic/type-compatibility.js";

const shouldPreserveExistingNarrowing = (
  context: EmitterContext,
  narrowing: IrBranchNarrowing
): boolean => {
  const existingType = context.narrowedBindings?.get(
    narrowing.bindingKey
  )?.type;
  return (
    existingType !== undefined &&
    isAssignableToType(existingType, narrowing.targetType, context)
  );
};

export const applyIrBranchNarrowings = (
  context: EmitterContext,
  narrowings: readonly IrBranchNarrowing[] | undefined,
  emitExprAst: EmitExprAstFn
): EmitterContext => {
  if (!narrowings || narrowings.length === 0) {
    return context;
  }

  return narrowings.reduce(
    (currentContext, narrowing) =>
      shouldPreserveExistingNarrowing(currentContext, narrowing)
        ? currentContext
        : applyDirectTypeNarrowing(
            narrowing.bindingKey,
            narrowing.targetExpr,
            narrowing.targetType,
            currentContext,
            emitExprAst
          ),
    context
  );
};
