import type { IrExpression, IrType } from "@tsonic/frontend";
import { identifierExpression } from "../core/format/backend-ast/builders.js";
import type { CSharpExpressionAst } from "../core/format/backend-ast/types.js";
import type { EmitterContext } from "../types.js";
import { escapeCSharpIdentifier } from "../emitter-types/index.js";
import { tryResolveRuntimeUnionMemberType } from "../core/semantic/narrowed-expression-types.js";
import { resolveIdentifierValueSurfaceType } from "../core/semantic/direct-value-surfaces.js";
import { getMemberAccessNarrowKey } from "../core/semantic/narrowing-keys.js";

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
  const localStorageType = context.localValueTypes?.get(expr.name);
  const narrowed = context.narrowedBindings?.get(expr.name);
  if (narrowed?.kind === "expr") {
    return (
      narrowed.storageType ??
      localStorageType ??
      narrowed.sourceType ??
      narrowed.type
    );
  }

  if (narrowed?.kind === "runtimeSubset") {
    return localStorageType ?? narrowed.sourceType ?? narrowed.type;
  }

  if (narrowed?.kind === "rename") {
    return localStorageType ?? narrowed.sourceType ?? narrowed.type;
  }

  return localStorageType ?? resolveIdentifierValueSurfaceType(expr, context);
};

export const resolveIdentifierRuntimeCarrierType = (
  expr: Extract<IrExpression, { kind: "identifier" }>,
  context: EmitterContext
): IrType | undefined => {
  const narrowed = context.narrowedBindings?.get(expr.name);
  if (narrowed?.kind === "expr") {
    return narrowed.sourceType ?? narrowed.storageType ?? narrowed.type;
  }

  if (narrowed?.kind === "runtimeSubset") {
    return narrowed.sourceType ?? narrowed.type;
  }

  if (narrowed?.kind === "rename") {
    return narrowed.sourceType ?? narrowed.type;
  }

  return (
    context.localValueTypes?.get(expr.name) ??
    resolveIdentifierValueSurfaceType(expr, context)
  );
};

export const resolveDirectStorageExpressionAst = (
  expr: IrExpression,
  context: EmitterContext
): CSharpExpressionAst | undefined => {
  if (expr.kind !== "identifier" && expr.kind !== "memberAccess") {
    return undefined;
  }

  const narrowKey =
    expr.kind === "identifier" ? expr.name : getMemberAccessNarrowKey(expr);
  const narrowed = narrowKey
    ? context.narrowedBindings?.get(narrowKey)
    : undefined;
  if (narrowed?.kind === "expr" && narrowed.storageExprAst) {
    return narrowed.storageExprAst;
  }

  if (expr.kind !== "identifier") {
    return undefined;
  }

  return identifierExpression(
    context.localNameMap?.get(expr.name) ?? escapeCSharpIdentifier(expr.name)
  );
};

export const resolveRuntimeCarrierExpressionAst = (
  expr: IrExpression,
  context: EmitterContext
): CSharpExpressionAst | undefined => {
  if (expr.kind !== "identifier" && expr.kind !== "memberAccess") {
    return undefined;
  }

  const narrowKey =
    expr.kind === "identifier" ? expr.name : getMemberAccessNarrowKey(expr);
  const narrowed = narrowKey
    ? context.narrowedBindings?.get(narrowKey)
    : undefined;
  if (narrowed?.kind === "expr") {
    return narrowed.carrierExprAst ?? narrowed.storageExprAst;
  }
  if (narrowed?.kind === "runtimeSubset" && narrowed.storageExprAst) {
    return narrowed.storageExprAst;
  }

  if (expr.kind !== "identifier") {
    return undefined;
  }

  return identifierExpression(
    context.localNameMap?.get(expr.name) ?? escapeCSharpIdentifier(expr.name)
  );
};
