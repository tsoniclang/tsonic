/**
 * Universe Module — Unified Type Catalog
 *
 * This module exports the unified type catalog that merges source-authored
 * types (from TypeRegistry) and external-authored types (from target metadata).
 *
 * INVARIANT INV-NOMINAL: All nominal type identities come from ONE unified catalog.
 * No type query is allowed to "fall back" to parallel logic or parallel stores.
 *
 * Exports:
 * - Types: TypeId, NominalEntry, MemberEntry, etc.
 * - Builders: buildUnifiedUniverse, buildAliasTable, loadExternalCatalog
 * - Resolution: resolveTypeName, validateStdlibTypes
 * - Queries: getTypeId, lookupMemberWithInheritance
 */

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type {
  TypeId,
  NominalEntry,
  NominalKind,
  TypeOrigin,
  TypeParameterEntry,
  HeritageEdge,
  MemberEntry,
  MemberKind,
  MethodSignatureEntry,
  ParameterEntry,
  ParameterMode,
  ConstructorEntry,
  FieldEntry,
  ExternalTypeCatalog,
  UnifiedTypeCatalog,
  RawBindingsType,
  RawBindingsMethod,
  RawBindingsProperty,
  RawBindingsField,
  RawBindingsConstructor,
  RawTsbindgenBindingsFile,
  RawBindingsFileV2,
  RawBindingsFile,
  RawBindingsPayload,
} from "./types.js";

export { makeTypeId, parseStableId } from "./types.js";

// ═══════════════════════════════════════════════════════════════════════════
// target CATALOG
// ═══════════════════════════════════════════════════════════════════════════

export {
  loadExternalCatalog,
  loadSinglePackageBindings,
  getTypeByStableId,
  getTypeByTsName,
  getTypeByTargetName,
  getMemberByTsName,
} from "./external-catalog.js";

// ═══════════════════════════════════════════════════════════════════════════
// UNIFIED UNIVERSE
// ═══════════════════════════════════════════════════════════════════════════

export {
  buildUnifiedUniverse,
  normalizePrimitiveToTypeId,
  getTypeId,
  lookupMemberWithInheritance,
  getMemberDeclaredType,
} from "./unified-universe.js";

// ═══════════════════════════════════════════════════════════════════════════
// ALIAS TABLE
// ═══════════════════════════════════════════════════════════════════════════

export type { AliasTable } from "./alias-table.js";

export {
  buildAliasTable,
  resolveAlias,
  isKnownAlias,
  isStdlibTypeName,
  getPrimitiveNames,
  getGlobalNames,
  normalizeToTargetName,
  getInstanceInterfaceName,
} from "./alias-table.js";

// ═══════════════════════════════════════════════════════════════════════════
// RESOLUTION
// ═══════════════════════════════════════════════════════════════════════════

export type {
  ResolutionResult,
  ResolutionWithCollector,
  BatchResolutionResult,
  StdlibValidationResult,
} from "./resolution.js";

export {
  resolveTypeName,
  tryResolveTypeName,
  resolveTypeNamePure,
  resolveTypeNames,
  validateStdlibTypes,
} from "./resolution.js";

// ═══════════════════════════════════════════════════════════════════════════
// SOURCE CATALOG
// ═══════════════════════════════════════════════════════════════════════════

export type {
  SourceCatalogConfig,
  SourceCatalogResult,
} from "./source-catalog.js";

export { buildSourceCatalog, shouldIncludeFile } from "./source-catalog.js";
