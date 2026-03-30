/**
 * Binding Layer — Registry Management & Simple Resolution
 *
 * Contains the BindingContext type, registry creation, and simple resolution
 * methods (identifiers, type references, property access, element access).
 * Complex call/constructor resolution lives in binding-call-resolution.ts.
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
  normalizeCapturedDeclaringTypeName,
  extractClassMemberNames,
  isOptionalMember,
  isReadonlyMember,
} from "./binding-helpers.js";
import { tryResolveDeterministicPropertyName } from "../syntax/property-names.js";

// ═══════════════════════════════════════════════════════════════════════════
// BINDING CONTEXT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Shared mutable context for the binding factory closure.
 *
 * This holds the internal registries, counters, and caches that are shared
 * across all binding resolution methods. Created once by createBindingContext()
 * and threaded through all sub-module functions.
 */
export type BindingContext = {
  readonly checker: ts.TypeChecker;
  readonly declMap: Map<number, DeclEntry>;
  readonly signatureMap: Map<number, SignatureEntry>;
  readonly memberMap: Map<string, MemberEntry>;
  readonly typeSyntaxMap: Map<number, TypeSyntaxEntry>;
  readonly nextDeclId: { value: number };
  readonly nextSignatureId: { value: number };
  readonly nextTypeSyntaxId: { value: number };
  readonly symbolToDeclId: Map<ts.Symbol, DeclId>;
  readonly signatureToId: Map<ts.Signature, SignatureId>;
};

/**
 * Create a fresh BindingContext for a TypeScript program.
 */
export const createBindingContext = (
  checker: ts.TypeChecker
): BindingContext => ({
  checker,
  declMap: new Map<number, DeclEntry>(),
  signatureMap: new Map<number, SignatureEntry>(),
  memberMap: new Map<string, MemberEntry>(),
  typeSyntaxMap: new Map<number, TypeSyntaxEntry>(),
  nextDeclId: { value: 0 },
  nextSignatureId: { value: 0 },
  nextTypeSyntaxId: { value: 0 },
  symbolToDeclId: new Map<ts.Symbol, DeclId>(),
  signatureToId: new Map<ts.Signature, SignatureId>(),
});

// ═══════════════════════════════════════════════════════════════════════════
// INTERNAL HELPERS
// ═══════════════════════════════════════════════════════════════════════════

export const isSyntheticBindingMarkerName = (name: string): boolean =>
  name.startsWith("__tsonic_type_") ||
  name.startsWith("__tsonic_binding_alias_");

export const getStaticPropertyName = (
  name: ts.PropertyName
): string | undefined => tryResolveDeterministicPropertyName(name);

export const getBindingAliasFromDeclaration = (
  decl: ts.InterfaceDeclaration | ts.ClassDeclaration | ts.TypeAliasDeclaration
): string | undefined => {
  const members = ts.isTypeAliasDeclaration(decl)
    ? ts.isTypeLiteralNode(decl.type)
      ? decl.type.members
      : undefined
    : decl.members;
  if (!members) return undefined;

  for (const member of members) {
    if (
      !ts.isPropertySignature(member) &&
      !ts.isPropertyDeclaration(member) &&
      !ts.isGetAccessorDeclaration(member) &&
      !ts.isSetAccessorDeclaration(member)
    ) {
      continue;
    }
    if (!member.name) continue;
    const name = getStaticPropertyName(member.name);
    if (!name || !name.startsWith("__tsonic_binding_alias_")) continue;
    return name.slice("__tsonic_binding_alias_".length) || undefined;
  }

  return undefined;
};

// ═══════════════════════════════════════════════════════════════════════════
// REGISTRY CREATION (getOrCreate*)
// ═══════════════════════════════════════════════════════════════════════════

export const getOrCreateDeclId = (
  ctx: BindingContext,
  symbol: ts.Symbol
): DeclId => {
  const existing = ctx.symbolToDeclId.get(symbol);
  if (existing) return existing;

  const id = makeDeclId(ctx.nextDeclId.value++);
  ctx.symbolToDeclId.set(symbol, id);

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
    fqName:
      typeDecl &&
      (ts.isTypeAliasDeclaration(typeDecl) ||
        ts.isInterfaceDeclaration(typeDecl) ||
        ts.isClassDeclaration(typeDecl))
        ? (getBindingAliasFromDeclaration(typeDecl) ?? symbol.getName())
        : symbol.getName(),
    classMemberNames,
  };
  ctx.declMap.set(id.id, entry);

  return id;
};

