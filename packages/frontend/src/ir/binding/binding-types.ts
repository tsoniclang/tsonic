/**
 * Binding Layer — Type Definitions
 *
 * Public and internal type definitions for the Binding layer.
 * Contains Binding/BindingInternal interfaces and internal entry types
 * used by the factory and handle registry.
 */

import type {
  TstsNode,
  TstsSignature,
  TstsSymbol,
} from "@tsonic/tsts";
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
  HandleRegistry,
} from "../type-system/internal/handle-types.js";
import type { SourceSemanticFactKey } from "../../source-frontend/index.js";

export type BindingExternalImportTypeIdentity = {
  readonly sourceName: string;
  readonly providerQualifiedName: string;
};

export type BindingImportedSourceValueTarget = {
  readonly sourceFilePath: string;
  readonly exportName: string;
};

export type BindingImportedSourceNamespaceMemberTarget = {
  readonly declaration: TstsNode;
  readonly sourceFilePath: string;
  readonly exportName: string;
};

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
   * Uses sourceSemantics symbol and declaration queries.
   */
  resolveIdentifier(node: TstsNode): DeclId | undefined;

  /**
   * Resolve a type reference to its declaration.
   * For qualified names (A.B.C), resolves the rightmost symbol.
   */
  resolveTypeReference(node: TstsNode): DeclId | undefined;

  /**
   * Resolve a property access to its member declaration.
   */
  resolvePropertyAccess(
    node: TstsNode
  ): MemberId | undefined;

  /**
   * Resolve an element access to its member (for known keys).
   */
  resolveElementAccess(node: TstsNode): MemberId | undefined;

  // ═══════════════════════════════════════════════════════════════════════════
  // CALL RESOLUTION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Pick the correct overload for a call expression.
   * Uses sourceSemantics.getResolvedSignature to pick the overload.
   */
  resolveCallSignature(node: TstsNode): SignatureId | undefined;

  /**
   * Resolve new expression constructor signature.
   */
  resolveConstructorSignature(node: TstsNode): SignatureId | undefined;

  /**
   * Read source-extension facts projected onto TypeScript AST nodes.
   * This keeps binding/type conversion behind the source semantic boundary.
   */
  getSourceFact<T>(node: TstsNode, key: SourceSemanticFactKey<T>): T | undefined;

  // ═══════════════════════════════════════════════════════════════════════════
  // IMPORT RESOLUTION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Resolve an import specifier to its actual declaration.
   * Uses sourceSemantics.resolveAlias to follow the import chain.
   */
  resolveImport(node: TstsNode): DeclId | undefined;

  /**
   * Resolve a type reference that points at an imported external facade export.
   *
   * This preserves module identity for cases where the same exported simple name
   * exists in multiple external namespaces, for example:
   *
   *   import { Queue } from "@example/provider/Collections.Generic.js";
   *   import { Queue } from "@example/provider/Collections.Legacy.js";
   *
   * The first and second imports can intentionally point at different provider
   * identities even when they share the same source-facing name. A global
   * simple-name lookup cannot distinguish those identities.
   */
  resolveExternalImportType(
    node: TstsNode
  ): BindingExternalImportTypeIdentity | undefined;

  /**
   * Resolve a value identifier that is a named import from another source file
   * to its target source file and exported name.
   *
   * This is intentionally syntax/module-graph based because source engines may
   * expose either the import alias declaration or the final exported declaration
   * as the symbol declaration. The module graph is the deterministic owner of
   * import/export identity.
   */
  resolveImportedSourceValue(
    node: TstsNode
  ): BindingImportedSourceValueTarget | undefined;

  /**
   * Resolve `import * as ns from "pkg"; ns.member` to the exported source
   * declaration for `member`.
   *
   * This is module-graph authority, not name inference: the receiver must be a
   * namespace import binding and the target export must exist in the resolved
   * source package/file.
   */
  resolveImportedSourceNamespaceMember(
    node: TstsNode
  ): BindingImportedSourceNamespaceMemberTarget | undefined;

  // ═══════════════════════════════════════════════════════════════════════════
  // ADDITIONAL RESOLUTION METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Resolve a shorthand property assignment to its declaration.
   * For `{ foo }` syntax, resolves `foo` to its declaration.
   */
  resolveShorthandAssignment(
    node: TstsNode
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
   * Used to disambiguate tsbindgen bindings when multiple native target types share the same
   * TS alias (e.g., `Server.listen` exists on both `nodejs.Server` and `nodejs.Http.Server`).
   */
  getSourceFilePathOfMember(member: MemberId): string | undefined;

  /**
   * Get the fully-qualified name for a declaration.
   * Used for override detection and external type identification.
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
   * Get the kind captured for a resolved declaration.
   *
   * This is a narrow syntactic query for converter logic that must distinguish
   * classes from values without reaching into the internal handle registry.
   */
  getKindOfDecl(decl: DeclId): DeclKind | undefined;

  /**
   * Get the explicit type annotation captured for a resolved declaration.
   *
   * Returns undefined for declarations without a syntactic type annotation.
   */
  getTypeNodeOfDecl(decl: DeclId): TstsNode | undefined;

  /**
   * Get the value-side declaration node captured for a resolved declaration.
   *
   * For merged value/type symbols, this prefers the value declaration and falls
   * back to the canonical declaration node.
   */
  getValueDeclarationNode(decl: DeclId): TstsNode | undefined;

  /**
   * Get every declaration node captured for a resolved declaration.
   *
   * This intentionally returns declaration nodes only, never raw symbols or
   * registry entries.
   */
  getDeclarationNodesOfDecl(decl: DeclId): readonly TstsNode[];

  /**
   * Get the explicit type annotation captured for a resolved member.
   */
  getTypeNodeOfMember(member: MemberId): TstsNode | undefined;

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
  getThisTypeNodeOfSignature(sig: SignatureId): TstsNode | undefined;

  /**
   * Get the declaring TypeScript type name for a resolved signature (if present).
   *
   * For extension methods, this is the declaring interface/type that owns the selected
   * overload signature (e.g., `__TsonicExtMethods_Microsoft_EntityFrameworkCore`).
   *
   * This is critical for airplane-grade extension method binding when the same method name
   * exists in multiple external extension namespaces.
   */
  getDeclaringTypeNameOfSignature(sig: SignatureId): string | undefined;

  // ═══════════════════════════════════════════════════════════════════════════
  // TYPE SYNTAX CAPTURE
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
  captureTypeSyntax(
    node: TstsNode
  ): TypeSyntaxId;

  /**
   * Capture multiple type arguments.
   *
   * Convenience method for capturing generic type arguments like `Foo<A, B, C>`.
   */
  captureTypeArgs(nodes: readonly TstsNode[]): readonly TypeSyntaxId[];
};

