/**
 * Import processing and resolution
 *
 * Local module imports are always emitted as fully-qualified references.
 * This eliminates the need for collision detection and using aliases.
 */

import { IrImport, IrModule, IrImportSpecifier } from "@tsonic/frontend";
import { EmitterContext, addUsing, ImportBinding } from "../types.js";
import { resolveImportPath } from "./module-map.js";

/**
 * Process imports and collect using statements.
 *
 * - BCL/runtime imports: Add to using statements
 * - Local module imports: Build ImportBindings with fully-qualified containers (no using)
 */
export const processImports = (
  imports: readonly IrImport[],
  context: EmitterContext,
  module: IrModule
): EmitterContext => {
  const importBindings = new Map<string, ImportBinding>();

  const updatedContext = imports.reduce((ctx, imp) => {
    if (imp.resolvedAssembly) {
      // Module binding (Node.js API, etc.) - add assembly using
      return addUsing(ctx, imp.resolvedAssembly);
    }

    if (imp.isDotNet) {
      // .NET import - add to using statements
      return imp.resolvedNamespace ? addUsing(ctx, imp.resolvedNamespace) : ctx;
    }

    if (imp.isLocal) {
      // Local import - build ImportBindings with fully-qualified containers
      // NO using directive for local modules
      const moduleMap = ctx.options.moduleMap;
      const exportMap = ctx.options.exportMap;
      if (moduleMap) {
        const targetPath = resolveImportPath(module.filePath, imp.source);

        // Process each import specifier - may need to resolve re-exports
        for (const spec of imp.specifiers) {
          const exportName =
            spec.kind === "named"
              ? spec.name
              : spec.kind === "default"
                ? ""
                : "";

          // Check if this is a re-export - look up in export map
          const reexportKey = `${targetPath}:${exportName}`;
          const reexportSource = exportMap?.get(reexportKey);

          // Determine the actual source module
          const actualSourcePath = reexportSource?.sourceFile ?? targetPath;
          const actualExportName = reexportSource?.sourceName ?? exportName;
          const targetModule = moduleMap.get(actualSourcePath);

          if (targetModule) {
            // Build fully-qualified container reference to actual source
            const fullyQualifiedContainer = `${targetModule.namespace}.${targetModule.className}`;
            const binding = createImportBindingWithName(
              spec,
              fullyQualifiedContainer,
              actualExportName
            );
            if (binding) {
              importBindings.set(binding.localName, binding.importBinding);
            }
          }
        }
        // If module not found in map, it's a compilation error - will be caught elsewhere
      }
      // No module map = single file compilation, no import bindings needed
    }

    // External packages not supported in MVP
    return ctx;
  }, context);

  // Add import bindings to context
  return {
    ...updatedContext,
    importBindings,
  };
};

/**
 * Create import binding with explicit export name.
 * Used for re-exports where the resolved name may differ from spec.name.
 */
const createImportBindingWithName = (
  spec: IrImportSpecifier,
  fullyQualifiedContainer: string,
  resolvedExportName: string
): { localName: string; importBinding: ImportBinding } | null => {
  // Determine local name based on specifier kind
  const localName = spec.localName;

  if (spec.kind === "named") {
    return {
      localName,
      importBinding: {
        fullyQualifiedContainer,
        exportName: resolvedExportName, // Use resolved name (may differ for re-exports)
      },
    };
  }

  if (spec.kind === "default") {
    // Default export binds to the container class itself
    return {
      localName,
      importBinding: {
        fullyQualifiedContainer,
        exportName: "", // Empty = container class itself
      },
    };
  }

  if (spec.kind === "namespace") {
    // Namespace imports (import * as M) - bind to the container class
    return {
      localName,
      importBinding: {
        fullyQualifiedContainer,
        exportName: "", // Empty = the whole module/container
      },
    };
  }

  return null;
};

/**
 * Resolve local import to a namespace (legacy fallback for single-file compilation)
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
  const resolvedPath = resolveRelativePath(currentDir, imp.source);

  // Remove .ts extension and get directory path
  const withoutExtension = resolvedPath.replace(/\.ts$/, "");
  const dirPath = withoutExtension.substring(
    0,
    withoutExtension.lastIndexOf("/")
  );

  // Convert directory path to namespace - only use path after last "/src/"
  const relativePath = extractRelativePath(dirPath);
  const parts = relativePath.split("/").filter((p) => p !== "" && p !== ".");

  return parts.length === 0
    ? rootNamespace
    : `${rootNamespace}.${parts.join(".")}`;
};

/**
 * Resolve a relative import path from a given directory
 */
const resolveRelativePath = (currentDir: string, source: string): string => {
  if (source.startsWith("./")) {
    return `${currentDir}/${source.substring(2)}`;
  }

  if (source.startsWith("../")) {
    const parts = currentDir.split("/");
    const sourceCopy = source;
    return resolveParentPath(parts, sourceCopy);
  }

  return `${currentDir}/${source}`;
};

/**
 * Resolve parent path references (..)
 */
const resolveParentPath = (parts: string[], source: string): string => {
  if (!source.startsWith("../")) {
    return `${parts.join("/")}/${source}`;
  }
  return resolveParentPath(parts.slice(0, -1), source.substring(3));
};

/**
 * Extract relative path from a directory path
 */
const extractRelativePath = (dirPath: string): string => {
  const srcIndex = dirPath.lastIndexOf("/src/");

  if (srcIndex >= 0) {
    return dirPath.substring(srcIndex + 5);
  }

  if (dirPath.endsWith("/src")) {
    return "";
  }

  if (dirPath.startsWith("src/")) {
    return dirPath.substring(4);
  }

  if (dirPath === "src") {
    return "";
  }

  return "";
};
