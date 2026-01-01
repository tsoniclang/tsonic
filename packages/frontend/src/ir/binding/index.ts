/**
 * Binding Layer — TS Symbol Resolution with Opaque Handles
 *
 * This module wraps TypeScript's symbol resolution APIs and returns opaque
 * handles (DeclId, SignatureId, MemberId) instead of ts.Symbol/ts.Signature.
 *
 * ALLOWED APIs (symbol resolution only):
 * - checker.getSymbolAtLocation(node) — Find symbol at AST node
 * - checker.getAliasedSymbol(symbol) — Resolve import alias
 * - checker.getExportSymbolOfSymbol(symbol) — Resolve export
 * - symbol.getDeclarations() — Get AST declaration nodes
 * - checker.getResolvedSignature(call) — Pick overload (type from declaration)
 *
 * BANNED APIs (these produce ts.Type, which violates INV-0):
 * - checker.getTypeAtLocation
 * - checker.getTypeOfSymbolAtLocation
 * - checker.getContextualType
 * - checker.typeToTypeNode
 */

import ts from "typescript";
import {
  DeclId,
  SignatureId,
  MemberId,
  makeDeclId,
  makeSignatureId,
  makeMemberId,
} from "../type-system/types.js";
import type {
  HandleRegistry,
  DeclInfo,
  SignatureInfo,
  MemberInfo,
  DeclKind,
  ParameterNode,
  TypeParameterNode,
} from "../type-system/index.js";

// ═══════════════════════════════════════════════════════════════════════════
// BINDING INTERFACE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Binding interface — wraps TS symbol resolution APIs.
 *
 * All methods return opaque handles. Use HandleRegistry to look up
 * the underlying declaration/signature information.
 */
export interface Binding {
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
   * Resolve new expression constructor signature.
   */
  resolveConstructorSignature(node: ts.NewExpression): SignatureId | undefined;

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
   * Get the fully-qualified name for a declaration.
   * Used for override detection and .NET type identification.
   */
  getFullyQualifiedName(decl: DeclId): string | undefined;

  /**
   * Get type predicate information from a signature.
   * For functions with `x is T` return type.
   */
  getTypePredicateOfSignature(sig: SignatureId): TypePredicateInfo | undefined;

  // ═══════════════════════════════════════════════════════════════════════════
  // REGISTRY ACCESS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get the handle registry for TypeSystem queries.
   */
  getHandleRegistry(): HandleRegistry;
}

/**
 * Type predicate information for `x is T` predicates.
 */
export type TypePredicateInfo = {
  readonly kind: "typePredicate";
  readonly parameterIndex: number;
  readonly typeNode?: ts.TypeNode;
};

// ═══════════════════════════════════════════════════════════════════════════
// BINDING IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a Binding instance for a TypeScript program.
 */
