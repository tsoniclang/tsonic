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
  TypeSyntaxId,
  makeDeclId,
  makeSignatureId,
  makeMemberId,
  makeTypeSyntaxId,
} from "../type-system/types.js";
// ALICE'S SPEC: Binding is allowed to import internal handle types
import type {
  HandleRegistry,
  DeclInfo,
  SignatureInfo,
  MemberInfo,
  DeclKind,
  ParameterNode,
  TypeParameterNode,
  SignatureTypePredicate,
  TypeSyntaxInfo,
  ClassMemberNames,
} from "../type-system/internal/handle-types.js";
import type { ParameterMode } from "../type-system/types.js";

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
   * Get type predicate information from a signature.
   * For functions with `x is T` return type.
   */
  getTypePredicateOfSignature(sig: SignatureId): TypePredicateInfo | undefined;

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
  const typeSyntaxMap = new Map<number, TypeSyntaxEntry>(); // TypeSyntaxId → TypeNode

  // Auto-increment IDs
  const nextDeclId = { value: 0 };
  const nextSignatureId = { value: 0 };
  const nextTypeSyntaxId = { value: 0 };

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

    // Get declaration info.
    //
    // IMPORTANT:
    // Some symbols (notably tsbindgen facades) intentionally merge a value export
    // and a type export under the same name, e.g.:
    //   export const Task: typeof Internal.Task;
    //   export type Task<T1 = __> = ... Internal.Task_1<T1> ...
    //
    // For expression identifiers we want the value declaration, while for type
    // references we must be able to access the type declaration. We capture both.
    const decls = symbol.getDeclarations() ?? [];

    const valueDecl = decls.find(
      (d) =>
        ts.isVariableDeclaration(d) ||
        ts.isFunctionDeclaration(d) ||
        ts.isParameter(d) ||
        ts.isPropertyDeclaration(d) ||
        ts.isPropertySignature(d) ||
        ts.isMethodDeclaration(d) ||
        ts.isMethodSignature(d)
    );

    const typeDecl = decls.find(
      (d) =>
        ts.isTypeAliasDeclaration(d) ||
        ts.isInterfaceDeclaration(d) ||
        ts.isClassDeclaration(d) ||
        ts.isEnumDeclaration(d) ||
        ts.isTypeParameterDeclaration(d)
    );

    const decl = valueDecl ?? typeDecl ?? decls[0];

    // Capture class member names for override detection (TS-version safe)
    const classMemberNames =
      decl && ts.isClassDeclaration(decl)
        ? extractClassMemberNames(decl)
        : undefined;

    const entry: DeclEntry = {
      symbol,
      decl,
      typeDeclNode: typeDecl,
      valueDeclNode: valueDecl,
      typeNode: decl ? getTypeNodeFromDeclaration(decl) : undefined,
      kind: decl ? getDeclKind(decl) : "variable",
      fqName: symbol.getName(),
      classMemberNames,
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
      declaringTypeTsName: declaringIdentity?.typeTsName,
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
	      typeNode: decl ? getMemberTypeAnnotation(decl) : undefined,
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
    const rawPropSymbol = checker.getSymbolAtLocation(node.name);
    if (!rawPropSymbol) return undefined;

    const propSymbol =
      rawPropSymbol.flags & ts.SymbolFlags.Alias
        ? checker.getAliasedSymbol(rawPropSymbol)
        : rawPropSymbol;

    // Get owner type's declaration
    const rawOwnerSymbol = checker.getSymbolAtLocation(node.expression);

    // Note: `getSymbolAtLocation(node.expression)` can be undefined for receivers
    // that are not identifiers/member-accesses (e.g., `xs.where(...).select`).
    // In that case we still want a stable MemberId for the member symbol itself,
    // so we key the member entry off the member symbol's own DeclId.
    const ownerSymbol = rawOwnerSymbol
      ? rawOwnerSymbol.flags & ts.SymbolFlags.Alias
        ? checker.getAliasedSymbol(rawOwnerSymbol)
        : rawOwnerSymbol
      : undefined;

    const ownerDeclId = getOrCreateDeclId(ownerSymbol ?? propSymbol);
    return getOrCreateMemberId(ownerDeclId, node.name.text, propSymbol);
  };

  const resolveElementAccess = (
    _node: ts.ElementAccessExpression
  ): MemberId | undefined => {
    // Element access member resolution requires type-level analysis
    // Return undefined (member not resolved via handles)
    return undefined;
  };

  const resolveCallSignature = (
    node: ts.CallExpression
  ): SignatureId | undefined => {
    const signature = checker.getResolvedSignature(node);
    if (!signature) return undefined;

    // TypeScript can produce a resolved signature without a declaration for
    // implicit default constructors (e.g., `super()` when the base class has
    // no explicit constructor). We still want a SignatureId so TypeSystem can
    // treat this call deterministically as `void`.
    if (signature.declaration === undefined) {
      // Special case: `super()` implicit base constructor
      if (node.expression.kind === ts.SyntaxKind.SuperKeyword) {
        return getOrCreateSignatureId(signature);
      }

      // Recovery: calls through variables/properties typed as functions can
      // yield signatures without declarations. Attempt to re-anchor to a
      // function-like declaration we can capture syntactically.
      const symbol = (() => {
        const expr = node.expression;
        if (ts.isIdentifier(expr)) return checker.getSymbolAtLocation(expr);
        if (ts.isPropertyAccessExpression(expr)) {
          return checker.getSymbolAtLocation(expr.name);
        }
        return undefined;
      })();

      const resolvedSymbol =
        symbol && symbol.flags & ts.SymbolFlags.Alias
          ? checker.getAliasedSymbol(symbol)
          : symbol;

      const decls = resolvedSymbol?.getDeclarations() ?? [];
      for (const decl of decls) {
        // Direct function-like declarations (function/method/signature)
        if (ts.isFunctionLike(decl)) {
          const sig = checker.getSignatureFromDeclaration(decl);
          if (sig) return getOrCreateSignatureId(sig);
          continue;
        }

        // Variable initializers: const f = (x) => ...
        if (ts.isVariableDeclaration(decl)) {
          const init = decl.initializer;
          if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) {
            const sig = checker.getSignatureFromDeclaration(init);
            if (sig) return getOrCreateSignatureId(sig);
          }
        }
      }

      return undefined;
    }

    const resolvedId = getOrCreateSignatureId(signature);

    // Airplane-grade overload selection for erased TS types:
    // In TypeScript, `char` is `string`, so overload sets that differ only by
    // `char` vs `string` can be resolved "wrong" due to declaration order
    // (e.g., string.split("/") picking the `char` overload).
    //
    // We apply a deterministic, syntax-driven tie-breaker:
    // - Prefer `string` parameters for non-charish arguments (string literals, etc.)
    // - Prefer `char` parameters only when the argument is explicitly marked char
    //   (e.g., `expr as char`, or identifier declared `: char`).
    const candidates = resolveCallSignatureCandidates(node);
    if (!candidates || candidates.length < 2) return resolvedId;

    const stripParens = (expr: ts.Expression): ts.Expression => {
      let current = expr;
      while (ts.isParenthesizedExpression(current)) {
        current = current.expression;
      }
      return current;
    };

    const isCharTypeNode = (typeNode: ts.TypeNode): boolean => {
      if (ts.isTypeReferenceNode(typeNode)) {
        const tn = typeNode.typeName;
        if (ts.isIdentifier(tn)) return tn.text === "char";
        return tn.right.text === "char";
      }
      return false;
    };

    const isCharishArgument = (arg: ts.Expression): boolean => {
      const expr = stripParens(arg);

      // Explicit `as char` / `<char>` assertions.
      if (ts.isAsExpression(expr) || ts.isTypeAssertionExpression(expr)) {
        return isCharTypeNode(expr.type);
      }

      // Identifier declared with `: char`.
      if (ts.isIdentifier(expr)) {
        const sym = checker.getSymbolAtLocation(expr);
        if (!sym) return false;
        const resolvedSym =
          sym.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(sym) : sym;
        const decls = resolvedSym.getDeclarations() ?? [];
        for (const decl of decls) {
          const typeNode = getTypeNodeFromDeclaration(decl);
          if (typeNode && isCharTypeNode(typeNode)) return true;
        }
      }

      return false;
    };

    const prefersStringOverChar = (arg: ts.Expression): boolean => {
      const expr = stripParens(arg);
      if (isCharishArgument(expr)) return false;
      return ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr);
    };

    type ParamClass = "char" | "string" | "other";

    const classifyParamTypeNode = (typeNode: unknown): ParamClass => {
      if (!typeNode) return "other";
      const node = typeNode as ts.TypeNode;
      if (node.kind === ts.SyntaxKind.StringKeyword) return "string";
      if (isCharTypeNode(node)) return "char";
      if (ts.isArrayTypeNode(node)) {
        return isCharTypeNode(node.elementType) ? "char" : "other";
      }
      return "other";
    };

    const paramClassForArgIndex = (
      entry: SignatureEntry,
      argIndex: number
    ): ParamClass => {
      const params = entry.parameters;
      const direct = params[argIndex];
      if (direct) return classifyParamTypeNode(direct.typeNode);

      // Rest parameter: map extra args to last param if it is rest.
      const last = params[params.length - 1];
      if (last && last.isRest) return classifyParamTypeNode(last.typeNode);
      return "other";
    };

    const args = node.arguments;
    const wantsStringAt: number[] = [];
    const wantsCharAt: number[] = [];

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (!arg) continue;
      if (ts.isSpreadElement(arg)) continue;

      if (isCharishArgument(arg)) {
        wantsCharAt.push(i);
      } else if (prefersStringOverChar(arg)) {
        wantsStringAt.push(i);
      }
    }

    if (wantsStringAt.length === 0 && wantsCharAt.length === 0) return resolvedId;

    const scoreSignature = (sigId: SignatureId): number => {
      const entry = signatureMap.get(sigId.id);
      if (!entry) return 0;

      let score = 0;
      for (const i of wantsStringAt) {
        const pc = paramClassForArgIndex(entry, i);
        if (pc === "string") score += 2;
        if (pc === "char") score -= 2;
      }
      for (const i of wantsCharAt) {
        const pc = paramClassForArgIndex(entry, i);
        if (pc === "char") score += 2;
        if (pc === "string") score -= 2;
      }
      return score;
    };

    const resolvedScore = scoreSignature(resolvedId);
    let bestId = resolvedId;
    let bestScore = resolvedScore;

    for (const candidate of candidates) {
      const s = scoreSignature(candidate);
      if (s > bestScore) {
        bestScore = s;
        bestId = candidate;
      }
    }

    return bestId;
  };

  const resolveCallSignatureCandidates = (
    node: ts.CallExpression
  ): readonly SignatureId[] | undefined => {
    const expr = node.expression;
    const symbol = (() => {
      if (ts.isIdentifier(expr)) return checker.getSymbolAtLocation(expr);
      if (ts.isPropertyAccessExpression(expr)) {
        return checker.getSymbolAtLocation(expr.name);
      }
      return undefined;
    })();
    if (!symbol) return undefined;

    const resolvedSymbol =
      symbol.flags & ts.SymbolFlags.Alias
        ? checker.getAliasedSymbol(symbol)
        : symbol;

    const decls = resolvedSymbol.getDeclarations();
    if (!decls || decls.length === 0) return undefined;

    const argCount = node.arguments.length;
    const candidates: SignatureId[] = [];

    for (const decl of decls) {
      if (!ts.isFunctionLike(decl)) continue;
      // Exclude construct signatures / constructors for call expressions.
      if (ts.isConstructSignatureDeclaration(decl) || ts.isConstructorDeclaration(decl)) {
        continue;
      }

      // Arity filtering (optional/rest aware)
      const params = extractParameterNodes(decl);
      const required = params.filter((p) => !p.isOptional && !p.isRest).length;
      const hasRest = params.some((p) => p.isRest);
      if (argCount < required) continue;
      if (!hasRest && argCount > params.length) continue;

      const sig = checker.getSignatureFromDeclaration(decl);
      if (!sig) continue;
      candidates.push(getOrCreateSignatureId(sig));
    }

    return candidates.length > 0 ? candidates : undefined;
  };

  const resolveConstructorSignature = (
    node: ts.NewExpression
  ): SignatureId | undefined => {
    const signature = checker.getResolvedSignature(node);
    if (!signature) return undefined;

    const sigId = getOrCreateSignatureId(signature);

    // For implicit default constructors, TypeScript may return a signature with no declaration.
    // We still need a SignatureEntry that identifies the constructed type so TypeSystem can
    // synthesize the constructor return type deterministically.
    const entry = signatureMap.get(sigId.id);
    if (entry && !entry.decl) {
      const expr = node.expression;

      const symbol = (() => {
        if (ts.isIdentifier(expr)) return checker.getSymbolAtLocation(expr);
        if (ts.isPropertyAccessExpression(expr)) {
          return checker.getSymbolAtLocation(expr.name);
        }
        return undefined;
      })();

      const resolvedSymbol =
        symbol && symbol.flags & ts.SymbolFlags.Alias
          ? checker.getAliasedSymbol(symbol)
          : symbol;

      const decl = resolvedSymbol?.getDeclarations()?.[0];

      const declaringTypeTsName = (() => {
        if (decl && ts.isClassDeclaration(decl) && decl.name) return decl.name.text;
        if (resolvedSymbol) return resolvedSymbol.getName();
        if (ts.isIdentifier(expr)) return expr.text;
        if (ts.isPropertyAccessExpression(expr)) return expr.name.text;
        return undefined;
      })();

      if (declaringTypeTsName) {
        signatureMap.set(sigId.id, {
          ...entry,
          declaringTypeTsName,
          declaringMemberName: "constructor",
          typeParameters:
            decl && ts.isClassDeclaration(decl)
              ? convertTypeParameterDeclarations(decl.typeParameters)
              : undefined,
        });
      }
    }

    return sigId;
  };

  const resolveConstructorSignatureCandidates = (
    node: ts.NewExpression
  ): readonly SignatureId[] | undefined => {
    const expr = node.expression;
    const symbol = (() => {
      if (ts.isIdentifier(expr)) return checker.getSymbolAtLocation(expr);
      if (ts.isPropertyAccessExpression(expr)) {
        return checker.getSymbolAtLocation(expr.name);
      }
      return undefined;
    })();
    if (!symbol) return undefined;

    const resolvedSymbol =
      symbol.flags & ts.SymbolFlags.Alias
        ? checker.getAliasedSymbol(symbol)
        : symbol;

    const decls = resolvedSymbol.getDeclarations();
    if (!decls || decls.length === 0) return undefined;

    const argCount = node.arguments?.length ?? 0;
    const candidates: SignatureId[] = [];

    for (const decl of decls) {
      if (!ts.isFunctionLike(decl)) continue;
      // Only include construct signatures / constructors for new expressions.
      if (!ts.isConstructSignatureDeclaration(decl) && !ts.isConstructorDeclaration(decl)) {
        continue;
      }

      const params = extractParameterNodes(decl);
      const required = params.filter((p) => !p.isOptional && !p.isRest).length;
      const hasRest = params.some((p) => p.isRest);
      if (argCount < required) continue;
      if (!hasRest && argCount > params.length) continue;

      const sig = checker.getSignatureFromDeclaration(decl);
      if (!sig) continue;
      candidates.push(getOrCreateSignatureId(sig));
    }

    return candidates.length > 0 ? candidates : undefined;
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

  const getDeclaringTypeNameOfMember = (member: MemberId): string | undefined => {
    const key = `${member.declId.id}:${member.name}`;
    const entry = memberMap.get(key);
    const decl = entry?.decl;
    if (!decl) return undefined;

    const parent = decl.parent;
    if (ts.isInterfaceDeclaration(parent) && parent.name) return parent.name.text;
    if (ts.isClassDeclaration(parent) && parent.name) return parent.name.text;
    if (ts.isTypeAliasDeclaration(parent) && parent.name) return parent.name.text;
    return undefined;
  };

  const getSourceFilePathOfMember = (member: MemberId): string | undefined => {
    const key = `${member.declId.id}:${member.name}`;
    const entry = memberMap.get(key);
    const decl = entry?.decl;
    if (!decl) return undefined;
    return decl.getSourceFile().fileName;
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
        typeDeclNode: entry.typeDeclNode,
        valueDeclNode: entry.valueDeclNode,
        classMemberNames: entry.classMemberNames,
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
        // Uses simple TS name, resolved via UnifiedTypeCatalog.resolveTsName()
        declaringTypeTsName: entry.declaringTypeTsName,
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
        declNode: entry.decl,
        typeNode: entry.typeNode,
        isOptional: entry.isOptional,
        isReadonly: entry.isReadonly,
      };
    },

    getTypeSyntax: (id: TypeSyntaxId): TypeSyntaxInfo | undefined => {
      const entry = typeSyntaxMap.get(id.id);
      if (!entry) return undefined;
      return {
        typeNode: entry.typeNode,
      };
    },
  };

  // ─────────────────────────────────────────────────────────────────────────
  // TYPE SYNTAX CAPTURE (Phase 2: TypeSyntaxId)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Capture a type syntax node for later conversion.
   *
   * This creates an opaque TypeSyntaxId handle that can be passed to
   * TypeSystem.typeFromSyntax() for conversion. Used for inline type syntax
   * that cannot be captured at catalog-build time.
   */
  const captureTypeSyntax = (node: ts.TypeNode): TypeSyntaxId => {
    const id = makeTypeSyntaxId(nextTypeSyntaxId.value++);
    typeSyntaxMap.set(id.id, { typeNode: node });
    return id;
  };

  /**
   * Capture multiple type arguments.
   *
   * Convenience method for capturing generic type arguments.
   */
  const captureTypeArgs = (
    nodes: readonly ts.TypeNode[]
  ): readonly TypeSyntaxId[] => {
    return nodes.map((node) => captureTypeSyntax(node));
  };

  return {
    resolveIdentifier,
    resolveTypeReference,
    resolvePropertyAccess,
    resolveElementAccess,
    resolveCallSignature,
    resolveCallSignatureCandidates,
    resolveConstructorSignature,
    resolveConstructorSignatureCandidates,
    resolveImport,
    resolveShorthandAssignment,
    getDeclaringTypeNameOfMember,
    getSourceFilePathOfMember,
    getFullyQualifiedName,
    getTypePredicateOfSignature,
    // Type syntax capture (Phase 2: TypeSyntaxId)
    captureTypeSyntax,
    captureTypeArgs,
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
  readonly typeDeclNode?: ts.Declaration;
  readonly valueDeclNode?: ts.Declaration;
  readonly typeNode?: ts.TypeNode;
  readonly kind: DeclKind;
  readonly fqName?: string;
  readonly classMemberNames?: ClassMemberNames;
}

