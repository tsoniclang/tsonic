/**
 * Type Universe — Catalog Type Definitions
 *
 * Defines the core types for the unified type catalog: TypeId, NominalEntry,
 * MemberEntry, MethodSignatureEntry, ConstructorEntry, FieldEntry, and the
 * catalog interfaces (AssemblyTypeCatalog, UnifiedTypeCatalog).
 *
 * INVARIANT INV-CLR: All nominal type identities come from ONE unified catalog.
 * No type query is allowed to "fall back" to parallel logic or parallel stores.
 */

import type { IrType } from "../../../types/index.js";

// ═══════════════════════════════════════════════════════════════════════════
// CANONICAL TYPE IDENTITY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Canonical identity for any nominal type.
 *
 * Uses stableId as the primary key:
 * - Assembly types: "{assemblyName}:{clrName}" e.g., "System.Private.CoreLib:System.String"
 * - Source types: "{projectName}:{fullyQualifiedName}" e.g., "myapp:MyApp.Models.User"
 *
 * The distinction matters for:
 * - Collisions across assemblies
 * - Type-forwarding
 * - Multiple assemblies declaring same namespace/type
 */
export type TypeId = {
  /** Primary key: e.g., "System.Private.CoreLib:System.String" */
  readonly stableId: string;
  /** CLR display name for emitter: e.g., "System.String" */
  readonly clrName: string;
  /** Assembly name: e.g., "System.Private.CoreLib" */
  readonly assemblyName: string;
  /** TS surface name for symbol binding: e.g., "String" */
  readonly tsName: string;
};

// ═══════════════════════════════════════════════════════════════════════════
// NOMINAL ENTRY — Complete type information
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Complete type information for a nominal type.
 *
 * This is the unified shape for both source and assembly types.
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
   * Present only for source-origin aliases; undefined for assembly types and
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
export type TypeOrigin = "source" | "assembly";

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
  /** CLR name (for emitter) */
  readonly clrName: string;
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
 * Parameter passing mode for C# interop.
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
// FIELD ENTRY (from metadata JSON)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Field information from metadata.
 */
export type FieldEntry = {
  /** Stable ID */
  readonly stableId: string;
  /** CLR name */
  readonly clrName: string;
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
// ASSEMBLY TYPE CATALOG — Collection of types from assemblies
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Complete catalog of types loaded from assembly metadata.
 *
 * This is the result of loading bindings.json files.
 */
export type AssemblyTypeCatalog = {
  /** All type entries, keyed by stableId */
  readonly entries: ReadonlyMap<string, NominalEntry>;
  /** TS name → TypeId mapping */
  readonly tsNameToTypeId: ReadonlyMap<string, TypeId>;
  /** CLR name → TypeId mapping */
  readonly clrNameToTypeId: ReadonlyMap<string, TypeId>;
  /** Namespace → TypeIds mapping */
  readonly namespaceToTypeIds: ReadonlyMap<string, readonly TypeId[]>;
};

// ═══════════════════════════════════════════════════════════════════════════
// UNIFIED TYPE CATALOG — Merged source + assembly types
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Unified catalog merging source and assembly types.
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
  /** Resolve CLR name to TypeId */
  readonly resolveClrName: (clrName: string) => TypeId | undefined;
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
