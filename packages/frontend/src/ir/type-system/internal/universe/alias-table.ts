/**
 * Alias Table — Maps Surface Names to Canonical TypeIds
 *
 * This module provides the alias table that maps TypeScript surface names
 * to their canonical CLR TypeIds. This replaces the scattered type mappings
 * in clr-type-mappings.ts with a unified, TypeId-based approach.
 *
 * INVARIANT: All surface names (primitives, globals, $instance interfaces)
 * resolve to the same TypeId as their CLR counterparts.
 *
 * Example:
 * - "string" → TypeId(System.String)
 * - "String" → TypeId(System.String)
 * - "System.String" → TypeId(System.String)
 * - "String$instance" → TypeId(System.String)
 *
 * This unification is critical for Alice's TypeSystem spec:
 * > "string and System.String unify to the same TypeId (stableId)"
 */

import type { TypeId, AssemblyTypeCatalog } from "./types.js";

// ═══════════════════════════════════════════════════════════════════════════
// ALIAS TABLE TYPE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Alias table maps surface names to canonical TypeIds.
 *
 * This is a read-only map built once at universe construction time.
 */
export type AliasTable = ReadonlyMap<string, TypeId>;

// ═══════════════════════════════════════════════════════════════════════════
// PRIMITIVE MAPPINGS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Maps TypeScript/IR primitive type names to their CLR System.* names.
 *
 * These are the core primitive type mappings.
 */
const PRIMITIVE_ALIASES: ReadonlyMap<string, string> = new Map([
  // Core primitives (TypeScript built-ins)
  ["string", "System.String"],
  ["number", "System.Double"],
  ["boolean", "System.Boolean"],

  // @tsonic/core signed integers
  ["sbyte", "System.SByte"],
  ["short", "System.Int16"],
  ["int", "System.Int32"],
  ["long", "System.Int64"],
  ["nint", "System.IntPtr"],
  ["int128", "System.Int128"],

  // @tsonic/core unsigned integers
  ["byte", "System.Byte"],
  ["ushort", "System.UInt16"],
  ["uint", "System.UInt32"],
  ["ulong", "System.UInt64"],
  ["nuint", "System.UIntPtr"],
  ["uint128", "System.UInt128"],

  // @tsonic/core floating-point
  ["half", "System.Half"],
  ["float", "System.Single"],
  ["double", "System.Double"],
  ["decimal", "System.Decimal"],

  // @tsonic/core other primitives
  ["bool", "System.Boolean"],
  ["char", "System.Char"],
]);

/**
 * Maps @tsonic/globals type names to their CLR System.* names.
 *
 * These are the TypeScript-facing names that wrap CLR types.
 */
const GLOBALS_ALIASES: ReadonlyMap<string, string> = new Map([
  // Globals from @tsonic/globals
  ["String", "System.String"],
  ["Number", "System.Double"],
  ["Boolean", "System.Boolean"],
  ["Object", "System.Object"],
  ["Array", "System.Array"],

  // Instance interfaces (from @tsonic/dotnet)
  ["String$instance", "System.String"],
  ["Double$instance", "System.Double"],
  ["Boolean$instance", "System.Boolean"],
  ["Object$instance", "System.Object"],
  ["Array$instance", "System.Array"],
]);

// ═══════════════════════════════════════════════════════════════════════════
// RECORD-BASED EXPORTS (for backward compatibility during migration)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Record-based primitive type → CLR System.* mappings.
 * Used for direct property access in type normalization.
 *
 * @deprecated Use normalizeToClrName() instead
 */
export const PRIMITIVE_TO_CLR_FQ: Readonly<Record<string, string>> =
  Object.fromEntries(PRIMITIVE_ALIASES);

/**
 * Record-based globals → CLR System.* mappings.
 * Used for direct property access in type normalization.
 *
 * @deprecated Use normalizeToClrName() instead
 */