/**
 * BindingInternal — extended interface for TypeSystem construction only.
 *
 * INVARIANT: Only createTypeSystem() should access
 * _getHandleRegistry(). All other code uses the TypeSystem API.
 */
export type BindingInternal = Binding & {
  /**
   * Get the handle registry for TypeSystem construction.
   *
   * INTERNAL USE ONLY: This method is NOT part of the public Binding API.
   * Only createTypeSystem() should call this to access declaration info.
   * All other code should use TypeSystem queries instead.
   */
  _getHandleRegistry(): HandleRegistry;
};

/**
 * Type predicate information for `x is T` predicates.
 */
export type TypePredicateInfo = {
  readonly kind: "typePredicate";
  readonly parameterIndex: number;
  readonly typeNode?: TstsNode;
};

// ═══════════════════════════════════════════════════════════════════════════
// INTERNAL TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type DeclEntry = {
  readonly symbol?: TstsSymbol;
  readonly decl?: TstsNode;
  readonly typeDeclNode?: TstsNode;
  readonly valueDeclNode?: TstsNode;
  readonly typeNode?: TstsNode;
  readonly kind: DeclKind;
  readonly fqName?: string;
  readonly classMemberNames?: ClassMemberNames;
};

export type SignatureEntry = {
  readonly signature: TstsSignature;
  readonly decl?: TstsNode;
  readonly parameters: readonly ParameterNode[];
  readonly resolvedParameters?: readonly ParameterNode[];
  /** Type node of a TypeScript `this:` parameter (if present). Excluded from `parameters`. */
  readonly thisTypeNode?: TstsNode;
  readonly returnTypeNode?: TstsNode;
  readonly typeParameters?: readonly TypeParameterNode[];
  /**
   * Declaring type simple TS name (e.g., "Box" not "Test.Box").
   * TypeSystem uses UnifiedTypeCatalog.resolveTsName() to get target name.
   */
  readonly declaringTypeTsName?: string;
  readonly declaringTypeParameterNames?: readonly string[];
  /** Declaring member name (for inheritance substitution in resolveCall) */
  readonly declaringMemberName?: string;
  /** Type predicate extracted from return type (x is T) */
  readonly typePredicate?: SignatureTypePredicate;
};

export type MemberEntry = {
  readonly memberId: MemberId;
  readonly symbol: TstsSymbol;
  readonly decl?: TstsNode;
  readonly name: string;
  readonly typeNode?: TstsNode;
  readonly isOptional: boolean;
  readonly isReadonly: boolean;
};

/**
 * Entry for captured type syntax.
 */
export type TypeSyntaxEntry = {
  readonly typeNode: TstsNode;
  readonly referenceDeclId?: DeclId;
};
