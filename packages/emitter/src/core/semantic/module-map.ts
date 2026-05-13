/**
 * Module map for resolving cross-file imports
 */

import { IrModule, Diagnostic } from "@tsonic/frontend";
import type {
  ModuleIdentity,
  ModuleMap,
  ExportSource,
  ExportMap,
} from "../../emitter-types/core.js";
import { buildLocalTypes, collectPublicLocalTypes } from "./local-types.js";
import {
  computeDeclarationRuntimeOmittableCallArities,
  computeFunctionValueRuntimeOmittableCallArities,
} from "./runtime-call-arities.js";
import { moduleBodyRequiresStaticContainerSuffix } from "./module-type-collisions.js";

// Re-export types from barrel
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
    const hasRuntimeContainer = module.body.some(
      (stmt) =>
        !(
          stmt.kind === "classDeclaration" ||
          stmt.kind === "interfaceDeclaration" ||
          stmt.kind === "enumDeclaration" ||
          (stmt.kind === "typeAliasDeclaration" &&
            stmt.type.kind === "objectType")
        )
    );

    // Check if the emitted static module container needs the __Module suffix.
    // This determines whether value imports target ClassName or ClassName__Module.
    const hasTypeCollision = moduleBodyRequiresStaticContainerSuffix(
      module.body,
      module.className
    );

    const exportedValueKinds = (() => {
      const kinds = new Map<string, "function" | "variable">();

      const findLocalValueKind = (
        localName: string
      ): "function" | "variable" | undefined => {
        for (const stmt of module.body) {
          if (stmt.kind === "functionDeclaration" && stmt.name === localName) {
            return "function";
          }
          if (stmt.kind === "variableDeclaration") {
            for (const decl of stmt.declarations) {
              if (decl.name.kind !== "identifierPattern") continue;
              if (decl.name.name === localName) return "variable";
            }
          }
        }
        return undefined;
      };

      for (const exp of module.exports) {
        if (exp.kind === "declaration") {
          const decl = exp.declaration;
          if (decl.kind === "functionDeclaration") {
            kinds.set(decl.name, "function");
          } else if (decl.kind === "variableDeclaration") {
            for (const d of decl.declarations) {
              if (d.name.kind !== "identifierPattern") continue;
              kinds.set(d.name.name, "variable");
            }
          }
          continue;
        }

        if (exp.kind === "named") {
          const kind = findLocalValueKind(exp.localName);
          if (kind) kinds.set(exp.name, kind);
        }
      }

      return kinds;
    })();

    const exportedValueCallArities = (() => {
      const arities = new Map<string, readonly number[]>();

      const findLocalValueCallArities = (
        localName: string
      ): readonly number[] | undefined => {
        for (const stmt of module.body) {
          if (stmt.kind === "functionDeclaration" && stmt.name === localName) {
            return computeDeclarationRuntimeOmittableCallArities(
              stmt.parameters
            );
          }
          if (stmt.kind !== "variableDeclaration") {
            continue;
          }
          for (const decl of stmt.declarations) {
            if (decl.name.kind !== "identifierPattern") {
              continue;
            }
            if (decl.name.name !== localName) {
              continue;
            }
            if (
              decl.initializer &&
              (decl.initializer.kind === "arrowFunction" ||
                decl.initializer.kind === "functionExpression")
            ) {
              return computeFunctionValueRuntimeOmittableCallArities(
                decl.initializer.parameters
              );
            }
            return undefined;
          }
        }
        return undefined;
      };

      for (const exp of module.exports) {
        if (exp.kind === "declaration") {
          const decl = exp.declaration;
          if (decl.kind === "functionDeclaration") {
            arities.set(
              decl.name,
              computeDeclarationRuntimeOmittableCallArities(decl.parameters)
            );
          } else if (decl.kind === "variableDeclaration") {
            for (const d of decl.declarations) {
              if (d.name.kind !== "identifierPattern") {
                continue;
              }
              if (
                d.initializer &&
                (d.initializer.kind === "arrowFunction" ||
                  d.initializer.kind === "functionExpression")
              ) {
                arities.set(
                  d.name.name,
                  computeFunctionValueRuntimeOmittableCallArities(
                    d.initializer.parameters
                  )
                );
              }
            }
          }
          continue;
        }

        if (exp.kind === "named") {
          const supportedArities = findLocalValueCallArities(exp.localName);
          if (supportedArities) {
            arities.set(exp.name, supportedArities);
          }
        }
      }

      return arities;
    })();

    const localTypes = buildLocalTypes(module);
    const publicLocalTypes = collectPublicLocalTypes(module, localTypes);

    map.set(canonicalPath, {
      namespace: module.namespace,
      className: module.className,
      filePath: canonicalPath,
      hasRuntimeContainer,
      hasTypeCollision,
      exportedValueKinds,
      exportedValueCallArities,
      localTypes,
      publicLocalTypes,
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
    const importedSources = new Map<string, ExportSource>();

    for (const imp of module.imports) {
      if (!imp.isLocal) continue;
      const sourceFile = resolveImportPath(module.filePath, imp.source);

      for (const spec of imp.specifiers) {
        if (spec.kind !== "named") continue;
        importedSources.set(spec.localName, {
          sourceFile,
          sourceName: spec.name,
        });
      }
    }

    for (const exp of module.exports) {
      if (exp.kind === "reexport") {
        // Resolve the source module path
        const sourcePath = resolveImportPath(module.filePath, exp.fromModule);
        const key = `${modulePath}:${exp.name}`;
        exportMap.set(key, {
          sourceFile: sourcePath,
          sourceName: exp.originalName,
        });
        continue;
      }

      if (exp.kind === "named") {
        const importedSource = importedSources.get(exp.localName);
        const key = `${modulePath}:${exp.name}`;

        if (importedSource) {
          exportMap.set(key, importedSource);
          continue;
        }

        if (exp.localName !== exp.name) {
          exportMap.set(key, {
            sourceFile: modulePath,
            sourceName: exp.localName,
          });
        }
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

  // Remove .ts or .js extension if present
  // ESM imports use .js extension for TypeScript files
  if (source.endsWith(".ts")) {
    source = source.slice(0, -3);
  } else if (source.endsWith(".js")) {
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
