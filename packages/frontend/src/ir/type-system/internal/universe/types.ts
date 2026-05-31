/**
 * Type Universe Type Definitions
 *
 * This module defines the types for the unified type catalog that merges
 * source-authored types (from TS AST) and external-authored types (from
 * target metadata in bindings.json).
 *
 * FACADE: re-exports from catalog-types and raw-bindings-types.
 */

export type {
  IrAsyncWrapperMetadata,
  IrIterableShapeMetadata,
} from "../../../types/index.js";

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
} from "./catalog-types.js";

export type {
  RawBindingsType,
  RawBindingsHeritageType,
  RawBindingsMethod,
  RawBindingsProperty,
  RawBindingsField,
  RawBindingsConstructor,
  RawTsbindgenBindingsFile,
  RawBindingsFile,
  RawBindingsPayload,
} from "./raw-bindings-types.js";

export {
  makeTypeId,
  parseStableId,
  resolveRawTypeStableId,
  typeIdProviderLookupName,
} from "./raw-bindings-types.js";
