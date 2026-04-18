import * as ts from "typescript";
import type { IrType } from "../types.js";
import type { ProgramContext } from "../program-context.js";
// eslint-disable-next-line no-restricted-imports -- heritage resolution is a frontend conversion boundary.
import { resolveHeritageTypeName } from "../type-system/internal/registry-helpers-extraction.js";

export const resolveHeritageReferenceType = (
  typeNode: ts.ExpressionWithTypeArguments,
  ctx: ProgramContext
): IrType => {
  const converted = ctx.typeSystem.typeFromSyntax(
    ctx.binding.captureTypeSyntax(typeNode)
  );
  const resolvedName = resolveHeritageTypeName(
    typeNode,
    ctx.checker,
    ctx.sourceRoot,
    ctx.rootNamespace
  );

  if (!resolvedName) {
    return converted;
  }

  if (converted.kind === "referenceType") {
    return {
      ...converted,
      name: resolvedName,
    };
  }

  const typeArguments = typeNode.typeArguments?.map((typeArgument) =>
    ctx.typeSystem.typeFromSyntax(ctx.binding.captureTypeSyntax(typeArgument))
  );

  return {
    kind: "referenceType",
    name: resolvedName,
    ...(typeArguments && typeArguments.length > 0 ? { typeArguments } : {}),
  };
};
