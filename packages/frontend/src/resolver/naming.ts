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
  classNamingPolicy: "default" | "PascalCase" = "default"
): string => {
  const basename = path.basename(filePath, ".ts");
  // Default behavior: strip hyphens from file names (per spec: hyphens are ignored)
  if (classNamingPolicy === "default") {
    return basename.replace(/-/g, "");
  }

  // PascalCase: treat '-' and '_' as word separators; uppercase first char of each segment.
  const parts = basename.split(/[-_]+/g).filter((p) => p.length > 0);
  if (parts.length === 0) return "";
  return parts
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("");
};