export const createBinding = (checker: ts.TypeChecker): Binding => {
  // Internal registries mapping handles to underlying TS objects
  const declMap = new Map<number, DeclEntry>();
  const signatureMap = new Map<number, SignatureEntry>();
  const memberMap = new Map<string, MemberEntry>(); // key: "declId:name"

  // Auto-increment IDs
  const nextDeclId = { value: 0 };
  const nextSignatureId = { value: 0 };

  // Symbol to DeclId cache (avoid duplicate DeclIds for same symbol)
  const symbolToDeclId = new Map<ts.Symbol, DeclId>();
  const signatureToId = new Map<ts.Signature, SignatureId>();

  // ─────────────────────────────────────────────────────────────────────────
  // INTERNAL HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  const getOrCreateDeclId = (symbol: ts.Symbol): DeclId => {
    const existing = symbolToDeclId.get(symbol);
    if (existing) return existing;

    const id = makeDeclId(nextDeclId.value++);
    symbolToDeclId.set(symbol, id);

    // Get declaration info
    const decl = symbol.getDeclarations()?.[0];
    const entry: DeclEntry = {
      symbol,
      decl,
      typeNode: decl ? getTypeNodeFromDeclaration(decl) : undefined,
      kind: decl ? getDeclKind(decl) : "variable",
      fqName: symbol.getName(),
    };
    declMap.set(id.id, entry);

    return id;
  };

  const getOrCreateSignatureId = (signature: ts.Signature): SignatureId => {
    const existing = signatureToId.get(signature);
    if (existing) return existing;

    const id = makeSignatureId(nextSignatureId.value++);
    signatureToId.set(signature, id);

    // Extract signature info from declaration
    const decl = signature.getDeclaration();
    const entry: SignatureEntry = {
      signature,
      decl,
      parameters: extractParameterNodes(decl),
      returnTypeNode: getReturnTypeNode(decl),
      typeParameters: extractTypeParameterNodes(decl),
    };
    signatureMap.set(id.id, entry);

    return id;
  };

  const getOrCreateMemberId = (
    ownerDeclId: DeclId,
    memberName: string,
    memberSymbol: ts.Symbol
  ): MemberId => {
    const key = `${ownerDeclId.id}:${memberName}`;
    const existing = memberMap.get(key);
    if (existing) return existing.memberId;

    const id = makeMemberId(ownerDeclId, memberName);
    const decl = memberSymbol.getDeclarations()?.[0];
    const entry: MemberEntry = {
      memberId: id,
      symbol: memberSymbol,
      decl,
      name: memberName,
      typeNode: decl ? getMemberTypeNode(decl) : undefined,
      isOptional: isOptionalMember(memberSymbol),
      isReadonly: isReadonlyMember(decl),
    };
    memberMap.set(key, entry);

    return id;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // BINDING IMPLEMENTATION
  // ─────────────────────────────────────────────────────────────────────────

  const resolveIdentifier = (node: ts.Identifier): DeclId | undefined => {
    const symbol = checker.getSymbolAtLocation(node);
    if (!symbol) return undefined;

    // Follow aliases for imports
    const resolvedSymbol =
      symbol.flags & ts.SymbolFlags.Alias
        ? checker.getAliasedSymbol(symbol)
        : symbol;

    return getOrCreateDeclId(resolvedSymbol);
  };

  const resolveTypeReference = (
    node: ts.TypeReferenceNode
  ): DeclId | undefined => {
    const typeName = node.typeName;
    const symbol = ts.isIdentifier(typeName)
      ? checker.getSymbolAtLocation(typeName)
      : checker.getSymbolAtLocation(typeName.right);

    if (!symbol) return undefined;

    // Follow aliases
    const resolvedSymbol =
      symbol.flags & ts.SymbolFlags.Alias
        ? checker.getAliasedSymbol(symbol)
        : symbol;

    return getOrCreateDeclId(resolvedSymbol);
  };

  const resolvePropertyAccess = (
    node: ts.PropertyAccessExpression
  ): MemberId | undefined => {
    const propSymbol = checker.getSymbolAtLocation(node.name);
    if (!propSymbol) return undefined;

    // Get owner type's declaration
    const ownerSymbol = checker.getSymbolAtLocation(node.expression);
    if (!ownerSymbol) return undefined;

    const ownerDeclId = getOrCreateDeclId(ownerSymbol);
    return getOrCreateMemberId(ownerDeclId, node.name.text, propSymbol);
  };

  const resolveElementAccess = (
    _node: ts.ElementAccessExpression
  ): MemberId | undefined => {
    // Element access member resolution requires type-level analysis
    // For now, return undefined (member not resolved via handles)
    // TODO: Implement when needed for specific cases
    return undefined;
  };

  const resolveCallSignature = (
    node: ts.CallExpression
  ): SignatureId | undefined => {
    const signature = checker.getResolvedSignature(node);
    if (!signature || signature.declaration === undefined) return undefined;

    return getOrCreateSignatureId(signature);
  };

  const resolveConstructorSignature = (
    node: ts.NewExpression
  ): SignatureId | undefined => {
    const signature = checker.getResolvedSignature(node);
    if (!signature || signature.declaration === undefined) return undefined;

    return getOrCreateSignatureId(signature);
  };

  const resolveImport = (node: ts.ImportSpecifier): DeclId | undefined => {
    const symbol = checker.getSymbolAtLocation(node.name);
    if (!symbol) return undefined;

    const aliased = checker.getAliasedSymbol(symbol);
    return getOrCreateDeclId(aliased);
  };

  const resolveShorthandAssignment = (
    node: ts.ShorthandPropertyAssignment
  ): DeclId | undefined => {
    const symbol = checker.getShorthandAssignmentValueSymbol(node);
    if (!symbol) return undefined;
    return getOrCreateDeclId(symbol);
  };

  const getFullyQualifiedName = (declId: DeclId): string | undefined => {
    const entry = declMap.get(declId.id);
    if (!entry) return undefined;
    return checker.getFullyQualifiedName(entry.symbol);
  };

  const getTypePredicateOfSignature = (
    sigId: SignatureId
  ): TypePredicateInfo | undefined => {
    const entry = signatureMap.get(sigId.id);
    if (!entry) return undefined;

    const predicate = checker.getTypePredicateOfSignature(entry.signature);
    if (!predicate || predicate.kind !== ts.TypePredicateKind.Identifier) {
      return undefined;
    }

    return {
      kind: "typePredicate",
      parameterIndex: predicate.parameterIndex ?? 0,
      typeNode: predicate.type
        ? checker.typeToTypeNode(
            predicate.type,
            undefined,
            ts.NodeBuilderFlags.None
          )
        : undefined,
    };
  };

  // ─────────────────────────────────────────────────────────────────────────
  // HANDLE REGISTRY IMPLEMENTATION
  // ─────────────────────────────────────────────────────────────────────────

  const handleRegistry: HandleRegistry = {
    getDecl: (id: DeclId): DeclInfo | undefined => {
      const entry = declMap.get(id.id);
      if (!entry) return undefined;
      return {
        typeNode: entry.typeNode,
        kind: entry.kind,
        fqName: entry.fqName,
        declNode: entry.decl,
      };
    },

    getSignature: (id: SignatureId): SignatureInfo | undefined => {
      const entry = signatureMap.get(id.id);
      if (!entry) return undefined;
      return {
        parameters: entry.parameters,
        returnTypeNode: entry.returnTypeNode,
        typeParameters: entry.typeParameters,
      };
    },

    getMember: (id: MemberId): MemberInfo | undefined => {
      const key = `${id.declId.id}:${id.name}`;
      const entry = memberMap.get(key);
      if (!entry) return undefined;
      return {
        name: entry.name,
        typeNode: entry.typeNode,
        isOptional: entry.isOptional,
        isReadonly: entry.isReadonly,
      };
    },
  };

  return {
    resolveIdentifier,
    resolveTypeReference,
    resolvePropertyAccess,
    resolveElementAccess,
    resolveCallSignature,
    resolveConstructorSignature,
    resolveImport,
    resolveShorthandAssignment,
    getFullyQualifiedName,
    getTypePredicateOfSignature,
    getHandleRegistry: () => handleRegistry,
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// INTERNAL TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface DeclEntry {
  readonly symbol: ts.Symbol;
  readonly decl?: ts.Declaration;
  readonly typeNode?: ts.TypeNode;
  readonly kind: DeclKind;
  readonly fqName?: string;
}

interface SignatureEntry {
  readonly signature: ts.Signature;
  readonly decl?: ts.SignatureDeclaration;
  readonly parameters: readonly ParameterNode[];
  readonly returnTypeNode?: ts.TypeNode;
  readonly typeParameters?: readonly TypeParameterNode[];
}

interface MemberEntry {
  readonly memberId: MemberId;
  readonly symbol: ts.Symbol;
  readonly decl?: ts.Declaration;
  readonly name: string;
  readonly typeNode?: ts.TypeNode;
  readonly isOptional: boolean;
  readonly isReadonly: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

const getTypeNodeFromDeclaration = (
  decl: ts.Declaration
): ts.TypeNode | undefined => {
  if (ts.isVariableDeclaration(decl) && decl.type) {
    return decl.type;
  }
  if (ts.isFunctionDeclaration(decl) || ts.isMethodDeclaration(decl)) {
    return decl.type;
  }
  if (ts.isParameter(decl) && decl.type) {
    return decl.type;
  }
  if (ts.isPropertyDeclaration(decl) && decl.type) {
    return decl.type;
  }
  if (ts.isPropertySignature(decl) && decl.type) {
    return decl.type;
  }
  if (ts.isTypeAliasDeclaration(decl)) {
    return decl.type;
  }
  return undefined;
};

const getMemberTypeNode = (decl: ts.Declaration): ts.TypeNode | undefined => {
  if (ts.isPropertyDeclaration(decl) || ts.isPropertySignature(decl)) {
    return decl.type;
  }
  if (ts.isMethodDeclaration(decl) || ts.isMethodSignature(decl)) {
    // For methods, we could return a function type node if needed
    return decl.type;
  }
  return undefined;
};

const getDeclKind = (decl: ts.Declaration): DeclKind => {
  if (ts.isVariableDeclaration(decl)) return "variable";
  if (ts.isFunctionDeclaration(decl)) return "function";
  if (ts.isClassDeclaration(decl)) return "class";
  if (ts.isInterfaceDeclaration(decl)) return "interface";
  if (ts.isTypeAliasDeclaration(decl)) return "typeAlias";
  if (ts.isEnumDeclaration(decl)) return "enum";
  if (ts.isParameter(decl)) return "parameter";
  if (ts.isPropertyDeclaration(decl) || ts.isPropertySignature(decl))
    return "property";
  if (ts.isMethodDeclaration(decl) || ts.isMethodSignature(decl))
    return "method";
  return "variable";
};

const getReturnTypeNode = (
  decl: ts.SignatureDeclaration | undefined
): ts.TypeNode | undefined => {
  if (!decl) return undefined;
  return decl.type;
};

const extractParameterNodes = (
  decl: ts.SignatureDeclaration | undefined
): readonly ParameterNode[] => {
  if (!decl) return [];
  return decl.parameters.map((p) => ({
    name: ts.isIdentifier(p.name) ? p.name.text : "param",
    typeNode: p.type,
    isOptional: !!p.questionToken || !!p.initializer,
    isRest: !!p.dotDotDotToken,
  }));
};

const extractTypeParameterNodes = (
  decl: ts.SignatureDeclaration | undefined
): readonly TypeParameterNode[] | undefined => {
  if (!decl?.typeParameters) return undefined;
  return decl.typeParameters.map((tp) => ({
    name: tp.name.text,
    constraintNode: tp.constraint,
    defaultNode: tp.default,
  }));
};

const isOptionalMember = (symbol: ts.Symbol): boolean => {
  return (symbol.flags & ts.SymbolFlags.Optional) !== 0;
};

const isReadonlyMember = (decl: ts.Declaration | undefined): boolean => {
  if (!decl) return false;
  if (ts.isPropertyDeclaration(decl) || ts.isPropertySignature(decl)) {
    return (
      decl.modifiers?.some((m) => m.kind === ts.SyntaxKind.ReadonlyKeyword) ??
      false
    );
  }
  return false;
};
