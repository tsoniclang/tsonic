/**
 * Import resolution with ESM rules enforcement
 *
 * Phase 5 Step 4: No more singleton access. Module bindings are passed explicitly.
 */

import * as path from "node:path";
import * as fs from "node:fs";
import { Result, ok, error } from "../types/result.js";
import { Diagnostic, createDiagnostic } from "../types/diagnostic.js";
import { isLocalImport } from "../types/module.js";
import { ResolvedModule } from "./types.js";
import { ClrBindingsResolver } from "./clr-bindings-resolver.js";
import type { BindingRegistry } from "../program/bindings.js";

/**
 * Options for import resolution
 */
export type ResolveImportOptions = {
  readonly clrResolver?: ClrBindingsResolver;
  readonly bindings?: BindingRegistry;
};

/**
 * Resolve import specifier to module
 *
 * @param importSpecifier - The import path to resolve
 * @param containingFile - The file containing the import
 * @param sourceRoot - The project source root
 * @param opts - Optional resolvers (clrResolver for CLR imports, bindings for module bindings)
 */
export const resolveImport = (
  importSpecifier: string,
  containingFile: string,
  sourceRoot: string,
  opts?: ClrBindingsResolver | ResolveImportOptions
): Result<ResolvedModule, Diagnostic> => {
  // Support both old signature (clrResolver only) and new signature (options object)
  const clrResolver =
    opts && "resolve" in opts
      ? (opts as ClrBindingsResolver)
      : (opts as ResolveImportOptions | undefined)?.clrResolver;
  const bindings =
    opts && "resolve" in opts
      ? undefined
      : (opts as ResolveImportOptions | undefined)?.bindings;

  if (isLocalImport(importSpecifier)) {
    return resolveLocalImport(importSpecifier, containingFile, sourceRoot);
  }

  // Use import-driven resolution for CLR imports (if resolver provided)
  if (clrResolver) {
    const clrResolution = clrResolver.resolve(importSpecifier);
    if (clrResolution.isClr) {
      return ok({
        resolvedPath: "", // No file path for CLR imports
        isLocal: false,
        isClr: true,
        originalSpecifier: importSpecifier,
        resolvedNamespace: clrResolution.resolvedNamespace,
      });
    }
  }

  // Check if this is a module binding (e.g., Node.js API)
  // Only if bindings registry is provided
  if (bindings) {
    const binding = bindings.getBinding(importSpecifier);
    if (binding && binding.kind === "module") {
      return ok({
        resolvedPath: "", // No file path for bound modules
        isLocal: false,
        isClr: false,
        originalSpecifier: importSpecifier,
        resolvedClrType: binding.type,
        resolvedAssembly: binding.assembly,
      });
    }
  }

  // @tsonic/core packages are type-only (phantom types, attributes) - no runtime code
  if (
    importSpecifier === "@tsonic/core/types.js" ||
    importSpecifier === "@tsonic/core/lang.js" ||
    importSpecifier === "@tsonic/core/attributes.js"
  ) {
    return ok({
      resolvedPath: "", // No file path for type-only packages
      isLocal: false,
      isClr: false,
      originalSpecifier: importSpecifier,
      resolvedClrType: undefined,
      resolvedAssembly: undefined,
    });
  }

  return error(
    createDiagnostic(
      "TSN1004",
      "error",
      `Unsupported module import: "${importSpecifier}"`,
      undefined,
      "Tsonic only supports local imports (with .js or .ts), .NET imports, and registered module bindings"
    )
  );
};

/**
 * Resolve local import with ESM rules
 *
 * Accepts both .js and .ts extensions:
 * - .js is the ESM-compliant extension (resolves to .ts source file)
 * - .ts is also accepted for convenience
 */
export const resolveLocalImport = (
  importSpecifier: string,
  containingFile: string,
  sourceRoot: string
): Result<ResolvedModule, Diagnostic> => {
  // Check for .js or .ts extension
  const hasJsExtension = importSpecifier.endsWith(".js");
  const hasTsExtension = importSpecifier.endsWith(".ts");

  if (!hasJsExtension && !hasTsExtension) {
    return error(
      createDiagnostic(
        "TSN1001",
        "error",
        `Local import must have .js or .ts extension: "${importSpecifier}"`,
        undefined,
        `Change to: "${importSpecifier}.js" (ESM) or "${importSpecifier}.ts"`
      )
    );
  }

  const containingDir = path.dirname(containingFile);

  // If .js extension, resolve to .ts source file
  const tsSpecifier = hasJsExtension
    ? importSpecifier.slice(0, -3) + ".ts"
    : importSpecifier;
  const resolvedPath = path.resolve(containingDir, tsSpecifier);

  // Check if file exists
  if (!fs.existsSync(resolvedPath)) {
    return error(
      createDiagnostic(
        "TSN1004",
        "error",
        `Cannot find module: "${importSpecifier}"`,
        undefined,
        `File not found: ${resolvedPath}`
      )
    );
  }

  // Check case sensitivity
  const realPath = fs.realpathSync(resolvedPath);
  if (realPath !== resolvedPath && process.platform !== "win32") {
    return error(
      createDiagnostic(
        "TSN1003",
        "error",
        `Case mismatch in import path: "${importSpecifier}"`,
        undefined,
        `File exists as: ${realPath}`
      )
    );
  }

  // Ensure it's within the source root
  if (!resolvedPath.startsWith(sourceRoot)) {
    return error(
      createDiagnostic(
        "TSN1004",
        "error",
        `Import outside source root: "${importSpecifier}"`,
        undefined,
        `Source root: ${sourceRoot}`
      )
    );
  }

  return ok({
    resolvedPath,
    isLocal: true,
    isClr: false,
    originalSpecifier: importSpecifier,
  });
};

/**
 * Resolve CLR import (namespace validation)
 */
export const resolveClrImport = (
  importSpecifier: string
): Result<ResolvedModule, Diagnostic> => {
  // For CLR imports, we don't resolve to a file
  // We just validate the format and return the namespace

  // Check for invalid characters
  if (!/^[A-Za-z_][A-Za-z0-9_.]*$/.test(importSpecifier)) {
    return error(
      createDiagnostic(
        "TSN4001",
        "error",
        `Invalid CLR namespace: "${importSpecifier}"`,
        undefined,
        "Must be a valid CLR namespace identifier"
      )
    );
  }

  return ok({
    resolvedPath: "", // No file path for CLR imports
    isLocal: false,
    isClr: true,
    originalSpecifier: importSpecifier,
  });
};
