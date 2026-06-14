/**
 * Array type conversion
 */

import type { TstsNode } from "@tsonic/tsts";
import { IrType } from "../../../types.js";
import type { Binding } from "../../../binding/index.js";
import { TstsSyntax } from "@tsonic/tsts";

/**
 * Convert TSTS array type to IR array type
 */
export const convertArrayType = (
  node: TstsNode,
  binding: Binding,
  convertType: (node: TstsNode, binding: Binding) => IrType
): IrType => {
  const arrayNode = TstsSyntax.AsArrayTypeNode(node);
  return {
    kind: "arrayType",
    elementType: arrayNode?.ElementType
      ? convertType(arrayNode.ElementType, binding)
      : { kind: "unknownType" },
    origin: "explicit",
  };
};
