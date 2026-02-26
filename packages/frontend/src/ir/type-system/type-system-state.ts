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
  IrPrimitiveType,
  IrMethodSignature,
} from "../types/index.js";
import type { Diagnostic, DiagnosticCode } from "../../types/diagnostic.js";
import type {
  DeclId,
  SignatureId,
  MemberId,
  TypeSyntaxId,
  TypeParameterInfo,
  ParameterMode,
} from "./types.js";
import { unknownType, neverType, voidType } from "./types.js";
import { stableIrTypeKey } from "../types/type-ops.js";
import type { AliasTable } from "./internal/universe/alias-table.js";
import type { TypeId, UnifiedTypeCatalog } from "./internal/universe/types.js";

// Re-export constants for convenience
export { unknownType, neverType, voidType };

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

  /** TypeScript `this:` parameter type (if present). Excluded from `parameterTypes`. */
  readonly thisParameterType?: IrType;

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
export type TypeSystemState = {
  // From TypeSystemConfig
  readonly handleRegistry: HandleRegistry;
  readonly typeRegistry: TypeRegistryAPI;
  readonly nominalEnv: NominalEnvAPI;
  readonly convertTypeNodeRaw: (node: unknown) => IrType;
  readonly unifiedCatalog: UnifiedTypeCatalog;
  readonly aliasTable: AliasTable;
  readonly resolveIdentifier: (node: unknown) => DeclId | undefined;
  readonly resolveCallSignature: (node: unknown) => SignatureId | undefined;
  readonly resolveConstructorSignature: (
    node: unknown
  ) => SignatureId | undefined;

  // Mutable caches (shared by reference)
  readonly declTypeCache: Map<number, IrType>;
  readonly memberDeclaredTypeCache: Map<string, IrType>;
  readonly signatureRawCache: Map<number, RawSignatureInfo>;
  readonly nominalMemberLookupCache: Map<string, NominalLookupResult | null>;

  // Diagnostics accumulator (mutable array, shared by reference)
  readonly diagnostics: Diagnostic[];
};

// ═══════════════════════════════════════════════════════════════════════════
// DIAGNOSTIC HELPERS
// ═══════════════════════════════════════════════════════════════════════════

export const emitDiagnostic = (
  state: TypeSystemState,
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

  state.diagnostics.push({
    code,
    severity: "error",
    message,
    location,
  });
};

// ═══════════════════════════════════════════════════════════════════════════
// CACHE KEY HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a cache key for member type lookup.
 */
export const makeMemberCacheKey = (
  fqName: string,
  memberName: string,
  typeArgs?: readonly IrType[]
): string => {
  if (typeArgs && typeArgs.length > 0) {
    return `${fqName}:${memberName}:${typeArgs.map(stableIrTypeKey).join(",")}`;
  }
  return `${fqName}:${memberName}`;
};

/**
 * Create a cache key for nominal lookup.
 */
export const makeNominalLookupKey = (
  fqName: string,
  typeArgs: readonly IrType[],
  memberName: string
): string => {
  return `${fqName}:${typeArgs.map(stableIrTypeKey).join(",")}:${memberName}`;
};

// Helper to check if type is null/undefined primitive
export const isNullishPrimitive = (
  t: IrType
): t is IrPrimitiveType & { name: "null" | "undefined" } => {
  return (
    t.kind === "primitiveType" && (t.name === "null" || t.name === "undefined")
  );
};

export const addUndefinedToType = (type: IrType): IrType => {
  const undefinedType: IrType = { kind: "primitiveType", name: "undefined" };
  if (type.kind === "unionType") {
    const hasUndefined = type.types.some(
      (x) => x.kind === "primitiveType" && x.name === "undefined"
    );
    return hasUndefined
      ? type
      : { ...type, types: [...type.types, undefinedType] };
  }
  return { kind: "unionType", types: [type, undefinedType] };
};

