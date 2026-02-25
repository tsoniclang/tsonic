/**
 * Binding Layer — Type Definitions
 *
 * Public and internal type definitions for the Binding layer.
 * Contains Binding/BindingInternal interfaces and internal entry types
 * used by the factory and handle registry.
 */

import ts from "typescript";
import type {
  DeclId,
  SignatureId,
  MemberId,
  TypeSyntaxId,
} from "../type-system/types.js";
import type {
  DeclKind,
  ParameterNode,
  TypeParameterNode,
  SignatureTypePredicate,
  ClassMemberNames,
} from "../type-system/internal/handle-types.js";

// ═══════════════════════════════════════════════════════════════════════════
// BINDING INTERFACE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Binding interface — wraps TS symbol resolution APIs.
 *
 * All methods return opaque handles. Use HandleRegistry to look up
 * the underlying declaration/signature information.
 */
export type Binding = {
  // ═══════════════════════════════════════════════════════════════════════════
  // DECLARATION RESOLUTION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Resolve an identifier to its declaration.
   * Uses checker.getSymbolAtLocation + symbol.getDeclarations().
   */
  resolveIdentifier(node: ts.Identifier): DeclId | undefined;

  /**
   * Resolve a type reference to its declaration.
   * For qualified names (A.B.C), resolves the rightmost symbol.
   */
  resolveTypeReference(node: ts.TypeReferenceNode): DeclId | undefined;

  /**
   * Resolve a property access to its member declaration.
   */
  resolvePropertyAccess(
    node: ts.PropertyAccessExpression
  ): MemberId | undefined;

  /**
   * Resolve an element access to its member (for known keys).
   */
  resolveElementAccess(node: ts.ElementAccessExpression): MemberId | undefined;

  // ═══════════════════════════════════════════════════════════════════════════
  // CALL RESOLUTION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Pick the correct overload for a call expression.
   * Uses checker.getResolvedSignature to pick the overload.
   */
  resolveCallSignature(node: ts.CallExpression): SignatureId | undefined;

  /**
   * Return candidate overload signatures for a call expression, filtered by arity.
   *
   * This is used when TypeScript overload selection is ambiguous due to
   * erased types in the TS layer (e.g., `char` is `string` in TypeScript).
   *
   * IMPORTANT: This returns *candidates*, not the final selection.
   * The TypeSystem remains the authority for semantic selection.
   */
  resolveCallSignatureCandidates(
    node: ts.CallExpression
  ): readonly SignatureId[] | undefined;

  /**
   * Resolve new expression constructor signature.
   */
  resolveConstructorSignature(node: ts.NewExpression): SignatureId | undefined;

  /**
   * Return candidate overload signatures for a constructor call, filtered by arity.
   */
  resolveConstructorSignatureCandidates(
    node: ts.NewExpression
  ): readonly SignatureId[] | undefined;

  // ═══════════════════════════════════════════════════════════════════════════
  // IMPORT RESOLUTION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Resolve an import specifier to its actual declaration.
   * Uses checker.getAliasedSymbol to follow the import chain.
   */
  resolveImport(node: ts.ImportSpecifier): DeclId | undefined;

  // ═══════════════════════════════════════════════════════════════════════════
  // ADDITIONAL RESOLUTION METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Resolve a shorthand property assignment to its declaration.
   * For `{ foo }` syntax, resolves `foo` to its declaration.
   */
  resolveShorthandAssignment(
    node: ts.ShorthandPropertyAssignment
  ): DeclId | undefined;

  /**
   * Get the declaring type name for a resolved member handle.
   *
   * This is used for features that depend on the syntactic container of a member
   * declaration (e.g. tsbindgen extension-method interfaces like `__Ext_*`).
   */
  getDeclaringTypeNameOfMember(member: MemberId): string | undefined;

  /**
   * Get the absolute source file path where a resolved member is declared.
   *
   * Used to disambiguate tsbindgen bindings when multiple CLR types share the same
   * TS alias (e.g., `Server.listen` exists on both `nodejs.Server` and `nodejs.Http.Server`).
   */
  getSourceFilePathOfMember(member: MemberId): string | undefined;

  /**
   * Get the fully-qualified name for a declaration.
   * Used for override detection and .NET type identification.
   */
  getFullyQualifiedName(decl: DeclId): string | undefined;

  /**
   * Get the absolute source file path where a resolved declaration is declared.
   *
   * Used to map re-exported tsbindgen symbols back to their owning bindings.json
   * namespace deterministically (airplane-grade).
   */
  getSourceFilePathOfDecl(decl: DeclId): string | undefined;

  /**
   * Get type predicate information from a signature.
   * For functions with `x is T` return type.
   */
  getTypePredicateOfSignature(sig: SignatureId): TypePredicateInfo | undefined;

  /**
   * Get the TypeScript `this:` parameter type node for a signature (if present).
   *
   * Used for airplane-grade lowering of extension-method calls emitted as method-table
   * members with explicit `this:` receiver constraints.
   */
  getThisTypeNodeOfSignature(sig: SignatureId): ts.TypeNode | undefined;

  /**
   * Get the declaring TypeScript type name for a resolved signature (if present).
   *
   * For extension methods, this is the declaring interface/type that owns the selected
   * overload signature (e.g., `__TsonicExtMethods_Microsoft_EntityFrameworkCore`).
   *
   * This is critical for airplane-grade extension method binding when the same method name
   * exists in multiple extension namespaces (e.g., `ToArrayAsync` in BCL async LINQ vs EF Core).
   */
  getDeclaringTypeNameOfSignature(sig: SignatureId): string | undefined;

  // ═══════════════════════════════════════════════════════════════════════════
  // TYPE SYNTAX CAPTURE (Phase 2: TypeSyntaxId)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Capture a type syntax node for later conversion.
   *
   * Used for inline type syntax that cannot be captured at catalog-build time:
   * - `as Foo` type assertions
   * - `satisfies Bar` expressions
   * - Generic type arguments in expressions
   *
   * The captured syntax can be converted to IrType via TypeSystem.typeFromSyntax().
   * This is NOT an escape hatch — it's the correct boundary for inline syntax.
   */
  captureTypeSyntax(node: ts.TypeNode): TypeSyntaxId;

  /**
   * Capture multiple type arguments.
   *
   * Convenience method for capturing generic type arguments like `Foo<A, B, C>`.
   */
  captureTypeArgs(nodes: readonly ts.TypeNode[]): readonly TypeSyntaxId[];
}

