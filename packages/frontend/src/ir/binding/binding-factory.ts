/**
 * Binding Layer — Factory Function
 *
 * Contains the createBinding() factory which creates a BindingInternal instance.
 * The factory uses a closure pattern with internal registries mapping handles
 * to underlying TypeScript objects.
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
import type {
  HandleRegistry,
  DeclInfo,
  SignatureInfo,
  MemberInfo,
  TypeSyntaxInfo,
} from "../type-system/internal/handle-types.js";
import type { BindingInternal, TypePredicateInfo } from "./binding-types.js";
import type {
  DeclEntry,
  SignatureEntry,
  MemberEntry,
  TypeSyntaxEntry,
} from "./binding-types.js";
import {
  getTypeNodeFromDeclaration,
  getMemberTypeAnnotation,
  getDeclKind,
  getReturnTypeNode,
  extractThisParameterTypeNode,
  extractParameterNodes,
  extractTypeParameterNodes,
  extractTypePredicate,
  extractDeclaringIdentity,
  extractClassMemberNames,
  isOptionalMember,
  isReadonlyMember,
  convertTypeParameterDeclarations,
} from "./binding-helpers.js";

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
      thisTypeNode: extractThisParameterTypeNode(decl),
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
    const resolveEntityNameSymbol = (
      typeName: ts.EntityName
    ): ts.Symbol | undefined => {
      const symbol = ts.isIdentifier(typeName)
        ? checker.getSymbolAtLocation(typeName)
        : checker.getSymbolAtLocation(typeName.right);
      if (!symbol) return undefined;

      return symbol.flags & ts.SymbolFlags.Alias
        ? checker.getAliasedSymbol(symbol)
        : symbol;
    };

    let symbol = resolveEntityNameSymbol(node.typeName);
    if (!symbol) return undefined;

    // Follow type aliases that are pure renames to another type reference:
    //   type Foo<T> = Bar<T>
    //
    // This is required for tsbindgen facades, where ergonomic types are often
    // exported as aliases to arity-qualified internal CLR types.
    //
    // DETERMINISTIC: AST inspection only (no ts.Type queries).
    const seen = new Set<ts.Symbol>();
    while (!seen.has(symbol)) {
      seen.add(symbol);

      const decls = symbol.getDeclarations() ?? [];
      const typeAliasDecl = decls.find(ts.isTypeAliasDeclaration);
      if (!typeAliasDecl) break;

      const aliasedType = typeAliasDecl.type;
      if (!ts.isTypeReferenceNode(aliasedType)) break;

      // Only follow aliases that forward type parameters 1:1.
      //
      // SAFE EXAMPLES:
      //   type Foo<T> = Bar<T>
      //   type Foo<T1, T2> = Bar<T1, T2>
      //   type Foo = Bar
      //
      // UNSAFE (requires substitution / rewrapping, so we must NOT follow):
      //   type Foo<T> = Bar<Baz<T>>
      //   type Foo<T, U> = Bar<U, T>              // reorders args
      //   type Foo = Bar<string>                  // applies args
      const aliasTypeParams = typeAliasDecl.typeParameters ?? [];
      const rhsArgs = aliasedType.typeArguments ?? [];

      if (aliasTypeParams.length === 0) {
        if (rhsArgs.length > 0) break;
      } else {
        if (rhsArgs.length !== aliasTypeParams.length) break;

        let forwardsIdentity = true;
        for (let i = 0; i < aliasTypeParams.length; i++) {
          const p = aliasTypeParams[i];
          const a = rhsArgs[i];
          if (!p || !a) {
            forwardsIdentity = false;
            break;
          }

          if (!ts.isTypeReferenceNode(a) || !ts.isIdentifier(a.typeName)) {
            forwardsIdentity = false;
            break;
          }
          if (a.typeArguments && a.typeArguments.length > 0) {
            forwardsIdentity = false;
            break;
          }
          if (a.typeName.text !== p.name.text) {
            forwardsIdentity = false;
            break;
          }
        }

        if (!forwardsIdentity) break;
      }

      const next = resolveEntityNameSymbol(aliasedType.typeName);
      if (!next) break;

      symbol = next;
    }

    return getOrCreateDeclId(symbol);
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
          if (
            init &&
            (ts.isArrowFunction(init) || ts.isFunctionExpression(init))
          ) {
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
          sym.flags & ts.SymbolFlags.Alias
            ? checker.getAliasedSymbol(sym)
            : sym;
        const decls = resolvedSym.getDeclarations() ?? [];
        for (const decl of decls) {
          const typeNode = getTypeNodeFromDeclaration(decl);
          if (typeNode && isCharTypeNode(typeNode)) return true;
        }
      }

      return false;
    };

    const stringType = checker.getStringType();

    const prefersStringOverChar = (arg: ts.Expression): boolean => {
      const expr = stripParens(arg);
      if (isCharishArgument(expr)) return false;

      // In TS, `char` is erased to `string`, so we must prefer `string` overloads
      // for *any* string-typed argument unless the user explicitly marks it as char.
      //
      // This keeps common code like `Console.WriteLine(condition ? "OK" : "BAD")`
      // from accidentally binding to `WriteLine(char)` (due to declaration order).
      const t = checker.getTypeAtLocation(expr);
      return checker.isTypeAssignableTo(t, stringType);
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

    if (wantsStringAt.length === 0 && wantsCharAt.length === 0)
      return resolvedId;

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
      if (
        ts.isConstructSignatureDeclaration(decl) ||
        ts.isConstructorDeclaration(decl)
      ) {
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
        if (decl && ts.isClassDeclaration(decl) && decl.name)
          return decl.name.text;
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
      if (
        !ts.isConstructSignatureDeclaration(decl) &&
        !ts.isConstructorDeclaration(decl)
      ) {
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

  const getDeclaringTypeNameOfMember = (
    member: MemberId
  ): string | undefined => {
    const key = `${member.declId.id}:${member.name}`;
    const entry = memberMap.get(key);
    const decl = entry?.decl;
    if (!decl) return undefined;

    const parent = decl.parent;
    if (ts.isInterfaceDeclaration(parent) && parent.name)
      return parent.name.text;
    if (ts.isClassDeclaration(parent) && parent.name) return parent.name.text;
    if (ts.isTypeAliasDeclaration(parent) && parent.name)
      return parent.name.text;

    // tsbindgen static containers can be emitted as:
    //   export const Foo: { bar(...): ... }
    //
    // In this case, member declarations live under a TypeLiteralNode whose parent
    // is the VariableDeclaration for `Foo`. We treat `Foo` as the declaring "type"
    // name for binding disambiguation purposes.
    if (ts.isTypeLiteralNode(parent)) {
      const container = parent.parent;
      if (
        ts.isVariableDeclaration(container) &&
        ts.isIdentifier(container.name)
      ) {
        return container.name.text;
      }
    }

    return undefined;
  };

  const getSourceFilePathOfMember = (member: MemberId): string | undefined => {
    const key = `${member.declId.id}:${member.name}`;
    const entry = memberMap.get(key);
    const decl = entry?.decl;
    if (!decl) return undefined;
    return decl.getSourceFile().fileName;
  };

  const getSourceFilePathOfDecl = (declId: DeclId): string | undefined => {
    const entry = declMap.get(declId.id);
    if (!entry) return undefined;
    const decl = entry.decl ?? entry.typeDeclNode ?? entry.valueDeclNode;
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

  const getThisTypeNodeOfSignature = (
    sigId: SignatureId
  ): ts.TypeNode | undefined => {
    const entry = signatureMap.get(sigId.id);
    return entry?.thisTypeNode;
  };

  const getDeclaringTypeNameOfSignature = (
    sigId: SignatureId
  ): string | undefined => {
    const entry = signatureMap.get(sigId.id);
    return entry?.declaringTypeTsName;
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
        thisTypeNode: entry.thisTypeNode,
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
    getSourceFilePathOfDecl,
    getFullyQualifiedName,
    getTypePredicateOfSignature,
    getThisTypeNodeOfSignature,
    getDeclaringTypeNameOfSignature,
    // Type syntax capture (Phase 2: TypeSyntaxId)
    captureTypeSyntax,
    captureTypeArgs,
    // Internal method for TypeSystem construction only
    _getHandleRegistry: () => handleRegistry,
  };
};