interface SignatureEntry {
  readonly signature: ts.Signature;
  readonly decl?: ts.SignatureDeclaration;
  readonly parameters: readonly ParameterNode[];
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

interface MemberEntry {
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
interface TypeSyntaxEntry {
  readonly typeNode: ts.TypeNode;
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

const getMemberTypeAnnotation = (
  decl: ts.Declaration
): ts.TypeNode | undefined => {
  if (ts.isPropertyDeclaration(decl) || ts.isPropertySignature(decl)) {
    return decl.type;
  }
  if (ts.isMethodDeclaration(decl) || ts.isMethodSignature(decl)) {
    // For methods, we could return a function type node if needed
    return decl.type;
  }
  if (ts.isGetAccessorDeclaration(decl)) {
    return decl.type;
  }
  if (ts.isSetAccessorDeclaration(decl)) {
    // Setter declarations have no return type; use the value parameter type.
    const valueParam = decl.parameters[0];
    return valueParam?.type;
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
  if (ts.isGetAccessorDeclaration(decl) || ts.isSetAccessorDeclaration(decl))
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

  // Mirror IR conversion rules: wrappers may be nested and may appear in any order.
  // - thisarg<T> marks an extension-method receiver parameter (erases for typing)
  // - ref<T>/out<T>/in<T>/inref<T> set passing mode and erase to T for typing
  let mode: ParameterMode = "value";
  let current: ts.TypeNode | undefined = typeNode;

  while (current) {
    if (ts.isParenthesizedTypeNode(current)) {
      current = current.type;
      continue;
    }

    if (!ts.isTypeReferenceNode(current)) break;
    if (!ts.isIdentifier(current.typeName)) break;
    if (!current.typeArguments || current.typeArguments.length !== 1) break;
    const inner: ts.TypeNode | undefined = current.typeArguments[0];
    if (!inner) break;

    const wrapperName = current.typeName.text;
    if (wrapperName === "thisarg") {
      current = inner;
      continue;
    }

    if (wrapperName === "ref" || wrapperName === "out") {
      mode = wrapperName;
      current = inner;
      continue;
    }

    if (wrapperName === "in" || wrapperName === "inref") {
      mode = "in";
      current = inner;
      continue;
    }

    break;
  }

  // No wrapper detected - regular parameter
  return { mode, typeNode: current ?? typeNode };
};

const convertTypeParameterDeclarations = (
  typeParameters: readonly ts.TypeParameterDeclaration[] | undefined
): readonly TypeParameterNode[] | undefined => {
  if (!typeParameters || typeParameters.length === 0) return undefined;
  return typeParameters.map((tp) => ({
    name: tp.name.text,
    constraintNode: tp.constraint,
    defaultNode: tp.default,
  }));
};

const extractTypeParameterNodes = (
  decl: ts.SignatureDeclaration | undefined
): readonly TypeParameterNode[] | undefined => {
  if (!decl) return undefined;

  // Constructor declarations don't have their own type parameters in TS syntax,
  // but the enclosing class may be generic (class Box<T> { constructor(x: T) {} }).
  // For constructor signature typing/inference, the relevant type parameters are the
  // class type parameters.
  if (ts.isConstructorDeclaration(decl)) {
    const parent = decl.parent;
    if (ts.isClassDeclaration(parent)) {
      return convertTypeParameterDeclarations(parent.typeParameters);
    }
    return undefined;
  }

  return convertTypeParameterDeclarations(decl.typeParameters);
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
 * DESIGN (Phase 5 Step 4): Store the declaring type as a **simple TS name**
 * (identifier text like "Box"), NOT a TS "fully qualified name". TypeSystem
 * uses UnifiedTypeCatalog.resolveTsName() to resolve this to the proper
 * CLR FQ name for inheritance substitution.
 *
 * @param decl The signature declaration (method, function, etc.)
 * @param _checker TypeChecker (kept for backwards compatibility, unused)
 * @returns { typeTsName, memberName } or undefined if not a member
 */
const extractDeclaringIdentity = (
  decl: ts.SignatureDeclaration | undefined,
  _checker: ts.TypeChecker
): { typeTsName: string; memberName: string } | undefined => {
  if (!decl) return undefined;

  const normalizeTsbindgenTypeName = (name: string): string => {
    if (name.endsWith("$instance")) {
      return name.slice(0, -"$instance".length);
    }
    if (name.startsWith("__") && name.endsWith("$views")) {
      return name.slice(2, -"$views".length);
    }
    return name;
  };

  // Check if this is a method (class or interface member)
  if (ts.isMethodDeclaration(decl) || ts.isMethodSignature(decl)) {
    const parent = decl.parent;

    // Get the method name
    const memberName = ts.isIdentifier(decl.name)
      ? decl.name.text
      : (decl.name?.getText() ?? "unknown");

    // Get the containing type's simple name (identifier text)
    if (ts.isClassDeclaration(parent) || ts.isInterfaceDeclaration(parent)) {
      if (parent.name) {
        // Use the simple identifier text, not checker.getFullyQualifiedName
        const typeTsName = normalizeTsbindgenTypeName(parent.name.text);
        return { typeTsName, memberName };
      }
    }

    // tsbindgen static containers are commonly emitted as:
    //   export const Foo: { bar(...): ... }
    //
    // In this case, method signatures live under a TypeLiteralNode whose parent is
    // the variable declaration for `Foo`. We still need declaring identity so
    // TypeSystem can apply airplane-grade overload correction using CLR metadata.
    if (ts.isTypeLiteralNode(parent)) {
      const container = parent.parent;
      if (ts.isVariableDeclaration(container) && ts.isIdentifier(container.name)) {
        const typeTsName = normalizeTsbindgenTypeName(container.name.text);
        return { typeTsName, memberName };
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
      // Use the simple identifier text
      const typeTsName = normalizeTsbindgenTypeName(parent.name.text);
      return { typeTsName, memberName: "constructor" };
    }
  }

  // Getter/setter declarations
  if (ts.isGetAccessorDeclaration(decl) || ts.isSetAccessorDeclaration(decl)) {
    const parent = decl.parent;
    const memberName = ts.isIdentifier(decl.name)
      ? decl.name.text
      : (decl.name?.getText() ?? "unknown");

    if (ts.isClassDeclaration(parent) || ts.isInterfaceDeclaration(parent)) {
      if (parent.name) {
        // Use the simple identifier text
        const typeTsName = normalizeTsbindgenTypeName(parent.name.text);
        return { typeTsName, memberName };
      }
    }
  }

  // Standalone functions don't have a declaring type
  return undefined;
};

/**
 * Extract class member names from a ClassDeclaration.
 *
 * ALICE'S SPEC: This is PURE SYNTAX inspection at registration time.
 * We iterate class members and collect method/property names.
 * This data is used by TypeSystem.checkTsClassMemberOverride without
 * needing to inspect TS AST nodes or use hardcoded SyntaxKind numbers.
 *
 * @param classDecl The class declaration node
 * @returns ClassMemberNames with method and property name sets
 */
const extractClassMemberNames = (
  classDecl: ts.ClassDeclaration
): ClassMemberNames => {
  const methods = new Set<string>();
  const properties = new Set<string>();

  for (const member of classDecl.members) {
    // Get member name if it has an identifier
    const name = ts.isMethodDeclaration(member)
      ? ts.isIdentifier(member.name)
        ? member.name.text
        : undefined
      : ts.isPropertyDeclaration(member)
        ? ts.isIdentifier(member.name)
          ? member.name.text
          : undefined
        : ts.isGetAccessorDeclaration(member) ||
            ts.isSetAccessorDeclaration(member)
          ? ts.isIdentifier(member.name)
            ? member.name.text
            : undefined
          : undefined;

    if (!name) continue;

    if (ts.isMethodDeclaration(member)) {
      methods.add(name);
    } else if (ts.isPropertyDeclaration(member)) {
      properties.add(name);
    } else if (
      ts.isGetAccessorDeclaration(member) ||
      ts.isSetAccessorDeclaration(member)
    ) {
      // Accessors are treated as properties for override detection
      properties.add(name);
    }
  }

  return { methods, properties };
};