/**
 * BindingInternal — extended interface for TypeSystem construction only.
 *
 * INVARIANT (Alice's spec): Only createTypeSystem() should access
 * _getHandleRegistry(). All other code uses the TypeSystem API.
 */
export type BindingInternal = {
  /**
   * Get the handle registry for TypeSystem construction.
   *
   * INTERNAL USE ONLY: This method is NOT part of the public Binding API.
   * Only createTypeSystem() should call this to access declaration info.
   * All other code should use TypeSystem queries instead.
   */
  _getHandleRegistry(): import("../type-system/internal/handle-types.js").HandleRegistry;
} & Binding

/**
 * Type predicate information for `x is T` predicates.
 */
export type TypePredicateInfo = {
  readonly kind: "typePredicate";
  readonly parameterIndex: number;
  readonly typeNode?: ts.TypeNode;
};

// ═══════════════════════════════════════════════════════════════════════════
// INTERNAL TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type DeclEntry = {
  readonly symbol: ts.Symbol;
  readonly decl?: ts.Declaration;
  readonly typeDeclNode?: ts.Declaration;
  readonly valueDeclNode?: ts.Declaration;
  readonly typeNode?: ts.TypeNode;
  readonly kind: DeclKind;
  readonly fqName?: string;
  readonly classMemberNames?: ClassMemberNames;
}

export type SignatureEntry = {
  readonly signature: ts.Signature;
  readonly decl?: ts.SignatureDeclaration;
  readonly parameters: readonly ParameterNode[];
  /** Type node of a TypeScript `this:` parameter (if present). Excluded from `parameters`. */
  readonly thisTypeNode?: ts.TypeNode;
  readonly returnTypeNode?: ts.TypeNode;
  readonly typeParameters?: readonly TypeParameterNode[];
  /**
   * Declaring type simple TS name (e.g., "Box" not "Test.Box").
   * TypeSystem uses UnifiedTypeCatalog.resolveTsName() to get CLR FQ name.
   */
  readonly declaringTypeTsName?: string;
  /** Declaring member name (for inheritance substitution in resolveCall) */
  readonly declaringMemberName?: string;
  /** Type predicate extracted from return type (x is T) */
  readonly typePredicate?: SignatureTypePredicate;
}

export type MemberEntry = {
  readonly memberId: MemberId;
  readonly symbol: ts.Symbol;
  readonly decl?: ts.Declaration;
  readonly name: string;
  readonly typeNode?: ts.TypeNode;
  readonly isOptional: boolean;
  readonly isReadonly: boolean;
}

/**
 * Entry for captured type syntax (Phase 2: TypeSyntaxId).
 */
export type TypeSyntaxEntry = {
  readonly typeNode: ts.TypeNode;
}
