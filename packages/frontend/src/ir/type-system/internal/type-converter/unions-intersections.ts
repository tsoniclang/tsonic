/**
 * Union and intersection type conversion
 */

import type { TstsNode } from "@tsonic/tsts";
import { TstsSyntax } from "@tsonic/tsts";
import { IrObjectType, IrType } from "../../../types.js";
import { normalizedUnionType } from "../../../types/type-ops.js";
import type { Binding } from "../../../binding/index.js";

/**
 * Convert TypeScript union type to IR union type
 */
export const convertUnionType = (
  node: TstsNode,
  binding: Binding,
  convertType: (node: TstsNode, binding: Binding) => IrType
): IrType => {
  const types =
    TstsSyntax.AsUnionTypeNode(node)?.Types?.Nodes?.filter(
      (typeNode): typeNode is TstsNode => typeNode !== undefined
    ) ?? [];
  return normalizedUnionType(
    types.map((typeNode) => convertType(typeNode, binding))
  );
};

/**
 * Convert TypeScript intersection type to IR intersection type
 */
export const convertIntersectionType = (
  node: TstsNode,
  binding: Binding,
  convertType: (node: TstsNode, binding: Binding) => IrType
): IrType => {
  const types =
    TstsSyntax.AsIntersectionTypeNode(node)?.Types?.Nodes?.filter(
      (typeNode): typeNode is TstsNode => typeNode !== undefined
    ) ?? [];
  const parts = types.flatMap((typeNode): readonly IrType[] => {
    const converted = convertType(typeNode, binding);
    return converted.kind === "intersectionType"
      ? converted.types
      : [converted];
  });

  const isErasedBrandObject = (type: IrType): type is IrObjectType => {
    if (type.kind !== "objectType") {
      return false;
    }

    return (
      type.members.length > 0 &&
      type.members.every(
        (member) =>
          member.kind === "propertySignature" &&
          member.name.startsWith("__") &&
          member.isReadonly === true
      )
    );
  };

  const runtimeParts = parts.filter((part) => !isErasedBrandObject(part));
  if (runtimeParts.length === 1) {
    const runtimePart = runtimeParts[0];
    if (runtimePart) {
      return runtimePart;
    }
  }

  return {
    kind: "intersectionType",
    types: parts,
  };
};
