/**
 * Import processing and resolution
 */

import { IrImport, IrModule } from "@tsonic/frontend";
import { EmitterContext, addUsing } from "../types.js";

/**
 * Process imports and collect using statements
 */
export const processImports = (
  imports: readonly IrImport[],
  context: EmitterContext,
  module: IrModule
): EmitterContext => {
  let currentContext = context;

  for (const imp of imports) {
    if (imp.resolvedAssembly) {
      // Module binding (Node.js API, etc.) - add assembly using
      currentContext = addUsing(currentContext, imp.resolvedAssembly);
    } else if (imp.isDotNet) {
      // .NET import - add to using statements
      if (imp.resolvedNamespace) {
        currentContext = addUsing(currentContext, imp.resolvedNamespace);
      }
    } else if (imp.isLocal) {
      // Local import - resolve to namespace
      const namespace = resolveLocalImport(
        imp,
        module.filePath,
        context.options.rootNamespace
      );
      if (namespace) {
        currentContext = addUsing(currentContext, namespace);
      }
    }
    // External packages not supported in MVP
  }

  return currentContext;
};

/**
 * Resolve local import to a namespace
 */
export const resolveLocalImport = (
  imp: IrImport,
  currentFilePath: string,
  rootNamespace: string
): string | null => {
  // Normalize paths - handle both Unix and Windows separators
  const normalize = (p: string) => p.replace(/\\/g, "/");
  const currentFile = normalize(currentFilePath);

  // Get the directory of the current file
  const currentDir = currentFile.substring(0, currentFile.lastIndexOf("/"));

  // Resolve the import path relative to current directory
  let resolvedPath: string;
  if (imp.source.startsWith("./")) {
    resolvedPath = `${currentDir}/${imp.source.substring(2)}`;
  } else if (imp.source.startsWith("../")) {
    const parts = currentDir.split("/");
    let source = imp.source;
    while (source.startsWith("../")) {
      parts.pop(); // Go up one directory
      source = source.substring(3);
    }
    resolvedPath = `${parts.join("/")}/${source}`;
  } else {
    resolvedPath = `${currentDir}/${imp.source}`;
  }

  // Remove .ts extension and get directory path
  const withoutExtension = resolvedPath.replace(/\.ts$/, "");
  const dirPath = withoutExtension.substring(
    0,
    withoutExtension.lastIndexOf("/")
  );

  // Convert directory path to namespace - only use path after last "/src/"
  // e.g., "/absolute/path/to/project/src/services" -> ["services"]
  // e.g., "/absolute/path/to/project/src" -> [] (files in src/ have no sub-namespace)
  const srcIndex = dirPath.lastIndexOf("/src/");
  const endsWithSrc = dirPath.endsWith("/src");
  let relativePath: string;

  if (srcIndex >= 0) {
    // Found "/src/", use everything after it
    relativePath = dirPath.substring(srcIndex + 5); // +5 to skip "/src/"
  } else if (endsWithSrc) {
    // Path ends with "/src", so files are directly in src/
    relativePath = "";
  } else if (dirPath.startsWith("src/")) {
    // Path starts with "src/", skip it
    relativePath = dirPath.substring(4); // Skip "src/"
  } else if (dirPath === "src") {
    // Just "src"
    relativePath = "";
  } else {
    // No src directory found, this shouldn't happen
    // but fallback to empty to use just root namespace
    relativePath = "";
  }

  const parts = relativePath.split("/").filter((p) => p !== "" && p !== ".");

  if (parts.length === 0) {
    return rootNamespace;
  }

  return `${rootNamespace}.${parts.join(".")}`;
};