const resolveDeclarationSymbolFQName = (
  ctx: BindingContext,
  symbol: ts.Symbol | undefined
): string | undefined => {
  if (!symbol) {
    return undefined;
  }

  const resolved = resolveTransparentAliases(ctx, symbol);
  const declId = getOrCreateDeclId(ctx, resolved);
  return ctx.declMap.get(declId.id)?.fqName;
};

export const resolveCanonicalDeclaringTypeName = (
  ctx: BindingContext,
  decl: ts.SignatureDeclaration | undefined
): string | undefined => {
  if (!decl) {
    return undefined;
  }

  if (
    ts.isMethodDeclaration(decl) ||
    ts.isMethodSignature(decl) ||
    ts.isConstructorDeclaration(decl) ||
    ts.isGetAccessorDeclaration(decl) ||
    ts.isSetAccessorDeclaration(decl)
  ) {
    const parent = decl.parent;

    if (
      (ts.isClassDeclaration(parent) ||
        ts.isInterfaceDeclaration(parent) ||
        ts.isTypeAliasDeclaration(parent)) &&
      parent.name
    ) {
      const resolvedName =
        resolveDeclarationSymbolFQName(
          ctx,
          ctx.checker.getSymbolAtLocation(parent.name)
        ) ?? parent.name.text;
      return normalizeCapturedDeclaringTypeName(resolvedName);
    }

    if (ts.isTypeLiteralNode(parent)) {
      const container = parent.parent;
      if (ts.isVariableDeclaration(container) && ts.isIdentifier(container.name)) {
        const resolvedName =
          resolveDeclarationSymbolFQName(
            ctx,
            ctx.checker.getSymbolAtLocation(container.name)
          ) ?? container.name.text;
        return normalizeCapturedDeclaringTypeName(resolvedName);
      }
    }
  }

  return undefined;
};

export const getOrCreateSignatureId = (
  ctx: BindingContext,
  signature: ts.Signature
): SignatureId => {
  const existing = ctx.signatureToId.get(signature);
  if (existing) return existing;

  const id = makeSignatureId(ctx.nextSignatureId.value++);
  ctx.signatureToId.set(signature, id);

  // Extract signature info from declaration
  const decl = signature.getDeclaration();

  // Extract declaring identity (CRITICAL for Alice's spec: resolveCall needs this)
  const declaringIdentity = extractDeclaringIdentity(decl);
  const declaringTypeParameterNames = (() => {
    if (!decl) return undefined;
    const parent = decl.parent;
    if (
      (ts.isInterfaceDeclaration(parent) || ts.isClassDeclaration(parent)) &&
      parent.typeParameters &&
      parent.typeParameters.length > 0
    ) {
      return parent.typeParameters.map((tp) => tp.name.text);
    }
    return undefined;
  })();

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
    declaringTypeTsName:
      resolveCanonicalDeclaringTypeName(ctx, decl) ??
      declaringIdentity?.typeTsName,
    declaringTypeParameterNames,
    declaringMemberName: declaringIdentity?.memberName,
    typePredicate,
  };
  ctx.signatureMap.set(id.id, entry);

  return id;
};

export const getOrCreateMemberId = (
  ctx: BindingContext,
  ownerDeclId: DeclId,
  memberName: string,
  memberSymbol: ts.Symbol
): MemberId => {
  const key = `${ownerDeclId.id}:${memberName}`;
  const existing = ctx.memberMap.get(key);
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
  ctx.memberMap.set(key, entry);

  return id;
};

// ═══════════════════════════════════════════════════════════════════════════
// SIMPLE RESOLUTION
// ═══════════════════════════════════════════════════════════════════════════

export const resolveTransparentAliases = (
  ctx: BindingContext,
  input: ts.Symbol
): ts.Symbol => {
  const seen = new Set<ts.Symbol>();
  let current = input;

  while (!seen.has(current)) {
    seen.add(current);

    const aliased =
      current.flags & ts.SymbolFlags.Alias
        ? ctx.checker.getAliasedSymbol(current)
        : current;
    if (aliased !== current) {
      current = aliased;
      continue;
    }

    const decls = current.getDeclarations() ?? [];
    const exportSpecifier =
      decls.length === 1 && decls[0] && ts.isExportSpecifier(decls[0])
        ? decls[0]
        : undefined;
    if (!exportSpecifier || exportSpecifier.isTypeOnly) {
      break;
    }

    const targetSymbol =
      ctx.checker.getExportSpecifierLocalTargetSymbol(exportSpecifier);
    if (!targetSymbol || targetSymbol === current) {
      break;
    }

    current = targetSymbol;
  }

  return current;
};

