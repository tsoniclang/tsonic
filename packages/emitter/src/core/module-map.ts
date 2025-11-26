/**
 * Module map for resolving cross-file imports
 */

import { IrModule, Diagnostic } from "@tsonic/frontend";
import type {
  ModuleIdentity,
  ModuleMap,
  ExportSource,
  ExportMap,
} from "../emitter-types/core.js";

// Re-export types for backward compatibility
export type { ModuleIdentity, ModuleMap, ExportSource, ExportMap };

/**
 * Normalize a file path for use as module map key
 * - Convert backslashes to forward slashes
 * - Remove .ts extension if present
 * - Normalize . and .. segments
 */
export const canonicalizeFilePath = (filePath: string): string => {
  // Normalize slashes
  let normalized = filePath.replace(/\\/g, "/");

  // Remove .ts extension
  if (normalized.endsWith(".ts")) {
    normalized = normalized.slice(0, -3);
  }

  // Split into segments and resolve . and ..
  const segments: string[] = [];
  for (const segment of normalized.split("/")) {
    if (segment === "" || segment === ".") {
      continue; // Skip empty and current directory
    } else if (segment === "..") {
      segments.pop(); // Go up one directory
    } else {
      segments.push(segment);
    }
  }

  return segments.join("/");
};

/**
 * Result of building module map
 */
export type ModuleMapResult =
  | {
      readonly ok: true;
      readonly value: ModuleMap;
      readonly exportMap: ExportMap;
    }
  | { readonly ok: false; readonly errors: readonly Diagnostic[] };

/**
 * Build module map from IR modules.
 * Returns an error if any two files in the same namespace have the same
 * normalized class name (e.g., api-client.ts and apiclient.ts both map to "apiclient").
 */
export const buildModuleMap = (
  modules: readonly IrModule[]
): ModuleMapResult => {
  const map = new Map<string, ModuleIdentity>();
  const errors: Diagnostic[] = [];

  // Group modules by namespace to detect class name collisions
  const byNamespace = new Map<string, IrModule[]>();
  for (const module of modules) {
    const existing = byNamespace.get(module.namespace) ?? [];
    byNamespace.set(module.namespace, [...existing, module]);
  }

  // Check for collisions within each namespace
  for (const [namespace, nsModules] of byNamespace) {
    const byClassName = new Map<string, IrModule[]>();
    for (const module of nsModules) {
      const existing = byClassName.get(module.className) ?? [];
      byClassName.set(module.className, [...existing, module]);
    }

    // Report collisions
    for (const [className, colliding] of byClassName) {
      if (colliding.length > 1) {
        const fileNames = colliding
          .map((m) => `'${m.filePath.split("/").pop()}'`)
          .join(" and ");
        errors.push({
          code: "TSN9001",
          message: `File name collision after normalization: ${fileNames} both map to class '${className}' in namespace '${namespace}'. Rename one file.`,
          severity: "error",
        });
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  // Build the map
  for (const module of modules) {
    const canonicalPath = canonicalizeFilePath(module.filePath);
    const typeExports = extractTypeExports(module);
    map.set(canonicalPath, {
      namespace: module.namespace,
      className: module.className,
      filePath: canonicalPath,
      typeExports,
    });
  }

  // Build the export map
  const exportMap = buildExportMap(modules);

  return { ok: true, value: map, exportMap };
};

/**
 * Build export map from IR modules.
 * Maps (modulePath, exportName) -> actual source for re-exports.
 */
const buildExportMap = (modules: readonly IrModule[]): ExportMap => {
  const exportMap = new Map<string, ExportSource>();

  // First pass: collect all re-exports
  for (const module of modules) {
    const modulePath = canonicalizeFilePath(module.filePath);

    for (const exp of module.exports) {
      if (exp.kind === "reexport") {
        // Resolve the source module path
        const sourcePath = resolveImportPath(module.filePath, exp.fromModule);
        const key = `${modulePath}:${exp.name}`;
        exportMap.set(key, {
          sourceFile: sourcePath,
          sourceName: exp.originalName,
        });
      }
    }
  }

  // Second pass: resolve transitive re-exports
  // Keep resolving until no changes (handles chains like A re-exports from B re-exports from C)
  const resolveTransitive = (): boolean => {
    let changed = false;

    for (const [key, source] of exportMap) {
      const transitiveKey = `${source.sourceFile}:${source.sourceName}`;
      const transitiveSource = exportMap.get(transitiveKey);

      if (transitiveSource) {
        // This is a transitive re-export - update to point to the actual source
        exportMap.set(key, transitiveSource);
        changed = true;
      }
    }

    return changed;
  };

  // Resolve transitive re-exports (max 10 iterations to prevent infinite loops)
  for (let i = 0; i < 10 && resolveTransitive(); i++) {
    // Keep resolving
  }

  return exportMap;
};

/**
 * Resolve a relative import path to a canonical file path
 */
export const resolveImportPath = (
  currentFilePath: string,
  importSource: string
): string => {
  // Normalize current file path
  const currentCanonical = canonicalizeFilePath(currentFilePath);

  // Get directory of current file
  const lastSlash = currentCanonical.lastIndexOf("/");
  const currentDir = lastSlash >= 0 ? currentCanonical.slice(0, lastSlash) : "";

  // Normalize import source
  let source = importSource.replace(/\\/g, "/");

  // Remove .ts extension if present
  if (source.endsWith(".ts")) {
    source = source.slice(0, -3);
  }

  // Resolve relative path
  let resolvedPath: string;
  if (source.startsWith("./")) {
    // Same directory or subdirectory
    resolvedPath = currentDir
      ? `${currentDir}/${source.slice(2)}`
      : source.slice(2);
  } else if (source.startsWith("../")) {
    // Parent directory
    const parts = currentDir.split("/");
    let remaining = source;
    while (remaining.startsWith("../")) {
      parts.pop();
      remaining = remaining.slice(3);
    }
    resolvedPath =
      parts.length > 0 ? `${parts.join("/")}/${remaining}` : remaining;
  } else if (source.startsWith("/")) {
    // Absolute path (remove leading slash)
    resolvedPath = source.slice(1);
  } else {
    // No ./ or ../, treat as same directory
    resolvedPath = currentDir ? `${currentDir}/${source}` : source;
  }

  // Canonicalize the result
  return canonicalizeFilePath(resolvedPath);
};

/**
 * Extract type export names from a module.
 * Types (interfaces, classes) are emitted at namespace level in C#,
 * while values (functions, variables) are inside the container class.
 */
const extractTypeExports = (module: IrModule): ReadonlySet<string> => {
  const typeNames = new Set<string>();

  // Check exported declarations in exports array
  for (const exp of module.exports) {
    if (exp.kind === "declaration") {
      const decl = exp.declaration;
      if (
        decl.kind === "classDeclaration" ||
        decl.kind === "interfaceDeclaration"
      ) {
        typeNames.add(decl.name);
      }
    }
    // Named exports referencing types in body are handled below
    if (exp.kind === "named") {
      // Check if the local name refers to a type in the module body
      const localDecl = module.body.find(
        (stmt) =>
          (stmt.kind === "classDeclaration" ||
            stmt.kind === "interfaceDeclaration") &&
          stmt.name === exp.localName
      );
      if (localDecl) {
        typeNames.add(exp.name);
      }
    }
  }

  // Check module body for exported class/interface declarations
  for (const stmt of module.body) {
    if (
      (stmt.kind === "classDeclaration" ||
        stmt.kind === "interfaceDeclaration") &&
      stmt.isExported
    ) {
      typeNames.add(stmt.name);
    }
  }

  return typeNames;
};
