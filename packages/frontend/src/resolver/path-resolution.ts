/**
 * Path resolution utilities
 */

import * as path from "node:path";

/**
 * Resolve module path relative to source root
 */
export const resolveModulePath = (
  filePath: string,
  sourceRoot: string
): string => {
  const absolutePath = path.resolve(filePath);
  const absoluteRoot = path.resolve(sourceRoot);

  if (!absolutePath.startsWith(absoluteRoot)) {
    throw new Error(`File ${filePath} is outside source root ${sourceRoot}`);
  }

  return path.relative(absoluteRoot, absolutePath);
};
