/**
 * Type Resolution — Unified Name Resolution with Diagnostic Stratification
 *
 * This module provides type name resolution that:
 * 1. Resolves names through the alias table and universe
 * 2. Emits fatal diagnostics for missing stdlib types
 * 3. Emits error diagnostics for missing third-party types
 *
 * INVARIANT (from Phase 1): Missing stdlib type → fatal
 * INVARIANT (from Phase 1): Missing third-party metadata → error + unknownType
 *
 * This is the implementation of diagnostic stratification that was
 * deferred from Phase 1 to Phase 3 when UnifiedUniverse can detect
 * missing types.
 */

import type { TypeId, UnifiedTypeCatalog } from "./types.js";
import type { AliasTable } from "./alias-table.js";
import { isStdlibTypeName } from "./alias-table.js";
import type {
  DiagnosticsCollector,
  Diagnostic,
} from "../../../../types/diagnostic.js";
import {
  addDiagnostic,
  createDiagnostic,
} from "../../../../types/diagnostic.js";

// ═══════════════════════════════════════════════════════════════════════════
// TYPE RESOLUTION WITH DIAGNOSTICS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Result of a type resolution attempt.
 */
export type ResolutionResult =
  | { readonly ok: true; readonly typeId: TypeId }
  | { readonly ok: false; readonly diagnostic: Diagnostic };

/**
 * Result of a type resolution with collector update.
 */
export type ResolutionWithCollector = {
  readonly typeId: TypeId | undefined;
  readonly collector: DiagnosticsCollector;
};

/**
 * Resolve a type name to its TypeId, returning updated diagnostics collector.
 *
 * Resolution order:
 * 1. Try alias table (primitives, globals, $instance interfaces)
 * 2. Try universe by TS name
 * 3. Try universe by CLR name
 * 4. Emit diagnostic and return undefined
 *
 * Diagnostic stratification:
 * - Missing stdlib type (System.*, primitives, globals) → fatal (TSN9001)
 * - Missing third-party type → error (TSN9002)
 *
 * @param name - The type name to resolve
 * @param aliasTable - The alias table for surface name resolution
 * @param universe - The unified type catalog
 * @param collector - Collector for emitting diagnostics
 * @returns Object with TypeId (or undefined) and updated collector
 */
export const resolveTypeName = (
  name: string,
  aliasTable: AliasTable,
  universe: UnifiedTypeCatalog,
  collector: DiagnosticsCollector
): ResolutionWithCollector => {
  // 1. Try alias table first
  const aliasTypeId = aliasTable.get(name);
  if (aliasTypeId) {
    return { typeId: aliasTypeId, collector };
  }

  // 2. Try universe by TS name
  const tsTypeId = universe.resolveTsName(name);
  if (tsTypeId) {
    return { typeId: tsTypeId, collector };
  }

  // 3. Try universe by CLR name
  const clrTypeId = universe.resolveClrName(name);
  if (clrTypeId) {
    return { typeId: clrTypeId, collector };
  }

  // 4. Type not found - emit appropriate diagnostic
  if (isStdlibTypeName(name)) {
    // Missing stdlib type is FATAL
    const diagnostic = createDiagnostic(
      "TSN9001",
      "fatal",
      `Missing stdlib type: ${name}. Ensure Tsonic runtime types are loaded.`,
      undefined
    );
    return {
      typeId: undefined,
      collector: addDiagnostic(collector, diagnostic),
    };
  }

  // Missing third-party type is error (caller uses unknownType)
  const diagnostic = createDiagnostic(
    "TSN9002",
    "error",
    `Unknown type: ${name}`,
    undefined
  );
  return {
    typeId: undefined,
    collector: addDiagnostic(collector, diagnostic),
  };
};

/**
 * Resolve a type name without emitting diagnostics.
 *
 * Use this for "try" operations where you want to check if a type exists
 * without emitting errors.
 *
 * @param name - The type name to resolve
 * @param aliasTable - The alias table
 * @param universe - The unified type catalog
 * @returns The TypeId if found, undefined if not
 */
