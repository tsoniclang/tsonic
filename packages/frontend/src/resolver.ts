/**
 * Module resolution with ESM rules enforcement
 */

import * as path from "node:path";
import * as fs from "node:fs";
import { Result, ok, error } from "./types/result.js";
import { Diagnostic, createDiagnostic } from "./types/diagnostic.js";
import { isLocalImport, isDotNetImport } from "./types/module.js";

export type ResolvedModule = {
  readonly resolvedPath: string;
  readonly isLocal: boolean;
  readonly isDotNet: boolean;
  readonly originalSpecifier: string;
};

export const resolveImport = (
  importSpecifier: string,
  containingFile: string,
  sourceRoot: string
): Result<ResolvedModule, Diagnostic> => {
  if (isLocalImport(importSpecifier)) {
    return resolveLocalImport(importSpecifier, containingFile, sourceRoot);
  }

  if (isDotNetImport(importSpecifier)) {
    return resolveDotNetImport(importSpecifier);
  }

  return error(
    createDiagnostic(
      "TSN1004",
      "error",
      `Node module imports are not supported: "${importSpecifier}"`,
      undefined,
      "Tsonic only supports local imports (with .ts) and .NET imports"
    )
  );
};

const resolveLocalImport = (
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

const resolveDotNetImport = (
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

export const resolveModulePath = (
  filePath: string,
  sourceRoot: string
): string => {
  const absolutePath = path.resolve(filePath);
  const absoluteRoot = path.resolve(sourceRoot);

  if (!absolutePath.startsWith(absoluteRoot)) {
    throw new Error(`File ${filePath} is outside source root ${sourceRoot}`);
  }

  return path.relative(absoluteRoot, absolutePath);
};

export const getNamespaceFromPath = (
  filePath: string,
  sourceRoot: string,
  rootNamespace: string
): string => {
  const relativePath = resolveModulePath(filePath, sourceRoot);
  const dirPath = path.dirname(relativePath);

  if (dirPath === ".") {
    return rootNamespace;
  }

  const parts = dirPath.split(path.sep).filter((p) => p !== ".");
  return [rootNamespace, ...parts].join(".");
};

export const getClassNameFromPath = (filePath: string): string => {
  const basename = path.basename(filePath, ".ts");
  return basename;
};
