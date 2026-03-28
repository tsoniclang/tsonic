/**
 * TypeAuthority — Interface & Config Definitions
 *
 * Contains the TypeAuthority interface (Alice's exact API) and
 * TypeSystemConfig for factory construction. Split from type-system.ts
 * for file-size compliance.
 *
 * DAG position: pure types — no runtime logic, only type definitions.
 */

import type { IrType, IrFunctionType, IrParameter } from "../types/index.js";
import type { Diagnostic } from "../../types/diagnostic.js";
import type * as ts from "typescript";
import type {
  DeclId,
  SignatureId,
  MemberId,
  TypeSyntaxId,
  UtilityTypeName,
} from "./types.js";
import type { AliasTable } from "./internal/universe/alias-table.js";
import type { UnifiedTypeCatalog } from "./internal/universe/types.js";

import type {
  HandleRegistry,
  TypeRegistryAPI,
  NominalEnvAPI,
  CallQuery,
  ResolvedCall,
  MemberRef,
  Site,
  TypeSubstitutionMap,
} from "./type-system-state.js";

// ═══════════════════════════════════════════════════════════════════════════
// ALICE'S EXACT API — TypeAuthority Interface
// ═══════════════════════════════════════════════════════════════════════════

/**
 * TypeAuthority interface — Alice's exact specification.
 *
 * Key method: resolveCall(query) — single entry point for all call resolution.
 */
export type TypeAuthority = {
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
   * All converters use captureTypeSyntax() + typeFromSyntax().
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

  /**
   * Get the readable value type of a declaration by its handle.
   *
   * This differs from `typeOfDecl` for optional value declarations such as:
   * - `param?: T` parameters
   * - `prop?: T` properties
   *
   * In those cases, reads observe `T | undefined`.
   */
  typeOfValueRead(declId: DeclId): IrType;

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
   * Try to get the declared type of a member without emitting diagnostics.
   *
   * Used by strict feature-detection paths that need to inspect explicit shape
   * without turning absence into a speculative compiler error.
   */
  tryTypeOfMember(receiver: IrType, member: MemberRef): IrType | undefined;

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
   * Expand a contextual expected type into inference candidates.
   *
   * Used by the frontend before full argument conversion so imported aliases,
   * union members, and async wrapper shapes can participate in early
   * contextual call specialization.
   */
  collectExpectedReturnCandidates(type: IrType): readonly IrType[];

  /**
   * Expand a type into concrete narrowing candidates.
   *
   * Used by flow analysis when a nominal alias (for example `Result<T, E>`)
   * expands to an underlying union that must participate in discriminant or
   * property-presence narrowing.
   */
  collectNarrowingCandidates(type: IrType): readonly IrType[];

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
  typeOfMemberId(memberId: MemberId, receiverType?: IrType): IrType;

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
    memberKind: "method" | "property",
    parameters?: readonly IrParameter[],
    baseClassType?: IrType
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
};

// ═══════════════════════════════════════════════════════════════════════════
// TYPESYSTEM FACTORY CONFIG
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Configuration for creating a TypeSystem instance.
 */
export type TypeSystemConfig = {
  readonly sourceRoot: string;
  readonly rootNamespace: string;
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
  readonly resolveShorthandAssignment: (node: unknown) => DeclId | undefined;
  readonly resolveCallSignature: (node: unknown) => SignatureId | undefined;
  readonly resolveConstructorSignature: (
    node: unknown
  ) => SignatureId | undefined;
  readonly checker: ts.TypeChecker;
  readonly tsCompilerOptions: ts.CompilerOptions;
  readonly sourceFilesByPath: ReadonlyMap<string, ts.SourceFile>;
};
