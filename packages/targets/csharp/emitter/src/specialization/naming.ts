/**
 * Name generation for specialized declarations
 */

import { IrType } from "@tsonic/frontend";
import { serializeType } from "./helpers.js";

const sanitizeSpecializedTypeNamePart = (serialized: string): string => {
  const sanitized = serialized
    .replace(/[^A-Za-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return sanitized.length > 0 ? sanitized : "Type";
};

/**
 * Generate specialized function name
 */
export const generateSpecializedFunctionName = (
  baseName: string,
  typeArgs: readonly IrType[]
): string => {
  const typeNames = typeArgs.map((t) => {
    const serialized = serializeType(t);
    return sanitizeSpecializedTypeNamePart(serialized);
  });
  return `${baseName}__${typeNames.join("__")}`;
};

/**
 * Generate specialized class name
 */
export const generateSpecializedClassName = (
  baseName: string,
  typeArgs: readonly IrType[]
): string => {
  const typeNames = typeArgs.map((t) => {
    const serialized = serializeType(t);
    return sanitizeSpecializedTypeNamePart(serialized);
  });
  return `${baseName}__${typeNames.join("__")}`;
};
