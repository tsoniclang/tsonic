import { IrExpression } from "@tsonic/frontend";
import { EmitterContext, NarrowedBinding } from "../../types.js";
import { identifierExpression } from "../../core/format/backend-ast/builders.js";
import { tryResolveRuntimeUnionMemberType } from "../../core/semantic/narrowed-expression-types.js";
import { willCarryAsRuntimeUnion } from "../../core/semantic/union-semantics.js";
import type { CSharpExpressionAst } from "../../core/format/backend-ast/types.js";
import { matchesEmittedStorageSurface } from "./storage-surface-match.js";

export const tryEmitImplicitNarrowedStorageIdentifier = (
  expr: Extract<IrExpression, { kind: "identifier" }>,
  narrowed: Extract<NarrowedBinding, { kind: "expr" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] | undefined => {
  if (!narrowed.storageExprAst || !narrowed.type) {
    return undefined;
  }

  const storageType =
    narrowed.storageType ?? context.localValueTypes?.get(expr.name);
  if (!storageType) {
    return undefined;
  }

  const narrowedProjectionType =
    narrowed.type ??
    tryResolveRuntimeUnionMemberType(
      narrowed.sourceType ?? storageType,
      narrowed.exprAst,
      context
    );
  const shouldAvoidProjectedRuntimeUnionStorageReuse =
    narrowed.storageExprAst !== undefined &&
    narrowed.storageExprAst !== narrowed.exprAst &&
    willCarryAsRuntimeUnion(storageType, context) &&
    !!narrowedProjectionType &&
    !willCarryAsRuntimeUnion(narrowedProjectionType, context);
  if (shouldAvoidProjectedRuntimeUnionStorageReuse) {
    return undefined;
  }

  const [sameSurface, nextContext] = matchesEmittedStorageSurface(
    storageType,
    narrowed.type,
    context
  );
  if (!sameSurface) {
    return undefined;
  }

  return [narrowed.storageExprAst, nextContext];
};

export const tryEmitImplicitRuntimeSubsetStorageIdentifier = (
  expr: Extract<IrExpression, { kind: "identifier" }>,
  narrowed: Extract<NarrowedBinding, { kind: "runtimeSubset" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] | undefined => {
  if (!narrowed.type) {
    return undefined;
  }

  const remappedLocal = context.localNameMap?.get(expr.name);
  const storageType = context.localValueTypes?.get(expr.name);
  if (!remappedLocal || !storageType) {
    return undefined;
  }

  const [sameSurface, nextContext] = matchesEmittedStorageSurface(
    storageType,
    narrowed.type,
    context
  );
  if (!sameSurface) {
    return undefined;
  }

  return [identifierExpression(remappedLocal), nextContext];
};
