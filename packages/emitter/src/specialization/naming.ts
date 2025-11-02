/**
 * Name generation for specialized declarations
 */

import { IrType } from "@tsonic/frontend";
import { serializeType } from "./helpers.js";

/**
 * Generate specialized function name
 */
export const generateSpecializedFunctionName = (
  baseName: string,
  typeArgs: readonly IrType[]
): string => {
  const typeNames = typeArgs.map((t) => {
    const serialized = serializeType(t);
    return serialized.replace(/[<>?,\s]/g, "_").replace(/\./g, "_");
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
    return serialized.replace(/[<>?,\s]/g, "_").replace(/\./g, "_");
  });
  return `${baseName}__${typeNames.join("__")}`;
};
