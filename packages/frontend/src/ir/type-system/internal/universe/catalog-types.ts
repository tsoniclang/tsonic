/**
 * Type Universe — Catalog Type Definitions
 *
 * Defines the core types for the unified type catalog: TypeId, NominalEntry,
 * MemberEntry, MethodSignatureEntry, ConstructorEntry, FieldEntry, and the
 * catalog interfaces (ExternalTypeCatalog, UnifiedTypeCatalog).
 *
 * INVARIANT: All nominal type identities come from ONE unified catalog.
 * No type query is allowed to "fall back" to parallel logic or parallel stores.
 */

import type {
  IrAsyncWrapperMetadata,
  IrIterableShapeMetadata,
  IrType,
} from "../../../types/index.js";
import type { TypeSymbolId } from "../../../../symbols/index.js";

export type SourcePrimitiveName =
  | "string"
  | "number"
  | "boolean"
  | "char"
  | "sbyte"
  | "byte"
  | "short"
  | "ushort"
  | "int"
  | "uint"
  | "long"
  | "ulong"
  | "nint"
  | "nuint"
  | "int128"
  | "uint128"
  | "half"
  | "float"
  | "double"
  | "decimal";

// ═══════════════════════════════════════════════════════════════════════════
// CANONICAL TYPE IDENTITY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Canonical identity for any nominal type.
 *
 * Uses stableId as the primary key:
 * - External types: "{ownerIdentity}:{providerTypeName}"
 * - Source types: "{projectName}:{fullyQualifiedName}" e.g., "myapp:MyApp.Models.User"
 *
 * The distinction matters for:
 * - Collisions across target providers
 * - Provider-owned forwarding
 * - Multiple providers declaring the same source-facing namespace/type
 */
export type TypeId = {
  /** Primary key: owner/provider identity plus provider-local type name. */
  readonly stableId: string;
  /** Target-neutral nominal symbol identity. */
  readonly symbolId?: TypeSymbolId;
  /** Source-language-facing name used for diagnostics and type lookup. */
  readonly sourceName: string;
  /** Owner/package/project identity, independent of target render naming. */
  readonly ownerIdentity: string;
  /** Provider-local target render key; consumed only by target-surface indexes. */
  readonly targetName: string;
  readonly origin?: TypeOrigin;
};

// ═══════════════════════════════════════════════════════════════════════════
// NOMINAL ENTRY — Complete type information
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Complete type information for a nominal type.
 *
 * This is the unified shape for both source and external types.
 * All type queries go through this structure.
 */
export type NominalEntry = {
  /** Canonical identity */
  readonly typeId: TypeId;
  /** Type kind */
  readonly kind: NominalKind;
  /**
   * Source type alias target (when kind originated from a TypeScript type alias).
   *
   * Present only for source-origin aliases; undefined for external types and
   * non-alias source declarations.
   */
  readonly aliasedType?: IrType;
  /** Type parameters (for generic types) */
  readonly typeParameters: readonly TypeParameterEntry[];
  /** Inheritance edges (extends, implements) */
  readonly heritage: readonly HeritageEdge[];
  /** Members indexed by TS name */
  readonly members: ReadonlyMap<string, MemberEntry>;
  /** Where this type came from */
  readonly origin: TypeOrigin;
  /** Optional source-level primitive projection provided by target metadata. */
  readonly sourcePrimitiveName?: SourcePrimitiveName;
  /** Optional source-level async wrapper semantics provided by target metadata. */
  readonly asyncWrapper?: IrAsyncWrapperMetadata;
  /** Optional source-level iterable semantics provided by target metadata. */
  readonly iterableShape?: IrIterableShapeMetadata;
  /** Accessibility modifier */
  readonly accessibility: "public" | "internal" | "private" | "protected";
  /** Abstract class flag */
  readonly isAbstract: boolean;
  /** Sealed class flag */
  readonly isSealed: boolean;
  /** Static class flag */
  readonly isStatic: boolean;
};

/**
 * Type kind classification.
 */
export type NominalKind =
  | "class"
  | "interface"
  | "struct"
  | "enum"
  | "delegate";

/**
 * Where a type originated.
 */
export type TypeOrigin = "source" | "external";

/**
 * Type parameter declaration on a generic type.
 */
export type TypeParameterEntry = {
  /** Parameter name (e.g., "T", "TKey") */
  readonly name: string;
  /** Constraint type (e.g., "where T : IComparable") */
  readonly constraint?: IrType;
  /** Default type (if any) */
  readonly defaultType?: IrType;
};

// ═══════════════════════════════════════════════════════════════════════════
// HERITAGE — Inheritance relationships
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Inheritance edge connecting types.
 *
 * For generic inheritance like `class MyList<T> extends List<T>`,
 * the typeArguments capture the type parameter mappings.
 */
export type HeritageEdge = {
  /** "extends" for classes, "implements" for interfaces */
  readonly kind: "extends" | "implements";
  /** Target type's stableId */
  readonly targetStableId: string;
  /** Type arguments passed to the target type */
  readonly typeArguments: readonly IrType[];
};

// ═══════════════════════════════════════════════════════════════════════════
// MEMBER ENTRY — Properties, methods, fields, events
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Member information for properties, methods, fields, and events.
 */
