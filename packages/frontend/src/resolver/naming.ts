/**
 * Namespace and class name generation from file paths
 */

import * as path from "node:path";

const normalizePathFragment = (fragment: string): string => {
  const cleaned = fragment.replace(/[^a-zA-Z0-9_]/g, "");
  if (cleaned.length === 0) return "_";
  return /^\d/.test(cleaned) ? `_${cleaned}` : cleaned;
};

/**
 * Generate class name from file path
 */
export const getClassNameFromPath = (filePath: string): string => {
  const basename = path.basename(filePath, ".ts");
  return normalizePathFragment(basename);
};
