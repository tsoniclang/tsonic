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
    if (imp.isDotNet) {
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
  // Get the directory of the current file
  // e.g., "/src/services/api.ts" -> "/src/services"
  const currentDir = currentFilePath.substring(
    0,
    currentFilePath.lastIndexOf("/")
  );

  // Resolve the import path relative to current directory
  // e.g., "./auth.ts" from "/src/services" -> "/src/services/auth.ts"
  // e.g., "../models/User.ts" from "/src/services" -> "/src/models/User.ts"
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

  // Convert directory path to namespace
  // e.g., "/src/services" -> ["src", "services"]
  const parts = dirPath.split("/").filter((p) => p !== "");

  if (parts.length === 0) {
    return rootNamespace;
  }

  // Remove "src" if it's the first part (common convention)
  if (parts[0] === "src") {
    parts.shift();
  }

  if (parts.length === 0) {
    return rootNamespace;
  }

  return `${rootNamespace}.${parts.join(".")}`;
};
