/**
 * Helper functions for specialization (key generation, serialization)
 */

import { IrType, stableIrTypeKey } from "@tsonic/frontend";

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
  return stableIrTypeKey(type);
};
