/**
 * Import processing and resolution
 *
 * All imports are resolved to fully-qualified global:: references.
 * No using statements are emitted - everything uses explicit FQN.
 *
 * All CLR name resolution happens here using module map - the emitter
 * just uses the pre-computed clrName directly (no string parsing).
 */

import { IrImport, IrModule, IrImportSpecifier } from "@tsonic/frontend";
import { EmitterContext, ImportBinding } from "../types.js";
import { resolveImportPath } from "./module-map.js";

/**
 * Process imports and build ImportBindings for local modules.
 *
 * NOTE: No using statements are collected. All type/member references
 * are emitted as fully-qualified global:: names.
 *
 * - BCL/runtime imports: No action needed (types use global:: FQN)
 * - Local module imports: Build ImportBindings with fully-qualified CLR names
 */
export const processImports = (
  imports: readonly IrImport[],
  context: EmitterContext,
  module: IrModule
): EmitterContext => {
  const importBindings = new Map<string, ImportBinding>();

  const updatedContext = imports.reduce((ctx, imp) => {
    // BCL/runtime imports: No using needed, types are emitted with global:: FQN
    // .NET imports: No using needed, types are emitted with global:: FQN

    if (imp.isLocal) {
      // Local import - build ImportBindings with fully-qualified CLR names
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
            const binding = createImportBinding(
              spec,
              targetModule.namespace,
              targetModule.className,
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
 * Create import binding with fully-qualified global:: CLR names.
 * Uses isType from frontend (set by TS checker) to determine kind.
 *
 * - Type imports: clrName is the type's global:: FQN (global::namespace.TypeName)
 * - Value imports: clrName is the container global:: FQN, member is the export name
 * - Namespace imports: clrName is the container global:: FQN
 */
const createImportBinding = (
  spec: IrImportSpecifier,
  namespace: string,
  containerClassName: string,
  resolvedExportName: string
): { localName: string; importBinding: ImportBinding } | null => {
  const localName = spec.localName;
  const containerFqn = `global::${namespace}.${containerClassName}`;

  if (spec.kind === "named") {
    // Use isType from frontend (determined by TS checker)
    const isType = spec.isType === true;

    if (isType) {
      // Type import: clrName is the type's FQN at namespace level
      // Types are emitted at namespace level, not inside container class
      return {
        localName,
        importBinding: {
          kind: "type",
          clrName: `global::${namespace}.${resolvedExportName}`,
        },
      };
    } else {
      // Value import: clrName is container, member is the export name
      return {
        localName,
        importBinding: {
          kind: "value",
          clrName: containerFqn,
          member: resolvedExportName,
        },
      };
    }
  }

  if (spec.kind === "default") {
    // Default export binds to the container class itself
    // TODO: Consider adding diagnostic for unsupported default exports
    return {
      localName,
      importBinding: {
        kind: "value",
        clrName: containerFqn,
      },
    };
  }

  if (spec.kind === "namespace") {
    // Namespace imports (import * as M) - bind to the container class
    return {
      localName,
      importBinding: {
        kind: "namespace",
        clrName: containerFqn,
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
