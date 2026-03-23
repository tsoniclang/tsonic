import type { IrExpression, IrType } from "@tsonic/frontend";
import { identifierExpression } from "../core/format/backend-ast/builders.js";
import type { CSharpExpressionAst } from "../core/format/backend-ast/types.js";
import type { EmitterContext } from "../types.js";
import { tryResolveRuntimeUnionMemberType } from "../core/semantic/narrowed-expression-types.js";
import { resolveIdentifierValueSurfaceType } from "../core/semantic/direct-value-surfaces.js";

export const resolveDirectStorageExpressionType = (
  expr: IrExpression,
  ast: CSharpExpressionAst,
  context: EmitterContext
): IrType | undefined => {
  if (expr.kind !== "identifier") {
    return undefined;
  }

  const storageType = resolveIdentifierCarrierStorageType(expr, context);
  const remappedLocal = context.localNameMap?.get(expr.name) ?? expr.name;
  if (ast.kind !== "identifierExpression" || ast.identifier !== remappedLocal) {
    return tryResolveRuntimeUnionMemberType(storageType, ast, context);
  }

  return storageType;
};

export const resolveIdentifierCarrierStorageType = (
  expr: Extract<IrExpression, { kind: "identifier" }>,
  context: EmitterContext
): IrType | undefined => {
  return (
    context.localValueTypes?.get(expr.name) ??
    resolveIdentifierValueSurfaceType(expr, context)
  );
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
