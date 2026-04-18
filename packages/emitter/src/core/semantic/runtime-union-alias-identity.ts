import { stableIrTypeKey, type IrType } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import { resolveTypeAlias } from "./type-resolution.js";

export const getRuntimeUnionAliasReferenceKey = (
  type: IrType,
  context: EmitterContext
): string | undefined => {
  const resolved =
    type.kind === "referenceType" ? resolveTypeAlias(type, context) : type;
  if (
    resolved.kind !== "unionType" ||
    !resolved.runtimeCarrierFamilyKey ||
    !resolved.runtimeCarrierName ||
    !resolved.runtimeCarrierNamespace
  ) {
    return undefined;
  }

  const typeArguments =
    type.kind === "referenceType" &&
    type.typeArguments &&
    type.typeArguments.length > 0
      ? type.typeArguments
      : resolved.runtimeCarrierTypeArguments;
  return `${resolved.runtimeCarrierFamilyKey}<${(typeArguments ?? [])
    .map(stableIrTypeKey)
    .join(",")}>`;
};

export const runtimeUnionAliasReferencesMatch = (
  left: IrType,
  right: IrType,
  context: EmitterContext
): boolean => {
  const leftKey = getRuntimeUnionAliasReferenceKey(left, context);
  return (
    leftKey !== undefined &&
    leftKey === getRuntimeUnionAliasReferenceKey(right, context)
  );
};
