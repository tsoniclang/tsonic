/**
 * Namespace and class name generation from file paths
 */

import * as path from "node:path";
import { applyNamingPolicy, type NamingPolicy } from "./naming-policy.js";

/**
 * Generate class name from file path
 */
export const getClassNameFromPath = (
  filePath: string,
  classNamingPolicy?: NamingPolicy
): string => {
  const basename = path.basename(filePath, ".ts");
  return applyNamingPolicy(basename, classNamingPolicy ?? "clr");
};
