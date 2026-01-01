/**
 * TypeSystem — Alice's 100% Specification
 *
 * The single, authoritative type facility for Tsonic. This is the ONLY place
 * where type information is computed or queried. All converters, validation,
 * and utilities use this interface exclusively.
 *
 * INVARIANTS (enforced by scripts/verify-invariants.sh):
 * - INV-0: No TS computed type APIs outside Binding
 * - INV-1: No convertType/getHandleRegistry outside TypeSystem
 * - INV-2: Deterministic type sources only
 * - INV-3: Poison-on-missing-types (return unknownType + emit diagnostic)
 */

import type {
  IrType,
  IrFunctionType,
  IrReferenceType,
  IrPrimitiveType,
} from "../types/index.js";
import type { Diagnostic, DiagnosticCode } from "../../types/diagnostic.js";
import type {
  DeclId,
  SignatureId,
  MemberId,
  TypeParameterInfo,
  UtilityTypeName,
  ParameterMode,
} from "./types.js";
import {
  substituteIrType as irSubstitute,
  TypeSubstitutionMap as IrSubstitutionMap,
} from "../types/ir-substitution.js";

// ═══════════════════════════════════════════════════════════════════════════
// ALICE'S EXACT API — TypeSystem Interface
// ═══════════════════════════════════════════════════════════════════════════

/**
 * TypeSystem interface — Alice's exact specification.
 *
 * Key method: resolveCall(query) — single entry point for all call resolution.
 */
export interface TypeSystem {
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
   * - Awaited: Recursive on Promise<T>
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
 */
export type CallQuery = {
  /** The signature being called (from Binding.resolveCallSignature) */
  readonly sigId: SignatureId;

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

  /** Diagnostics emitted during resolution */
  readonly diagnostics: readonly Diagnostic[];
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
   * Declaring identity — CRITICAL for inheritance substitution.
   *
   * Without this, resolveCall cannot compute receiver substitution.
   */
  readonly declaringTypeFQName?: string;
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
   */
  readonly convertTypeNode: (node: unknown) => IrType;
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
}

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
   * Declaring type fully-qualified name.
   *
   * CRITICAL: Required for inheritance substitution in resolveCall().
   */
  readonly declaringTypeFQName?: string;

  /**
   * Declaring member name.
   *
   * CRITICAL: Required for inheritance substitution in resolveCall().
   */
  readonly declaringMemberName?: string;
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
 * Currently stores TypeNode (will be pure IR after Step 3).
 */
export type TypeRegistryMemberInfo = {
  readonly kind: "property" | "method" | "indexSignature";
  readonly name: string;
  readonly typeNode?: unknown; // Will become `type: IrType` in Step 3
  readonly isOptional: boolean;
  readonly isReadonly: boolean;
};

/**
 * NominalEnv API — minimal interface needed by TypeSystem.
 */
export interface NominalEnvAPI {
  /** Get inheritance chain for a type (FQ names) */
  getInheritanceChain(fqName: string): readonly string[];

  /** Get substitution for a parent type given child instantiation */
  getInstantiation(
    childFQName: string,
    childTypeArgs: readonly IrType[],
    parentFQName: string
  ): ReadonlyMap<string, IrType> | undefined;