export type MemberEntry = {
  /** TS surface name (for symbol binding) */
  readonly tsName: string;
  /** Provider-local target render name. */
  readonly targetName: string;
  /** Member kind */
  readonly memberKind: MemberKind;
  /** Type (for properties, fields); undefined for methods */
  readonly type?: IrType;
  /** Method signatures (for methods/overloads) */
  readonly signatures?: readonly MethodSignatureEntry[];
  /** Static member flag */
  readonly isStatic: boolean;
  /** Readonly property/field flag */
  readonly isReadonly: boolean;
  /** Abstract member flag */
  readonly isAbstract: boolean;
  /** Virtual member flag */
  readonly isVirtual: boolean;
  /** Override member flag */
  readonly isOverride: boolean;
  /** For properties: is this an indexer? */
  readonly isIndexer: boolean;
  /** For properties: has getter? */
  readonly hasGetter: boolean;
  /** For properties: has setter? */
  readonly hasSetter: boolean;
  /** Stable ID for this member */
  readonly stableId: string;
};

/**
 * Member kind classification.
 */
export type MemberKind = "property" | "method" | "field" | "event";

// ═══════════════════════════════════════════════════════════════════════════
// METHOD SIGNATURE — Full method information
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Complete method signature information.
 *
 * For overloaded methods, each overload has its own entry.
 */
export type MethodSignatureEntry = {
  /** Stable ID for this specific signature */
  readonly stableId: string;
  /** Method parameters */
  readonly parameters: readonly ParameterEntry[];
  /** Return type */
  readonly returnType: IrType;
  /** Method-level type parameters */
  readonly typeParameters: readonly TypeParameterEntry[];
  /** Parameter count (for quick overload filtering) */
  readonly parameterCount: number;
  /** Static method flag */
  readonly isStatic: boolean;
  /** Extension method flag */
  readonly isExtensionMethod: boolean;
  /** Source interface for explicit interface implementations */
  readonly sourceInterface?: string;
  /** Normalized signature string for dedup */
  readonly normalizedSignature: string;
};

/**
 * Parameter information for method signatures.
 */
export type ParameterEntry = {
  /** Parameter name */
  readonly name: string;
  /** Parameter type */
  readonly type: IrType;
  /** Passing mode (value, ref, out, in) */
  readonly mode: ParameterMode;
  /** Optional parameter flag */
  readonly isOptional: boolean;
  /** Default value (for optional parameters) */
  readonly defaultValue?: unknown;
  /** Rest/params parameter flag */
  readonly isRest: boolean;
};

/**
 * Parameter passing mode for by-reference style APIs.
 */
export type ParameterMode = "value" | "ref" | "out" | "in";

// ═══════════════════════════════════════════════════════════════════════════
// CONSTRUCTOR ENTRY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Constructor information.
 */
export type ConstructorEntry = {
  /** Normalized signature for dedup */
  readonly normalizedSignature: string;
  /** Constructor parameters */
  readonly parameters: readonly ParameterEntry[];
  /** Static constructor flag */
  readonly isStatic: boolean;
  /** Parameter count */
  readonly parameterCount: number;
};

// ═══════════════════════════════════════════════════════════════════════════
// FIELD ENTRY (from external metadata JSON)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Field information from metadata.
 */
export type FieldEntry = {
  /** Stable ID */
  readonly stableId: string;
  /** Provider-local target render name. */
  readonly targetName: string;
  /** TS surface name */
  readonly tsName: string;
  /** Static field flag */
  readonly isStatic: boolean;
  /** Readonly field flag */
  readonly isReadonly: boolean;
  /** Literal/const field flag */
  readonly isLiteral: boolean;
  /** Normalized signature for type extraction */
  readonly normalizedSignature: string;
};

// ═══════════════════════════════════════════════════════════════════════════
// EXTERNAL TYPE CATALOG — Collection of types from external providers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Complete catalog of types loaded from external provider metadata.
 *
 * This is the result of loading bindings.json files.
 */
export type ExternalTypeCatalog = {
  /** All type entries, keyed by stableId */
  readonly entries: ReadonlyMap<string, NominalEntry>;
  /** TS name → TypeId mapping */
  readonly tsNameToTypeId: ReadonlyMap<string, TypeId>;
  /** Provider-local target name → TypeId mapping */
  readonly targetNameToTypeId: ReadonlyMap<string, TypeId>;
  /** Namespace → TypeIds mapping */
  readonly namespaceToTypeIds: ReadonlyMap<string, readonly TypeId[]>;
};

// ═══════════════════════════════════════════════════════════════════════════
// UNIFIED TYPE CATALOG — Merged source + external types
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Unified catalog merging source and external types.
 *
 * This is THE source of truth for all type queries.
 * No fallback paths allowed.
 */
export type UnifiedTypeCatalog = {
  /** Get entry by TypeId */
  readonly getByTypeId: (typeId: TypeId) => NominalEntry | undefined;
  /** Get entry by stableId string */
  readonly getByStableId: (stableId: string) => NominalEntry | undefined;
  /** Resolve TS name to TypeId */
  readonly resolveTsName: (tsName: string) => TypeId | undefined;
  /** Resolve provider-local target name to TypeId */
  readonly resolveTargetName: (targetName: string) => TypeId | undefined;
  /** Get all members of a type */
  readonly getMembers: (typeId: TypeId) => ReadonlyMap<string, MemberEntry>;
  /** Get specific member by name */
  readonly getMember: (
    typeId: TypeId,
    memberName: string
  ) => MemberEntry | undefined;
  /** Get heritage edges */
  readonly getHeritage: (typeId: TypeId) => readonly HeritageEdge[];
  /** Get type parameters */
  readonly getTypeParameters: (typeId: TypeId) => readonly TypeParameterEntry[];
  /** Check if type exists */
  readonly hasType: (stableId: string) => boolean;
  /** Get all type IDs */
  readonly getAllTypeIds: () => readonly TypeId[];
};
