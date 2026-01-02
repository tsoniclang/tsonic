/**
 * TypeAuthority — Single Source of Truth for All Type Queries
 *
 * ALICE'S SPEC (Phase 5): This is the ONLY public API for type operations.
 * The public module is structurally incapable of supporting a parallel type system.
 *
 * INVARIANT: No ts.Type, ts.Symbol, or computed type APIs appear in this layer.
 * INVARIANT: No raw structures (TypeNodes, declarations, registries) are exported.
 * INVARIANT: All type information flows through semantic methods only.
 *
 * The Binding layer handles TS symbol resolution and produces opaque handles
 * (DeclId, SignatureId, MemberId, TypeSyntaxId) that cross into this layer.
 */

import type { IrType, IrReferenceType } from "../types/index.js";
import type {
  DeclId,
  SignatureId,
  MemberId,
  TypeSyntaxId,
  TypeResult,
  SignatureResult,
  MemberResult,
  PropertyInit,
  SyntaxPosition,
  TypeSubstitution,
  UtilityTypeName,
  ParameterMode,
} from "./types.js";

// ═══════════════════════════════════════════════════════════════════════════════
// OPAQUE HANDLE TYPES — These are the ONLY handle types exported publicly
// ═══════════════════════════════════════════════════════════════════════════════

export type { DeclId, SignatureId, MemberId, TypeSyntaxId };

// ALICE'S SPEC (B.1): All nominal types resolved by TypeId, not string name matching
export type { TypeId } from "./internal/universe/types.js";

// ═══════════════════════════════════════════════════════════════════════════════
// SEMANTIC RESULT TYPES — No syntax, no diagnostics arrays, no raw data
// ═══════════════════════════════════════════════════════════════════════════════

export type {
  TypeResult,
  SignatureResult,
  MemberResult,
  PropertyInit,
  SyntaxPosition,
  TypeSubstitution,
  UtilityTypeName,
  ParameterMode,
};

// Re-export semantic result types from Alice's TypeSystem
export type {
  MemberRef,
  CallQuery,
  ResolvedCall,
  Site,
} from "./type-system.js";

// ═══════════════════════════════════════════════════════════════════════════════
// FACTORY FUNCTIONS — For handle creation and result construction
// ═══════════════════════════════════════════════════════════════════════════════

export {
  makeDeclId,
  makeSignatureId,
  makeMemberId,
  makeTypeSyntaxId,
  typeOk,
  typeError,
  signatureOk,
  unknownType,
  neverType,
  voidType,
  anyType,
} from "./types.js";

export {
  BUILTIN_NOMINALS,
  poisonedCall,
  createTypeSystem,
} from "./type-system.js";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE AUTHORITY INTERFACE — The single source of truth for all type queries
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * TypeAuthority — the single source of truth for all type queries.
 *
 * ALICE'S SPEC: TypeAuthority returns semantic answers only.
 * No raw data structures. No escape hatches. Callers cannot rebuild
 * a parallel type system.
 *
 * All methods return semantic results (IrType, boolean, ResolvedCall).
 * The type field is ALWAYS present (unknownType if undeterminable).
 */
export interface TypeAuthority {
  // ───────────────────────────────────────────────────────────────────────────
  // CORE QUERIES — All return IrType
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Get the type of a declaration by its handle.
   */
  getDeclType(decl: DeclId): TypeResult;

  /**
   * Get a function signature (parameters + return type).
   */
  getSignature(sig: SignatureId): SignatureResult;

  /**
   * Get the type of a member (property, method) on a type.
   */
  getMemberType(type: IrType, member: MemberId): TypeResult;

  /**
   * Apply type arguments to a generic type.
   */
  instantiate(type: IrType, args: readonly IrType[]): TypeResult;

  /**
   * Get the expected type at a syntactic position.
   */
  getExpectedType(position: SyntaxPosition): TypeResult;

  // ───────────────────────────────────────────────────────────────────────────
  // UTILITY TYPE EXPANSION
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Expand a utility type (Partial, Pick, ReturnType, etc.).
   */
  expandUtilityType(
    utilityName: UtilityTypeName,
    typeArgs: readonly IrType[]
  ): TypeResult;

  // ───────────────────────────────────────────────────────────────────────────
  // STRUCTURAL OPERATIONS
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Get all members of a structural type (including inherited).
   */
  getStructuralMembers(type: IrType): readonly MemberResult[];

  /**
   * Resolve property access on a type.
   */
  resolvePropertyAccess(type: IrType, propertyName: string): TypeResult;

  /**
   * Synthesize an object type from property values.
   */
  synthesizeObjectType(properties: readonly PropertyInit[]): TypeResult;

  // ───────────────────────────────────────────────────────────────────────────
  // SUBSTITUTION & INHERITANCE
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Substitute type parameters with concrete types.
   */
  substitute(type: IrType, substitutions: TypeSubstitution): IrType;

  /**
   * Get the inheritance chain for a nominal type.
   */
  getInheritanceChain(type: IrReferenceType): readonly IrType[];

  // ───────────────────────────────────────────────────────────────────────────
  // TYPE COMPARISON
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Check if two types are structurally equal.
   */
  typesEqual(a: IrType, b: IrType): boolean;

  /**
   * Check if a type is assignable to another.
   */
  isAssignableTo(source: IrType, target: IrType): boolean;
}

// Re-export the legacy TypeSystem name for backwards compatibility during migration
// TODO: Remove after all callers migrate to TypeAuthority
export type { TypeSystem } from "./type-system.js";

// ═══════════════════════════════════════════════════════════════════════════════
// INTERNAL TYPES — NOT EXPORTED
// ═══════════════════════════════════════════════════════════════════════════════
//
// The following types are INTERNAL ONLY and must NOT be exported:
// - TypeSystemDeps
// - HandleRegistry
// - DeclInfo, SignatureInfo, MemberInfo, TypeSyntaxInfo
// - ParameterNode, TypeParameterNode
// - SignatureTypePredicate
// - DeclKind
// - TypeSystemConfig
// - TypeRegistryAPI, NominalEnvAPI
// - RawSignatureInfo
// - TypeSubstitutionMap (internal)
// - MemberLookupResult (internal)
//
// These are defined in type-system/internal/* and imported only by:
// - type-system implementation
// - binding implementation
//
// ALICE'S SPEC: The public module is structurally incapable of supporting
// a parallel type system. No raw structures. No escape hatches.
// ═══════════════════════════════════════════════════════════════════════════════
