import type { IrExpression, IrType } from "@tsonic/frontend";
import type { CSharpExpressionAst } from "../core/format/backend-ast/types.js";
import type { EmitterContext } from "../types.js";

export const resolveDirectStorageExpressionType = (
  expr: IrExpression,
  ast: CSharpExpressionAst,
  context: EmitterContext
): IrType | undefined => {
  if (expr.kind !== "identifier" || ast.kind !== "identifierExpression") {
    return undefined;
  }

  const remappedLocal = context.localNameMap?.get(expr.name) ?? expr.name;
  if (ast.identifier !== remappedLocal) {
    return undefined;
  }

  const narrowed = context.narrowedBindings?.get(expr.name);
  if (
    narrowed?.kind === "expr" &&
    narrowed.storageExprAst?.kind === "identifierExpression" &&
    narrowed.storageExprAst.identifier === remappedLocal &&
    narrowed.sourceType
  ) {
    return narrowed.sourceType;
  }

  if (narrowed?.kind === "runtimeSubset" && narrowed.sourceType) {
    return narrowed.sourceType;
  }

  return context.localValueTypes?.get(expr.name);
};
