import type { IrType } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import type { CSharpExpressionAst } from "../format/backend-ast/types.js";

export const resolveDirectValueSurfaceType = (
  valueAst: CSharpExpressionAst,
  context: EmitterContext
): IrType | undefined => {
  if (valueAst.kind !== "identifierExpression") {
    return undefined;
  }

  const direct = context.localValueTypes?.get(valueAst.identifier);
  if (direct) {
    return direct;
  }

  const originalName = Array.from(context.localNameMap ?? []).find(
    ([, emitted]) => emitted === valueAst.identifier
  )?.[0];
  return originalName ? context.localValueTypes?.get(originalName) : undefined;
};
