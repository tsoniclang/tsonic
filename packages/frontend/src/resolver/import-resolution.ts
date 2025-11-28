/**
 * Import resolution with ESM rules enforcement
 */

import * as path from "node:path";
import * as fs from "node:fs";
import { Result, ok, error } from "../types/result.js";
import { Diagnostic, createDiagnostic } from "../types/diagnostic.js";
import { isLocalImport } from "../types/module.js";
import { ResolvedModule } from "./types.js";
import { getBindingRegistry } from "../ir/converters/statements/declarations/registry.js";
import { DotNetImportResolver } from "./dotnet-import-resolver.js";

/**
 * Resolve import specifier to module
 */
export const resolveImport = (
  importSpecifier: string,
  containingFile: string,
  sourceRoot: string,
  dotnetResolver?: DotNetImportResolver
): Result<ResolvedModule, Diagnostic> => {
  if (isLocalImport(importSpecifier)) {
    return resolveLocalImport(importSpecifier, containingFile, sourceRoot);
  }

  // Use import-driven resolution for .NET imports (if resolver provided)
  if (dotnetResolver) {
    const dotnetResolution = dotnetResolver.resolve(importSpecifier);
    if (dotnetResolution.isDotNet) {
      return ok({
        resolvedPath: "", // No file path for .NET imports
        isLocal: false,
        isDotNet: true,
        originalSpecifier: importSpecifier,
        resolvedNamespace: dotnetResolution.resolvedNamespace,
      });
    }
  }

  // Check if this is a module binding (e.g., Node.js API)
  const binding = getBindingRegistry().getBinding(importSpecifier);
  if (binding && binding.kind === "module") {
    return ok({
      resolvedPath: "", // No file path for bound modules
      isLocal: false,
      isDotNet: false,
      originalSpecifier: importSpecifier,
      resolvedClrType: binding.type,
      resolvedAssembly: binding.assembly,
    });
  }

  // @tsonic/types is a type-only package (phantom types) - no runtime code
  if (importSpecifier === "@tsonic/types") {
    return ok({
      resolvedPath: "", // No file path for type-only packages
      isLocal: false,
      isDotNet: false,
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
      "Tsonic only supports local imports (with .ts), .NET imports, and registered module bindings"
    )
  );
};

/**
 * Resolve local import with ESM rules
 */
export const resolveLocalImport = (
  importSpecifier: string,
  containingFile: string,
  sourceRoot: string
): Result<ResolvedModule, Diagnostic> => {
  // Check for .ts extension
  if (!importSpecifier.endsWith(".ts")) {
    return error(
      createDiagnostic(
        "TSN1001",
        "error",
        `Local import must have .ts extension: "${importSpecifier}"`,
        undefined,
        `Change to: "${importSpecifier}.ts"`
      )
    );
  }

  const containingDir = path.dirname(containingFile);
  const resolvedPath = path.resolve(containingDir, importSpecifier);

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
    isDotNet: false,
    originalSpecifier: importSpecifier,
  });
};

/**
 * Resolve .NET import (namespace validation)
 */
export const resolveDotNetImport = (
  importSpecifier: string
): Result<ResolvedModule, Diagnostic> => {
  // For .NET imports, we don't resolve to a file
  // We just validate the format and return the namespace

  // Check for invalid characters
  if (!/^[A-Za-z_][A-Za-z0-9_.]*$/.test(importSpecifier)) {
    return error(
      createDiagnostic(
        "TSN4001",
        "error",
        `Invalid .NET namespace: "${importSpecifier}"`,
        undefined,
        "Must be a valid .NET namespace identifier"
      )
    );
  }

  return ok({
    resolvedPath: "", // No file path for .NET imports
    isLocal: false,
    isDotNet: true,
    originalSpecifier: importSpecifier,
  });
};
