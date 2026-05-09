/**
 * Binding Layer — Factory Function (Facade)
 *
 * Creates a BindingInternal instance by composing sub-modules:
 * - binding-registry.ts: Registry management and simple resolution
 * - binding-call-resolution.ts: Call/constructor signature resolution
 *
 * This module assembles the final BindingInternal object, the handle registry,
 * and the remaining simple accessor/capture methods.
 */

import ts from "typescript";
import {
  DeclId,
  SignatureId,
  MemberId,
  TypeSyntaxId,
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
import {
  createBindingContext,
  getOrCreateDeclId,
  resolveTransparentAliases,
  resolveIdentifier as resolveIdentifierImpl,
  resolveTypeReference as resolveTypeReferenceImpl,
  resolvePropertyAccess as resolvePropertyAccessImpl,
  resolveElementAccess as resolveElementAccessImpl,
  getBindingAliasFromDeclaration,
} from "./binding-registry.js";
import {
  resolveCallSignature as resolveCallSignatureImpl,
  resolveCallSignatureCandidates as resolveCallSignatureCandidatesImpl,
  resolveConstructorSignature as resolveConstructorSignatureImpl,
  resolveConstructorSignatureCandidates as resolveConstructorSignatureCandidatesImpl,
} from "./binding-call-resolution.js";

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
  const ctx = createBindingContext(checker);

  // ─────────────────────────────────────────────────────────────────────────
  // SIMPLE RESOLUTION METHODS (remaining methods not in sub-modules)
  // ─────────────────────────────────────────────────────────────────────────

  const resolveImport = (node: ts.ImportSpecifier): DeclId | undefined => {
    const symbol = checker.getSymbolAtLocation(node.name);
    if (!symbol) return undefined;

    return getOrCreateDeclId(ctx, resolveTransparentAliases(ctx, symbol));
  };

  const resolveShorthandAssignment = (
    node: ts.ShorthandPropertyAssignment
  ): DeclId | undefined => {
    const symbol = checker.getShorthandAssignmentValueSymbol(node);
    if (!symbol) return undefined;
    return getOrCreateDeclId(ctx, symbol);
  };

  const getDeclaringTypeNameOfMember = (
    member: MemberId
  ): string | undefined => {
    const key = `${member.declId.id}:${member.name}`;
    const entry = ctx.memberMap.get(key);
    const decl = entry?.decl;
    if (!decl) return undefined;

    const parent = decl.parent;
    if (ts.isInterfaceDeclaration(parent) && parent.name)
      return getBindingAliasFromDeclaration(parent) ?? parent.name.text;
    if (ts.isClassDeclaration(parent) && parent.name)
      return getBindingAliasFromDeclaration(parent) ?? parent.name.text;
    if (ts.isTypeAliasDeclaration(parent) && parent.name)
      return getBindingAliasFromDeclaration(parent) ?? parent.name.text;

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
    const entry = ctx.memberMap.get(key);
    const decl = entry?.decl;
    if (!decl) return undefined;
    return decl.getSourceFile().fileName;
  };

  const getSourceFilePathOfDecl = (declId: DeclId): string | undefined => {
    const entry = ctx.declMap.get(declId.id);
    if (!entry) return undefined;
    const decl = entry.decl ?? entry.typeDeclNode ?? entry.valueDeclNode;
    if (!decl) return undefined;
    return decl.getSourceFile().fileName;
  };

  const getFullyQualifiedName = (declId: DeclId): string | undefined => {
    const entry = ctx.declMap.get(declId.id);
    if (!entry) return undefined;
    return checker.getFullyQualifiedName(entry.symbol);
  };

  const getTypePredicateOfSignature = (
    sigId: SignatureId
  ): TypePredicateInfo | undefined => {
    const entry = ctx.signatureMap.get(sigId.id);
    if (!entry) return undefined;

    const predicate = checker.getTypePredicateOfSignature(entry.signature);
    if (!predicate || predicate.kind !== ts.TypePredicateKind.Identifier) {
      return undefined;
    }

    return {
      kind: "typePredicate",
      parameterIndex: predicate.parameterIndex ?? 0,
      typeNode:
        entry.typePredicate?.kind === "param"
          ? (entry.typePredicate.targetTypeNode as ts.TypeNode)
          : undefined,
    };
  };

  const getThisTypeNodeOfSignature = (
    sigId: SignatureId
  ): ts.TypeNode | undefined => {
    const entry = ctx.signatureMap.get(sigId.id);
    return entry?.thisTypeNode;
  };

  const getDeclaringTypeNameOfSignature = (
    sigId: SignatureId
  ): string | undefined => {
    const entry = ctx.signatureMap.get(sigId.id);
    return entry?.declaringTypeTsName;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // HANDLE REGISTRY IMPLEMENTATION
  // ─────────────────────────────────────────────────────────────────────────

  const handleRegistry: HandleRegistry = {
    getDecl: (id: DeclId): DeclInfo | undefined => {
      const entry = ctx.declMap.get(id.id);
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
      const entry = ctx.signatureMap.get(id.id);
      if (!entry) return undefined;
      return {
        parameters: entry.parameters,
        resolvedParameters: entry.resolvedParameters,
        thisTypeNode: entry.thisTypeNode,
        returnTypeNode: entry.returnTypeNode,
        typeParameters: entry.typeParameters,
        // Declaring identity lets resolveCall apply inheritance substitution.
        // Uses simple TS name, resolved via UnifiedTypeCatalog.resolveTsName().
        declaringTypeTsName: entry.declaringTypeTsName,
        declaringTypeParameterNames: entry.declaringTypeParameterNames,
        declaringMemberName: entry.declaringMemberName,
        // Type predicates are extracted at registration time.
        typePredicate: entry.typePredicate,
      };
    },

    getMember: (id: MemberId): MemberInfo | undefined => {
      const key = `${id.declId.id}:${id.name}`;
      const entry = ctx.memberMap.get(key);
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
      const entry = ctx.typeSyntaxMap.get(id.id);
      if (!entry) return undefined;
      return {
        typeNode: entry.typeNode,
      };
    },
  };

  // ─────────────────────────────────────────────────────────────────────────
  // TYPE SYNTAX CAPTURE
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Capture a type syntax node for later conversion.
   *
   * This creates an opaque TypeSyntaxId handle that can be passed to
   * TypeSystem.typeFromSyntax() for conversion. Used for inline type syntax
   * that cannot be captured at catalog-build time.
   */
  const captureTypeSyntax = (node: ts.TypeNode): TypeSyntaxId => {
    const id = makeTypeSyntaxId(ctx.nextTypeSyntaxId.value++);
    const referenceDeclId = ts.isTypeReferenceNode(node)
      ? resolveTypeReferenceImpl(ctx, node)
      : undefined;
    ctx.typeSyntaxMap.set(id.id, {
      typeNode: node,
      ...(referenceDeclId ? { referenceDeclId } : {}),
    });
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
    resolveIdentifier: (node) => resolveIdentifierImpl(ctx, node),
    resolveTypeReference: (node) => resolveTypeReferenceImpl(ctx, node),
    resolvePropertyAccess: (node) => resolvePropertyAccessImpl(ctx, node),
    resolveElementAccess: (node) => resolveElementAccessImpl(node),
    resolveCallSignature: (node) => resolveCallSignatureImpl(ctx, node),
    resolveCallSignatureCandidates: (node) =>
      resolveCallSignatureCandidatesImpl(ctx, node),
    resolveConstructorSignature: (node) =>
      resolveConstructorSignatureImpl(ctx, node),
    resolveConstructorSignatureCandidates: (node) =>
      resolveConstructorSignatureCandidatesImpl(ctx, node),
    resolveImport,
    resolveShorthandAssignment,
    getDeclaringTypeNameOfMember,
    getSourceFilePathOfMember,
    getSourceFilePathOfDecl,
    getFullyQualifiedName,
    getTypePredicateOfSignature,
    getThisTypeNodeOfSignature,
    getDeclaringTypeNameOfSignature,
    // Type syntax capture.
    captureTypeSyntax,
    captureTypeArgs,
    // Internal method for TypeSystem construction only
    _getHandleRegistry: () => handleRegistry,
  };
};