export const GLOBALS_TO_CLR_FQ: Readonly<Record<string, string>> =
  Object.fromEntries(GLOBALS_ALIASES);

// ═══════════════════════════════════════════════════════════════════════════
// ALIAS TABLE BUILDER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build the alias table from a CLR catalog.
 *
 * For each alias, we look up the corresponding CLR type in the catalog
 * and map the alias to that TypeId.
 *
 * @param clrCatalog - The CLR catalog containing loaded type metadata
 * @returns AliasTable mapping surface names to TypeIds
 */
export const buildAliasTable = (
  clrCatalog: AssemblyTypeCatalog
): AliasTable => {
  const aliases = new Map<string, TypeId>();

  // Add primitive aliases
  for (const [alias, clrName] of PRIMITIVE_ALIASES) {
    const typeId = clrCatalog.clrNameToTypeId.get(clrName);
    if (typeId) {
      aliases.set(alias, typeId);
    }
  }

  // Add globals aliases
  for (const [alias, clrName] of GLOBALS_ALIASES) {
    const typeId = clrCatalog.clrNameToTypeId.get(clrName);
    if (typeId) {
      aliases.set(alias, typeId);
    }
  }

  // Also add direct CLR name mappings (System.String → TypeId)
  // These come directly from the catalog
  for (const [clrName, typeId] of clrCatalog.clrNameToTypeId) {
    if (!aliases.has(clrName)) {
      aliases.set(clrName, typeId);
    }
  }

  return aliases;
};

// ═══════════════════════════════════════════════════════════════════════════
// ALIAS RESOLUTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Resolve a type name to its canonical TypeId using the alias table.
 *
 * @param name - The type name to resolve (primitive, global, or CLR name)
 * @param aliasTable - The alias table
 * @returns The TypeId if found, undefined otherwise
 */
export const resolveAlias = (
  name: string,
  aliasTable: AliasTable
): TypeId | undefined => {
  return aliasTable.get(name);
};

/**
 * Check if a name is a known alias.
 */
export const isKnownAlias = (name: string, aliasTable: AliasTable): boolean => {
  return aliasTable.has(name);
};

/**
 * Check if a type name is a known stdlib type (primitive, global, or System.*).
 *
 * This is used for fatal diagnostic stratification:
 * - Missing stdlib type → fatal
 * - Missing third-party type → error + unknownType
 */
export const isStdlibTypeName = (name: string): boolean => {
  return (
    PRIMITIVE_ALIASES.has(name) ||
    GLOBALS_ALIASES.has(name) ||
    name.startsWith("System.")
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get all primitive type names.
 */
export const getPrimitiveNames = (): readonly string[] => {
  return Array.from(PRIMITIVE_ALIASES.keys());
};

/**
 * Get all global type names.
 */
export const getGlobalNames = (): readonly string[] => {
  return Array.from(GLOBALS_ALIASES.keys());
};

/**
 * Normalize a type name to its CLR fully-qualified name.
 *
 * @param typeName - Simple or already-qualified type name
 * @returns CLR FQ name (e.g., "System.String") or original if no mapping exists
 */
export const normalizeToClrName = (typeName: string): string => {
  // Check primitives first
  const primitiveClr = PRIMITIVE_ALIASES.get(typeName);
  if (primitiveClr) return primitiveClr;

  // Check globals
  const globalsClr = GLOBALS_ALIASES.get(typeName);
  if (globalsClr) return globalsClr;

  // Already qualified or unknown - return as-is
  return typeName;
};

/**
 * Get the $instance interface name for a CLR type.
 *
 * E.g., "System.String" → "String$instance", "String" → "String$instance"
 */
export const getInstanceInterfaceName = (typeName: string): string => {
  // If it's a System.* name, extract the simple part
  if (typeName.startsWith("System.")) {
    const simpleName = typeName.substring(7); // Remove "System."
    return `${simpleName}$instance`;
  }

  // Already a simple name
  return `${typeName}$instance`;
};
