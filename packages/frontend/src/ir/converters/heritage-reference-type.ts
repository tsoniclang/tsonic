import type { TstsNode } from "@tsonic/tsts";
import { getTstsTypeArguments } from "@tsonic/tsts";
import type { IrType } from "../types.js";
import type { ProgramContext } from "../program-context.js";
// eslint-disable-next-line no-restricted-imports -- heritage resolution is a frontend conversion boundary.
import { resolveHeritageTypeName } from "../type-system/internal/registry-helpers-extraction.js";

export const resolveHeritageReferenceType = (
  typeNode: TstsNode,
  ctx: ProgramContext
): IrType => {
  const converted = ctx.typeSystem.typeFromSyntax(
    ctx.binding.captureTypeSyntax(typeNode)
  );
  const resolvedName = resolveHeritageTypeName(
    typeNode,
    ctx.sourceSemantics,
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

  const typeArguments = getTstsTypeArguments(typeNode)
    .filter((typeArgument): typeArgument is TstsNode => typeArgument !== undefined)
    .map((typeArgument) =>
      ctx.typeSystem.typeFromSyntax(ctx.binding.captureTypeSyntax(typeArgument))
    );

  return {
    kind: "referenceType",
    name: resolvedName,
    ...(typeArguments && typeArguments.length > 0 ? { typeArguments } : {}),
  };
};
