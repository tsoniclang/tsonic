import type { IrExpression, IrType } from "@tsonic/frontend";
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

  const narrowedRename = Array.from(context.narrowedBindings ?? []).find(
    ([, binding]) =>
      binding.kind === "rename" && binding.name === valueAst.identifier
  )?.[1];
  if (narrowedRename?.kind === "rename" && narrowedRename.type) {
    return narrowedRename.type;
  }

  const originalName = Array.from(context.localNameMap ?? []).find(
    ([, emitted]) => emitted === valueAst.identifier
  )?.[0];
  return originalName ? context.localValueTypes?.get(originalName) : undefined;
};

export const resolveIdentifierValueSurfaceType = (
  expr: Extract<IrExpression, { kind: "identifier" }>,
  context: EmitterContext
): IrType | undefined => {
  const narrowed = context.narrowedBindings?.get(expr.name);
  if (narrowed?.kind === "expr") {
    return narrowed.type ?? narrowed.sourceType;
  }

  if (narrowed?.kind === "runtimeSubset") {
    return narrowed.type ?? narrowed.sourceType;
  }

  return context.localValueTypes?.get(expr.name);
};
