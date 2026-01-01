/**
 * TypeSystem — Unified Type Facility for Tsonic
 *
 * A single, authoritative type facility that every part of the compiler uses
 * (IR build, utility expansion, validation). This replaces scattered type logic
 * and completely eliminates TypeScript computed type APIs.
 *
 * INVARIANT INV-0: No ts.Type, ts.Symbol, or computed type APIs (getTypeAtLocation,
 * getContextualType, etc.) appear in this layer. Types are derived from:
 * 1. ExpectedType — Threaded from syntax position
 * 2. Explicit TypeNodes — Annotations, declared signatures, return types
 * 3. Deterministic rules — Literals, operators, arrays with bounded inference
 * 4. Diagnostic + unknownType — If none above apply
 *
 * The Binding layer (separate module) handles TS symbol resolution and produces
 * opaque handles (DeclId, SignatureId, MemberId) that cross into this layer.
 */

import type { IrType, IrReferenceType } from "../types/index.js";
import type {
  DeclId,
  SignatureId,
  MemberId,
  TypeResult,
  SignatureResult,
  MemberResult,
  PropertyInit,
  SyntaxPosition,
  TypeSubstitution,
  UtilityTypeName,
  ParameterMode,
} from "./types.js";

// Re-export types for consumers
export type {
  DeclId,
  SignatureId,
  MemberId,
  TypeResult,
  SignatureResult,
  MemberResult,
  PropertyInit,
  SyntaxPosition,
  TypeSubstitution,
  UtilityTypeName,
  ParameterType,
  TypeParameterInfo,
  SyntaxNodeKind,
  ParameterMode,
} from "./types.js";

// Re-export factory functions
export {
  makeDeclId,
  makeSignatureId,
  makeMemberId,
  typeOk,
  typeError,
  signatureOk,
  unknownType,
  neverType,
  voidType,
  anyType,
} from "./types.js";

// Re-export Alice's TypeSystem API and supporting types
export type {
  TypeSystem as AliceTypeSystem, // Use prefixed name to avoid conflict during migration
  MemberRef,
  CallQuery,
  ResolvedCall,
  Site,
  TypeSubstitutionMap,
  RawSignatureInfo,
  TypeSystemConfig,
  HandleRegistry as TypeSystemHandleRegistry,
  DeclInfo as TypeSystemDeclInfo,
  TypeRegistryAPI,
  NominalEnvAPI,
  MemberLookupResult,
} from "./type-system.js";

export {
  BUILTIN_NOMINALS,
  poisonedCall,
  unknownType as aliceUnknownType,
  neverType as aliceNeverType,
  voidType as aliceVoidType,
  createTypeSystem,
} from "./type-system.js";

// Note: ParameterMode is also exported below in the legacy interface section

/**
 * TypeSystem interface — the single source of truth for all type queries.
 *
 * All methods return TypeResult or similar, which includes diagnostics.
 * The type field is ALWAYS present (unknownType if undeterminable).
 */
export interface TypeSystem {
  // ═══════════════════════════════════════════════════════════════════════════
  // CORE QUERIES — All return IrType + Diagnostic[]
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get the type of a declaration by its handle.
   *
   * For variables: returns the explicit type annotation or infers from initializer
   * For functions: returns the function type (use getSignature for details)
   * For classes/interfaces: returns the reference type
   */
  getDeclType(decl: DeclId): TypeResult;

  /**
   * Get a function signature (parameters + return type).
   *
   * For overloaded functions, use the SignatureId from Binding.resolveCallSignature
   * to get the specific overload.
   */
  getSignature(sig: SignatureId): SignatureResult;

  /**
   * Get the type of a member (property, method) on a type.
   *
   * Handles inheritance: if the member is inherited, it returns the
   * type with proper substitution applied.
   */
  getMemberType(type: IrType, member: MemberId): TypeResult;

  /**
   * Apply type arguments to a generic type, producing a concrete type.
   *
   * Example: instantiate(Array<T>, [string]) → Array<string>
   */
  instantiate(type: IrType, args: readonly IrType[]): TypeResult;

  /**
   * Get the expected type at a syntactic position.
   *
   * This is used for contextual typing without calling TS's getContextualType.
   * Works by walking up the AST to find the type provider.
   */
  getExpectedType(position: SyntaxPosition): TypeResult;

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITY TYPE EXPANSION — Deterministic algorithms
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Expand a utility type (Partial, Pick, ReturnType, etc.).
   *
   * Returns the expanded type or unknownType with diagnostic if expansion
   * is not possible (e.g., type parameter argument).
   *
   * @param utilityName The utility type name (Partial, Pick, etc.)
   * @param typeArgs The type arguments to the utility
   * @param sourceTypeArgs The source TypeNode arguments (for AST-based expansion)
   */
  expandUtilityType(
    utilityName: UtilityTypeName,
    typeArgs: readonly IrType[],
    sourceTypeArgs?: unknown // ts.TypeNode[] but hidden from interface
  ): TypeResult;

  // ═══════════════════════════════════════════════════════════════════════════
  // STRUCTURAL OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get all members of a structural type (including inherited).
   *
   * For reference types, resolves the declaration and walks the
   * inheritance chain, applying substitutions.
   */
  getStructuralMembers(type: IrType): readonly MemberResult[];

  /**
   * Resolve property access on a type.
   *
   * Handles arrays (length, [index]), objects, classes, interfaces.
   */
  resolvePropertyAccess(type: IrType, propertyName: string): TypeResult;

