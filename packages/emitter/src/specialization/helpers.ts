/**
 * Helper functions for specialization (key generation, serialization)
 */

import { IrType } from "@tsonic/frontend";

/**
 * Create a unique key for a specialization request
 */
export const createSpecializationKey = (
  name: string,
  typeArgs: readonly IrType[]
): string => {
  // Simple serialization of type arguments for deduplication
  const typeStrs = typeArgs.map((t) => serializeType(t));
  return `${name}<${typeStrs.join(",")}>`;
};

/**
 * Simple type serialization for deduplication
 */
export const serializeType = (type: IrType): string => {
  switch (type.kind) {
    case "primitiveType":
      return type.name;
    case "referenceType":
      if (type.typeArguments && type.typeArguments.length > 0) {
        const args = type.typeArguments.map(serializeType).join(",");
        return `${type.name}<${args}>`;
      }
      return type.name;
    case "arrayType":
      return `${serializeType(type.elementType)}[]`;
    case "literalType":
      return `literal:${type.value}`;
    default:
      return type.kind;
  }
};
