/**
 * TypeAuthority — Alice's 100% Specification
 *
 * The single, authoritative type facility for Tsonic. This is the ONLY place
 * where type information is computed or queried. All converters, validation,
 * and utilities use this interface exclusively.
 *
 * INVARIANTS (enforced by scripts/verify-invariants.sh):
 * - INV-0: No TS computed type APIs outside Binding
 * - INV-1: No convertType/getHandleRegistry outside TypeAuthority
 * - INV-2: Deterministic type sources only
 * - INV-3: Poison-on-missing-types (return unknownType + emit diagnostic)
 */

import type {
  IrType,
  IrFunctionType,
  IrParameter,
  IrInterfaceMember,
  IrPropertySignature,
  IrReferenceType,
  IrPrimitiveType,
  IrMethodSignature,
  IrTypeParameter,
} from "../types/index.js";
import * as ts from "typescript";
import type { Diagnostic, DiagnosticCode } from "../../types/diagnostic.js";
import type {
  DeclId,
  SignatureId,
  MemberId,
  TypeSyntaxId,
  TypeParameterInfo,
  UtilityTypeName,
  ParameterMode,
} from "./types.js";
import {
  substituteIrType as irSubstitute,
  TypeSubstitutionMap as IrSubstitutionMap,
} from "../types/ir-substitution.js";
import { inferNumericKindFromRaw } from "../types/numeric-helpers.js";
import { getBinaryResultKind, TSONIC_TO_NUMERIC_KIND } from "../types/numeric-kind.js";
import type { NumericKind } from "../types/numeric-kind.js";
import type { AliasTable } from "./internal/universe/alias-table.js";
import type {
  MethodSignatureEntry,
  TypeId,
  UnifiedTypeCatalog,
} from "./internal/universe/types.js";

// ═══════════════════════════════════════════════════════════════════════════
// ALICE'S EXACT API — TypeAuthority Interface
// ═══════════════════════════════════════════════════════════════════════════

/**
 * TypeAuthority interface — Alice's exact specification.
 *
 * Key method: resolveCall(query) — single entry point for all call resolution.
 */
export interface TypeAuthority {
  // ─────────────────────────────────────────────────────────────────────────
  // Type Syntax Conversion
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Convert a captured type syntax to IrType.
   *
   * This is the correct way for converters to convert inline type syntax
   * (as X, satisfies Y, generic args) that was captured via Binding.captureTypeSyntax().
   *
   * ALICE'S SPEC (Phase 4): TypeSystem receives opaque handles, not ts.TypeNode.
   * This keeps the TypeSystem public API free of TypeScript types.
   *
   * NOTE: The deprecated convertTypeNode() method has been removed.
   * All converters now use captureTypeSyntax() + typeFromSyntax().
   */
  typeFromSyntax(typeSyntaxId: TypeSyntaxId): IrType;

  // ─────────────────────────────────────────────────────────────────────────
  // Declaration Types
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get the type of a declaration by its handle.
   *
   * Returns unknownType + TSN5201/TSN5203 diagnostic if type cannot be determined.
   */
  typeOfDecl(declId: DeclId): IrType;

  // ─────────────────────────────────────────────────────────────────────────
  // Member Types
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get the declared type of a member (fully substituted through inheritance).
   *
   * Handles:
   * - Reference types: looks up in TypeRegistry + applies NominalEnv substitution
   * - Object types: direct structural lookup
   * - Primitive types: maps to nominal (string→String) for member lookup
   *
   * Returns unknownType + TSN5203 diagnostic if member not found.
   */
  typeOfMember(receiver: IrType, member: MemberRef, site?: Site): IrType;

  /**
   * Get CLR indexer information for a receiver type (if any).
   *
   * Used to deterministically lower computed access (`obj[key]`) using CLR metadata
   * rather than heuristics. This includes string-keyed indexers from ASP.NET Core
   * collections like IQueryCollection / IHeaderDictionary.
   */
  getIndexerInfo(
    receiver: IrType,
    site?: Site
  ): { readonly keyClrType: string; readonly valueType: IrType } | undefined;

  // ─────────────────────────────────────────────────────────────────────────
  // Call Resolution — THE HEART OF DETERMINISM
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Resolve a call site: returns fully instantiated param/return types + modes.
   *
   * This is the SINGLE method for all call resolution. It:
   * 1. Loads raw signature from SignatureId
   * 2. Computes receiver substitution (class type params)
   * 3. Computes call substitution (method type params from explicit args + unification)
   * 4. Returns final instantiated types
   *
   * Returns poisoned call on conflict (TSN5202).
   */
  resolveCall(query: CallQuery): ResolvedCall;

  /**
   * Convert a CLR delegate nominal type (Func/Action/custom delegates) into a function type.
   *
   * Used for deterministic lambda contextual typing and generic inference when
   * signatures use delegate types (e.g., LINQ's Func<T, bool>).
   */
  delegateToFunctionType(type: IrType): IrFunctionType | undefined;

  // ─────────────────────────────────────────────────────────────────────────
  // Utility Type Expansion
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Expand a utility type (Partial, Pick, ReturnType, etc.).
   *
   * All 13 utilities with deterministic constraints:
   * - Partial/Required/Readonly: T must be object-like
   * - Pick/Omit: K must be string literal union
   * - ReturnType/Parameters: F must be single function
   * - NonNullable: Works on any type
   * - Exclude/Extract: Works on any types
   * - Awaited: Recursive on Promise<T>, Task<T>, ValueTask<T>
   * - Record: K must be string/number or literal union
   *
   * Returns unknownType + TSN7414 diagnostic on constraint violation.
   */
  expandUtility(
    name: UtilityTypeName,
    args: readonly IrType[],
    site?: Site
  ): IrType;

  // ─────────────────────────────────────────────────────────────────────────
  // Substitution & Instantiation
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Substitute type parameters with concrete types.
   *
   * Pure IR-to-IR transformation.
   */
  substitute(type: IrType, subst: TypeSubstitutionMap): IrType;

  /**
   * Instantiate a generic type with type arguments.
   *
   * Example: instantiate("Array", [string]) → Array<string> with members substituted.
   */
  instantiate(
    typeName: string,
    typeArgs: readonly IrType[],
    site?: Site
  ): IrType;

  // ─────────────────────────────────────────────────────────────────────────
  // Type Relations
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Check if source type is assignable to target type.
   *
   * Conservative implementation — returns false if unsure.
   */
  isAssignableTo(source: IrType, target: IrType): boolean;

  /**
   * Check if two types are structurally equal.
   */
  typesEqual(a: IrType, b: IrType): boolean;

  /**
   * Check if a type contains unresolved type parameters.
   */
  containsTypeParameter(type: IrType): boolean;

  /**
   * Check if a declaration has type parameters (is generic).
   *
   * Used by getConstructedType to detect if `new Foo()` needs explicit type args.
   * Returns true for generic classes/interfaces/type aliases.
   */
  hasTypeParameters(declId: DeclId): boolean;

  /**
   * Get the type of a member by its handle.
   *
   * Used by property access fallback when TypeSystem.typeOfMember() can't resolve
   * the member through TypeRegistry/NominalEnv (e.g., CLR-bound members).
   *
   * Returns unknownType if member not found or has no type annotation.
   */
  typeOfMemberId(memberId: MemberId): IrType;

  /**
   * Get the fully-qualified name of a declaration.
   *
   * Used to detect aliased imports (e.g., `import { String as ClrString }`).
   * Returns undefined if no fqName is available.
   */
  getFQNameOfDecl(declId: DeclId): string | undefined;

  /**
   * Check if a declaration is a type (interface, class, type alias, or enum).
   *
   * Used by import processing to distinguish type imports from value imports.
   */
  isTypeDecl(declId: DeclId): boolean;

  /**
   * Check if a declaration is an interface.
   *
   * Used by validation to detect nominalized interfaces.
   */
  isInterfaceDecl(declId: DeclId): boolean;

  /**
   * Check if a declaration is a type alias to an object literal type.
   *
   * Used by validation to detect nominalized type aliases.
   */
  isTypeAliasToObjectLiteral(declId: DeclId): boolean;

  /**
   * Check if a signature has a conditional return type.
   *
   * This is used to detect if a call requires specialization due to
   * conditional return types like `T extends string ? A : B`.
   * The check is done inside TypeSystem to avoid exposing ts.TypeNode.
   */
  signatureHasConditionalReturn(sigId: SignatureId): boolean;

  /**
   * Check if a signature has variadic type parameters.
   *
   * Variadic patterns like `T extends unknown[]` require specialization.
   * This encapsulates the AST inspection inside TypeSystem.
   *
   * ALICE'S SPEC (Phase 5): Semantic method replaces getSignatureInfo.
   */
  signatureHasVariadicTypeParams(sigId: SignatureId): boolean;

  /**
   * Check if a declaration has an explicit type annotation.
   *
   * Used for deterministic typing checks (e.g., spread sources must have types).
   * Returns true if the declaration has a typeNode.
   *
   * ALICE'S SPEC (Phase 5): Semantic method replaces getDeclInfo.typeNode check.
   */
  declHasTypeAnnotation(declId: DeclId): boolean;

  /**
   * Check if a member in a TypeScript base class is overridable.
   *
   * For TypeScript classes, checks if the base class has the given member.
   * In TypeScript, all methods can be overridden (no `final` keyword).
   *
   * ALICE'S SPEC (Phase 5): Semantic method replaces getDeclInfo for override detection.
   *
   * @param declId The declaration ID of the base class
   * @param memberName Name of the member to check
   * @param memberKind Whether it's a method or property
   * @returns { isOverride: true } if member exists and can be overridden
   */
  checkTsClassMemberOverride(
    declId: DeclId,
    memberName: string,
    memberKind: "method" | "property"
  ): { isOverride: boolean; isShadow: boolean };

  // ─────────────────────────────────────────────────────────────────────────
  // Diagnostics
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get all diagnostics emitted during type queries.
   *
   * Call this after completing IR conversion to collect type-related diagnostics.
   */
  getDiagnostics(): readonly Diagnostic[];

  /**
   * Clear accumulated diagnostics.
   */
  clearDiagnostics(): void;
}

// ═══════════════════════════════════════════════════════════════════════════
// SUPPORTING TYPES — Alice's Exact Specification
// ═══════════════════════════════════════════════════════════════════════════

/**
 * MemberRef — Reference to a member by ID or name.
 *
 * byId: Use when MemberId is available (stable identity).
 * byName: Use for dynamic access (property access expressions).
 */
export type MemberRef =
  | { readonly kind: "byId"; readonly id: MemberId }
  | { readonly kind: "byName"; readonly name: string };

/**
 * CallQuery — Input to resolveCall().
 *
 * Contains all information needed to resolve a call site.
 *
 * IMPORTANT (Alice's spec): argumentCount is REQUIRED for totality.
 * Even if signature lookup fails, TypeSystem must return correct-arity
 * arrays filled with unknownType. This prevents fallback behavior.
 */
export type CallQuery = {
  /** The signature being called (from Binding.resolveCallSignature) */
  readonly sigId: SignatureId;

  /**
   * Number of arguments at the call site.
   *
   * REQUIRED for totality: Used to construct correct-arity poisoned result
   * when signature lookup fails. Without this, TypeSystem cannot guarantee
   * parameterTypes.length === argumentCount.
   */
  readonly argumentCount: number;

  /** Receiver type for member calls (e.g., `arr` in `arr.map(...)`) */
  readonly receiverType?: IrType;

  /** Explicit type arguments from call syntax (e.g., `fn<string>(...)`) */
  readonly explicitTypeArgs?: readonly IrType[];

  /** Argument types for deterministic unification (undefined = unknown) */
  readonly argTypes?: readonly (IrType | undefined)[];

  /** Blame location for diagnostics */
  readonly site?: Site;
};

/**
 * ResolvedCall — Output of resolveCall().
 *
 * Contains fully instantiated types after all substitutions applied.
 */
export type ResolvedCall = {
  /** Fully instantiated parameter types (undefined = missing annotation) */
  readonly parameterTypes: readonly (IrType | undefined)[];

  /** Parameter passing modes (value, ref, out, in) */
  readonly parameterModes: readonly ParameterMode[];

  /** Fully instantiated return type */
  readonly returnType: IrType;

  /**
   * Type predicate info for narrowing (x is T).
   * Only present if the function has a type predicate return type.
   */
  readonly typePredicate?: TypePredicateResult;

  /** Diagnostics emitted during resolution */
  readonly diagnostics: readonly Diagnostic[];
};

/**
 * TypePredicateResult — Resolved type predicate info.
 *
 * Extracted from SignatureInfo.typePredicate and converted to IR types.
 */
export type TypePredicateResult =
  | {
      readonly kind: "param";
      readonly parameterIndex: number;
      readonly targetType: IrType;
    }
  | {
      readonly kind: "this";
      readonly targetType: IrType;
    };

// ParameterMode is imported from types.ts

/**
 * Site — Blame location for diagnostics.
 *
 * Used to report errors at the correct source location.
 */
export type Site = {
  /** Source file path */
  readonly file?: string;

  /** 0-based line number */
  readonly line?: number;

  /** 0-based column number */
  readonly column?: number;

  /** Original AST node (for detailed location) */
  readonly node?: unknown;
};

/**
 * Type substitution map — maps type parameter names to concrete types.
 */
export type TypeSubstitutionMap = ReadonlyMap<string, IrType>;

// ═══════════════════════════════════════════════════════════════════════════
// RAW SIGNATURE INFO — Internal to TypeSystem
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Raw signature information extracted from Binding.
 *
 * This is the pre-substitution form stored in the signature cache.
 */
export type RawSignatureInfo = {
  /** Parameter types (undefined = missing annotation → TSN5201) */
  readonly parameterTypes: readonly (IrType | undefined)[];

  /** Return type (voidType if not specified) */
  readonly returnType: IrType;

  /** Parameter modes */
  readonly parameterModes: readonly ParameterMode[];

  /** Type parameters for generic methods */
  readonly typeParameters: readonly TypeParameterInfo[];

  /** Parameter names (for diagnostics) */
  readonly parameterNames: readonly string[];

  /**
   * Type predicate (x is T) - extracted at Binding registration time.
   * Contains target type as IrType.
   */
  readonly typePredicate?: TypePredicateResult;

  /**
   * Declaring identity — CRITICAL for inheritance substitution.
   *
   * Without this, resolveCall cannot compute receiver substitution.
   * Uses simple TS name, resolved via UnifiedTypeCatalog.resolveTsName().
   */
  readonly declaringTypeTsName?: string;
  readonly declaringMemberName?: string;
};

// ═══════════════════════════════════════════════════════════════════════════
// TYPESYSTEM FACTORY CONFIG
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Configuration for creating a TypeSystem instance.
 */
export type TypeSystemConfig = {
  /**
   * Handle registry for looking up declarations and signatures.
   *
   * This is obtained from Binding via the internal _getHandleRegistry().
   */
  readonly handleRegistry: HandleRegistry;

  /**
   * TypeRegistry for nominal type lookup.
   *
   * After Step 3, this stores pure IR (IrType), not TypeNodes.
   */
  readonly typeRegistry: TypeRegistryAPI;

  /**
   * NominalEnv for inheritance chain and substitution computation.
   */
  readonly nominalEnv: NominalEnvAPI;

  /**
   * Type converter for converting TypeNodes to IrType.
   *
   * Used during TypeSystem construction only. After Step 3, TypeRegistry
   * stores pure IR, so this is only needed for on-demand conversion.
   *
   * NOTE: Takes `unknown` because HandleRegistry stores TypeNodes as opaque.
   * This is used internally by TypeSystem methods (resolveCall, typeOfDecl, etc.)
   * and by typeFromSyntax. External callers don't access this directly.
   */
  readonly convertTypeNode: (node: unknown) => IrType;

  /**
   * Unified type catalog for CLR assembly type lookups.
   *
   * When provided, member lookups will fall through to this catalog
   * for types not found in TypeRegistry (e.g., System.String, System.Int32).
   * This enables method chain type recovery for built-in types.
   *
   * Optional during migration; will become required when migration completes.
   */
  readonly unifiedCatalog: UnifiedTypeCatalog;

  /**
   * Alias table mapping surface names to canonical TypeIds.
   *
   * This is required for Alice's invariant:
   * - "string" and "System.String" unify to the same TypeId (stableId)
   */
  readonly aliasTable: AliasTable;

  /**
   * Binding-powered symbol/signature resolution helpers (opaque boundary).
   *
   * ALICE'S SPEC: TypeSystem may depend on Binding for symbol resolution,
   * but must never use TypeScript computed type APIs directly.
   *
   * These accept `unknown` to keep the TypeSystem public surface TS-free.
   */
  readonly resolveIdentifier: (node: unknown) => DeclId | undefined;
  readonly resolveCallSignature: (node: unknown) => SignatureId | undefined;
  readonly resolveConstructorSignature: (node: unknown) => SignatureId | undefined;
};

