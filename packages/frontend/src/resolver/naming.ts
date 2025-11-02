/**
 * Namespace and class name generation from file paths
 */

import * as path from "node:path";
import { resolveModulePath } from "./path-resolution.js";

/**
 * Generate namespace from file path
 */
export const getNamespaceFromPath = (
  filePath: string,
  sourceRoot: string,
  rootNamespace: string
): string => {
  const relativePath = resolveModulePath(filePath, sourceRoot);
  const dirPath = path.dirname(relativePath);

  if (dirPath === ".") {
    return rootNamespace;
  }

  // Strip hyphens from directory names (per spec: hyphens are ignored)
  const parts = dirPath
    .split(path.sep)
    .filter((p) => p !== ".")
    .map((p) => p.replace(/-/g, ""));
  return [rootNamespace, ...parts].join(".");
};

/**
 * Generate class name from file path
 */
export const getClassNameFromPath = (filePath: string): string => {
  const basename = path.basename(filePath, ".ts");
  // Strip hyphens from file names (per spec: hyphens are ignored)
  return basename.replace(/-/g, "");
};