export const tryResolveTypeName = (
  name: string,
  aliasTable: AliasTable,
  universe: UnifiedTypeCatalog
): TypeId | undefined => {
  // Try alias table
  const aliasTypeId = aliasTable.get(name);
  if (aliasTypeId) return aliasTypeId;

  // Try universe by TS name
  const tsTypeId = universe.resolveTsName(name);
  if (tsTypeId) return tsTypeId;

  // Try universe by CLR name
  return universe.resolveClrName(name);
};

/**
 * Resolve a type name and return a result object (no side effects).
 *
 * Use this when you want to inspect the result before deciding what to do.
 *
 * @param name - The type name to resolve
 * @param aliasTable - The alias table
 * @param universe - The unified type catalog
 * @returns ResolutionResult with either TypeId or diagnostic info
 */
export const resolveTypeNamePure = (
  name: string,
  aliasTable: AliasTable,
  universe: UnifiedTypeCatalog
): ResolutionResult => {
  // Try resolution
  const typeId = tryResolveTypeName(name, aliasTable, universe);

  if (typeId) {
    return { ok: true, typeId };
  }

  // Build diagnostic info
  if (isStdlibTypeName(name)) {
    return {
      ok: false,
      diagnostic: createDiagnostic(
        "TSN9001",
        "fatal",
        `Missing stdlib type: ${name}. Ensure Tsonic runtime types are loaded.`,
        undefined
      ),
    };
  }

  return {
    ok: false,
    diagnostic: createDiagnostic(
      "TSN9002",
      "error",
      `Unknown type: ${name}`,
      undefined
    ),
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// BATCH RESOLUTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Result of batch type name resolution.
 */
export type BatchResolutionResult = {
  readonly resolved: ReadonlyMap<string, TypeId>;
  readonly collector: DiagnosticsCollector;
};

/**
 * Resolve multiple type names, collecting all diagnostics.
 *
 * Useful for resolving all types in a file at once.
 *
 * @param names - The type names to resolve
 * @param aliasTable - The alias table
 * @param universe - The unified type catalog
 * @param collector - Collector for emitting diagnostics
 * @returns Object with map of resolved types and updated collector
 */
export const resolveTypeNames = (
  names: readonly string[],
  aliasTable: AliasTable,
  universe: UnifiedTypeCatalog,
  collector: DiagnosticsCollector
): BatchResolutionResult => {
  const resolved = new Map<string, TypeId>();

  const finalCollector = names.reduce((acc, name) => {
    const result = resolveTypeName(name, aliasTable, universe, acc);
    if (result.typeId) {
      resolved.set(name, result.typeId);
    }
    return result.collector;
  }, collector);

  return { resolved, collector: finalCollector };
};

// ═══════════════════════════════════════════════════════════════════════════
// STDLIB VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Required stdlib types that must be present for compilation.
 *
 * These are checked at universe construction time.
 */
const REQUIRED_STDLIB_TYPES: readonly string[] = [
  "System.String",
  "System.Int32",
  "System.Double",
  "System.Boolean",
  "System.Object",
  "System.Void",
];

/**
 * Result of stdlib validation.
 */
export type StdlibValidationResult = {
  readonly allPresent: boolean;
  readonly collector: DiagnosticsCollector;
};

/**
 * Validate that all required stdlib types are present.
 *
 * Call this after building the universe to ensure the runtime is properly loaded.
 *
 * @param universe - The unified type catalog
 * @param collector - Collector for emitting diagnostics
 * @returns Object with validation result and updated collector
 */
export const validateStdlibTypes = (
  universe: UnifiedTypeCatalog,
  collector: DiagnosticsCollector
): StdlibValidationResult => {
  const result = REQUIRED_STDLIB_TYPES.reduce(
    (acc, typeName) => {
      const typeId = universe.resolveClrName(typeName);
      if (!typeId) {
        const diagnostic = createDiagnostic(
          "TSN9001",
          "fatal",
          `Missing required stdlib type: ${typeName}. Ensure Tsonic runtime types are loaded.`,
          undefined
        );
        return {
          allPresent: false,
          collector: addDiagnostic(acc.collector, diagnostic),
        };
      }
      return acc;
    },
    { allPresent: true, collector }
  );

  return result;
};