// ═══════════════════════════════════════════════════════════════════════════
// DEPENDENCY INTERFACES — Minimal APIs required by TypeSystem
// ═══════════════════════════════════════════════════════════════════════════

/**
 * HandleRegistry — maps opaque handles to their underlying data.
 *
 * Created and managed by the Binding layer. TypeSystem uses this
 * to look up declaration and signature information.
 */
export interface HandleRegistry {
  /** Get declaration info for a DeclId */
  getDecl(id: DeclId): DeclInfo | undefined;

  /** Get signature info for a SignatureId */
  getSignature(id: SignatureId): SignatureInfo | undefined;

  /** Get member info for a MemberId */
  getMember(id: MemberId): MemberInfo | undefined;

  /**
   * Get captured type syntax for a TypeSyntaxId.
   *
   * Returns the TypeNode that was captured via Binding.captureTypeSyntax().
   * TypeSystem uses this internally to convert captured syntax to IrType.
   */
  getTypeSyntax(id: TypeSyntaxId): TypeSyntaxInfo | undefined;
}

/**
 * Type syntax info stored in the handle registry.
 */
export type TypeSyntaxInfo = {
  /** The captured TypeNode (ts.TypeNode, cast to unknown) */
  readonly typeNode: unknown;
};

/**
 * Captured class member names for override detection.
 * Pure data — no TS nodes.
 */
export type ClassMemberNames = {
  readonly methods: ReadonlySet<string>;
  readonly properties: ReadonlySet<string>;
};

/**
 * Declaration info in the handle registry.
 */
export type DeclInfo = {
  /** Explicit type annotation (ts.TypeNode, cast to unknown) */
  readonly typeNode?: unknown;

  /** Declaration kind */
  readonly kind: DeclKind;

  /** Fully-qualified name */
  readonly fqName?: string;

  /** Declaration AST node (ts.Declaration, cast to unknown) */
  readonly declNode?: unknown;

  /** Captured class member names (for class declarations only) */
  readonly classMemberNames?: ClassMemberNames;
};

export type DeclKind =
  | "variable"
  | "function"
  | "class"
  | "interface"
  | "typeAlias"
  | "enum"
  | "parameter"
  | "property"
  | "method";

/**
 * Signature info in the handle registry.
 *
 * IMPORTANT: Must include declaring identity for resolveCall().
 */
export type SignatureInfo = {
  /** Parameter nodes */
  readonly parameters: readonly ParameterNode[];

  /** Return type node (ts.TypeNode, cast to unknown) */
  readonly returnTypeNode?: unknown;

  /** Type parameters */
  readonly typeParameters?: readonly TypeParameterNode[];

  /**
   * Declaring type simple TS name (e.g., "Box" not "Test.Box").
   *
   * CRITICAL: Required for inheritance substitution in resolveCall().
   * Resolved via UnifiedTypeCatalog.resolveTsName() to get CLR FQ name.
   */
  readonly declaringTypeTsName?: string;

  /**
   * Declaring member name.
   *
   * CRITICAL: Required for inheritance substitution in resolveCall().
   */
  readonly declaringMemberName?: string;

  /**
   * Type predicate information for `x is T` return types.
   *
   * Extracted at registration time via pure syntax inspection.
   * Contains targetTypeNode which TypeSystem converts to IrType.
   */
  readonly typePredicate?: SignatureTypePredicateRaw;
};

/**
 * Raw type predicate info as stored in SignatureInfo.
 * Contains TypeNode, not IrType.
 */
export type SignatureTypePredicateRaw =
  | {
      readonly kind: "param";
      readonly parameterName: string;
      readonly parameterIndex: number;
      readonly targetTypeNode: unknown; // ts.TypeNode
    }
  | {
      readonly kind: "this";
      readonly targetTypeNode: unknown; // ts.TypeNode
    };

export type ParameterNode = {
  readonly name: string;
  readonly typeNode?: unknown;
  readonly isOptional: boolean;
  readonly isRest: boolean;
  readonly mode?: ParameterMode;
};

export type TypeParameterNode = {
  readonly name: string;
  readonly constraintNode?: unknown;
  readonly defaultNode?: unknown;
};

/**
 * Member info in the handle registry.
 */
export type MemberInfo = {
  readonly name: string;
  readonly declNode?: unknown;
  readonly typeNode?: unknown;
  readonly isOptional: boolean;
  readonly isReadonly: boolean;
};

/**
 * TypeRegistry API — minimal interface needed by TypeSystem.
 *
 * After Step 3, TypeRegistry stores pure IR.
 */
export interface TypeRegistryAPI {
  /** Resolve a type by fully-qualified name */
  resolveNominal(fqName: string): TypeRegistryEntry | undefined;

  /** Resolve a type by simple name (returns first match) */
  resolveBySimpleName(simpleName: string): TypeRegistryEntry | undefined;

  /** Get fully-qualified name from simple name */
  getFQName(simpleName: string): string | undefined;

  /** Get member type from a nominal type (pure IR after Step 3) */
  getMemberType(fqNominal: string, memberName: string): IrType | undefined;

  /** Check if a type is registered */
  hasType(fqName: string): boolean;
}

/**
 * Type parameter info in TypeRegistry.
 *
 * Pure IR representation of type parameters.
 */
export type TypeParameterEntry = {
  readonly name: string;
  readonly constraint?: IrType;
  readonly defaultType?: IrType;
};

/**
 * TypeRegistry entry.
 *
 * After Step 3, members/heritage store IrType, not TypeNodes.
 */
export type TypeRegistryEntry = {
  readonly kind: "class" | "interface" | "typeAlias";
  readonly name: string;
  readonly fullyQualifiedName: string;
  readonly typeParameters: readonly TypeParameterEntry[];
  // After Step 3, members will store IrType directly
  readonly members: ReadonlyMap<string, TypeRegistryMemberInfo>;
};

/**
 * Member info in TypeRegistry.
 *
 * Pure IR representation - stores IrType, not TypeNode.
 */
export type TypeRegistryMemberInfo = {
  readonly kind: "property" | "method" | "indexSignature";
  readonly name: string;
  readonly type: IrType | undefined; // PURE IR - converted at registration time
  readonly isOptional: boolean;
  readonly isReadonly: boolean;
  readonly methodSignatures?: readonly IrMethodSignature[]; // For methods - PURE IR
};

/**
 * NominalEnv API — Phase 6: TypeId-based interface.
 */
export interface NominalEnvAPI {
  /** Get inheritance chain for a type (returns TypeIds) */
  getInheritanceChain(typeId: TypeId): readonly TypeId[];

  /** Get substitution for a parent type given child instantiation */
  getInstantiation(
    receiverTypeId: TypeId,
    receiverTypeArgs: readonly IrType[],
    targetTypeId: TypeId
  ): ReadonlyMap<string, IrType> | undefined;

  /** Find the declaring type of a member in the inheritance chain */
  findMemberDeclaringType(
    receiverTypeId: TypeId,
    receiverTypeArgs: readonly IrType[],
    memberName: string
  ): MemberLookupResult | undefined;
}

/**
 * Result of looking up a member in the inheritance chain.
 */
export type MemberLookupResult = {
  /** TypeId of the type that declares the member */
  readonly declaringTypeId: TypeId;

  /** Substitution to apply to the member's declared type */
  readonly substitution: ReadonlyMap<string, IrType>;
};

// ═══════════════════════════════════════════════════════════════════════════
// BUILTIN NOMINAL MAPPING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Mapping from primitive type names to their nominal type names.
 *
 * Used by typeOfMember to look up members on primitives.
 * e.g., `"hello".length` → String.length
 */
export const BUILTIN_NOMINALS: Readonly<Record<string, string>> = {
  string: "String",
  number: "Number",
  boolean: "Boolean",
  bigint: "BigInt",
  symbol: "Symbol",
};

// ═══════════════════════════════════════════════════════════════════════════
// POISON VALUES
// ═══════════════════════════════════════════════════════════════════════════

/** Poison type for undeterminable types */
export const unknownType: IrType = { kind: "unknownType" };

/** Poison type for impossible types */
export const neverType: IrType = { kind: "neverType" };

/** Void type for functions with no return */
export const voidType: IrType = { kind: "voidType" };

/**
 * Create a poisoned ResolvedCall with correct arity.
 *
 * CRITICAL (Alice's spec): Empty arrays are ILLEGAL.
 * Poisoned results must have correct arity so callers cannot
 * detect failure via `length === 0` and fall back to legacy.
 *
 * @param arity Number of parameters/arguments (from CallQuery.argumentCount)
 * @param diagnostics Diagnostics explaining why resolution failed
 */
export const poisonedCall = (
  arity: number,
  diagnostics: readonly Diagnostic[]
): ResolvedCall => ({
  parameterTypes: Array(arity).fill(unknownType),
  parameterModes: Array(arity).fill("value" as const),
  returnType: unknownType,
  diagnostics,
});

// ═══════════════════════════════════════════════════════════════════════════
// TYPESYSTEM FACTORY — Step 4 Implementation
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Nominal lookup result cached for member lookups.
 */
type NominalLookupResult = {
  readonly targetNominal: string;
  readonly memberType: IrType;
  readonly substitution: ReadonlyMap<string, IrType>;
};

/**
 * Create a TypeSystem instance with internal caches.
 *
 * This is the single factory for TypeSystem. All type queries go through
 * the returned TypeSystem instance.
 */
