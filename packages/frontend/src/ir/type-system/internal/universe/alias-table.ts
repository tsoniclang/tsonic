/**
 * Alias Table — Maps source-facing names to canonical TypeIds.
 *
 * The table is derived from the loaded external catalog. It does not encode
 * target runtime identities in frontend product code.
 */

import type { TypeId, ExternalTypeCatalog } from "./types.js";
import { primitiveTypeFactFromName } from "../../../types/numeric-kind.js";

// ═══════════════════════════════════════════════════════════════════════════
// ALIAS TABLE TYPE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Alias table maps surface names to canonical TypeIds.
 *
 * This is a read-only map built once at universe construction time.
 */
export type AliasTable = ReadonlyMap<string, TypeId>;

const CORE_SOURCE_PRIMITIVE_NAMES = new Set([
  "string",
  "number",
  "boolean",
  "bool",
  "char",
  "sbyte",
  "byte",
  "short",
  "ushort",
  "int",
  "uint",
  "long",
  "ulong",
  "nint",
  "nuint",
  "int128",
  "uint128",
  "half",
  "float",
  "double",
  "decimal",
]);

const lowerFirst = (name: string): string =>
  name.length === 0 ? name : `${name[0]?.toLowerCase()}${name.slice(1)}`;

const isSourcePrimitiveAlias = (name: string): boolean =>
  CORE_SOURCE_PRIMITIVE_NAMES.has(name) ||
  primitiveTypeFactFromName(name) !== undefined;

const addSourceNameAliases = (
  aliases: Map<string, TypeId>,
  sourceName: string,
  typeId: TypeId
): void => {
  if (!aliases.has(sourceName)) {
    aliases.set(sourceName, typeId);
  }

  const lowerAlias = lowerFirst(sourceName);
  if (
    lowerAlias !== sourceName &&
    isSourcePrimitiveAlias(lowerAlias) &&
    !aliases.has(lowerAlias)
  ) {
    aliases.set(lowerAlias, typeId);
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// ALIAS TABLE BUILDER
// ═══════════════════════════════════════════════════════════════════════════

export const buildAliasTable = (
  externalCatalog: ExternalTypeCatalog
): AliasTable => {
  const aliases = new Map<string, TypeId>();

  for (const typeId of externalCatalog.tsNameToTypeId.values()) {
    addSourceNameAliases(aliases, typeId.sourceName, typeId);
  }

  for (const [targetName, typeId] of externalCatalog.targetNameToTypeId) {
    if (!aliases.has(targetName)) {
      aliases.set(targetName, typeId);
    }
  }

  for (const [tsName, typeId] of externalCatalog.tsNameToTypeId) {
    if (tsName.endsWith("$instance")) continue;
    if (tsName.startsWith("__") && tsName.includes("$views")) continue;

    const instanceAlias = `${tsName}$instance`;
    if (!aliases.has(instanceAlias)) {
      aliases.set(instanceAlias, typeId);
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
 * @param name - The type name to resolve (primitive, global, or native target name)
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
 * Check if a type name is a known source primitive.
 *
 * This is used for fatal diagnostic stratification:
 * - Missing source primitive → fatal
 * - Missing third-party/external type → error + unknownType
 */
export const isStdlibTypeName = (name: string): boolean => {
  return isSourcePrimitiveAlias(name);
};

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get all primitive type names.
 */
export const getPrimitiveNames = (): readonly string[] => {
  return Array.from(CORE_SOURCE_PRIMITIVE_NAMES);
};

/**
 * Get all global type names known without consulting a catalog.
 */
export const getGlobalNames = (): readonly string[] => {
  return [];
};

/**
 * Normalize a type name to the provider-local target name known at this stage.
 */
export const normalizeToTargetName = (typeName: string): string => {
  return typeName;
};

/**
 * Get the $instance interface name for a source-facing type name.
 */
export const getInstanceInterfaceName = (typeName: string): string => {
  const simpleName = typeName.split(".").pop() ?? typeName;
  return `${simpleName}$instance`;
};
