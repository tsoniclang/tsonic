/**
 * Namespace and class name generation from file paths
 */

import * as path from "node:path";

const normalizePathFragment = (fragment: string): string =>
  fragment.replace(/-/g, "");

/**
 * Generate class name from file path
 */
export const getClassNameFromPath = (filePath: string): string => {
  const basename = path.basename(filePath, ".ts");
  return normalizePathFragment(basename);
};