export const createTypeSystem = (
  config: TypeSystemConfig
): TypeAuthority => {
  const {
    handleRegistry,
    typeRegistry,
    nominalEnv,
    convertTypeNode: convertTypeNodeRaw,
    unifiedCatalog,
    aliasTable,
    resolveIdentifier,
    resolveCallSignature,
    resolveConstructorSignature,
  } = config;

  // ─────────────────────────────────────────────────────────────────────────
  // INTERNAL CACHES — Step 4 Implementation
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Cache for declaration types.
   * Key: DeclId.id (number)
   * Value: IrType
   */
  const declTypeCache = new Map<number, IrType>();

  /**
   * Cache for member declared types (fully substituted).
   * Key: "fqName:memberName" or "fqName:memberName:typeArgs" for generics
   * Value: IrType
   */
  const memberDeclaredTypeCache = new Map<string, IrType>();

  /**
   * Cache for raw signature info (pre-substitution).
   * Key: SignatureId.id (number)
   * Value: RawSignatureInfo
   */
  const signatureRawCache = new Map<number, RawSignatureInfo>();

  /**
   * Cache for nominal member lookups.
   * Key: "fqName:typeArgs:memberName"
   * Value: NominalLookupResult
   */
  const nominalMemberLookupCache = new Map<
    string,
    NominalLookupResult | null
  >();

  /**
   * Accumulated diagnostics from type queries.
   */
  const diagnostics: Diagnostic[] = [];

  // ─────────────────────────────────────────────────────────────────────────
  // DIAGNOSTIC HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  const emitDiagnostic = (
    code: DiagnosticCode,
    message: string,
    site?: Site
  ): void => {
    const location =
      site?.file !== undefined &&
      site?.line !== undefined &&
      site?.column !== undefined
        ? {
            file: site.file,
            line: site.line,
            column: site.column,
            length: 1, // Default length
          }
        : undefined;

    diagnostics.push({
      code,
      severity: "error",
      message,
      location,
    });
  };

  // ─────────────────────────────────────────────────────────────────────────
  // CACHE KEY HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Create a cache key for member type lookup.
   */
  const makeMemberCacheKey = (
    fqName: string,
    memberName: string,
    typeArgs?: readonly IrType[]
  ): string => {
    if (typeArgs && typeArgs.length > 0) {
      return `${fqName}:${memberName}:${JSON.stringify(typeArgs)}`;
    }
    return `${fqName}:${memberName}`;
  };

  /**
   * Create a cache key for nominal lookup.
   */
  const makeNominalLookupKey = (
    fqName: string,
    typeArgs: readonly IrType[],
    memberName: string
  ): string => {
    return `${fqName}:${JSON.stringify(typeArgs)}:${memberName}`;
  };

  // Helper to check if type is null/undefined primitive
  const isNullishPrimitive = (
    t: IrType
  ): t is IrPrimitiveType & { name: "null" | "undefined" } => {
    return (
      t.kind === "primitiveType" &&
      (t.name === "null" || t.name === "undefined")
    );
  };

  // Use makeNominalLookupKey to suppress unused warning
  void makeNominalLookupKey;

  // ─────────────────────────────────────────────────────────────────────────
  // RAW SIGNATURE EXTRACTION
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get or compute raw signature info from SignatureId.
   * Caches the result for subsequent calls.
   */
  const getRawSignature = (
    sigId: SignatureId
  ): RawSignatureInfo | undefined => {
    const cached = signatureRawCache.get(sigId.id);
    if (cached) return cached;

    const sigInfo = handleRegistry.getSignature(sigId);
    if (!sigInfo) return undefined;

    // Convert parameter types from TypeNodes to IrTypes
    const parameterTypes: (IrType | undefined)[] = sigInfo.parameters.map(
      (p) => (p.typeNode ? convertTypeNode(p.typeNode) : undefined)
    );

    // Extract parameter modes
    const parameterModes: ParameterMode[] = sigInfo.parameters.map(
      (p) => p.mode ?? "value"
    );

    // Extract parameter names
    const parameterNames: string[] = sigInfo.parameters.map((p) => p.name);

    // Extract type parameters
    const typeParameters: TypeParameterInfo[] = (
      sigInfo.typeParameters ?? []
    ).map((tp) => ({
      name: tp.name,
      constraint: tp.constraintNode
        ? convertTypeNode(tp.constraintNode)
        : undefined,
      defaultType: tp.defaultNode ? convertTypeNode(tp.defaultNode) : undefined,
    }));

    const isConstructor = sigInfo.declaringMemberName === "constructor";

    // Convert return type
    const returnType: IrType = (() => {
      if (sigInfo.returnTypeNode) return convertTypeNode(sigInfo.returnTypeNode);

      // Class constructor declarations do not have return type annotations in TS syntax.
      // Deterministically synthesize the constructed instance type using the declaring
      // identity captured in Binding and the (class) type parameters captured for the
      // constructor signature.
      if (isConstructor && sigInfo.declaringTypeTsName) {
        const typeArguments = typeParameters.map(
          (tp) => ({ kind: "typeParameterType" as const, name: tp.name }) satisfies IrType
        );

        return {
          kind: "referenceType",
          name: sigInfo.declaringTypeTsName,
          ...(typeArguments.length > 0 ? { typeArguments } : {}),
        };
      }

      return voidType;
    })();

    // Extract type predicate (already extracted in Binding at registration time)
    let typePredicate: TypePredicateResult | undefined;
    if (sigInfo.typePredicate) {
      const pred = sigInfo.typePredicate;
      const targetType = convertTypeNode(pred.targetTypeNode);
      if (pred.kind === "param") {
        typePredicate = {
          kind: "param",
          parameterIndex: pred.parameterIndex,
          targetType,
        };
      } else {
        typePredicate = {
          kind: "this",
          targetType,
        };
      }
    }

    const rawSig: RawSignatureInfo = {
      parameterTypes,
      returnType,
      parameterModes,
      typeParameters,
      parameterNames,
      typePredicate,
      declaringTypeTsName: sigInfo.declaringTypeTsName,
      declaringMemberName: sigInfo.declaringMemberName,
    };

    signatureRawCache.set(sigId.id, rawSig);
    return rawSig;
  };

	  // ─────────────────────────────────────────────────────────────────────────
	  // STEP 5: TYPESYSTEM ALGORITHM IMPLEMENTATIONS
	  // ─────────────────────────────────────────────────────────────────────────

	  /**
	   * Resolve a surface name to a canonical TypeId.
	   *
	   * Order:
	   * 1) AliasTable (primitives/globals/System.* canonicalization)
	   * 2) UnifiedTypeCatalog by tsName
	   * 3) UnifiedTypeCatalog by clrName
	   *
	   * IMPORTANT (airplane-grade):
	   * Resolution must be arity-aware when type arguments are present. Facade
	   * types often omit the `_N` generic arity suffix (e.g. `IList<T>` is a
	   * facade over `IList_1<T>`). When `arity` is provided and the direct
	   * resolution doesn't match, we deterministically try `<name>_<arity>`.
	   */
	  const resolveTypeIdByName = (
	    name: string,
	    arity?: number
	  ): TypeId | undefined => {
	    const direct =
	      aliasTable.get(name) ??
	      unifiedCatalog.resolveTsName(name) ??
	      unifiedCatalog.resolveClrName(name);

	    if (arity === undefined) return direct;

	    if (direct) {
	      const directArity = unifiedCatalog.getTypeParameters(direct).length;
	      if (directArity === arity) return direct;
	    }

	    // Facade name without arity suffix → try tsbindgen's structural encoding.
	    if (arity > 0) {
	      const suffixed = `${name}_${arity}`;
	      const candidate =
	        aliasTable.get(suffixed) ??
	        unifiedCatalog.resolveTsName(suffixed) ??
	        unifiedCatalog.resolveClrName(suffixed);

	      if (candidate) {
	        const candidateArity =
	          unifiedCatalog.getTypeParameters(candidate).length;
	        if (candidateArity === arity) return candidate;
	      }
	    }

	    return undefined;
	  };

	  /**
	   * Attach canonical TypeIds to IR types where possible.
	   *
	   * This keeps nominal identity stable throughout the pipeline and enables
	   * emit-time resolution without relying on string name matching.
	   */
	  const attachParameterTypeIds = (p: IrParameter): IrParameter => ({
	    ...p,
	    type: p.type ? attachTypeIds(p.type) : undefined,
	  });

	  const attachTypeParameterTypeIds = (tp: IrTypeParameter): IrTypeParameter => ({
	    ...tp,
	    constraint: tp.constraint ? attachTypeIds(tp.constraint) : undefined,
	    default: tp.default ? attachTypeIds(tp.default) : undefined,
	    structuralMembers: tp.structuralMembers?.map(attachInterfaceMemberTypeIds),
	  });

	  const attachInterfaceMemberTypeIds = (
	    m: IrInterfaceMember
	  ): IrInterfaceMember => {
	    if (m.kind === "propertySignature") {
	      return { ...m, type: attachTypeIds(m.type) };
	    }

	    return {
	      ...m,
	      typeParameters: m.typeParameters?.map(attachTypeParameterTypeIds),
	      parameters: m.parameters.map(attachParameterTypeIds),
	      returnType: m.returnType ? attachTypeIds(m.returnType) : undefined,
	    };
	  };

	  const attachTypeIds = (type: IrType): IrType => {
	    switch (type.kind) {
	      case "referenceType": {
	        const typeId =
	          type.typeId ??
	          resolveTypeIdByName(
	            type.resolvedClrType ?? type.name,
	            type.typeArguments?.length
	          );

	        return {
	          ...type,
	          ...(type.typeArguments
	            ? { typeArguments: type.typeArguments.map(attachTypeIds) }
	            : {}),
	          ...(type.structuralMembers
	            ? {
	                structuralMembers:
	                  type.structuralMembers.map(attachInterfaceMemberTypeIds),
	              }
	            : {}),
	          ...(typeId ? { typeId } : {}),
	        };
	      }

	      case "arrayType":
	        return { ...type, elementType: attachTypeIds(type.elementType) };

	      case "tupleType":
	        return {
	          ...type,
	          elementTypes: type.elementTypes.map(attachTypeIds),
	        };

	      case "functionType":
	        return {
	          ...type,
	          parameters: type.parameters.map(attachParameterTypeIds),
	          returnType: attachTypeIds(type.returnType),
	        };

	      case "objectType":
	        return {
	          ...type,
	          members: type.members.map(attachInterfaceMemberTypeIds),
	        };

	      case "dictionaryType":
	        return {
	          ...type,
	          keyType: attachTypeIds(type.keyType),
	          valueType: attachTypeIds(type.valueType),
	        };

	      case "unionType":
	      case "intersectionType":
	        return { ...type, types: type.types.map(attachTypeIds) };

	      default:
	        return type;
	    }
	  };

	  /**
	   * Deterministic type syntax conversion with canonical TypeId attachment.
	   *
	   * The underlying converter is syntax-only; this wrapper re-attaches the
	   * nominal identity from the UnifiedUniverse so downstream passes (including
	   * the emitter) can resolve CLR types without re-driving a parallel lookup.
	   */
	  const convertTypeNode = (node: unknown): IrType => {
	    return attachTypeIds(convertTypeNodeRaw(node));
	  };

	  /**
	   * Normalize a receiver type to nominal form for member lookup.
	   *
	   * Phase 6: Returns TypeId + typeArgs for TypeId-based NominalEnv.
	   *
	   * ALICE'S RULE R3: Primitive-to-nominal bridging is part of TypeSystem.
	   */
	  const normalizeToNominal = (
	    type: IrType
	  ): { typeId: TypeId; typeArgs: readonly IrType[] } | undefined => {
	    if (type.kind === "referenceType") {
	      const arity = type.typeArguments?.length;
	      const typeId =
	        type.typeId ??
	        (type.resolvedClrType
	          ? resolveTypeIdByName(type.resolvedClrType, arity)
	          : undefined) ??
	        resolveTypeIdByName(type.name, arity);
	      if (!typeId) return undefined;
	      return { typeId, typeArgs: type.typeArguments ?? [] };
	    }

	    if (type.kind === "primitiveType") {
	      const typeId = resolveTypeIdByName(type.name, 0);
	      if (!typeId) return undefined;
	      return { typeId, typeArgs: [] };
	    }

	    if (type.kind === "arrayType") {
	      const arrayTypeId = resolveTypeIdByName("Array", 1);
	      if (!arrayTypeId) return undefined;
	      return { typeId: arrayTypeId, typeArgs: [type.elementType] };
	    }

	    return undefined;
	  };

  /**
   * Convert a nominal CLR delegate type to an IrFunctionType by reading its Invoke signature.
   *
   * This is used for deterministic lambda typing when the expected type is a delegate
   * (e.g., custom delegates from CLR metadata).
   */
  const delegateToFunctionType = (type: IrType): IrFunctionType | undefined => {
    // Expression<TDelegate> wrapper: treat as its underlying delegate type for
    // deterministic lambda contextual typing.
    //
    // This models C#'s implicit lambda conversion to Expression<Func<...>>:
    // the TypeScript surface uses Expression<TDelegate>, but lambdas should be
    // typed against the delegate shape.
    if (
      type.kind === "referenceType" &&
      type.name === "Expression_1" &&
      (type.typeArguments?.length ?? 0) === 1
    ) {
      const inner = type.typeArguments?.[0];
      if (!inner) return undefined;
      if (inner.kind === "functionType") return inner;
      return delegateToFunctionType(inner);
    }

    const normalized = normalizeToNominal(type);
    if (!normalized) return undefined;

    const entry = unifiedCatalog.getByTypeId(normalized.typeId);
    if (!entry || entry.kind !== "delegate") return undefined;

    const invokeMember =
      unifiedCatalog.getMember(normalized.typeId, "Invoke") ??
      unifiedCatalog.getMember(normalized.typeId, "invoke");
    const invokeSig = invokeMember?.signatures?.[0];
    if (!invokeSig) return undefined;

    const typeParams = unifiedCatalog.getTypeParameters(normalized.typeId);
    const subst = new Map<string, IrType>();
    for (let i = 0; i < Math.min(typeParams.length, normalized.typeArgs.length); i++) {
      const tp = typeParams[i];
      const arg = normalized.typeArgs[i];
      if (tp && arg) subst.set(tp.name, arg);
    }

    const substitute = (t: IrType): IrType =>
      subst.size > 0 ? irSubstitute(t, subst as IrSubstitutionMap) : t;

    const parameters = invokeSig.parameters.map((p) => {
      const paramType = substitute(p.type);
      return {
        kind: "parameter" as const,
        pattern: {
          kind: "identifierPattern" as const,
          name: p.name,
          ...(paramType ? { type: paramType } : {}),
        },
        type: paramType,
        initializer: undefined,
        isOptional: p.isOptional,
        isRest: p.isRest,
        passing: p.mode,
      };
    });

    return {
      kind: "functionType",
      parameters,
      returnType: substitute(invokeSig.returnType),
    };
  };

  /**
   * Look up a member on a structural (object) type.
   */
  const lookupStructuralMember = (
    type: IrType,
    memberName: string,
    site?: Site
  ): IrType => {
    if (type.kind === "objectType") {
      const member = type.members.find((m) => m.name === memberName);
      if (member) {
        if (member.kind === "propertySignature") {
          return member.type;
        }
        // Method signature - return function type using the same parameters
        if (member.kind === "methodSignature") {
          const funcType: IrFunctionType = {
            kind: "functionType",
            parameters: member.parameters,
            returnType: member.returnType ?? voidType,
          };
          return funcType;
        }
      }
    }
    if (
      type.kind === "referenceType" &&
      type.structuralMembers &&
      type.structuralMembers.length > 0
    ) {
      const member = type.structuralMembers.find((m) => m.name === memberName);
      if (member) {
        if (member.kind === "propertySignature") {
          return member.type;
        }
        if (member.kind === "methodSignature") {
          const funcType: IrFunctionType = {
            kind: "functionType",
            parameters: member.parameters,
            returnType: member.returnType ?? voidType,
          };
          return funcType;
        }
      }
    }
    emitDiagnostic(
      "TSN5203",
      `Member '${memberName}' not found on structural type`,
      site
    );
    return unknownType;
  };

  /**
   * Compute receiver substitution for a method call.
   *
   * Given a receiver type (e.g., Array<string>) and a declaring type's TS name,
   * computes the substitution map for class type parameters.
   *
   * Phase 6: Uses TypeId-based NominalEnv.getInstantiation().
   */
	  const computeReceiverSubstitution = (
	    receiverType: IrType,
	    declaringTypeTsName: string,
	    _declaringMemberName: string
	  ): TypeSubstitutionMap | undefined => {
	    const normalized = normalizeToNominal(receiverType);
	    if (!normalized) return undefined;

	    const declaringTypeId = resolveTypeIdByName(declaringTypeTsName);
	    if (!declaringTypeId) return undefined;

	    return nominalEnv.getInstantiation(
	      normalized.typeId,
	      normalized.typeArgs,
	      declaringTypeId
	    );
	  };

  // ─────────────────────────────────────────────────────────────────────────
  // typeOfDecl — Get declared type of a declaration
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Derive IrType from NumericKind (deterministic, no TypeScript).
   * Mirrors the logic in literals.ts deriveTypeFromNumericIntent.
   */
	  const deriveTypeFromNumericKind = (kind: NumericKind): IrType => {
	    if (kind === "Int32") return { kind: "referenceType", name: "int" };
	    if (kind === "Int64") return { kind: "referenceType", name: "long" };
	    if (kind === "Double") return { kind: "primitiveType", name: "number" };
	    if (kind === "Single") return { kind: "referenceType", name: "float" };
    if (kind === "Byte") return { kind: "referenceType", name: "byte" };
    if (kind === "Int16") return { kind: "referenceType", name: "short" };
    if (kind === "UInt32") return { kind: "referenceType", name: "uint" };
    if (kind === "UInt64") return { kind: "referenceType", name: "ulong" };
    if (kind === "UInt16") return { kind: "referenceType", name: "ushort" };
    if (kind === "SByte") return { kind: "referenceType", name: "sbyte" };
	    // Default to double for unknown
	    return { kind: "primitiveType", name: "number" };
	  };

  const unwrapParens = (expr: ts.Expression): ts.Expression => {
    let current: ts.Expression = expr;
    while (ts.isParenthesizedExpression(current)) {
      current = current.expression;
    }
    return current;
  };

  const isLambdaExpression = (expr: ts.Expression): boolean => {
    const unwrapped = unwrapParens(expr);
    return ts.isArrowFunction(unwrapped) || ts.isFunctionExpression(unwrapped);
  };

	  const getNumericKindFromIrType = (type: IrType): NumericKind | undefined => {
	    if (type.kind === "primitiveType" && type.name === "number") return "Double";
	    if (type.kind === "primitiveType") {
	      return TSONIC_TO_NUMERIC_KIND.get(type.name);
	    }
	    if (type.kind === "referenceType") {
	      return TSONIC_TO_NUMERIC_KIND.get(type.name);
	    }
	    return undefined;
	  };

	  const stripNullishForInference = (type: IrType): IrType | undefined => {
	    if (isNullishPrimitive(type)) return undefined;
	    if (type.kind !== "unionType") return type;
	    const filtered = type.types.filter((t) => !isNullishPrimitive(t));
	    if (filtered.length === 0) return undefined;
	    if (filtered.length === 1 && filtered[0]) return filtered[0];
	    return { kind: "unionType", types: filtered };
	  };

	  const unwrapAwaitedForInference = (type: IrType): IrType => {
	    if (type.kind === "unionType") {
	      return {
	        kind: "unionType",
	        types: type.types.map((t) => (t ? unwrapAwaitedForInference(t) : t)),
	      };
	    }

	    if (
	      type.kind === "referenceType" &&
	      (type.name === "Promise" || type.name === "PromiseLike")
	    ) {
	      const inner = type.typeArguments?.[0];
	      if (inner) return unwrapAwaitedForInference(inner);
	    }

	    if (type.kind === "referenceType") {
	      const clrName = type.typeId?.clrName;
	      if (
	        clrName === "System.Threading.Tasks.Task" ||
	        clrName === "System.Threading.Tasks.ValueTask"
	      ) {
	        return voidType;
	      }

	      if (
	        clrName?.startsWith("System.Threading.Tasks.Task`") ||
	        clrName?.startsWith("System.Threading.Tasks.ValueTask`")
	      ) {
	        const inner = type.typeArguments?.[0];
	        if (inner) return unwrapAwaitedForInference(inner);
	      }
	    }

	    return type;
	  };

	  /**
	   * Deterministically infer an expression's type using only:
	   * - local lambda parameter environment
	   * - declaration types (typeOfDecl)
   * - numeric literal lexeme rules
   *
   * This is intentionally small: it's used only to type lambda bodies for
   * initializer-driven generic inference (e.g., `Enumerable.select(..., x => x * 2)`).
   */
	  const inferExpressionType = (
	    expr: ts.Expression,
	    env: ReadonlyMap<string, IrType>
	  ): IrType | undefined => {
	    const unwrapped = unwrapParens(expr);

	    if (ts.isAsExpression(unwrapped) || ts.isTypeAssertionExpression(unwrapped)) {
	      return convertTypeNode(unwrapped.type);
	    }

	    if (ts.isNonNullExpression(unwrapped)) {
	      const inner = inferExpressionType(unwrapped.expression, env);
	      if (!inner || inner.kind === "unknownType") return undefined;
	      return stripNullishForInference(inner);
	    }

	    if (ts.isAwaitExpression(unwrapped)) {
	      const inner = inferExpressionType(unwrapped.expression, env);
	      if (!inner || inner.kind === "unknownType") return undefined;
	      return unwrapAwaitedForInference(inner);
	    }

	    if (ts.isCallExpression(unwrapped)) {
	      return tryInferReturnTypeFromCallExpression(unwrapped, env);
	    }

    if (ts.isNewExpression(unwrapped)) {
      const sigId = resolveConstructorSignature(unwrapped);
      if (!sigId) return undefined;

      const explicitTypeArgs =
        unwrapped.typeArguments && unwrapped.typeArguments.length > 0
          ? unwrapped.typeArguments.map((ta) => convertTypeNode(ta))
          : undefined;

      const argumentCount = unwrapped.arguments?.length ?? 0;
      const argTypesWorking: (IrType | undefined)[] = Array(argumentCount).fill(
        undefined
      );

      const args = unwrapped.arguments ?? [];
      for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (!arg) continue;
        if (ts.isSpreadElement(arg)) continue;
        if (isLambdaExpression(arg)) continue;

        const t = inferExpressionType(arg, env);
        if (t && t.kind !== "unknownType") {
          argTypesWorking[i] = t;
        }
      }

      const resolved = resolveCall({
        sigId,
        argumentCount,
        explicitTypeArgs,
        argTypes: argTypesWorking,
      });

      return resolved.returnType.kind === "unknownType"
        ? undefined
        : resolved.returnType;
    }

    if (ts.isPropertyAccessExpression(unwrapped)) {
      const receiverType = inferExpressionType(unwrapped.expression, env);
      if (!receiverType || receiverType.kind === "unknownType") return undefined;
      const memberType = typeOfMember(receiverType, {
        kind: "byName",
        name: unwrapped.name.text,
      });
      return memberType.kind === "unknownType" ? undefined : memberType;
    }

    if (ts.isElementAccessExpression(unwrapped)) {
      const objectType = inferExpressionType(unwrapped.expression, env);
      if (!objectType || objectType.kind === "unknownType") return undefined;

      if (objectType.kind === "arrayType") {
        return objectType.elementType;
      }

      if (objectType.kind === "dictionaryType") {
        return objectType.valueType;
      }

      if (objectType.kind === "primitiveType" && objectType.name === "string") {
        return { kind: "primitiveType", name: "string" };
      }

      if (objectType.kind === "referenceType") {
        return getIndexerInfo(objectType)?.valueType;
      }

      return undefined;
    }

    if (ts.isIdentifier(unwrapped)) {
      const fromEnv = env.get(unwrapped.text);
      if (fromEnv) return fromEnv;
      const declId = resolveIdentifier(unwrapped);
      if (!declId) return undefined;
      const t = typeOfDecl(declId);
      return t.kind === "unknownType" ? undefined : t;
    }

    if (ts.isNumericLiteral(unwrapped)) {
      const numericKind = inferNumericKindFromRaw(unwrapped.getText());
      return deriveTypeFromNumericKind(numericKind);
    }

	    if (ts.isStringLiteral(unwrapped)) {
	      return { kind: "primitiveType", name: "string" };
	    }

	    if (
	      ts.isNoSubstitutionTemplateLiteral(unwrapped) ||
	      ts.isTemplateExpression(unwrapped)
	    ) {
	      return { kind: "primitiveType", name: "string" };
	    }

	    if (
	      unwrapped.kind === ts.SyntaxKind.TrueKeyword ||
	      unwrapped.kind === ts.SyntaxKind.FalseKeyword
	    ) {
      return { kind: "primitiveType", name: "boolean" };
    }

    if (ts.isPrefixUnaryExpression(unwrapped)) {
      if (unwrapped.operator === ts.SyntaxKind.ExclamationToken) {
        return { kind: "primitiveType", name: "boolean" };
      }
      return inferExpressionType(unwrapped.operand, env);
    }

    if (ts.isBinaryExpression(unwrapped)) {
      const op = unwrapped.operatorToken.kind;

      // Comparisons / equality always return boolean.
      if (
        op === ts.SyntaxKind.EqualsEqualsToken ||
        op === ts.SyntaxKind.EqualsEqualsEqualsToken ||
        op === ts.SyntaxKind.ExclamationEqualsToken ||
        op === ts.SyntaxKind.ExclamationEqualsEqualsToken ||
        op === ts.SyntaxKind.LessThanToken ||
        op === ts.SyntaxKind.LessThanEqualsToken ||
        op === ts.SyntaxKind.GreaterThanToken ||
        op === ts.SyntaxKind.GreaterThanEqualsToken
      ) {
        return { kind: "primitiveType", name: "boolean" };
      }

      if (
        op === ts.SyntaxKind.AmpersandAmpersandToken ||
        op === ts.SyntaxKind.BarBarToken
      ) {
        return { kind: "primitiveType", name: "boolean" };
      }

      if (
        op === ts.SyntaxKind.PlusToken ||
        op === ts.SyntaxKind.MinusToken ||
        op === ts.SyntaxKind.AsteriskToken ||
        op === ts.SyntaxKind.SlashToken ||
        op === ts.SyntaxKind.PercentToken
      ) {
        const leftType = inferExpressionType(unwrapped.left, env);
        const rightType = inferExpressionType(unwrapped.right, env);
        if (!leftType || !rightType) return undefined;

        // String concatenation
        if (
          op === ts.SyntaxKind.PlusToken &&
          ((leftType.kind === "primitiveType" && leftType.name === "string") ||
            (rightType.kind === "primitiveType" && rightType.name === "string"))
        ) {
          return { kind: "primitiveType", name: "string" };
        }

        const leftKind = getNumericKindFromIrType(leftType);
        const rightKind = getNumericKindFromIrType(rightType);
        if (!leftKind || !rightKind) return undefined;

        return deriveTypeFromNumericKind(getBinaryResultKind(leftKind, rightKind));
      }
    }

    return undefined;
  };

  const inferLambdaType = (
    expr: ts.Expression,
    expectedType: IrType | undefined
  ): IrFunctionType | undefined => {
    const unwrapped = unwrapParens(expr);
    if (!ts.isArrowFunction(unwrapped) && !ts.isFunctionExpression(unwrapped)) {
      return undefined;
    }

    const expectedFnType =
      expectedType?.kind === "functionType"
        ? expectedType
        : expectedType
          ? delegateToFunctionType(expectedType)
          : undefined;

    const parameters = unwrapped.parameters.map((p, index) => {
      const name = ts.isIdentifier(p.name) ? p.name.text : `arg${index}`;
      const paramType = p.type
        ? convertTypeNode(p.type)
        : expectedFnType?.parameters[index]?.type;

      return {
        kind: "parameter" as const,
        pattern: {
          kind: "identifierPattern" as const,
          name,
        },
        type: paramType,
        initializer: undefined,
        isOptional: !!p.questionToken,
        isRest: !!p.dotDotDotToken,
        passing: "value" as const,
      };
    });

    const env = new Map<string, IrType>();
    for (const p of parameters) {
      if (
        p.pattern.kind === "identifierPattern" &&
        p.pattern.name &&
        p.type
      ) {
        env.set(p.pattern.name, p.type);
      }
    }

    const explicitReturnType =
      "type" in unwrapped && unwrapped.type ? convertTypeNode(unwrapped.type) : undefined;
    const expectedReturnType = expectedFnType?.returnType;

    const inferredReturnType =
      explicitReturnType ??
      (expectedReturnType && !containsTypeParameter(expectedReturnType)
        ? expectedReturnType
        : undefined) ??
      (() => {
        if (ts.isBlock(unwrapped.body)) {
          const returns: ts.Expression[] = [];
          const visit = (n: ts.Node): void => {
            if (ts.isFunctionLike(n) && n !== unwrapped) return;
            if (ts.isReturnStatement(n) && n.expression) {
              returns.push(n.expression);
            }
            n.forEachChild(visit);
          };
          unwrapped.body.forEachChild(visit);

          if (returns.length === 0) return { kind: "voidType" as const };

          const first = inferExpressionType(returns[0]!, env);
          if (!first) return undefined;
          for (let i = 1; i < returns.length; i++) {
            const t = inferExpressionType(returns[i]!, env);
            if (!t || !typesEqual(t, first)) return undefined;
          }
          return first;
        }

        return inferExpressionType(unwrapped.body, env);
      })();

    if (!inferredReturnType) return undefined;

    return {
      kind: "functionType",
      parameters,
      returnType: inferredReturnType,
    };
  };

  /**
   * Try to infer type from a variable declaration's literal initializer.
   *
   * DETERMINISM: Uses the raw lexeme form of the literal, not TS computed types.
   * Only handles simple literal initializers:
   * - Numeric literals → inferred via inferNumericKindFromRaw
   * - String literals → primitiveType("string")
   * - Boolean literals → primitiveType("boolean")
   *
   * Returns undefined if the initializer is not a simple literal.
   */
  const tryInferTypeFromLiteralInitializer = (
    declNode: unknown
  ): IrType | undefined => {
    // TypeScript's VariableDeclaration has an `initializer` property
    const decl = declNode as {
      kind?: number;
      initializer?: {
        kind?: number;
        text?: string;
        getText?: () => string;
      };
    };

    // Must have an initializer
    if (!decl.initializer) return undefined;

	    const init = decl.initializer;

	    if (init.kind === ts.SyntaxKind.NumericLiteral && init.getText) {
	      const raw = init.getText();
	      const numericKind = inferNumericKindFromRaw(raw);
	      return deriveTypeFromNumericKind(numericKind);
	    }

		    if (init.kind === ts.SyntaxKind.StringLiteral) {
		      return { kind: "primitiveType", name: "string" };
		    }

        if (
          init.kind === ts.SyntaxKind.NoSubstitutionTemplateLiteral ||
          init.kind === ts.SyntaxKind.TemplateExpression
        ) {
          return { kind: "primitiveType", name: "string" };
        }

		    if (
		      init.kind === ts.SyntaxKind.TrueKeyword ||
		      init.kind === ts.SyntaxKind.FalseKeyword
		    ) {
	      return { kind: "primitiveType", name: "boolean" };
	    }

    // Not a simple literal - cannot infer
    return undefined;
  };

  /**
   * Try to infer type from a variable declaration's initializer using only
   * deterministic sources (declarations + explicit syntax).
   *
   * Handles:
   * - simple literals (delegates to tryInferTypeFromLiteralInitializer)
   * - call expressions where the callee has an explicit declared return type
   * - new expressions with explicit type arguments (or best-effort nominal type)
   * - identifier initializers (propagate deterministically)
   */
	  const tryInferReturnTypeFromCallExpression = (
	    call: ts.CallExpression,
	    env: ReadonlyMap<string, IrType>
	  ): IrType | undefined => {
	    const sigId = resolveCallSignature(call);
	    if (!sigId) return undefined;

    const explicitTypeArgs =
      call.typeArguments && call.typeArguments.length > 0
        ? call.typeArguments.map((ta) => convertTypeNode(ta))
        : undefined;

	    const receiverType = (() => {
	      if (!ts.isPropertyAccessExpression(call.expression)) return undefined;
	      const receiverExpr = call.expression.expression;
	      const receiver = inferExpressionType(receiverExpr, env);
	      return receiver && receiver.kind !== "unknownType" ? receiver : undefined;
	    })();

    const argumentCount = call.arguments.length;

    // Two-pass: resolve once to get expected parameter types, then infer non-lambda args,
    // then infer lambda arg types (from expected types + body), then final resolve.
    const initialResolved = resolveCall({
      sigId,
      argumentCount,
      receiverType,
      explicitTypeArgs,
    });
    const initialParameterTypes = initialResolved.parameterTypes;

    const argTypesWorking: (IrType | undefined)[] = Array(argumentCount).fill(
      undefined
    );

    for (let index = 0; index < call.arguments.length; index++) {
      const arg = call.arguments[index];
      if (!arg) continue;
      if (ts.isSpreadElement(arg)) continue;
      if (isLambdaExpression(arg)) continue;

      if (ts.isNumericLiteral(arg)) {
        const numericKind = inferNumericKindFromRaw(arg.getText());
        argTypesWorking[index] = deriveTypeFromNumericKind(numericKind);
        continue;
      }

      if (ts.isStringLiteral(arg)) {
        argTypesWorking[index] = { kind: "primitiveType", name: "string" };
        continue;
      }

      if (
        arg.kind === ts.SyntaxKind.TrueKeyword ||
        arg.kind === ts.SyntaxKind.FalseKeyword
      ) {
        argTypesWorking[index] = {
          kind: "primitiveType",
          name: "boolean",
        };
        continue;
      }

      if (ts.isIdentifier(arg)) {
        const argDeclId = resolveIdentifier(arg);
        if (!argDeclId) continue;
        const t = typeOfDecl(argDeclId);
        if (t.kind !== "unknownType") {
          argTypesWorking[index] = t;
        }
        continue;
      }

      if (ts.isCallExpression(arg)) {
        const t = tryInferReturnTypeFromCallExpression(arg, env);
        if (t) {
          argTypesWorking[index] = t;
        }
        continue;
      }

      if (ts.isNewExpression(arg)) {
        const nestedSigId = resolveConstructorSignature(arg);
        if (!nestedSigId) continue;

        const nestedExplicitTypeArgs =
          arg.typeArguments && arg.typeArguments.length > 0
            ? arg.typeArguments.map((ta) => convertTypeNode(ta))
            : undefined;

        const nestedResolved = resolveCall({
          sigId: nestedSigId,
          argumentCount: arg.arguments?.length ?? 0,
          explicitTypeArgs: nestedExplicitTypeArgs,
        });

        if (nestedResolved.returnType.kind !== "unknownType") {
          argTypesWorking[index] = nestedResolved.returnType;
        }
        continue;
      }

      // Fallback: infer from a small deterministic expression set (identifiers, literals,
      // arithmetic, nested member/index access, calls, etc).
      const t = inferExpressionType(arg, env);
      if (t && t.kind !== "unknownType") {
        argTypesWorking[index] = t;
        continue;
      }
    }

    const lambdaContextResolved = resolveCall({
      sigId,
      argumentCount,
      receiverType,
      explicitTypeArgs,
      argTypes: argTypesWorking,
    });

    const parameterTypesForLambdaContext =
      lambdaContextResolved.parameterTypes ?? initialParameterTypes;

    for (let index = 0; index < call.arguments.length; index++) {
      const arg = call.arguments[index];
      if (!arg) continue;
      if (ts.isSpreadElement(arg)) continue;
      if (!isLambdaExpression(arg)) continue;

      const expectedType = parameterTypesForLambdaContext[index];
      const lambdaType = inferLambdaType(arg, expectedType);
      if (lambdaType) {
        argTypesWorking[index] = lambdaType;
      }
    }

    const finalResolved = resolveCall({
      sigId,
      argumentCount,
      receiverType,
      explicitTypeArgs,
      argTypes: argTypesWorking,
    });

    return finalResolved.returnType.kind === "unknownType"
      ? undefined
      : finalResolved.returnType;
  };

	  const tryInferTypeFromInitializer = (declNode: unknown): IrType | undefined => {
	    const literalType = tryInferTypeFromLiteralInitializer(declNode);
	    if (literalType) return literalType;

    if (!declNode || typeof declNode !== "object") return undefined;

    const node = declNode as ts.Node;
	    if (!ts.isVariableDeclaration(node)) return undefined;
		    let init = node.initializer;
		    if (!init) return undefined;

		    while (ts.isParenthesizedExpression(init)) {
		      init = init.expression;
		    }

	    // Explicit type assertions are deterministic sources for variable typing.
	    // This supports patterns like:
	    //   const xs = numbers as unknown as LinqSeq<int>;
	    // where the user intentionally supplies the type at the assertion site.
	    if (ts.isAsExpression(init) || ts.isTypeAssertionExpression(init)) {
	      return convertTypeNode(init.type);
	    }

	    if (ts.isNonNullExpression(init)) {
	      const inner = inferExpressionType(init.expression, new Map());
	      if (!inner || inner.kind === "unknownType") return undefined;
	      return stripNullishForInference(inner);
	    }

	    if (ts.isAwaitExpression(init)) {
	      const inner = inferExpressionType(init.expression, new Map());
	      if (!inner || inner.kind === "unknownType") return undefined;
	      return unwrapAwaitedForInference(inner);
	    }

			    if (ts.isCallExpression(init)) {
			      return tryInferReturnTypeFromCallExpression(init, new Map());
			    }

    if (ts.isArrayLiteralExpression(init)) {
      // Deterministic array literal typing for variable declarations:
      // infer `T[]` only when all element types are deterministically known and equal.
      const elementTypes: IrType[] = [];
      const emptyEnv = new Map<string, IrType>();
      for (const el of init.elements) {
        if (ts.isOmittedExpression(el)) {
          return undefined;
        }
        if (ts.isSpreadElement(el)) {
          return undefined;
        }

        const t = inferExpressionType(el, emptyEnv);
        if (!t || t.kind === "unknownType") {
          return undefined;
        }
        elementTypes.push(t);
      }

      if (elementTypes.length === 0) return undefined;
      const first = elementTypes[0];
      if (first && elementTypes.every((t) => typesEqual(t, first))) {
        return { kind: "arrayType", elementType: first };
      }

      return undefined;
    }

    // Phase 15: NewExpression branch - use constructor signature with argTypes
    if (ts.isNewExpression(init)) {
      const sigId = resolveConstructorSignature(init);
      if (!sigId) return undefined;

      const explicitTypeArgs =
        init.typeArguments && init.typeArguments.length > 0
          ? init.typeArguments.map((ta) => convertTypeNode(ta))
          : undefined;

      // Derive argTypes conservatively from syntax (same pattern as CallExpression)
      const args = init.arguments ?? [];
      const argTypes: (IrType | undefined)[] = args.map((arg) => {
        if (ts.isSpreadElement(arg)) return undefined;

        if (ts.isNumericLiteral(arg)) {
          const numericKind = inferNumericKindFromRaw(arg.getText());
          return deriveTypeFromNumericKind(numericKind);
        }

        if (ts.isStringLiteral(arg)) {
          return { kind: "primitiveType" as const, name: "string" };
        }

        if (
          arg.kind === ts.SyntaxKind.TrueKeyword ||
          arg.kind === ts.SyntaxKind.FalseKeyword
        ) {
          return { kind: "primitiveType" as const, name: "boolean" };
        }

        if (ts.isIdentifier(arg)) {
          const argDeclId = resolveIdentifier(arg);
          if (!argDeclId) return undefined;
          const t = typeOfDecl(argDeclId);
          return t.kind === "unknownType" ? undefined : t;
        }

        // Recursive handling for nested new expressions
        if (ts.isNewExpression(arg)) {
          const nestedSigId = resolveConstructorSignature(arg);
          if (!nestedSigId) return undefined;

          const nestedExplicitTypeArgs =
            arg.typeArguments && arg.typeArguments.length > 0
              ? arg.typeArguments.map((ta) => convertTypeNode(ta))
              : undefined;

          const nestedResolved = resolveCall({
            sigId: nestedSigId,
            argumentCount: arg.arguments?.length ?? 0,
            explicitTypeArgs: nestedExplicitTypeArgs,
          });

          return nestedResolved.returnType.kind === "unknownType"
            ? undefined
            : nestedResolved.returnType;
        }

        return undefined;
      });

      // Resolve constructor call with argTypes for inference
      const resolved = resolveCall({
        sigId,
        argumentCount: args.length,
        explicitTypeArgs,
        argTypes,
      });

      return resolved.returnType.kind === "unknownType"
        ? undefined
        : resolved.returnType;
    }

    if (ts.isIdentifier(init)) {
      const sourceDeclId = resolveIdentifier(init);
      if (!sourceDeclId) return undefined;
      const sourceType = typeOfDecl(sourceDeclId);
      return sourceType.kind === "unknownType" ? undefined : sourceType;
    }

	    // Property access: const output = response.outputStream
	    // DETERMINISTIC: Infer via TypeSystem member lookup on a deterministically typed receiver.
	    if (ts.isPropertyAccessExpression(init)) {
	      const receiverType = inferExpressionType(init.expression, new Map());
	      if (!receiverType || receiverType.kind === "unknownType") return undefined;

	      const memberType = typeOfMember(receiverType, {
	        kind: "byName",
	        name: init.name.text,
	      });

	      return memberType.kind === "unknownType" ? undefined : memberType;
	    }

	    // Element access: const first = items[0]
	    // DETERMINISTIC: Infer element type from a deterministically typed receiver.
	    if (ts.isElementAccessExpression(init)) {
	      const inferred = inferExpressionType(init, new Map());
	      return inferred && inferred.kind !== "unknownType" ? inferred : undefined;
	    }

	    return undefined;
	  };

  const typeOfDecl = (declId: DeclId): IrType => {
    // Check cache first
    const cached = declTypeCache.get(declId.id);
    if (cached) return cached;

    const declInfo = handleRegistry.getDecl(declId);
    if (!declInfo) {
      emitDiagnostic("TSN5203", "Cannot resolve declaration");
      const result = unknownType;
      declTypeCache.set(declId.id, result);
      return result;
    }

    let result: IrType;

    if (declInfo.typeNode) {
      // Explicit type annotation - convert to IR
      result = convertTypeNode(declInfo.typeNode);
    } else if (declInfo.kind === "class" || declInfo.kind === "interface") {
      // Class/interface - return reference type
      result = {
        kind: "referenceType",
        name: declInfo.fqName ?? "unknown",
      } as IrReferenceType;
    } else if (declInfo.kind === "function") {
      // Function without type annotation - need to build function type from signature
      // For now, return unknownType as we need the signature ID
      emitDiagnostic(
        "TSN5201",
        `Function '${declInfo.fqName ?? "unknown"}' requires explicit return type`
      );
      result = unknownType;
    } else if (declInfo.kind === "variable" && declInfo.declNode) {
      // Variable without type annotation - infer from deterministic initializer
      const inferred = tryInferTypeFromInitializer(declInfo.declNode);
      if (inferred) {
        result = inferred;
      } else {
        // Not a simple literal - require explicit type annotation
        emitDiagnostic(
          "TSN5201",
          `Declaration requires explicit type annotation`
        );
        result = unknownType;
      }
    } else {
      // Parameter or other declaration without type annotation
      emitDiagnostic(
        "TSN5201",
        `Declaration requires explicit type annotation`
      );
      result = unknownType;
    }

    declTypeCache.set(declId.id, result);
    return result;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // typeOfMember — Get declared type of a member (with inheritance substitution)
  // ─────────────────────────────────────────────────────────────────────────

  const typeOfMember = (
    receiver: IrType,
    member: MemberRef,
    site?: Site
  ): IrType => {
    const memberName = member.kind === "byName" ? member.name : "unknown"; // MemberId.name not defined yet

    // Common nullish unions (T | undefined | null) should behave like T for member lookup.
    // This preserves deterministic typing for patterns like:
    //   const url = request.url; if (!url) return; url.absolutePath
    const effectiveReceiver =
      receiver.kind === "unionType"
        ? (() => {
            const nonNullish = receiver.types.filter((t) => t && !isNullishPrimitive(t));
            return nonNullish.length === 1 && nonNullish[0] ? nonNullish[0] : receiver;
          })()
        : receiver;

    // 1. Normalize receiver to nominal form
    const normalized = normalizeToNominal(effectiveReceiver);
    if (!normalized) {
      // Handle structural types (objectType)
      if (
        effectiveReceiver.kind === "objectType" ||
        (effectiveReceiver.kind === "referenceType" && effectiveReceiver.structuralMembers)
      ) {
        return lookupStructuralMember(effectiveReceiver, memberName, site);
      }
      emitDiagnostic(
        "TSN5203",
        `Cannot resolve member '${memberName}' on type`,
        site
      );
      return unknownType;
    }

    // 2. Check cache (use clrName as key for compatibility)
    const cacheKey = makeMemberCacheKey(
      normalized.typeId.stableId,
      memberName,
      normalized.typeArgs
    );
    const cached = memberDeclaredTypeCache.get(cacheKey);
    if (cached) return cached;

    // 3. Use NominalEnv to find declaring type + substitution (Phase 6: TypeId-based)
    const lookupResult = nominalEnv.findMemberDeclaringType(
      normalized.typeId,
      normalized.typeArgs,
      memberName
    );

    // 4a. If NominalEnv found the member, get its declared type from Universe
    if (lookupResult) {
      const memberEntry = unifiedCatalog.getMember(
        lookupResult.declaringTypeId,
        memberName
      );

      // Property/field member: return its declared type.
      const memberType = memberEntry?.type;
      if (memberType) {
        const result = irSubstitute(memberType, lookupResult.substitution);
        memberDeclaredTypeCache.set(cacheKey, result);
        return result;
      }

      // Method member: materialize a callable function type from the first signature.
      // Call resolution (resolveCall) uses SignatureId for overload selection; this
      // type is used only to keep member access expressions deterministic.
      const firstSig = memberEntry?.signatures?.[0];
      if (firstSig) {
        const funcType: IrFunctionType = {
          kind: "functionType",
          parameters: firstSig.parameters.map(
            (p): IrParameter => ({
              kind: "parameter",
              pattern: {
                kind: "identifierPattern",
                name: p.name,
              },
              type: p.type,
              initializer: undefined,
              isOptional: p.isOptional,
              isRest: p.isRest,
              passing: p.mode,
            })
          ),
          returnType: firstSig.returnType,
        };

        const result = irSubstitute(funcType, lookupResult.substitution);
        memberDeclaredTypeCache.set(cacheKey, result);
        return result;
      }
    }

    // 5. Member not found anywhere
    emitDiagnostic("TSN5203", `Member '${memberName}' not found`, site);
    return unknownType;
  };

  const parseIndexerKeyClrType = (stableId: string): string | undefined => {
    const memberSep = stableId.indexOf("::");
    if (memberSep < 0) return undefined;

    const bracketStart = stableId.indexOf("[", memberSep);
    if (bracketStart < 0) return undefined;

    let depth = 0;
    let bracketEnd = -1;
    for (let i = bracketStart; i < stableId.length; i++) {
      const ch = stableId[i];
      if (ch === "[") depth++;
      if (ch === "]") {
        depth--;
        if (depth === 0) {
          bracketEnd = i;
          break;
        }
      }
    }
    if (bracketEnd < 0) return undefined;

    const rawParams = stableId.slice(bracketStart + 1, bracketEnd);

    // Split on top-level commas to support nested generic types.
    const splitTopLevel = (value: string): string[] => {
      const parts: string[] = [];
      let start = 0;
      let bracketDepth = 0;
      for (let i = 0; i < value.length; i++) {
        const c = value[i];
        if (c === "[") bracketDepth++;
        else if (c === "]" && bracketDepth > 0) bracketDepth--;
        else if (c === "," && bracketDepth === 0) {
          parts.push(value.slice(start, i).trim());
          start = i + 1;
        }
      }
      parts.push(value.slice(start).trim());
      return parts.filter((p) => p.length > 0);
    };

    const params = splitTopLevel(rawParams);
    if (params.length !== 1) return undefined;

    const first = params[0];
    if (!first) return undefined;

    // Strip assembly qualification (", Assembly, Version=..., ...") if present.
    const withoutAsm = first.includes(",") ? (first.split(",")[0] ?? first) : first;
    return withoutAsm.trim();
  };

  const getIndexerInfo = (
    receiver: IrType,
    _site?: Site
  ): { readonly keyClrType: string; readonly valueType: IrType } | undefined => {
    const normalized = normalizeToNominal(receiver);
    if (!normalized) return undefined;

    // Walk inheritance chain to find the first indexer property.
    const chain = nominalEnv.getInheritanceChain(normalized.typeId);
    for (const typeId of chain) {
      const members = unifiedCatalog.getMembers(typeId);
      const indexers = Array.from(members.values()).filter(
        (m) => m.memberKind === "property" && m.isIndexer
      );

      if (indexers.length === 0) continue;
      if (indexers.length > 1) return undefined;

      const indexer = indexers[0];
      if (!indexer?.type) return undefined;

      const keyClrType = parseIndexerKeyClrType(indexer.stableId);
      if (!keyClrType) return undefined;

      const inst = nominalEnv.getInstantiation(
        normalized.typeId,
        normalized.typeArgs,
        typeId
      );
      const valueType =
        inst && inst.size > 0
          ? irSubstitute(indexer.type, inst as IrSubstitutionMap)
          : indexer.type;

      return { keyClrType, valueType };
    }

    return undefined;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // resolveCall — THE HEART OF DETERMINISM
  // Resolve a call site: returns fully instantiated param/return types + modes
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Deterministically infer method type parameters from argument types.
   *
   * This is intentionally conservative: it only infers when it can unify
   * parameter and argument shapes without ambiguity.
   */
  const inferMethodTypeArgsFromArguments = (
    methodTypeParams: readonly TypeParameterInfo[],
    parameterTypes: readonly (IrType | undefined)[],
    argTypes: readonly (IrType | undefined)[]
  ): Map<string, IrType> | undefined => {
    if (methodTypeParams.length === 0) return new Map();

    const methodTypeParamNames = new Set(methodTypeParams.map((p) => p.name));
    const substitution = new Map<string, IrType>();

    const tryUnify = (parameterType: IrType, argumentType: IrType): boolean => {
      // Method type parameter position: infer directly
      if (parameterType.kind === "typeParameterType") {
        if (!methodTypeParamNames.has(parameterType.name)) {
          // Not a method type parameter (could be outer generic) — ignore
          return true;
        }

        const existing = substitution.get(parameterType.name);
        if (existing) {
          // A self-mapping like `B -> B` can be produced when a lambda argument was typed
          // contextually from the unresolved expected signature. This provides no real
          // inference signal and must not block later concrete inference.
          if (
            existing.kind === "typeParameterType" &&
            existing.name === parameterType.name
          ) {
            substitution.set(parameterType.name, argumentType);
            return true;
          }

          return typesEqual(existing, argumentType);
        }

        substitution.set(parameterType.name, argumentType);
        return true;
      }

      // Poison/any provides no deterministic information
      if (argumentType.kind === "unknownType" || argumentType.kind === "anyType") {
        return true;
      }

      // Expression<TDelegate> wrapper: infer through the underlying delegate shape.
      // This is required for Queryable APIs that use Expression<Func<...>>.
      if (
        parameterType.kind === "referenceType" &&
        parameterType.name === "Expression_1" &&
        (parameterType.typeArguments?.length ?? 0) === 1
      ) {
        const inner = parameterType.typeArguments?.[0];
        return inner ? tryUnify(inner, argumentType) : true;
      }

      // Array<T> ↔ T[] unification
      if (
        parameterType.kind === "referenceType" &&
        parameterType.name === "Array" &&
        (parameterType.typeArguments?.length ?? 0) === 1 &&
        argumentType.kind === "arrayType"
      ) {
        const elementParam = parameterType.typeArguments?.[0];
        return elementParam ? tryUnify(elementParam, argumentType.elementType) : true;
      }

      // Union parameter type: allow deterministic inference through common nullish unions.
      // Example: constructor(value: T | null) with argument of type T.
      if (parameterType.kind === "unionType") {
        const nonNullish = parameterType.types.filter(
          (t) => t && !isNullishPrimitive(t)
        );
        const nullish = parameterType.types.filter(
          (t) => t && isNullishPrimitive(t)
        );

        const candidates = isNullishPrimitive(argumentType) ? nullish : nonNullish;
        if (candidates.length === 1) {
          const only = candidates[0];
          return only ? tryUnify(only, argumentType) : true;
        }

        // Conservative: ambiguous unions provide no deterministic signal.
        return true;
      }

      if (
        parameterType.kind === "arrayType" &&
        argumentType.kind === "referenceType" &&
        argumentType.name === "Array" &&
        (argumentType.typeArguments?.length ?? 0) === 1
      ) {
        const elementArg = argumentType.typeArguments?.[0];
        return elementArg ? tryUnify(parameterType.elementType, elementArg) : true;
      }

      // Same-kind structural unification
      if (parameterType.kind !== argumentType.kind) {
        // Type mismatch provides no deterministic inference signal.
        return true;
      }

      switch (parameterType.kind) {
        case "primitiveType":
          return true;

        case "literalType":
          return true;

        case "referenceType": {
          const argRef = argumentType as IrReferenceType;

          const sameNominal = (() => {
            if (parameterType.typeId && argRef.typeId) {
              return parameterType.typeId.stableId === argRef.typeId.stableId;
            }
            return parameterType.name === argRef.name;
          })();

          // Direct generic unification when the nominals match
          if (sameNominal) {
            const paramArgs = parameterType.typeArguments ?? [];
            const argArgs = argRef.typeArguments ?? [];
            if (paramArgs.length !== argArgs.length) return true;

            for (let i = 0; i < paramArgs.length; i++) {
              const pa = paramArgs[i];
              const aa = argArgs[i];
              if (!pa || !aa) continue;
              if (!tryUnify(pa, aa)) return false;
            }
            return true;
          }

          // Inheritance/interface unification: allow argumentType to flow through
          // its inheritance chain to the parameter type (e.g., List<T> → IEnumerable<T>).
          const paramNominal = normalizeToNominal(parameterType);
          const argNominal = normalizeToNominal(argRef);
          if (paramNominal && argNominal) {
            const inst = nominalEnv.getInstantiation(
              argNominal.typeId,
              argNominal.typeArgs,
              paramNominal.typeId
            );

            if (inst) {
              const targetTypeParams = unifiedCatalog.getTypeParameters(
                paramNominal.typeId
              );
              const instantiatedArgs = targetTypeParams.map((tp) =>
                inst.get(tp.name)
              );

              const paramArgs = parameterType.typeArguments ?? [];
              if (
                instantiatedArgs.every((t) => t !== undefined) &&
                paramArgs.length === instantiatedArgs.length
              ) {
                for (let i = 0; i < paramArgs.length; i++) {
                  const pa = paramArgs[i];
                  const aa = instantiatedArgs[i];
                  if (!pa || !aa) continue;
                  if (!tryUnify(pa, aa)) return false;
                }
              }
            }
          }

          return true;
        }

        case "arrayType":
          return tryUnify(
            parameterType.elementType,
            (argumentType as typeof parameterType).elementType
          );

        case "tupleType": {
          const argTuple = argumentType as typeof parameterType;
          if (parameterType.elementTypes.length !== argTuple.elementTypes.length) {
            return true;
          }
          for (let i = 0; i < parameterType.elementTypes.length; i++) {
            const pe = parameterType.elementTypes[i];
            const ae = argTuple.elementTypes[i];
            if (!pe || !ae) continue;
            if (!tryUnify(pe, ae)) return false;
          }
          return true;
        }

        case "functionType": {
          const argFn = argumentType as typeof parameterType;
          if (parameterType.parameters.length !== argFn.parameters.length) {
            return true;
          }

          for (let i = 0; i < parameterType.parameters.length; i++) {
            const pp = parameterType.parameters[i];
            const ap = argFn.parameters[i];
            const pt = pp?.type;
            const at = ap?.type;
            if (pt && at) {
              if (!tryUnify(pt, at)) return false;
            }
          }

          return tryUnify(parameterType.returnType, argFn.returnType);
        }

        case "intersectionType":
        case "objectType":
        case "dictionaryType":
          // Conservative: only infer through these when shapes already match exactly.
          return true;

        case "voidType":
        case "neverType":
          return true;

        default:
          return true;
      }
    };

    const pairs = Math.min(parameterTypes.length, argTypes.length);
    for (let i = 0; i < pairs; i++) {
      const paramType = parameterTypes[i];
      const argType = argTypes[i];
      if (!paramType || !argType) continue;
      if (!tryUnify(paramType, argType)) return undefined;
    }

    return substitution;
  };

  const containsMethodTypeParameter = (
    type: IrType,
    unresolved: ReadonlySet<string>
  ): boolean => {
    if (type.kind === "typeParameterType") return unresolved.has(type.name);
    if (type.kind === "referenceType") {
      return (type.typeArguments ?? []).some((t) =>
        t ? containsMethodTypeParameter(t, unresolved) : false
      );
    }
    if (type.kind === "arrayType") {
      return containsMethodTypeParameter(type.elementType, unresolved);
    }
    if (type.kind === "tupleType") {
      return type.elementTypes.some((t) =>
        t ? containsMethodTypeParameter(t, unresolved) : false
      );
    }
    if (type.kind === "functionType") {
      const paramsContain = type.parameters.some((p) =>
        p.type ? containsMethodTypeParameter(p.type, unresolved) : false
      );
      return paramsContain || containsMethodTypeParameter(type.returnType, unresolved);
    }
    if (type.kind === "unionType" || type.kind === "intersectionType") {
      return type.types.some((t) =>
        t ? containsMethodTypeParameter(t, unresolved) : false
      );
    }
    if (type.kind === "objectType") {
      return type.members.some((m) => {
        if (m.kind === "propertySignature") {
          return containsMethodTypeParameter(m.type, unresolved);
        }
        if (m.kind === "methodSignature") {
          const paramsContain = m.parameters.some((p) =>
            p.type ? containsMethodTypeParameter(p.type, unresolved) : false
          );
          return (
            paramsContain ||
            (m.returnType
              ? containsMethodTypeParameter(m.returnType, unresolved)
              : false)
          );
        }
        return false;
      });
    }
    return false;
  };

  const normalizeCatalogTsName = (name: string): string => {
    if (name.endsWith("$instance")) return name.slice(0, -"$instance".length);
    if (name.startsWith("__") && name.endsWith("$views")) {
      return name.slice("__".length, -"$views".length);
    }
    return name;
  };

  const isArityCompatible = (
    signature: MethodSignatureEntry,
    argumentCount: number
  ): boolean => {
    const params = signature.parameters;
    if (params.length === 0) return argumentCount === 0;

    // Rest parameter can absorb any extra args.
    const restIndex = params.findIndex((p) => p.isRest);
    if (restIndex >= 0) {
      // Only support `...rest` in the last position.
      if (restIndex !== params.length - 1) return false;

      // Must supply all non-rest parameters.
      if (argumentCount < restIndex) return false;
      return true;
    }

    // Too many args for non-rest signature.
    if (argumentCount > params.length) return false;

    // Missing args must correspond to optional parameters.
    for (let i = argumentCount; i < params.length; i++) {
      const p = params[i];
      if (!p || !p.isOptional) return false;
    }

    return true;
  };

  const scoreSignatureMatch = (
    parameterTypes: readonly (IrType | undefined)[],
    argTypes: readonly (IrType | undefined)[],
    argumentCount: number
  ): number => {
    let score = 0;
    const pairs = Math.min(argumentCount, parameterTypes.length, argTypes.length);
    for (let i = 0; i < pairs; i++) {
      const pt = parameterTypes[i];
      const at = argTypes[i];
      if (!pt || !at) continue;

      if (typesEqual(pt, at)) {
        score += 3;
        continue;
      }

      const pNom = normalizeToNominal(pt);
      const aNom = normalizeToNominal(at);
      if (!pNom || !aNom) continue;

      if (pNom.typeId.stableId === aNom.typeId.stableId) {
        score += 2;
        continue;
      }

      const inst = nominalEnv.getInstantiation(
        aNom.typeId,
        aNom.typeArgs,
        pNom.typeId
      );
      if (inst) score += 1;
    }

    return score;
  };

  const tryResolveCallFromUnifiedCatalog = (
    declaringTypeTsName: string,
    declaringMemberName: string,
    query: CallQuery
  ): ResolvedCall | undefined => {
    const {
      argumentCount,
      receiverType,
      explicitTypeArgs,
      argTypes,
    } = query;

    if (!argTypes) return undefined;
    if (argTypes.length < argumentCount) return undefined;
    for (let i = 0; i < argumentCount; i++) {
      if (!argTypes[i]) return undefined;
    }

    const catalogTypeName = normalizeCatalogTsName(declaringTypeTsName);
    const declaringTypeId = resolveTypeIdByName(catalogTypeName);
    if (!declaringTypeId) return undefined;

    const entry = unifiedCatalog.getByTypeId(declaringTypeId);
    if (!entry || entry.origin !== "assembly") return undefined;

    const member = unifiedCatalog.getMember(declaringTypeId, declaringMemberName);
    const candidates = member?.signatures;
    if (!candidates || candidates.length === 0) return undefined;

    type Candidate = {
      readonly resolved: ResolvedCall;
      readonly score: number;
      readonly typeParamCount: number;
      readonly parameterCount: number;
      readonly stableId: string;
    };

    const resolveCandidate = (
      signature: MethodSignatureEntry
    ): ResolvedCall | undefined => {
      if (!isArityCompatible(signature, argumentCount)) return undefined;

      let workingParams = signature.parameters.map((p) => p.type);
      let workingReturn = signature.returnType;

      // Receiver substitution (class type params) for instance calls.
      if (receiverType) {
        const receiverSubst = computeReceiverSubstitution(
          receiverType,
          catalogTypeName,
          declaringMemberName
        );
        if (receiverSubst && receiverSubst.size > 0) {
          workingParams = workingParams.map((p) => irSubstitute(p, receiverSubst));
          workingReturn = irSubstitute(workingReturn, receiverSubst);
        }
      }

      // Method type parameter substitution.
      const methodTypeParams: TypeParameterInfo[] = signature.typeParameters.map(
        (tp) => ({
          name: tp.name,
          constraint: tp.constraint,
          defaultType: tp.defaultType,
        })
      );

      if (methodTypeParams.length > 0) {
        const callSubst = new Map<string, IrType>();

        if (explicitTypeArgs) {
          for (
            let i = 0;
            i < Math.min(explicitTypeArgs.length, methodTypeParams.length);
            i++
          ) {
            const param = methodTypeParams[i];
            const arg = explicitTypeArgs[i];
            if (param && arg) {
              callSubst.set(param.name, arg);
            }
          }
        }

        const paramsForInference =
          callSubst.size > 0
            ? workingParams.map((p) => irSubstitute(p, callSubst))
            : workingParams;

        const inferred = inferMethodTypeArgsFromArguments(
          methodTypeParams,
          paramsForInference,
          argTypes
        );
        if (!inferred) return undefined;

        for (const [name, inferredType] of inferred) {
          const existing = callSubst.get(name);
          if (existing) {
            if (!typesEqual(existing, inferredType)) return undefined;
            continue;
          }
          callSubst.set(name, inferredType);
        }

        for (const tp of methodTypeParams) {
          if (!callSubst.has(tp.name) && tp.defaultType) {
            callSubst.set(tp.name, tp.defaultType);
          }
        }

        if (callSubst.size > 0) {
          workingParams = workingParams.map((p) => irSubstitute(p, callSubst));
          workingReturn = irSubstitute(workingReturn, callSubst);
        }

        const unresolved = new Set(
          methodTypeParams
            .map((tp) => tp.name)
            .filter((name) => !callSubst.has(name))
        );
        if (
          unresolved.size > 0 &&
          containsMethodTypeParameter(workingReturn, unresolved)
        ) {
          return undefined;
        }
      }

      return {
        parameterTypes: workingParams,
        parameterModes: signature.parameters.map((p) => p.mode),
        returnType: workingReturn,
        typePredicate: undefined,
        diagnostics: [],
      };
    };

    let best: Candidate | undefined;

    for (const sig of candidates) {
      const resolved = resolveCandidate(sig);
      if (!resolved) continue;
      if (resolved.returnType.kind === "unknownType") continue;

      const candidate: Candidate = {
        resolved,
        score: scoreSignatureMatch(resolved.parameterTypes, argTypes, argumentCount),
        typeParamCount: sig.typeParameters.length,
        parameterCount: sig.parameters.length,
        stableId: sig.stableId,
      };

      if (!best) {
        best = candidate;
        continue;
      }

      const better =
        candidate.score > best.score ||
        (candidate.score === best.score &&
          candidate.typeParamCount < best.typeParamCount) ||
        (candidate.score === best.score &&
          candidate.typeParamCount === best.typeParamCount &&
          candidate.parameterCount < best.parameterCount) ||
        (candidate.score === best.score &&
          candidate.typeParamCount === best.typeParamCount &&
          candidate.parameterCount === best.parameterCount &&
          candidate.stableId < best.stableId);

      if (better) best = candidate;
    }

    return best?.resolved;
  };

  const resolveCall = (query: CallQuery): ResolvedCall => {
    const {
      sigId,
      argumentCount,
      receiverType,
      explicitTypeArgs,
      argTypes,
      site,
    } = query;

    // 1. Load raw signature (cached)
    const rawSig = getRawSignature(sigId);
    if (!rawSig) {
      // BINDING CONTRACT VIOLATION (Alice's spec): If Binding returned a
      // SignatureId, HandleRegistry.getSignature(sigId) MUST succeed.
      // This indicates a bug in Binding, not a normal runtime condition.
      //
      // However, we cannot throw during normal compilation as it would
      // crash the compiler. Instead, emit diagnostic and return poisoned
      // result with correct arity.
      emitDiagnostic(
        "TSN5203",
        `Cannot resolve signature (Binding contract violation: ID ${sigId.id} not in HandleRegistry)`,
        site
      );
      return poisonedCall(argumentCount, diagnostics.slice());
    }

    // 2. Start with raw types
    let workingParams = [...rawSig.parameterTypes];
    let workingReturn = rawSig.returnType;
    let workingPredicate = rawSig.typePredicate;

    // 3. Compute receiver substitution (class type params)
    if (
      receiverType &&
      rawSig.declaringTypeTsName &&
      rawSig.declaringMemberName
    ) {
      const receiverSubst = computeReceiverSubstitution(
        receiverType,
        rawSig.declaringTypeTsName,
        rawSig.declaringMemberName
      );
      if (receiverSubst && receiverSubst.size > 0) {
        workingParams = workingParams.map((p) =>
          p ? irSubstitute(p, receiverSubst) : undefined
        );
        workingReturn = irSubstitute(workingReturn, receiverSubst);
        if (workingPredicate) {
          workingPredicate =
            workingPredicate.kind === "param"
              ? {
                  ...workingPredicate,
                  targetType: irSubstitute(
                    workingPredicate.targetType,
                    receiverSubst
                  ),
                }
              : {
                  ...workingPredicate,
                  targetType: irSubstitute(
                    workingPredicate.targetType,
                    receiverSubst
                  ),
                };
        }
      }
    }

    // 4. Compute call substitution (method type params)
    const methodTypeParams = rawSig.typeParameters;
    if (methodTypeParams.length > 0) {
      const callSubst = new Map<string, IrType>();

      // Source 1: Explicit type args from call syntax
      if (explicitTypeArgs) {
        for (
          let i = 0;
          i < Math.min(explicitTypeArgs.length, methodTypeParams.length);
          i++
        ) {
          const param = methodTypeParams[i];
          const arg = explicitTypeArgs[i];
          if (param && arg) {
            callSubst.set(param.name, arg);
          }
        }
      }

      // Source 2: Deterministic argument-driven unification
      if (argTypes && argTypes.length > 0) {
        const paramsForInference =
          callSubst.size > 0
            ? workingParams.map((p) => (p ? irSubstitute(p, callSubst) : undefined))
            : workingParams;

        const inferred = inferMethodTypeArgsFromArguments(
          methodTypeParams,
          paramsForInference,
          argTypes
        );

        if (!inferred) {
          emitDiagnostic(
            "TSN5202",
            "Type arguments cannot be inferred deterministically from arguments",
            site
          );
          return poisonedCall(argumentCount, diagnostics.slice());
        }

        for (const [name, inferredType] of inferred) {
          const existing = callSubst.get(name);
          if (existing) {
            if (!typesEqual(existing, inferredType)) {
              emitDiagnostic(
                "TSN5202",
                `Conflicting type argument inference for '${name}'`,
                site
              );
              return poisonedCall(argumentCount, diagnostics.slice());
            }
            continue;
          }
          callSubst.set(name, inferredType);
        }
      }

      // Source 3: Default type parameters
      for (const tp of methodTypeParams) {
        if (!callSubst.has(tp.name) && tp.defaultType) {
          callSubst.set(tp.name, tp.defaultType);
        }
      }

      // Apply call substitution
      if (callSubst.size > 0) {
        workingParams = workingParams.map((p) =>
          p ? irSubstitute(p, callSubst) : undefined
        );
        workingReturn = irSubstitute(workingReturn, callSubst);
        if (workingPredicate) {
          workingPredicate =
            workingPredicate.kind === "param"
              ? {
                  ...workingPredicate,
                  targetType: irSubstitute(
                    workingPredicate.targetType,
                    callSubst as IrSubstitutionMap
                  ),
                }
              : {
                  ...workingPredicate,
                  targetType: irSubstitute(
                    workingPredicate.targetType,
                    callSubst as IrSubstitutionMap
                  ),
                };
        }
      }

      // Check for unresolved method type parameters (after explicit/arg/default inference)
      const unresolved = new Set(
        methodTypeParams
          .map((tp) => tp.name)
          .filter((name) => !callSubst.has(name))
      );
      if (unresolved.size > 0 && containsMethodTypeParameter(workingReturn, unresolved)) {
        const fallback =
          argTypes && rawSig.declaringTypeTsName && rawSig.declaringMemberName
            ? tryResolveCallFromUnifiedCatalog(
                rawSig.declaringTypeTsName,
                rawSig.declaringMemberName,
                query
              )
            : undefined;

        if (fallback) {
          return fallback;
        }

        emitDiagnostic(
          "TSN5202",
          "Return type contains unresolved type parameters - explicit type arguments required",
          site
        );
        workingReturn = unknownType;
      }
    }

    const resolved: ResolvedCall = {
      parameterTypes: workingParams,
      parameterModes: rawSig.parameterModes,
      returnType: workingReturn,
      typePredicate: workingPredicate,
      diagnostics: [],
    };

    // CLR overload correction (airplane-grade determinism):
    //
    // TypeScript cannot always select the correct overload for CLR APIs because some
    // Tsonic surface types intentionally erase to TS primitives (e.g., `char` is `string`
    // in @tsonic/core for TSC compatibility). This can cause TS to resolve calls like
    // Console.writeLine("Hello") to a `char` overload, which is semantically invalid.
    //
    // When we have full argument types, and the call targets an assembly-origin type,
    // prefer the best matching overload from the UnifiedTypeCatalog if it scores higher
    // than the TS-selected signature.

    if (
      !resolved.typePredicate &&
      argTypes &&
      rawSig.declaringTypeTsName &&
      rawSig.declaringMemberName
    ) {
      const hasAllArgTypes =
        argTypes.length >= argumentCount &&
        Array.from({ length: argumentCount }, (_, i) => argTypes[i]).every(
          (t) => t !== undefined
        );

      if (hasAllArgTypes) {
        const catalogResolved = tryResolveCallFromUnifiedCatalog(
          rawSig.declaringTypeTsName,
          rawSig.declaringMemberName,
          query
        );

        if (catalogResolved) {
          const currentScore = scoreSignatureMatch(
            resolved.parameterTypes,
            argTypes,
            argumentCount
          );
          const catalogScore = scoreSignatureMatch(
            catalogResolved.parameterTypes,
            argTypes,
            argumentCount
          );

          if (catalogScore > currentScore) {
            return catalogResolved;
          }
        }
      }
    }

    return resolved;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // expandUtility — Utility type expansion (Step 8)
  //
  // Implements all 13 utility types with deterministic constraints:
  // - Partial/Required/Readonly: T must be object-like
  // - Pick/Omit: K must be string literal union (finite keys)
  // - ReturnType/Parameters: F must be function type
  // - NonNullable: Works on any type
  // - Exclude/Extract: Works on any types
  // - Awaited: Recursive on Promise<T>, Task<T>, ValueTask<T>
  // - Record: K must be finite literal union (string/number infinite → dictionary)
  // ─────────────────────────────────────────────────────────────────────────

  const expandUtility = (
    name: UtilityTypeName,
    args: readonly IrType[],
    site?: Site
  ): IrType => {
    const firstArg = args[0];
    if (!firstArg) {
      emitDiagnostic(
        "TSN7414",
        `Utility type '${name}' requires a type argument`,
        site
      );
      return unknownType;
    }

    // Check if first arg contains type parameters (cannot expand)
    if (containsTypeParameter(firstArg)) {
      // Return unknownType - cannot expand utility types with type parameters
      return unknownType;
    }

    switch (name) {
      case "NonNullable":
        return expandNonNullableUtility(firstArg);

      case "Partial":
        return expandMappedUtility(firstArg, "optional", site);

      case "Required":
        return expandMappedUtility(firstArg, "required", site);

      case "Readonly":
        return expandMappedUtility(firstArg, "readonly", site);

      case "Pick": {
        const keysArg = args[1];
        if (!keysArg) {
          emitDiagnostic("TSN7414", `Pick requires two type arguments`, site);
          return unknownType;
        }
        return expandPickOmitUtility(firstArg, keysArg, true, site);
      }

      case "Omit": {
        const keysArg = args[1];
        if (!keysArg) {
          emitDiagnostic("TSN7414", `Omit requires two type arguments`, site);
          return unknownType;
        }
        return expandPickOmitUtility(firstArg, keysArg, false, site);
      }

      case "ReturnType":
        return expandReturnTypeUtility(firstArg, site);

      case "Parameters":
        return expandParametersUtility(firstArg, site);

      case "Exclude": {
        const excludeArg = args[1];
        if (!excludeArg) {
          emitDiagnostic(
            "TSN7414",
            `Exclude requires two type arguments`,
            site
          );
          return unknownType;
        }
        return expandExcludeExtractUtility(firstArg, excludeArg, false);
      }

      case "Extract": {
        const extractArg = args[1];
        if (!extractArg) {
          emitDiagnostic(
            "TSN7414",
            `Extract requires two type arguments`,
            site
          );
          return unknownType;
        }
        return expandExcludeExtractUtility(firstArg, extractArg, true);
      }

      case "Awaited":
        return expandAwaitedUtility(firstArg);

      case "Record": {
        const valueArg = args[1];
        if (!valueArg) {
          emitDiagnostic("TSN7414", `Record requires two type arguments`, site);
          return unknownType;
        }
        return expandRecordUtility(firstArg, valueArg, site);
      }

      default:
        emitDiagnostic(
          "TSN7414",
          `Utility type '${name}' is not supported`,
          site
        );
        return unknownType;
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Utility Type Helper Functions
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Expand NonNullable<T>: Filter out null and undefined from union
   */
  const expandNonNullableUtility = (type: IrType): IrType => {
    // Direct null/undefined
    if (isNullishPrimitive(type)) {
      return neverType;
    }

    // Not a union - return as-is
    if (type.kind !== "unionType") {
      return type;
    }

    // Filter out null and undefined from union
    const filtered = type.types.filter((t) => !isNullishPrimitive(t));

    if (filtered.length === 0) {
      return neverType;
    }
    if (filtered.length === 1 && filtered[0]) {
      return filtered[0];
    }
    return { kind: "unionType", types: filtered };
  };

  /**
   * Expand Partial/Required/Readonly<T>: Mapped type transformation
   */
  const expandMappedUtility = (
    type: IrType,
    mode: "optional" | "required" | "readonly",
    site?: Site
  ): IrType => {
    // Must be object-like
    if (type.kind !== "objectType") {
      // For reference types, we need structural members
      if (type.kind === "referenceType") {
        // Try to get structural members from type
        const members = getStructuralMembersForType(type);
        if (members.length === 0) {
          emitDiagnostic(
            "TSN7414",
            `${mode === "optional" ? "Partial" : mode === "required" ? "Required" : "Readonly"} requires a concrete object type`,
            site
          );
          return unknownType;
        }
        // Transform the members
        return {
          kind: "objectType",
          members: transformMembers(members, mode),
        };
      }
      emitDiagnostic(
        "TSN7414",
        `${mode === "optional" ? "Partial" : mode === "required" ? "Required" : "Readonly"} requires an object type`,
        site
      );
      return unknownType;
    }

    return {
      kind: "objectType",
      members: transformMembers(type.members, mode),
    };
  };

  /**
   * Transform members for Partial/Required/Readonly
   */
  const transformMembers = (
    members: readonly IrInterfaceMember[],
    mode: "optional" | "required" | "readonly"
  ): IrInterfaceMember[] => {
    return members.map((m) => {
      if (m.kind === "propertySignature") {
        return {
          ...m,
          isOptional:
            mode === "optional"
              ? true
              : mode === "required"
                ? false
                : m.isOptional,
          isReadonly: mode === "readonly" ? true : m.isReadonly,
        };
      }
      return m;
    });
  };

  /**
   * Get structural members for a reference type
   */
  const getStructuralMembersForType = (
    type: IrReferenceType
  ): readonly IrInterfaceMember[] => {
    if (type.structuralMembers) {
      return type.structuralMembers;
    }
    // Try to look up in registry
    const fqName = typeRegistry.getFQName(type.name);
    const entry = fqName
      ? typeRegistry.resolveNominal(fqName)
      : typeRegistry.resolveBySimpleName(type.name);
    if (!entry) return [];

    // Convert registry members to IR members
    const members: IrInterfaceMember[] = [];
    entry.members.forEach((info, name) => {
      if (info.kind === "property" && info.type) {
        members.push({
          kind: "propertySignature",
          name,
          type: info.type,
          isOptional: info.isOptional,
          isReadonly: info.isReadonly,
        });
      }
    });
    return members;
  };

  /**
   * Expand Pick/Omit<T, K>: Filter members by keys
   */
  const expandPickOmitUtility = (
    type: IrType,
    keysType: IrType,
    isPick: boolean,
    site?: Site
  ): IrType => {
    // Extract literal keys from keysType
    const keys = extractLiteralKeys(keysType);
    if (keys === null) {
      emitDiagnostic(
        "TSN7414",
        `${isPick ? "Pick" : "Omit"} requires literal string keys`,
        site
      );
      return unknownType;
    }

    // Get members from type
    let members: readonly IrInterfaceMember[];
    if (type.kind === "objectType") {
      members = type.members;
    } else if (type.kind === "referenceType") {
      members = getStructuralMembersForType(type);
    } else {
      emitDiagnostic(
        "TSN7414",
        `${isPick ? "Pick" : "Omit"} requires an object type`,
        site
      );
      return unknownType;
    }

    // Filter members
    const filtered = members.filter((m) => {
      const include = isPick ? keys.has(m.name) : !keys.has(m.name);
      return include;
    });

    return { kind: "objectType", members: filtered };
  };

  /**
   * Extract literal keys from a type (string literals or union of string literals)
   */
  const extractLiteralKeys = (type: IrType): Set<string> | null => {
    if (type.kind === "literalType" && typeof type.value === "string") {
      return new Set([type.value]);
    }

    if (type.kind === "unionType") {
      const keys = new Set<string>();
      for (const t of type.types) {
        if (t.kind === "literalType" && typeof t.value === "string") {
          keys.add(t.value);
        } else if (t.kind === "literalType" && typeof t.value === "number") {
          keys.add(String(t.value));
        } else {
          return null; // Non-literal in union
        }
      }
      return keys;
    }

    return null;
  };

  /**
   * Expand ReturnType<F>: Extract return type from function type
   */
  const expandReturnTypeUtility = (type: IrType, site?: Site): IrType => {
    if (type.kind === "functionType") {
      return type.returnType ?? voidType;
    }
    emitDiagnostic(
      "TSN7414",
      `ReturnType requires a function type argument`,
      site
    );
    return unknownType;
  };

  /**
   * Expand Parameters<F>: Extract parameters as tuple from function type
   */
  const expandParametersUtility = (type: IrType, site?: Site): IrType => {
    if (type.kind === "functionType") {
      const elementTypes = type.parameters.map(
        (p) => p.type ?? { kind: "anyType" as const }
      );
      return { kind: "tupleType", elementTypes };
    }
    emitDiagnostic(
      "TSN7414",
      `Parameters requires a function type argument`,
      site
    );
    return unknownType;
  };

  /**
   * Expand Exclude<T, U> or Extract<T, U>
   */
  const expandExcludeExtractUtility = (
    tType: IrType,
    uType: IrType,
    isExtract: boolean
  ): IrType => {
    // If T is not a union, check if it matches U
    if (tType.kind !== "unionType") {
      const matches =
        typesEqual(tType, uType) ||
        (uType.kind === "unionType" &&
          uType.types.some((u) => typesEqual(tType, u)));
      if (isExtract) {
        return matches ? tType : neverType;
      } else {
        return matches ? neverType : tType;
      }
    }

    // T is a union - filter its constituents
    const uTypes = uType.kind === "unionType" ? uType.types : [uType];
    const filtered = tType.types.filter((t) => {
      const matches = uTypes.some((u) => typesEqual(t, u));
      return isExtract ? matches : !matches;
    });

    if (filtered.length === 0) {
      return neverType;
    }
    if (filtered.length === 1 && filtered[0]) {
      return filtered[0];
    }
    return { kind: "unionType", types: filtered };
  };

  /**
   * Expand Awaited<T>: Unwrap Promise / Task / ValueTask types recursively.
   */
  const expandAwaitedUtility = (type: IrType): IrType => {
    if (type.kind === "unionType") {
      return { kind: "unionType", types: type.types.map((t) => expandAwaitedUtility(t)) };
    }

    // Check for Promise<T>
    if (
      type.kind === "referenceType" &&
      (type.name === "Promise" || type.name === "PromiseLike")
    ) {
      const innerType = type.typeArguments?.[0];
      if (innerType) {
        // Recursively unwrap
        return expandAwaitedUtility(innerType);
      }
    }

    // CLR awaitables: Task / ValueTask
    if (type.kind === "referenceType") {
      const clrName = type.typeId?.clrName;

      // Non-generic: await Task / await ValueTask => void
      if (
        clrName === "System.Threading.Tasks.Task" ||
        clrName === "System.Threading.Tasks.ValueTask"
      ) {
        return voidType;
      }

      // Generic: await Task<T> / await ValueTask<T> => T (recursively)
      if (
        clrName?.startsWith("System.Threading.Tasks.Task`") ||
        clrName?.startsWith("System.Threading.Tasks.ValueTask`")
      ) {
        const innerType = type.typeArguments?.[0];
        if (innerType) return expandAwaitedUtility(innerType);
      }
    }

    // Not an awaitable - return as-is
    return type;
  };

  /**
   * Expand Record<K, V>: Create object type from literal keys
   */
  const expandRecordUtility = (
    keyType: IrType,
    valueType: IrType,
    site?: Site
  ): IrType => {
    // Check if K is a finite set of literal keys
    const keys = extractLiteralKeys(keyType);
    if (keys === null) {
      // Non-finite key type - cannot expand to object, use dictionary instead
      // Return unknownType to signal that caller should use dictionaryType
      emitDiagnostic(
        "TSN7414",
        `Record with non-literal keys cannot be expanded to object type`,
        site
      );
      return unknownType;
    }

    // Build object type with a property for each key
    const members: IrPropertySignature[] =
      Array.from(keys).map((key) => ({
        kind: "propertySignature" as const,
        name: key,
        type: valueType,
        isOptional: false,
        isReadonly: false,
      }));

    return { kind: "objectType", members };
  };

  // ─────────────────────────────────────────────────────────────────────────
  // substitute — Delegate to ir-substitution
  // ─────────────────────────────────────────────────────────────────────────

  const substitute = (type: IrType, subst: TypeSubstitutionMap): IrType => {
    // Convert TypeSubstitutionMap to IrSubstitutionMap if needed
    // (they're the same type, just different naming)
    return irSubstitute(type, subst as IrSubstitutionMap);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // instantiate — Instantiate a generic type with type arguments
  // ─────────────────────────────────────────────────────────────────────────

  const instantiate = (
    typeName: string,
    typeArgs: readonly IrType[],
    site?: Site
  ): IrType => {
    // Look up the type in registry
    const fqName = typeRegistry.getFQName(typeName);
    const entry = fqName
      ? typeRegistry.resolveNominal(fqName)
      : typeRegistry.resolveBySimpleName(typeName);

    if (!entry) {
      emitDiagnostic("TSN5203", `Cannot resolve type '${typeName}'`, site);
      return unknownType;
    }

    // Build substitution map from type parameters to arguments
    const subst = new Map<string, IrType>();
    const typeParams = entry.typeParameters;
    for (let i = 0; i < Math.min(typeParams.length, typeArgs.length); i++) {
      const param = typeParams[i];
      const arg = typeArgs[i];
      if (param && arg) {
        subst.set(param.name, arg);
      }
    }

    // Return instantiated reference type
    const result: IrReferenceType = {
      kind: "referenceType",
      name: entry.name,
      typeArguments: typeArgs.length > 0 ? [...typeArgs] : undefined,
    };

    return result;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // isAssignableTo — Conservative subtype check
  // ─────────────────────────────────────────────────────────────────────────

  const isAssignableTo = (source: IrType, target: IrType): boolean => {
    // Same type - always assignable
    if (typesEqual(source, target)) return true;

    // any is assignable to anything, anything is assignable to any
    if (source.kind === "anyType" || target.kind === "anyType") return true;

    // never is assignable to anything
    if (source.kind === "neverType") return true;

    // undefined/null assignability (represented as primitiveType with name "null"/"undefined")
    if (isNullishPrimitive(source)) {
      // Assignable to union containing undefined/null
      if (target.kind === "unionType") {
        return target.types.some(
          (t) => t.kind === "primitiveType" && t.name === source.name
        );
      }
      return false;
    }

    // Primitives - same primitive type
    if (source.kind === "primitiveType" && target.kind === "primitiveType") {
      return source.name === target.name;
    }

    // Union source - all members must be assignable
    if (source.kind === "unionType") {
      return source.types.every((t) => isAssignableTo(t, target));
    }

    // Union target - source must be assignable to at least one member
    if (target.kind === "unionType") {
      return target.types.some((t) => isAssignableTo(source, t));
    }

    // Array types
    if (source.kind === "arrayType" && target.kind === "arrayType") {
      return isAssignableTo(source.elementType, target.elementType);
    }

	    // Reference types - check nominal compatibility via TypeId
	    if (source.kind === "referenceType" && target.kind === "referenceType") {
	      const sourceNominal = normalizeToNominal(source);
	      const targetNominal = normalizeToNominal(target);
	      if (!sourceNominal || !targetNominal) return false;

	      if (sourceNominal.typeId.stableId === targetNominal.typeId.stableId) {
	        const sourceArgs = sourceNominal.typeArgs;
	        const targetArgs = targetNominal.typeArgs;
	        if (sourceArgs.length !== targetArgs.length) return false;
	        return sourceArgs.every((sa, i) => {
	          const ta = targetArgs[i];
	          return ta ? typesEqual(sa, ta) : false;
	        });
	      }

	      const chain = nominalEnv.getInheritanceChain(sourceNominal.typeId);
	      return chain.some((t) => t.stableId === targetNominal.typeId.stableId);
	    }

    // Conservative - return false if unsure
    return false;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // typesEqual — Structural equality check
  // ─────────────────────────────────────────────────────────────────────────

  const typesEqual = (a: IrType, b: IrType): boolean => {
    if (a.kind !== b.kind) return false;

    switch (a.kind) {
      case "primitiveType":
        return b.kind === "primitiveType" && a.name === b.name;

      case "referenceType": {
        if (b.kind !== "referenceType") return false;
        if (a.name !== b.name) return false;
        const aArgs = a.typeArguments ?? [];
        const bArgs = b.typeArguments ?? [];
        if (aArgs.length !== bArgs.length) return false;
        return aArgs.every((arg, i) => {
          const bArg = bArgs[i];
          return bArg ? typesEqual(arg, bArg) : false;
        });
      }

      case "arrayType":
        return (
          b.kind === "arrayType" &&
          typesEqual(a.elementType, (b as typeof a).elementType)
        );

      case "tupleType": {
        if (b.kind !== "tupleType") return false;
        const bTyped = b as typeof a;
        if (a.elementTypes.length !== bTyped.elementTypes.length) return false;
        return a.elementTypes.every((el, i) => {
          const bEl = bTyped.elementTypes[i];
          return bEl ? typesEqual(el, bEl) : false;
        });
      }

      case "unionType":
      case "intersectionType": {
        if (b.kind !== a.kind) return false;
        const bTyped = b as typeof a;
        if (a.types.length !== bTyped.types.length) return false;
        // Order-independent comparison for unions/intersections
        return a.types.every((at) =>
          bTyped.types.some((bt) => typesEqual(at, bt))
        );
      }

      case "functionType": {
        if (b.kind !== "functionType") return false;
        const bTyped = b as typeof a;
        if (a.parameters.length !== bTyped.parameters.length) return false;
        const paramsEqual = a.parameters.every((ap, i) => {
          const bp = bTyped.parameters[i];
          if (!bp) return false;
          if (ap.type && bp.type) return typesEqual(ap.type, bp.type);
          return !ap.type && !bp.type;
        });
        if (!paramsEqual) return false;
        if (a.returnType && bTyped.returnType) {
          return typesEqual(a.returnType, bTyped.returnType);
        }
        return !a.returnType && !bTyped.returnType;
      }

      case "typeParameterType":
        return (
          b.kind === "typeParameterType" && a.name === (b as typeof a).name
        );

      case "literalType":
        return b.kind === "literalType" && a.value === (b as typeof a).value;

      case "voidType":
      case "neverType":
      case "unknownType":
      case "anyType":
        return a.kind === b.kind;

      default:
        // For other types, fall back to JSON comparison
        return JSON.stringify(a) === JSON.stringify(b);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // containsTypeParameter — Check if type contains unresolved type params
  // ─────────────────────────────────────────────────────────────────────────

  const containsTypeParameter = (type: IrType): boolean => {
    if (type.kind === "typeParameterType") return true;
    if (type.kind === "referenceType") {
      return (type.typeArguments ?? []).some(containsTypeParameter);
    }
    if (type.kind === "arrayType") {
      return containsTypeParameter(type.elementType);
    }
    if (type.kind === "functionType") {
      const paramsContain = type.parameters.some(
        (p) => p.type && containsTypeParameter(p.type)
      );
      const returnContains =
        type.returnType && containsTypeParameter(type.returnType);
      return paramsContain || !!returnContains;
    }
    if (type.kind === "unionType" || type.kind === "intersectionType") {
      return type.types.some(containsTypeParameter);
    }
    if (type.kind === "tupleType") {
      return type.elementTypes.some(containsTypeParameter);
    }
    if (type.kind === "objectType") {
      return type.members.some((m) => {
        if (m.kind === "propertySignature") {
          return containsTypeParameter(m.type);
        }
        if (m.kind === "methodSignature") {
          const paramsContain = m.parameters.some(
            (p) => p.type && containsTypeParameter(p.type)
          );
          const returnContains =
            m.returnType && containsTypeParameter(m.returnType);
          return paramsContain || !!returnContains;
        }
        return false;
      });
    }
    return false;
  };

  const getDiagnostics = (): readonly Diagnostic[] => {
    return diagnostics.slice();
  };

  const clearDiagnostics = (): void => {
    diagnostics.length = 0;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // hasTypeParameters — Check if declaration has type parameters
  // ─────────────────────────────────────────────────────────────────────────

  const hasTypeParameters = (declId: DeclId): boolean => {
    const declInfo = handleRegistry.getDecl(declId);
    if (!declInfo?.declNode) return false;

    // Check the declaration node for type parameters
    // We need to import ts to check for type parameter declarations
    // Access the declNode as any to check for typeParameters property
    const declNode = declInfo.declNode as {
      typeParameters?: readonly unknown[];
    };
    return !!(declNode.typeParameters && declNode.typeParameters.length > 0);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // typeOfMemberId — Get type of member by handle
  // ─────────────────────────────────────────────────────────────────────────

  const typeOfMemberId = (memberId: MemberId): IrType => {
    const memberInfo = handleRegistry.getMember(memberId);
    if (!memberInfo) {
      return unknownType;
    }

    // If the member has a type node, convert it
    if (memberInfo.typeNode) {
      return convertTypeNode(memberInfo.typeNode);
    }

    // Otherwise, attempt to recover type deterministically from the member declaration.
    // This is required for namespace imports (`import * as X`) where members are
    // function declarations / const declarations (no typeNode captured by Binding).
    const decl = memberInfo.declNode as ts.Declaration | undefined;
    if (decl) {
      if (ts.isFunctionDeclaration(decl)) {
        // Determinism: require explicit parameter + return annotations.
        if (!decl.type) return unknownType;
        if (decl.parameters.some((p) => p.type === undefined)) return unknownType;

        const parameters: readonly IrParameter[] = decl.parameters.map((p) => ({
          kind: "parameter",
          pattern: {
            kind: "identifierPattern",
            name: ts.isIdentifier(p.name) ? p.name.text : "param",
          },
          type: p.type ? convertTypeNode(p.type) : undefined,
          initializer: undefined,
          isOptional: !!p.questionToken || !!p.initializer,
          isRest: !!p.dotDotDotToken,
          passing: "value",
        }));

        const returnType = convertTypeNode(decl.type);
        const fnType: IrFunctionType = {
          kind: "functionType",
          parameters,
          returnType,
        };
        return fnType;
      }

      if (ts.isVariableDeclaration(decl)) {
        if (decl.type) return convertTypeNode(decl.type);
        const inferred = tryInferTypeFromInitializer(decl);
        return inferred ?? unknownType;
      }
    }

    return unknownType;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // getFQNameOfDecl — Get fully-qualified name of declaration
  // ─────────────────────────────────────────────────────────────────────────

  const getFQNameOfDecl = (declId: DeclId): string | undefined => {
    const declInfo = handleRegistry.getDecl(declId);
    return declInfo?.fqName;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // isTypeDecl — Check if declaration is a type
  // ─────────────────────────────────────────────────────────────────────────

  const isTypeDecl = (declId: DeclId): boolean => {
    const declInfo = handleRegistry.getDecl(declId);
    if (!declInfo) return false;

    const typeKinds: readonly DeclKind[] = [
      "interface",
      "class",
      "typeAlias",
      "enum",
    ];
    return typeKinds.includes(declInfo.kind);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // isInterfaceDecl — Check if declaration is an interface
  // ─────────────────────────────────────────────────────────────────────────

  const isInterfaceDecl = (declId: DeclId): boolean => {
    const declInfo = handleRegistry.getDecl(declId);
    return declInfo?.kind === "interface";
  };

  // ─────────────────────────────────────────────────────────────────────────
  // isTypeAliasToObjectLiteral — Check if type alias points to object literal
  // ─────────────────────────────────────────────────────────────────────────

  const isTypeAliasToObjectLiteral = (declId: DeclId): boolean => {
    const declInfo = handleRegistry.getDecl(declId);
    if (!declInfo || declInfo.kind !== "typeAlias") return false;

    // Check if the typeNode is a type literal node
    // We need to access the declNode to get the type alias declaration
    const declNode = declInfo.declNode as
      | { type?: { kind?: number } }
      | undefined;
    if (!declNode?.type) return false;

	    return declNode.type.kind === ts.SyntaxKind.TypeLiteral;
	  };

  // Suppress unused variable warning for nominalMemberLookupCache
  // Will be used for more advanced caching in future
  void nominalMemberLookupCache;

  // ─────────────────────────────────────────────────────────────────────────
  // signatureHasConditionalReturn — Check for conditional return type
  // ─────────────────────────────────────────────────────────────────────────

	  const signatureHasConditionalReturn = (sigId: SignatureId): boolean => {
    const sigInfo = handleRegistry.getSignature(sigId);
    if (!sigInfo) return false;

    const returnTypeNode = sigInfo.returnTypeNode as
      | { kind?: number }
      | undefined;
    if (!returnTypeNode) return false;

	    return returnTypeNode.kind === ts.SyntaxKind.ConditionalType;
	  };

  // ─────────────────────────────────────────────────────────────────────────
  // signatureHasVariadicTypeParams — Check for variadic type parameters
  // ─────────────────────────────────────────────────────────────────────────

	  const signatureHasVariadicTypeParams = (sigId: SignatureId): boolean => {
    const sigInfo = handleRegistry.getSignature(sigId);
    if (!sigInfo) return false;

    if (!sigInfo.typeParameters) return false;

    for (const typeParam of sigInfo.typeParameters) {
      const constraintNode = typeParam.constraintNode as
        | {
            kind?: number;
            elementType?: { kind?: number; typeName?: { text?: string } };
          }
        | undefined;
      if (!constraintNode) continue;

      // Check if constraint is an array type (variadic pattern: T extends unknown[])
	      if (constraintNode.kind === ts.SyntaxKind.ArrayType) {
	        const elementType = constraintNode.elementType;
	        if (!elementType) continue;

	        // Check for unknown[] or any[] constraint
	        if (
	          elementType.kind === ts.SyntaxKind.UnknownKeyword ||
	          elementType.kind === ts.SyntaxKind.AnyKeyword
	        ) {
	          return true;
	        }

        // Also check for type reference to "unknown" or "any"
        const typeName = elementType.typeName?.text;
        if (typeName === "unknown" || typeName === "any") {
          return true;
        }
      }
    }

    return false;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // declHasTypeAnnotation — Check if declaration has explicit type
  // ─────────────────────────────────────────────────────────────────────────

  const declHasTypeAnnotation = (declId: DeclId): boolean => {
    const declInfo = handleRegistry.getDecl(declId);
    return declInfo?.typeNode !== undefined;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // checkTsClassMemberOverride — Check if member can be overridden
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Check if a class member overrides a base class member.
   *
   * ALICE'S SPEC: Uses captured ClassMemberNames (pure data) from Binding.
   * No TS AST inspection, no SyntaxKind numbers. TS-version safe.
   */
  const checkTsClassMemberOverride = (
    declId: DeclId,
    memberName: string,
    memberKind: "method" | "property"
  ): { isOverride: boolean; isShadow: boolean } => {
    const declInfo = handleRegistry.getDecl(declId);
    const members = declInfo?.classMemberNames;

    // No class member info available
    if (!members) {
      return { isOverride: false, isShadow: false };
    }

    // Check if base class has this member
    const has =
      memberKind === "method"
        ? members.methods.has(memberName)
        : members.properties.has(memberName);

    // In TypeScript, all methods can be overridden (no `final` keyword)
    return has
      ? { isOverride: true, isShadow: false }
      : { isOverride: false, isShadow: false };
  };

  // ─────────────────────────────────────────────────────────────────────────
  // typeFromSyntax — Convert captured type syntax to IrType
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Convert a captured type syntax to IrType.
   *
   * This method takes a TypeSyntaxId handle (opaque to caller) and looks up
   * the captured TypeNode in the HandleRegistry, then converts it.
   *
   * ALICE'S SPEC (Phase 2): TypeSystem receives opaque handles, not ts.TypeNode.
   */
  const typeFromSyntax = (typeSyntaxId: TypeSyntaxId): IrType => {
    const syntaxInfo = handleRegistry.getTypeSyntax(typeSyntaxId);
    if (!syntaxInfo) {
      // Invalid handle - return unknownType
      return { kind: "unknownType" };
    }
    // Phase 5: convertTypeNode accepts unknown, cast is inside type-system/internal
    return convertTypeNode(syntaxInfo.typeNode);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RETURN TYPESYSTEM INSTANCE
  // ─────────────────────────────────────────────────────────────────────────

  return {
    typeFromSyntax,
    typeOfDecl,
    typeOfMember,
    getIndexerInfo,
    typeOfMemberId,
    getFQNameOfDecl,
    isTypeDecl,
    isInterfaceDecl,
    isTypeAliasToObjectLiteral,
    signatureHasConditionalReturn,
    signatureHasVariadicTypeParams,
    declHasTypeAnnotation,
    checkTsClassMemberOverride,
    resolveCall,
    delegateToFunctionType,
    expandUtility,
    substitute,
    instantiate,
    isAssignableTo,
    typesEqual,
    containsTypeParameter,
    hasTypeParameters,
    getDiagnostics,
    clearDiagnostics,
  };
};
