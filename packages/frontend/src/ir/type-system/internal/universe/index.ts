/**
 * Universe Module — Unified Type Catalog
 *
 * This module exports the unified type catalog that merges source-authored
 * types (from TypeRegistry) and assembly-authored types (from CLR metadata).
 *
 * INVARIANT INV-CLR: All nominal type identities come from ONE unified catalog.
 * No type query is allowed to "fall back" to parallel logic or parallel stores.
 *
 * Exports:
 * - Types: TypeId, NominalEntry, MemberEntry, etc.
 * - Builders: buildUnifiedUniverse, buildAliasTable, loadClrCatalog
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
  AssemblyTypeCatalog,
  UnifiedTypeCatalog,
  RawBindingsType,
  RawBindingsMethod,
  RawBindingsProperty,
  RawBindingsField,
  RawBindingsConstructor,
  RawBindingsFile,
} from "./types.js";

export {
  makeTypeId,
  parseStableId,
  PRIMITIVE_TO_STABLE_ID,
  STABLE_ID_TO_PRIMITIVE,
} from "./types.js";

// ═══════════════════════════════════════════════════════════════════════════
// CLR CATALOG
// ═══════════════════════════════════════════════════════════════════════════

export {
  loadClrCatalog,
  loadSinglePackageBindings,
  getTypeByStableId,
  getTypeByTsName,
  getTypeByClrName,
  getMemberByTsName,
} from "./clr-catalog.js";

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
  normalizeToClrName,
  getInstanceInterfaceName,
  // Backward compatibility (deprecated - use normalizeToClrName instead)
  PRIMITIVE_TO_CLR_FQ,
  GLOBALS_TO_CLR_FQ,
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
// SOURCE CATALOG (Phase 4: Two-Pass Build)
// ═══════════════════════════════════════════════════════════════════════════

export type {
  SourceCatalogConfig,
  SourceCatalogResult,
} from "./source-catalog.js";

export { buildSourceCatalog, shouldIncludeFile } from "./source-catalog.js";
