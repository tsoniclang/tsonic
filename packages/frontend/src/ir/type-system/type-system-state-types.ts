/**
 * TypeSystem Shared Types, State, and Leaf Helpers
 *
 * This is the leaf module in the type-system DAG. It contains:
 * - All shared type/interface definitions used by split modules
 * - TypeSystemState type (the DI container for all type-system functions)
 * - Pure helper functions that have no cross-module dependencies
 *
 * DAG position: LEAF (no imports from other type-system-* split modules)
 */

import type {
  IrType,
  IrMethodSignature,
} from "../types/index.js";
import type { Diagnostic } from "../../types/diagnostic.js";
import type {
  DeclId,
  SignatureId,
  MemberId,
  TypeSyntaxId,
  TypeParameterInfo,
  ParameterMode,
} from "./types.js";
import type { TypeId } from "./internal/universe/types.js";
import { unknownType } from "./types.js";

// ═══════════════════════════════════════════════════════════════════════════
// SHARED TYPES — Used by split modules and orchestrator
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

  /**
   * Contextual expected return type from call site usage.
   *
   * Used for deterministic generic inference when method type parameters only
   * appear in the return position (e.g., `ok<T>(value: T): Ok<T>` in
   * `return ok({...})` where function return type is `Result<Payload, string>`).
   */
  readonly expectedReturnType?: IrType;

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

  /** Declared/public parameter surface types before call-site argument refinement. */
  readonly surfaceParameterTypes: readonly (IrType | undefined)[];

  /** Explicit rest-parameter metadata from the selected signature. */
  readonly restParameter?: {
    readonly index: number;
    readonly arrayType: IrType | undefined;
    readonly elementType: IrType | undefined;
  };

  /** Declared/public rest-parameter metadata before call-site argument refinement. */
  readonly surfaceRestParameter?: {
    readonly index: number;
    readonly arrayType: IrType | undefined;
    readonly elementType: IrType | undefined;
  };

  /** Parameter passing modes (value, ref, out, in) */
  readonly parameterModes: readonly ParameterMode[];

  /** Fully instantiated return type */
  readonly returnType: IrType;

  /**
   * True when the selected signature had an explicit return type declaration.
   * This is used to distinguish deliberate `unknown` returns from poisoned
   * fallback caused by missing annotations.
   */
  readonly hasDeclaredReturnType: boolean;

  /**
   * Type predicate info for narrowing (x is T).
   * Only present if the function has a type predicate return type.
   */
  readonly typePredicate?: TypePredicateResult;

  /** Internal deterministic selection metadata for overload correction/tie-breaking. */
  readonly selectionMeta?: {
    readonly hasRestParameter: boolean;
    readonly typeParamCount: number;
    readonly parameterCount: number;
    readonly stableId: string;
  };

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

  /** Parameter shape metadata needed for arity/rest inference. */
  readonly parameterFlags: readonly {
    readonly isRest: boolean;
    readonly isOptional: boolean;
  }[];

  /** TypeScript `this:` parameter type (if present). Excluded from `parameterTypes`. */
  readonly thisParameterType?: IrType;

  /** Return type (voidType if not specified) */
  readonly returnType: IrType;

  /** Whether the source signature declared a return type explicitly. */
  readonly hasDeclaredReturnType: boolean;

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
  readonly declaringTypeParameterNames?: readonly string[];
  readonly declaringMemberName?: string;
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
export type HandleRegistry = {
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
};

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
  readonly typeParameters: readonly string[];
  readonly methods: ReadonlySet<string>;
  readonly properties: ReadonlySet<string>;
  readonly methodSignatures: ReadonlyMap<
    string,
    readonly CapturedClassMethodSignature[]
  >;
  readonly propertyTypeNodes: ReadonlyMap<string, unknown | undefined>;
};

export type CapturedClassMethodSignature = {
  readonly parameters: readonly CapturedClassMethodParameter[];
};

export type CapturedClassMethodParameter = {
  readonly typeNode?: unknown;
  readonly isRest: boolean;
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

  /** Type declaration AST node when a symbol merges type and value declarations. */
  readonly typeDeclNode?: unknown;

  /** Value declaration AST node when a symbol merges type and value declarations. */
  readonly valueDeclNode?: unknown;

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

  /** Type node of a TypeScript `this:` parameter (if present). Excluded from `parameters`. */
  readonly thisTypeNode?: unknown;

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
  readonly declaringTypeParameterNames?: readonly string[];

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
export type TypeRegistryAPI = {
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
};

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
export type NominalEnvAPI = {
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
};

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

/**
 * Create a poisoned ResolvedCall with correct arity.
 *
 * CRITICAL (Alice's spec): Empty arrays are ILLEGAL.
 * Poisoned results must have correct arity so callers cannot
 * detect failure via `length === 0`.
 *
 * @param arity Number of parameters/arguments (from CallQuery.argumentCount)
 * @param diagnostics Diagnostics explaining why resolution failed
 */
export const poisonedCall = (
  arity: number,
  diagnostics: readonly Diagnostic[]
): ResolvedCall => ({
  surfaceParameterTypes: Array(arity).fill(unknownType),
  parameterTypes: Array(arity).fill(unknownType),
  parameterModes: Array(arity).fill("value" as const),
  returnType: unknownType,
  hasDeclaredReturnType: false,
  diagnostics,
});

/**
 * Nominal lookup result cached for member lookups.
 */
export type NominalLookupResult = {
  readonly targetNominal: string;
  readonly memberType: IrType;
  readonly substitution: ReadonlyMap<string, IrType>;
};

// ═══════════════════════════════════════════════════════════════════════════
// TYPESYSTEM STATE — DI container for all split functions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * TypeSystemState — shared state for all type-system functions.
 *
 * This replaces the closure-based shared state from the monolithic
 * createTypeSystem() function. Maps are reference types; all functions
 * sharing the same TypeSystemState see the same cache. No cloning.
 */
