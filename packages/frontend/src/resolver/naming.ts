/**
 * Namespace and class name generation from file paths
 */

import * as path from "node:path";

const normalizePathFragment = (fragment: string): string => {
  // Fast path: If the fragment is already a valid identifier fragment (letters/digits),
  // keep it as-is (airplane-grade: no heuristics like camelCase word splitting).
  //
  // NOTE: We intentionally treat underscores as separators, not identifier characters,
  // so "foo_bar" behaves like "foo-bar" and becomes "FooBar" for readability.
  if (/^[a-zA-Z0-9]+$/.test(fragment)) {
    if (fragment.length === 0) return "_";
    return /^\d/.test(fragment) ? `_${fragment}` : fragment;
  }

  // Tokenize on any non-alphanumeric sequence (kebab-case, snake_case, dotted.names, etc)
  // and PascalCase the result.
  const parts = fragment.split(/[^a-zA-Z0-9]+/g).filter((p) => p.length > 0);
  const pascal = parts
    .map((p) => (p.length === 0 ? "" : p.charAt(0).toUpperCase() + p.slice(1)))
    .join("");

  if (pascal.length === 0) return "_";
  return /^\d/.test(pascal) ? `_${pascal}` : pascal;
};

/**
 * Generate class name from file path
 */
export const getClassNameFromPath = (filePath: string): string => {
  const basename = path.basename(filePath, ".ts");
  return normalizePathFragment(basename);
};