const resolveTransparentTypeQueryTarget = (
  ctx: BindingContext,
  symbol: ts.Symbol
): ts.Symbol | undefined => {
  const declarations = symbol.getDeclarations() ?? [];

  for (const declaration of declarations) {
    const typeNode = getTypeNodeFromDeclaration(declaration);
    if (!typeNode) {
      continue;
    }

    const targetSymbol = (() => {
      if (ts.isTypeQueryNode(typeNode)) {
        return ctx.checker.getSymbolAtLocation(typeNode.exprName);
      }

      if (ts.isImportTypeNode(typeNode) && typeNode.isTypeOf && typeNode.qualifier) {
        return ctx.checker.getSymbolAtLocation(typeNode.qualifier);
      }

      return undefined;
    })();
    if (!targetSymbol) {
      continue;
    }

    const resolvedTarget = resolveTransparentAliases(ctx, targetSymbol);
    if (resolvedTarget !== symbol) {
      return resolvedTarget;
    }
  }

  return undefined;
};

export const resolveIdentifier = (
  ctx: BindingContext,
  node: ts.Identifier
): DeclId | undefined => {
  const symbol = ctx.checker.getSymbolAtLocation(node);
  if (!symbol) return undefined;

  return getOrCreateDeclId(ctx, resolveTransparentAliases(ctx, symbol));
};

export const resolveTypeReference = (
  ctx: BindingContext,
  node: ts.TypeReferenceNode
): DeclId | undefined => {
  const resolveTransparentTypeAliases = (input: ts.Symbol): ts.Symbol => {
    const seen = new Set<ts.Symbol>();
    let current = input;

    while (!seen.has(current)) {
      seen.add(current);

      const aliased =
        current.flags & ts.SymbolFlags.Alias
          ? ctx.checker.getAliasedSymbol(current)
          : current;
      if (aliased !== current) {
        const aliasedDecls = aliased.getDeclarations() ?? [];
        if (aliasedDecls.length === 0) {
          break;
        }

        current = aliased;
        continue;
      }

      const decls = current.getDeclarations() ?? [];
      const exportSpecifier =
        decls.length === 1 && decls[0] && ts.isExportSpecifier(decls[0])
          ? decls[0]
          : undefined;
      if (exportSpecifier && !exportSpecifier.isTypeOnly) {
        const targetSymbol =
          ctx.checker.getExportSpecifierLocalTargetSymbol(exportSpecifier);
        if (targetSymbol && targetSymbol !== current) {
          current = targetSymbol;
          continue;
        }
      }

      const transparentTypeQueryTarget = resolveTransparentTypeQueryTarget(
        ctx,
        current
      );
      if (!transparentTypeQueryTarget || transparentTypeQueryTarget === current) {
        break;
      }

      current = transparentTypeQueryTarget;
    }

    return current;
  };

  const resolveEntityNameSymbol = (
    typeName: ts.EntityName
  ): ts.Symbol | undefined => {
    const symbol = ts.isIdentifier(typeName)
      ? ctx.checker.getSymbolAtLocation(typeName)
      : ctx.checker.getSymbolAtLocation(typeName.right);
    if (!symbol) return undefined;

    return resolveTransparentTypeAliases(symbol);
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

  return getOrCreateDeclId(ctx, symbol);
};

export const resolvePropertyAccess = (
  ctx: BindingContext,
  node: ts.PropertyAccessExpression
): MemberId | undefined => {
  const rawPropSymbol = ctx.checker.getSymbolAtLocation(node.name);
  if (!rawPropSymbol) return undefined;

  const propSymbol =
    rawPropSymbol.flags & ts.SymbolFlags.Alias
      ? ctx.checker.getAliasedSymbol(rawPropSymbol)
      : rawPropSymbol;

  // Get owner type's declaration
  const rawOwnerSymbol = ctx.checker.getSymbolAtLocation(node.expression);

  // Note: `getSymbolAtLocation(node.expression)` can be undefined for receivers
  // that are not identifiers/member-accesses (e.g., `xs.where(...).select`).
  // In that case we still want a stable MemberId for the member symbol itself,
  // so we key the member entry off the member symbol's own DeclId.
  const ownerSymbol = rawOwnerSymbol
    ? rawOwnerSymbol.flags & ts.SymbolFlags.Alias
      ? ctx.checker.getAliasedSymbol(rawOwnerSymbol)
      : rawOwnerSymbol
    : undefined;

  const ownerDeclId = getOrCreateDeclId(ctx, ownerSymbol ?? propSymbol);
  return getOrCreateMemberId(ctx, ownerDeclId, node.name.text, propSymbol);
};

export const resolveElementAccess = (
  _node: ts.ElementAccessExpression
): MemberId | undefined => {
  // Element access member resolution requires type-level analysis
  // Return undefined (member not resolved via handles)
  return undefined;
};
