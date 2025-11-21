/**
 * Library Loader - Load metadata and bindings from external library directories.
 *
 * External libraries (specified via --lib flag) contain both metadata and bindings:
 *   lib-path/
 *     .metadata/
 *       Namespace.metadata.json
 *     .bindings/
 *       Namespace.bindings.json
 *
 * This module provides helpers to load both from a single library root path.
 */

import { join } from "path";
import { existsSync, statSync } from "fs";
import type { Result } from "../types/result.js";
import type { Diagnostic } from "../types/diagnostic.js";
import { loadMetadataDirectory } from "./loader.js";
import { loadBindingsDirectory } from "./bindings-loader.js";
import type { MetadataFile } from "../types/metadata.js";
import type { BindingsFile } from "../types/bindings.js";

/**
 * Loaded library data (metadata + bindings).
 */
export type LibraryData = {
  readonly metadata: ReadonlyArray<MetadataFile>;
  readonly bindings: ReadonlyArray<BindingsFile>;
};

/**
 * Load metadata and bindings from a library directory.
 *
 * Looks for:
 * - ${libraryPath}/.metadata/ directory
 * - ${libraryPath}/.bindings/ directory
 *
 * @param libraryPath - Path to external library root
 * @returns Result with library data or diagnostics
 */
export const loadLibrary = (
  libraryPath: string
): Result<LibraryData, Diagnostic[]> => {
  const diagnostics: Diagnostic[] = [];

  // Validate library path exists
  if (!existsSync(libraryPath)) {
    return {
      ok: false,
      error: [
        {
          code: "TSN9016",
          severity: "error",
          message: `Library directory not found: ${libraryPath}`,
        },
      ],
    };
  }

  // Validate it's a directory
  if (!statSync(libraryPath).isDirectory()) {
    return {
      ok: false,
      error: [
        {
          code: "TSN9017",
          severity: "error",
          message: `Library path is not a directory: ${libraryPath}`,
        },
      ],
    };
  }

  // Load metadata from .metadata/ subdirectory
  const metadataPath = join(libraryPath, ".metadata");
  let metadata: ReadonlyArray<MetadataFile> = [];

  if (existsSync(metadataPath)) {
    const metadataResult = loadMetadataDirectory(metadataPath);
    if (metadataResult.ok) {
      metadata = metadataResult.value;
    } else {
      diagnostics.push(...metadataResult.error);
    }
  }

  // Load bindings from .bindings/ subdirectory
  const bindingsPath = join(libraryPath, ".bindings");
  let bindings: ReadonlyArray<BindingsFile> = [];

  if (existsSync(bindingsPath)) {
    const bindingsResult = loadBindingsDirectory(bindingsPath);
    if (bindingsResult.ok) {
      bindings = bindingsResult.value;
    } else {
      diagnostics.push(...bindingsResult.error);
    }
  }

  // Return success even if one or both are missing (library might be incomplete)
  return {
    ok: true,
    value: {
      metadata,
      bindings,
    },
  };
};

/**
 * Load metadata and bindings from multiple library directories.
 *
 * @param libraryPaths - Array of library root paths
 * @returns Result with merged library data or diagnostics
 */
export const loadLibraries = (
  libraryPaths: readonly string[]
): Result<LibraryData, Diagnostic[]> => {
  const allMetadata: MetadataFile[] = [];
  const allBindings: BindingsFile[] = [];
  const allDiagnostics: Diagnostic[] = [];

  for (const libPath of libraryPaths) {
    const result = loadLibrary(libPath);
    if (result.ok) {
      allMetadata.push(...result.value.metadata);
      allBindings.push(...result.value.bindings);
    } else {
      allDiagnostics.push(...result.error);
    }
  }

  // If we have any diagnostics but also loaded some data, still succeed
  // (allows partial library loading)
  if (allDiagnostics.length > 0 && allMetadata.length === 0 && allBindings.length === 0) {
    return {
      ok: false,
      error: allDiagnostics,
    };
  }

  return {
    ok: true,
    value: {
      metadata: allMetadata,
      bindings: allBindings,
    },
  };
};
