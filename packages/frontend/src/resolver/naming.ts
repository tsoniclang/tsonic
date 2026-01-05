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
export const getClassNameFromPath = (
  filePath: string,
  classNamingPolicy?: "PascalCase"
): string => {
  const basename = path.basename(filePath, ".ts");

  if (classNamingPolicy === "PascalCase") {
    return toPascalCase(basename);
  }

  // Default: strip hyphens from file names (per spec: hyphens are ignored)
  return basename.replace(/-/g, "");
};

const toPascalCase = (name: string): string => {
  const parts = name.split(/[-_]+/g).filter((p) => p.length > 0);
  if (parts.length === 0) return "";

  return parts
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join("");
};