// ═══════════════════════════════════════════════════════════════════════════
// TYPE ID RESOLUTION
// ═══════════════════════════════════════════════════════════════════════════

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
export const resolveTypeIdByName = (
  state: TypeSystemState,
  name: string,
  arity?: number
): TypeId | undefined => {
  const direct =
    state.aliasTable.get(name) ??
    state.unifiedCatalog.resolveTsName(name) ??
    state.unifiedCatalog.resolveClrName(name);

  if (arity === undefined) return direct;

  if (direct) {
    const directArity = state.unifiedCatalog.getTypeParameters(direct).length;
    if (directArity === arity) return direct;
  }

  // Facade name without arity suffix → try tsbindgen's structural encoding.
  if (arity > 0) {
    const suffixed = `${name}_${arity}`;
    const candidate =
      state.aliasTable.get(suffixed) ??
      state.unifiedCatalog.resolveTsName(suffixed) ??
      state.unifiedCatalog.resolveClrName(suffixed);

    if (candidate) {
      const candidateArity =
        state.unifiedCatalog.getTypeParameters(candidate).length;
      if (candidateArity === arity) return candidate;
    }
  }

  return undefined;
};

// ═══════════════════════════════════════════════════════════════════════════
// NORMALIZATION HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Normalize a receiver type to nominal form for member lookup.
 *
 * Phase 6: Returns TypeId + typeArgs for TypeId-based NominalEnv.
 *
 * ALICE'S RULE R3: Primitive-to-nominal bridging is part of TypeSystem.
 */
export const normalizeToNominal = (
  state: TypeSystemState,
  type: IrType
): { typeId: TypeId; typeArgs: readonly IrType[] } | undefined => {
  if (type.kind === "referenceType") {
    const arity = type.typeArguments?.length;
    const typeId =
      type.typeId ??
      (type.resolvedClrType
        ? resolveTypeIdByName(state, type.resolvedClrType, arity)
        : undefined) ??
      resolveTypeIdByName(state, type.name, arity);
    if (!typeId) return undefined;
    return { typeId, typeArgs: type.typeArguments ?? [] };
  }

  if (type.kind === "primitiveType") {
    const typeId = resolveTypeIdByName(state, type.name, 0);
    if (!typeId) return undefined;
    return { typeId, typeArgs: [] };
  }

  if (type.kind === "arrayType") {
    const arrayTypeId = resolveTypeIdByName(state, "Array", 1);
    if (!arrayTypeId) return undefined;
    return { typeId: arrayTypeId, typeArgs: [type.elementType] };
  }

  return undefined;
};

// tsbindgen-generated "sticky extension scope" helpers are TS-only wrappers that
// must erase for deterministic IR typing and call inference.
//
// Example (generated bindings for Tsonic source):
//   import type { ExtensionMethods as __TsonicExt_Ef } from "@tsonic/efcore/Microsoft.EntityFrameworkCore.js";
//   readonly Tenants: __TsonicExt_Ef<...>;
//
// These wrapper types have no CLR identity. For the compiler, the only meaningful
// runtime/CLR shape is the inner type argument.
export const stripTsonicExtensionWrappers = (type: IrType): IrType => {
  if (type.kind === "referenceType") {
    if (
      type.name.startsWith("__TsonicExt_") &&
      (type.typeArguments?.length ?? 0) === 1
    ) {
      const inner = type.typeArguments?.[0];
      return inner ? stripTsonicExtensionWrappers(inner) : type;
    }
  }
  return type;
};

export const stripNullishForInference = (type: IrType): IrType | undefined => {
  if (isNullishPrimitive(type)) return undefined;
  if (type.kind !== "unionType") return type;
  const filtered = type.types.filter((t) => !isNullishPrimitive(t));
  if (filtered.length === 0) return undefined;
  if (filtered.length === 1 && filtered[0]) return filtered[0];
  return { kind: "unionType", types: filtered };
};
