/**
 * Type Universe Type Definitions
 *
 * This module defines the types for the unified type catalog that merges
 * source-authored types (from TS AST) and assembly-authored types (from
 * CLR metadata in bindings.json).
 *
 * FACADE: re-exports from catalog-types and raw-bindings-types.
 */

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
} from "./catalog-types.js";

export type {
  RawBindingsType,
  RawBindingsHeritageType,
  RawBindingsMethod,
  RawBindingsProperty,
  RawBindingsField,
  RawBindingsConstructor,
  RawTsbindgenBindingsFile,
  RawBindingsFileV2,
  RawBindingsFile,
  RawBindingsPayload,
} from "./raw-bindings-types.js";

export {
  makeTypeId,
  parseStableId,
  resolveRawTypeStableId,
  PRIMITIVE_TO_STABLE_ID,
  STABLE_ID_TO_PRIMITIVE,
} from "./raw-bindings-types.js";
