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
  ParameterMode,
  SignatureTypePredicate,
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

  /**
   * Get the handle registry for TypeSystem queries.
   *
   * @deprecated Use TypeSystem API instead. This method will be removed
   * after Step 7 migration is complete. See Alice's spec in the plan file.
   */
  getHandleRegistry(): HandleRegistry;
}

/**
 * BindingInternal — extended interface for TypeSystem construction only.
 *
 * INVARIANT (Alice's spec): Only createTypeSystem() should access
 * _getHandleRegistry(). All other code uses the TypeSystem API.
 */
export interface BindingInternal extends Binding {
  /**
   * Get the handle registry for TypeSystem construction.
   *
   * INTERNAL USE ONLY: This method is NOT part of the public Binding API.
   * Only createTypeSystem() should call this to access declaration info.
   * All other code should use TypeSystem queries instead.
   */
  _getHandleRegistry(): HandleRegistry;
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
 *
 * Returns BindingInternal which includes _getHandleRegistry() for TypeSystem.
 * Cast to Binding when passing to regular converters.
 */
export const createBinding = (checker: ts.TypeChecker): BindingInternal => {
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

    // Extract declaring identity (CRITICAL for Alice's spec: resolveCall needs this)
    const declaringIdentity = extractDeclaringIdentity(decl, checker);

    // Extract type predicate from return type (ALICE'S SPEC: pure syntax inspection)
    const returnTypeNode = getReturnTypeNode(decl);
    const typePredicate = extractTypePredicate(returnTypeNode, decl);

    const entry: SignatureEntry = {
      signature,
      decl,
      parameters: extractParameterNodes(decl),
      returnTypeNode,
      typeParameters: extractTypeParameterNodes(decl),
      declaringTypeFQName: declaringIdentity?.typeFQName,
      declaringMemberName: declaringIdentity?.memberName,
      typePredicate,
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
        // CRITICAL for Alice's spec: declaring identity for resolveCall()
        declaringTypeFQName: entry.declaringTypeFQName,
        declaringMemberName: entry.declaringMemberName,
        // Type predicate extracted at registration time (Alice's spec)
        typePredicate: entry.typePredicate,
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
    // @deprecated - will be removed after Step 7 migration
    getHandleRegistry: () => handleRegistry,
    // Internal method for TypeSystem construction only
    _getHandleRegistry: () => handleRegistry,
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
  /** Declaring type FQ name (for inheritance substitution in resolveCall) */
  readonly declaringTypeFQName?: string;
  /** Declaring member name (for inheritance substitution in resolveCall) */
  readonly declaringMemberName?: string;
  /** Type predicate extracted from return type (x is T) */
  readonly typePredicate?: SignatureTypePredicate;
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

/**
 * Extract and normalize parameter nodes from a signature declaration.
 *
 * ALICE'S SPEC: Parameter mode detection happens HERE during signature registration.
 * If the parameter type is `ref<T>`, `out<T>`, or `in<T>`:
 * - Set `mode` to that keyword
 * - Set `typeNode` to the INNER T node (unwrapped)
 *
 * This is PURE SYNTAX inspection, no TS type inference.
 */
const extractParameterNodes = (
  decl: ts.SignatureDeclaration | undefined
): readonly ParameterNode[] => {
  if (!decl) return [];
  return decl.parameters.map((p) => {
    const normalized = normalizeParameterTypeNode(p.type);
    return {
      name: ts.isIdentifier(p.name) ? p.name.text : "param",
      typeNode: normalized.typeNode,
      isOptional: !!p.questionToken || !!p.initializer,
      isRest: !!p.dotDotDotToken,
      mode: normalized.mode,
    };
  });
};

/**
 * Normalize a parameter type node by detecting ref<T>/out<T>/in<T> wrappers.
 *
 * This is PURE SYNTAX analysis - we look at the TypeNode AST structure:
 * - If it's a TypeReferenceNode with identifier name "ref"/"out"/"in"
 * - And exactly one type argument
 * - Then unwrap to get the inner type
 *
 * @param typeNode The parameter's type node
 * @returns { mode, typeNode } where typeNode is unwrapped if wrapper detected
 */
const normalizeParameterTypeNode = (
  typeNode: ts.TypeNode | undefined
): { mode: ParameterMode; typeNode: ts.TypeNode | undefined } => {
  if (!typeNode) {
    return { mode: "value", typeNode: undefined };
  }

  // Check if it's a TypeReferenceNode with identifier name ref/out/in
  if (ts.isTypeReferenceNode(typeNode) && ts.isIdentifier(typeNode.typeName)) {
    const typeName = typeNode.typeName.text;
    if (
      (typeName === "ref" || typeName === "out" || typeName === "in") &&
      typeNode.typeArguments &&
      typeNode.typeArguments.length === 1
    ) {
      // Unwrap: ref<T> → T with mode="ref"
      return {
        mode: typeName,
        typeNode: typeNode.typeArguments[0],
      };
    }
  }

  // No wrapper detected - regular parameter
  return { mode: "value", typeNode };
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

/**
 * Extract type predicate from a signature's return type.
 *
 * ALICE'S SPEC: This is PURE SYNTAX inspection at registration time.
 * We check if the return TypeNode is a TypePredicateNode (x is T or this is T).
 * No TS type inference is used.
 *
 * @param returnTypeNode The signature's return type node
 * @param decl The signature declaration (to find parameter index)
 * @returns SignatureTypePredicate or undefined if not a predicate
 */
const extractTypePredicate = (
  returnTypeNode: ts.TypeNode | undefined,
  decl: ts.SignatureDeclaration | undefined
): SignatureTypePredicate | undefined => {
  // Return type must be a TypePredicateNode
  if (!returnTypeNode || !ts.isTypePredicateNode(returnTypeNode)) {
    return undefined;
  }

  const predNode = returnTypeNode;

  // Must have a target type
  if (!predNode.type) {
    return undefined;
  }

  // Check if it's "this is T" predicate
  if (predNode.parameterName.kind === ts.SyntaxKind.ThisType) {
    return {
      kind: "this",
      targetTypeNode: predNode.type,
    };
  }

  // Check if it's "param is T" predicate
  if (ts.isIdentifier(predNode.parameterName)) {
    const paramName = predNode.parameterName.text;

    // Find parameter index
    const paramIndex =
      decl?.parameters.findIndex(
        (p) => ts.isIdentifier(p.name) && p.name.text === paramName
      ) ?? -1;

    if (paramIndex >= 0) {
      return {
        kind: "param",
        parameterName: paramName,
        parameterIndex: paramIndex,
        targetTypeNode: predNode.type,
      };
    }
  }

  return undefined;
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

/**
 * Extract declaring identity from a signature declaration.
 *
 * CRITICAL for Alice's spec: Without this, resolveCall() cannot compute
 * inheritance substitution. It would have to "guess" the method name
 * from the signature, which breaks on overloads, aliases, etc.
 *
 * @param decl The signature declaration (method, function, etc.)
 * @param checker TypeChecker for FQ name resolution
 * @returns { typeFQName, memberName } or undefined if not a member
 */
const extractDeclaringIdentity = (
  decl: ts.SignatureDeclaration | undefined,
  checker: ts.TypeChecker
): { typeFQName: string; memberName: string } | undefined => {
  if (!decl) return undefined;

  // Check if this is a method (class or interface member)
  if (ts.isMethodDeclaration(decl) || ts.isMethodSignature(decl)) {
    const parent = decl.parent;

    // Get the method name
    const memberName = ts.isIdentifier(decl.name)
      ? decl.name.text
      : (decl.name?.getText() ?? "unknown");

    // Get the containing type's FQ name
    if (ts.isClassDeclaration(parent) || ts.isInterfaceDeclaration(parent)) {
      const typeSymbol = parent.name
        ? checker.getSymbolAtLocation(parent.name)
        : undefined;

      if (typeSymbol) {
        const typeFQName = checker.getFullyQualifiedName(typeSymbol);
        return { typeFQName, memberName };
      }
    }

    // Object literal method - use parent context
    if (ts.isObjectLiteralExpression(parent)) {
      // For object literals, we don't have a named type
      return undefined;
    }
  }

  // Constructor declarations
  if (ts.isConstructorDeclaration(decl)) {
    const parent = decl.parent;
    if (ts.isClassDeclaration(parent) && parent.name) {
      const typeSymbol = checker.getSymbolAtLocation(parent.name);
      if (typeSymbol) {
        const typeFQName = checker.getFullyQualifiedName(typeSymbol);
        return { typeFQName, memberName: "constructor" };
      }
    }
  }

  // Getter/setter declarations
  if (ts.isGetAccessorDeclaration(decl) || ts.isSetAccessorDeclaration(decl)) {
    const parent = decl.parent;
    const memberName = ts.isIdentifier(decl.name)
      ? decl.name.text
      : (decl.name?.getText() ?? "unknown");

    if (ts.isClassDeclaration(parent) || ts.isInterfaceDeclaration(parent)) {
      const typeSymbol = parent.name
        ? checker.getSymbolAtLocation(parent.name)
        : undefined;

      if (typeSymbol) {
        const typeFQName = checker.getFullyQualifiedName(typeSymbol);
        return { typeFQName, memberName };
      }
    }
  }

  // Standalone functions don't have a declaring type
  return undefined;
};
