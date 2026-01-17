import { dirname, relative } from "path";

const normalizePathFragment = (fragment: string): string =>
  fragment.replace(/-/g, "");

/**
 * Compute namespace from file path relative to source root.
 *
 * Rules:
 * - Namespace = rootNamespace + path components (excluding "src")
 * - Path normalized with "/" separators after relative() call
 * - Empty path maps to root namespace
 *
 * Examples:
 * - /project/src/models/user.ts → RootNamespace.models
 * - /project/src/index.ts → RootNamespace
 * - /project/models/user.ts → RootNamespace.models
 *
 * @param filePath - Absolute path to the TypeScript file
 * @param sourceRoot - Absolute path to source root directory
 * @param rootNamespace - Root namespace for the project
 * @returns Computed namespace string
 */
export const getNamespaceFromPath = (
  filePath: string,
  sourceRoot: string,
  rootNamespace: string,
): string => {
  const fileDir = dirname(filePath);

  // Make relative to source root, then normalize to forward slashes
  // IMPORTANT: Normalize AFTER relative() call, not before (cross-platform)
  let relativePath = relative(sourceRoot, fileDir).replace(/\\/g, "/");

  // Split by "/" and filter out empty, ".", and "src" components
  const parts = relativePath
    .split("/")
    .filter((p) => p !== "" && p !== "." && p !== "src");

  // If no path components, return root namespace
  // Otherwise, join with "."
  return parts.length === 0
    ? rootNamespace
    : `${rootNamespace}.${parts
        .map(normalizePathFragment)
        .join(".")}`;
};
