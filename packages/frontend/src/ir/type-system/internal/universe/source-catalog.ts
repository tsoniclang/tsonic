/**
 * Source Catalog — Two-Pass Type Capture from Source Files
 *
 * ALICE'S SPEC (Phase 4): This is THE CORE ARCHITECTURAL FIX.
 *
 * "You cannot reliably convert everything in one walk because of forward
 * references and aliasing."
 *
 * Two-pass architecture:
 * - Pass A (Skeleton): Register all type names without conversion
 * - Pass B (Capture): Convert all type annotations with stable resolution
 *
 * After this module runs, converters NEVER call convertType. They ask
 * TypeSystem for already-captured types via typeOfDecl(declId).
 *
 * INVARIANT: All type conversion happens HERE, not in converters.
 */

import * as ts from "typescript";
import type { IrType } from "../../../types/index.js";
import type { Binding } from "../../../binding/index.js";
import { buildTypeRegistry } from "../type-registry.js";
import type { TypeRegistry } from "../type-registry.js";
import { convertType } from "../type-converter.js";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Configuration for building the source catalog.
 */
export type SourceCatalogConfig = {
  readonly sourceFiles: readonly ts.SourceFile[];
  readonly checker: ts.TypeChecker;
  readonly sourceRoot: string;
  readonly rootNamespace: string;
  readonly binding: Binding;
};

/**
 * Result of building the source catalog.
 */
export type SourceCatalogResult = {
  readonly typeRegistry: TypeRegistry;
};

// ═══════════════════════════════════════════════════════════════════════════
// TWO-PASS BUILD
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build source catalog with two-pass architecture.
 *
 * Pass A: Register all type names (skeleton)
 *   - Walk all source files
 *   - Collect class/interface/type alias declarations
 *   - Register names without type conversion
 *
 * Pass B: Capture all types (with stable resolution)
 *   - Now all names are registered, resolution is stable
 *   - Convert all type annotations to IrType
 *   - Store in TypeRegistry
 *
 * After this function returns, TypeRegistry contains all types.
 * Converters use typeOfDecl(declId) to get already-captured types.
 */
export const buildSourceCatalog = (
  config: SourceCatalogConfig
): SourceCatalogResult => {
  // ═══════════════════════════════════════════════════════════════════════════
  // PASS A: SKELETON REGISTRATION
  // ═══════════════════════════════════════════════════════════════════════════
  //
  // First pass: Register all type names without conversion.
  // This allows type references to be resolved in Pass B.
  //
  // We call buildTypeRegistry without convertType — it stores unknownType
  // for all type annotations. This is just to register the names.

  // Pass A builds the skeleton registry (all types stored as unknownType).
  // This is intentional — we just need the names registered for resolution.
  // The actual types are captured in Pass B.
  //
  // NOTE: We don't actually need the skeleton registry result since
  // buildTypeRegistry uses module-level state for name registration.
  // However, we call it to trigger the name registration walk.
  // In a future refactor (Phase 7), this will be replaced with explicit
  // name-only registration without creating a full registry.
  buildTypeRegistry(
    config.sourceFiles,
    config.checker,
    config.sourceRoot,
    config.rootNamespace
    // No convertType — uses default (() => unknownType)
  );

  // At this point, all type names are registered and can be resolved.

  // ═══════════════════════════════════════════════════════════════════════════
  // PASS B: TYPE CAPTURE (resolution is now stable)
  // ═══════════════════════════════════════════════════════════════════════════
  //
  // Second pass: Convert all type annotations with stable resolution.
  // Now that all names are registered, type references will resolve correctly.
  //
  // We create a convertType function bound to the Binding, then call
  // buildTypeRegistry again with the real converter.

  const boundConvertType = (typeNode: ts.TypeNode): IrType => {
    return convertType(typeNode, config.binding);
  };

  const typeRegistry = buildTypeRegistry(
    config.sourceFiles,
    config.checker,
    config.sourceRoot,
    config.rootNamespace,
    boundConvertType
  );

  return { typeRegistry };
};

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if a source file should be included in the source catalog.
 *
 * Includes:
 * - User source files (.ts)
 * - Declaration files (.d.ts) for globals and runtime types
 */
export const shouldIncludeFile = (sourceFile: ts.SourceFile): boolean => {
  // Include all TypeScript files
  return (
    sourceFile.fileName.endsWith(".ts") ||
    sourceFile.fileName.endsWith(".tsx")
  );
};