  /**
   * Synthesize an object type from property values.
   *
   * Used for anonymous object literal typing when no contextual type is available.
   */
  synthesizeObjectType(properties: readonly PropertyInit[]): TypeResult;

  // ═══════════════════════════════════════════════════════════════════════════
  // SUBSTITUTION & INHERITANCE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Substitute type parameters with concrete types.
   *
   * Pure IR-to-IR transformation. Does not use TS APIs.
   */
  substitute(type: IrType, substitutions: TypeSubstitution): IrType;

  /**
   * Get the inheritance chain for a nominal type.
   *
   * Returns the type and all its base types in order.
   */
  getInheritanceChain(type: IrReferenceType): readonly IrType[];

  // ═══════════════════════════════════════════════════════════════════════════
  // TYPE COMPARISON
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Check if two types are structurally equal.
   */
  typesEqual(a: IrType, b: IrType): boolean;

  /**
   * Check if a type is assignable to another (subtype check).
   */
  isAssignableTo(source: IrType, target: IrType): boolean;
}

/**
 * Dependencies required to create a TypeSystem instance.
 *
 * These are passed to createTypeSystem() and encapsulate all
 * external dependencies.
 */
export interface TypeSystemDeps {
  /**
   * TypeRegistry for looking up declaration TypeNodes.
   * TypeRegistry is TS-free — it stores TypeNodes, not ts.Type.
   */
  readonly registry: unknown; // TypeRegistry

  /**
   * NominalEnv for inheritance chain resolution.
   * NominalEnv uses TypeRegistry, not TS computed types.
   */
  readonly nominalEnv: unknown; // NominalEnv

  /**
   * Handle registry mapping DeclId → declaration info.
   * This is created by the Binding layer.
   */
  readonly handleRegistry: HandleRegistry;

  /**
   * Type converter for converting TypeNodes to IrType.
   * This is a pure function that doesn't use TS computed types.
   */
  readonly convertTypeNode: (node: unknown) => IrType;
}

/**
 * Handle registry — maps opaque handles to their underlying data.
 *
 * This is created and managed by the Binding layer.
 * TypeSystem uses it to look up declaration information.
 */
export interface HandleRegistry {
  /**
   * Get declaration info for a DeclId.
   */
  getDecl(id: DeclId): DeclInfo | undefined;

  /**
   * Get signature info for a SignatureId.
   */
  getSignature(id: SignatureId): SignatureInfo | undefined;

  /**
   * Get member info for a MemberId.
   */
  getMember(id: MemberId): MemberInfo | undefined;
}

/**
 * Declaration info stored in the handle registry.
 */
export interface DeclInfo {
  /**
   * The TypeNode for the declaration's type (if explicitly annotated).
   */
  readonly typeNode?: unknown; // ts.TypeNode

  /**
   * The declaration kind.
   */
  readonly kind: DeclKind;

  /**
   * Fully-qualified name for resolution.
   */
  readonly fqName?: string;

  /**
   * The declaration AST node (for AST traversal in type-converter).
   * Used for extracting structural members from interface/type alias declarations.
   */
  readonly declNode?: unknown; // ts.Declaration
}

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
 * Signature info stored in the handle registry.
 *
 * IMPORTANT (Alice's spec): Must include declaring identity for resolveCall().
 * Without declaringTypeFQName + declaringMemberName, resolveCall() cannot
 * compute inheritance substitution — it would have to "guess" the method name
 * from the signature, which breaks on overloads, aliases, and non-property-access calls.
 */
export interface SignatureInfo {
  /**
   * Parameter TypeNodes.
   */
  readonly parameters: readonly ParameterNode[];

  /**
   * Return type TypeNode.
   */
  readonly returnTypeNode?: unknown; // ts.TypeNode

  /**
   * Type parameters.
   */
  readonly typeParameters?: readonly TypeParameterNode[];

  /**
   * Declaring type fully-qualified name.
   *
   * CRITICAL for Alice's spec: Required for receiver substitution
   * in resolveCall(). Set when the signature belongs to a class/interface method.
   */
  readonly declaringTypeFQName?: string;

  /**
   * Declaring member name.
   *
   * CRITICAL for Alice's spec: Required together with declaringTypeFQName
   * for inheritance substitution in resolveCall().
   */
  readonly declaringMemberName?: string;

  /**
   * Type predicate information for `x is T` return types.
   *
   * Extracted at registration time via pure syntax inspection.
   * TypeSystem can later convert targetTypeNode to IrType.
   */
  readonly typePredicate?: SignatureTypePredicate;
}

/**
 * Type predicate extracted from signature's return type.
 *
 * For functions with `param is T` or `this is T` return types.
 * Stored with the raw TypeNode; TypeSystem converts to IrType when needed.
 */
export type SignatureTypePredicate =
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

export interface ParameterNode {
  readonly name: string;
  readonly typeNode?: unknown; // ts.TypeNode
  readonly isOptional: boolean;
  readonly isRest: boolean;
  /** Parameter passing mode for C# interop (default: "value") */
  readonly mode?: ParameterMode;
}

// ParameterMode is exported from types.ts

export interface TypeParameterNode {
  readonly name: string;
  readonly constraintNode?: unknown; // ts.TypeNode
  readonly defaultNode?: unknown; // ts.TypeNode
}

/**
 * Member info stored in the handle registry.
 */
export interface MemberInfo {
  readonly name: string;
  readonly typeNode?: unknown; // ts.TypeNode
  readonly isOptional: boolean;
  readonly isReadonly: boolean;
}
