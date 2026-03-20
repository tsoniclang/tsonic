import type { IrExpression, IrType } from "@tsonic/frontend";
import { identifierExpression } from "../core/format/backend-ast/builders.js";
import type { CSharpExpressionAst } from "../core/format/backend-ast/types.js";
import type { EmitterContext } from "../types.js";

export const resolveDirectStorageExpressionType = (
  expr: IrExpression,
  ast: CSharpExpressionAst,
  context: EmitterContext
): IrType | undefined => {
  if (expr.kind !== "identifier") {
    return undefined;
  }

  const remappedLocal = context.localNameMap?.get(expr.name) ?? expr.name;
  if (ast.kind !== "identifierExpression" || ast.identifier !== remappedLocal) {
    return undefined;
  }

  return resolveIdentifierCarrierStorageType(expr, context);
};

export const resolveIdentifierCarrierStorageType = (
  expr: Extract<IrExpression, { kind: "identifier" }>,
  context: EmitterContext
): IrType | undefined => {
  const narrowed = context.narrowedBindings?.get(expr.name);
  if (narrowed?.kind === "expr" && narrowed.sourceType) {
    return narrowed.sourceType;
  }

  if (narrowed?.kind === "runtimeSubset" && narrowed.sourceType) {
    return narrowed.sourceType;
  }

  return context.localValueTypes?.get(expr.name);
};

export const resolveDirectStorageExpressionAst = (
  expr: IrExpression,
  context: EmitterContext
): CSharpExpressionAst | undefined => {
  if (expr.kind !== "identifier") {
    return undefined;
  }

  const narrowed = context.narrowedBindings?.get(expr.name);
  if (narrowed?.kind === "expr" && narrowed.storageExprAst) {
    return narrowed.storageExprAst;
  }

  const remappedLocal = context.localNameMap?.get(expr.name);
  if (!remappedLocal) {
    return undefined;
  }

  return identifierExpression(remappedLocal);
};
