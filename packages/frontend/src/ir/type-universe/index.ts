/**
 * Type Universe Module
 *
 * This module provides the unified type catalog that merges source-authored
 * types (from TS AST) and assembly-authored types (from CLR metadata).
 *
 * INVARIANT INV-CLR: All nominal type identities come from ONE unified catalog.
 * No type query is allowed to "fall back" to parallel logic or parallel stores.
 *
 * Exports:
 * - Types: TypeId, NominalEntry, MemberEntry, etc.
 * - Loader: loadAssemblyTypeCatalog
 * - Query helpers: getTypeByStableId, getTypeByTsName, getMemberByTsName
 */

// Core types
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
} from "./types.js";

// Factory functions and constants
export {
  makeTypeId,
  parseStableId,
  PRIMITIVE_TO_STABLE_ID,
  STABLE_ID_TO_PRIMITIVE,
} from "./types.js";

// Assembly catalog loader and queries
export {
  loadAssemblyTypeCatalog,
  loadSinglePackageMetadata,
  getTypeByStableId,
  getTypeByTsName,
  getTypeByClrName,
  getMemberByTsName,
} from "./assembly-catalog.js";

// Unified catalog builder and queries
export {
  buildUnifiedTypeCatalog,
  normalizePrimitiveToTypeId,
  getTypeId,
  lookupMemberWithInheritance,
  getMemberDeclaredType,
} from "./unified-catalog.js";
