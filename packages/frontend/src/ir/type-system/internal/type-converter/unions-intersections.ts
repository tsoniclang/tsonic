/**
 * Union and intersection type conversion
 */

import * as ts from "typescript";
import { IrObjectType, IrType } from "../../../types.js";
import { normalizedUnionType } from "../../../types/type-ops.js";
import type { Binding } from "../../../binding/index.js";

/**
 * Convert TypeScript union type to IR union type
 */
export const convertUnionType = (
  node: ts.UnionTypeNode,
  binding: Binding,
  convertType: (node: ts.TypeNode, binding: Binding) => IrType
): IrType => {
  return normalizedUnionType(node.types.map((t) => convertType(t, binding)));
};

/**
 * Convert TypeScript intersection type to IR intersection type
 */
export const convertIntersectionType = (
  node: ts.IntersectionTypeNode,
  binding: Binding,
  convertType: (node: ts.TypeNode, binding: Binding) => IrType
): IrType => {
  const parts = node.types.flatMap((typeNode): readonly IrType[] => {
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