  /** Find the declaring type of a member in the inheritance chain */
  findMemberDeclaringType(
    fqName: string,
    typeArgs: readonly IrType[],
    memberName: string
  ): MemberLookupResult | undefined;
}

/**
 * Result of looking up a member in the inheritance chain.
 */
export type MemberLookupResult = {
  /** FQ name of the type that declares the member */
  readonly targetNominal: string;

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
 * Create a poisoned ResolvedCall with diagnostics.
 */
export const poisonedCall = (diagnostics: readonly Diagnostic[]): ResolvedCall => ({
  parameterTypes: [],
  parameterModes: [],
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
export const createTypeSystem = (config: TypeSystemConfig): TypeSystem => {
  const { handleRegistry, typeRegistry, nominalEnv, convertTypeNode } = config;

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
  const nominalMemberLookupCache = new Map<string, NominalLookupResult | null>();

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
      t.kind === "primitiveType" && (t.name === "null" || t.name === "undefined")
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
  const getRawSignature = (sigId: SignatureId): RawSignatureInfo | undefined => {
    const cached = signatureRawCache.get(sigId.id);
    if (cached) return cached;

    const sigInfo = handleRegistry.getSignature(sigId);
    if (!sigInfo) return undefined;

    // Convert parameter types from TypeNodes to IrTypes
    const parameterTypes: (IrType | undefined)[] = sigInfo.parameters.map((p) =>
      p.typeNode ? convertTypeNode(p.typeNode) : undefined
    );

    // Convert return type
    const returnType: IrType = sigInfo.returnTypeNode
      ? convertTypeNode(sigInfo.returnTypeNode)
      : voidType;

    // Extract parameter modes
    const parameterModes: ParameterMode[] = sigInfo.parameters.map(
      (p) => p.mode ?? "value"
    );

    // Extract parameter names
    const parameterNames: string[] = sigInfo.parameters.map((p) => p.name);

    // Extract type parameters
    const typeParameters: TypeParameterInfo[] = (sigInfo.typeParameters ?? []).map(
      (tp) => ({
        name: tp.name,
        constraint: tp.constraintNode
          ? convertTypeNode(tp.constraintNode)
          : undefined,
        defaultType: tp.defaultNode
          ? convertTypeNode(tp.defaultNode)
          : undefined,
      })
    );

    const rawSig: RawSignatureInfo = {
      parameterTypes,
      returnType,
      parameterModes,
      typeParameters,
      parameterNames,
      declaringTypeFQName: sigInfo.declaringTypeFQName,
      declaringMemberName: sigInfo.declaringMemberName,
    };

    signatureRawCache.set(sigId.id, rawSig);
    return rawSig;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 5: TYPESYSTEM ALGORITHM IMPLEMENTATIONS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Normalize a receiver type to nominal form for member lookup.
   *
   * Handles:
   * - referenceType → { fqName, typeArgs }
   * - arrayType → { fqName: "Array", typeArgs: [elementType] }
   * - primitiveType → { fqName: "String"|"Number"|etc, typeArgs: [] }
   */
  const normalizeToNominal = (
    type: IrType
  ): { fqName: string; typeArgs: readonly IrType[] } | undefined => {
    if (type.kind === "referenceType") {
      const fqName = typeRegistry.getFQName(type.name) ?? type.name;
      return { fqName, typeArgs: type.typeArguments ?? [] };
    }
    if (type.kind === "arrayType") {
      const arrayFqName = typeRegistry.getFQName("Array") ?? "Array";
      return { fqName: arrayFqName, typeArgs: [type.elementType] };
    }
    if (type.kind === "primitiveType") {
      const nominalName = BUILTIN_NOMINALS[type.name];
      if (nominalName) {
        const fqName = typeRegistry.getFQName(nominalName) ?? nominalName;
        return { fqName, typeArgs: [] };
      }
    }
    return undefined;
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
   * Given a receiver type (e.g., Array<string>) and a declaring type,
   * computes the substitution map for class type parameters.
   */
  const computeReceiverSubstitution = (
    receiverType: IrType,
    declaringTypeFQName: string,
    _declaringMemberName: string
  ): TypeSubstitutionMap | undefined => {
    const normalized = normalizeToNominal(receiverType);
    if (!normalized) return undefined;

    return nominalEnv.getInstantiation(
      normalized.fqName,
      normalized.typeArgs,
      declaringTypeFQName
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // typeOfDecl — Get declared type of a declaration
  // ─────────────────────────────────────────────────────────────────────────

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
    } else {
      // Variable/parameter without type annotation
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

    // 1. Normalize receiver to nominal form
    const normalized = normalizeToNominal(receiver);
    if (!normalized) {
      // Handle structural types (objectType)
      if (
        receiver.kind === "objectType" ||
        (receiver.kind === "referenceType" && receiver.structuralMembers)
      ) {
        return lookupStructuralMember(receiver, memberName, site);
      }
      emitDiagnostic(
        "TSN5203",
        `Cannot resolve member '${memberName}' on type`,
        site
      );
      return unknownType;
    }

    // 2. Check cache
    const cacheKey = makeMemberCacheKey(
      normalized.fqName,
      memberName,
      normalized.typeArgs
    );
    const cached = memberDeclaredTypeCache.get(cacheKey);
    if (cached) return cached;

    // 3. Use NominalEnv to find declaring type + substitution
    const lookupResult = nominalEnv.findMemberDeclaringType(
      normalized.fqName,
      normalized.typeArgs,
      memberName
    );
    if (!lookupResult) {
      emitDiagnostic("TSN5203", `Member '${memberName}' not found`, site);
      return unknownType;
    }

    // 4. Get declared member type from TypeRegistry (pure IR after Step 3)
    const memberType = typeRegistry.getMemberType(
      lookupResult.targetNominal,
      memberName
    );
    if (!memberType) {
      emitDiagnostic(
        "TSN5203",
        `Member '${memberName}' has no declared type`,
        site
      );
      return unknownType;
    }

    // 5. Apply substitution
    const result = irSubstitute(memberType, lookupResult.substitution);
    memberDeclaredTypeCache.set(cacheKey, result);
    return result;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // resolveCall — THE HEART OF DETERMINISM
  // Resolve a call site: returns fully instantiated param/return types + modes
  // ─────────────────────────────────────────────────────────────────────────

  const resolveCall = (query: CallQuery): ResolvedCall => {
    const { sigId, receiverType, explicitTypeArgs, site } = query;

    // 1. Load raw signature (cached)
    const rawSig = getRawSignature(sigId);
    if (!rawSig) {
      emitDiagnostic("TSN5203", "Cannot resolve signature", site);
      return poisonedCall(diagnostics.slice());
    }

    // 2. Start with raw types
    let workingParams = [...rawSig.parameterTypes];
    let workingReturn = rawSig.returnType;

    // 3. Compute receiver substitution (class type params)
    if (
      receiverType &&
      rawSig.declaringTypeFQName &&
      rawSig.declaringMemberName
    ) {
      const receiverSubst = computeReceiverSubstitution(
        receiverType,
        rawSig.declaringTypeFQName,
        rawSig.declaringMemberName
      );
      if (receiverSubst && receiverSubst.size > 0) {
        workingParams = workingParams.map((p) =>
          p ? irSubstitute(p, receiverSubst) : undefined
        );
        workingReturn = irSubstitute(workingReturn, receiverSubst);
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

      // Source 2: Argument-driven unification is deferred to Step 8
      // For now, we only handle explicit type args

      // Apply call substitution
      if (callSubst.size > 0) {
        workingParams = workingParams.map((p) =>
          p ? irSubstitute(p, callSubst) : undefined
        );
        workingReturn = irSubstitute(workingReturn, callSubst);
      }

      // Check for unresolved type parameters → TSN5201
      if (containsTypeParameter(workingReturn)) {
        emitDiagnostic(
          "TSN5202",
          "Return type contains unresolved type parameters - explicit type arguments required",
          site
        );
        workingReturn = unknownType;
      }
    }

    return {
      parameterTypes: workingParams,
      parameterModes: rawSig.parameterModes,
      returnType: workingReturn,
      diagnostics: [],
    };
  };

  // ─────────────────────────────────────────────────────────────────────────
  // expandUtility — Utility type expansion (implemented in Step 8)
  // ─────────────────────────────────────────────────────────────────────────

  const expandUtility = (
    _name: UtilityTypeName,
    _args: readonly IrType[],
    _site?: Site
  ): IrType => {
    // Will be implemented in Step 8 - for now delegate to unknownType
    return unknownType;
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

    // Reference types - check by name (nominal compatibility)
    if (source.kind === "referenceType" && target.kind === "referenceType") {
      if (source.name === target.name) {
        // Same type - check type arguments
        const sourceArgs = source.typeArguments ?? [];
        const targetArgs = target.typeArguments ?? [];
        if (sourceArgs.length !== targetArgs.length) return false;
        return sourceArgs.every((sa, i) => {
          const ta = targetArgs[i];
          return ta ? typesEqual(sa, ta) : false;
        });
      }
      // Different names - check inheritance chain
      const sourceFQ = typeRegistry.getFQName(source.name) ?? source.name;
      const chain = nominalEnv.getInheritanceChain(sourceFQ);
      const targetFQ = typeRegistry.getFQName(target.name) ?? target.name;
      return chain.includes(targetFQ);
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
        return b.kind === "typeParameterType" && a.name === (b as typeof a).name;

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

  // Suppress unused variable warning for nominalMemberLookupCache
  // Will be used for more advanced caching in future
  void nominalMemberLookupCache;

  // ─────────────────────────────────────────────────────────────────────────
  // RETURN TYPESYSTEM INSTANCE
  // ─────────────────────────────────────────────────────────────────────────

  return {
    typeOfDecl,
    typeOfMember,
    resolveCall,
    expandUtility,
    substitute,
    instantiate,
    isAssignableTo,
    typesEqual,
    containsTypeParameter,
    getDiagnostics,
    clearDiagnostics,
  };
};
