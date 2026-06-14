/**
 * Binding Layer — Factory Function (Facade)
 *
 * Composes the TSTS-backed binding registry and exposes opaque declaration,
 * signature, member, and type-syntax handles to the IR/type-system layers.
 */

import type {
  TstsNode,
} from "@tsonic/tsts";
import {
  getTstsContainingSourceFileName,
  getTstsNodeNameText,
  TstsSyntax,
} from "@tsonic/tsts";
import type {
  DeclId,
  SignatureId,
  MemberId,
  TypeSyntaxId,
} from "../type-system/types.js";
import { makeTypeSyntaxId } from "../type-system/types.js";
import type {
  HandleRegistry,
  DeclInfo,
  SignatureInfo,
  MemberInfo,
  TypeSyntaxInfo,
} from "../type-system/internal/handle-types.js";
import type { BindingInternal, TypePredicateInfo } from "./binding-types.js";
import type {
  TstsFrontendSourceSemanticView,
  SourceSemanticFactKey,
} from "../../source-frontend/index.js";
import {
  createBindingContext,
  type BindingModuleGraphInput,
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
  resolveConstructorSignature as resolveConstructorSignatureImpl,
} from "./binding-call-resolution.js";
import {
  resolveExternalImportType as resolveExternalImportTypeImpl,
  resolveImportedSourceNamespaceMember as resolveImportedSourceNamespaceMemberImpl,
  resolveImportedSourceValue as resolveImportedSourceValueImpl,
} from "./binding-external-imports.js";

const getDeclaringTypeNameFromParent = (
  parent: TstsNode | undefined
): string | undefined => {
  if (!parent) return undefined;

  if (
    TstsSyntax.IsInterfaceDeclaration(parent) ||
    TstsSyntax.IsClassDeclaration(parent) ||
    TstsSyntax.IsTypeAliasDeclaration(parent)
  ) {
    return getBindingAliasFromDeclaration(parent) ?? getTstsNodeNameText(parent);
  }

  if (TstsSyntax.IsTypeLiteralNode(parent)) {
    const container = parent.Parent;
    return TstsSyntax.IsVariableDeclaration(container)
      ? getTstsNodeNameText(container)
      : undefined;
  }

  return undefined;
};

const toConcreteTstsNode = (value: unknown): TstsNode | undefined =>
  value !== null && typeof value === "object" ? (value as TstsNode) : undefined;

export const createBinding = (
  sourceSemantics: TstsFrontendSourceSemanticView,
  moduleGraphInput: BindingModuleGraphInput = {}
): BindingInternal => {
  const ctx = createBindingContext(sourceSemantics, moduleGraphInput);

  const resolveImport = (node: TstsNode): DeclId | undefined => {
    const symbol = sourceSemantics.getSymbol(TstsSyntax.Node_Name(node) ?? node);
    if (!symbol) return undefined;
    return getOrCreateDeclId(ctx, resolveTransparentAliases(ctx, symbol));
  };

  const resolveShorthandAssignment = (node: TstsNode): DeclId | undefined => {
    const symbol = sourceSemantics.getShorthandAssignmentValueSymbol(node);
    if (!symbol) return undefined;
    return getOrCreateDeclId(ctx, resolveTransparentAliases(ctx, symbol));
  };

  const getDeclaringTypeNameOfMember = (
    member: MemberId
  ): string | undefined => {
    const key = `${member.declId.id}:${member.name}`;
    return getDeclaringTypeNameFromParent(ctx.memberMap.get(key)?.decl?.Parent);
  };

  const getSourceFilePathOfMember = (member: MemberId): string | undefined => {
    const key = `${member.declId.id}:${member.name}`;
    return getTstsContainingSourceFileName(ctx.memberMap.get(key)?.decl);
  };

  const getSourceFilePathOfDecl = (declId: DeclId): string | undefined => {
    const entry = ctx.declMap.get(declId.id);
    const decl = entry?.decl ?? entry?.typeDeclNode ?? entry?.valueDeclNode;
    return getTstsContainingSourceFileName(decl);
  };

  const getFullyQualifiedName = (declId: DeclId): string | undefined => {
    const entry = ctx.declMap.get(declId.id);
    return entry?.fqName;
  };

  const getKindOfDecl = (declId: DeclId) => ctx.declMap.get(declId.id)?.kind;

  const getTypeNodeOfDecl = (declId: DeclId): TstsNode | undefined =>
    ctx.declMap.get(declId.id)?.typeNode;

  const getValueDeclarationNode = (declId: DeclId): TstsNode | undefined => {
    const entry = ctx.declMap.get(declId.id);
    return entry?.valueDeclNode ?? entry?.decl;
  };

  const getDeclarationNodesOfDecl = (
    declId: DeclId
  ): readonly TstsNode[] => {
    const entry = ctx.declMap.get(declId.id);
    if (!entry) return [];
    return [entry.decl, entry.valueDeclNode, entry.typeDeclNode].filter(
      (node): node is TstsNode => node !== undefined
    );
  };

  const getTypeNodeOfMember = (member: MemberId): TstsNode | undefined => {
    const key = `${member.declId.id}:${member.name}`;
    return ctx.memberMap.get(key)?.typeNode;
  };

  const getTypePredicateOfSignature = (
    sigId: SignatureId
  ): TypePredicateInfo | undefined => {
    const predicate = ctx.signatureMap.get(sigId.id)?.typePredicate;
    if (predicate?.kind !== "param") return undefined;
    return {
      kind: "typePredicate",
      parameterIndex: predicate.parameterIndex,
      typeNode: toConcreteTstsNode(predicate.targetTypeNode),
    };
  };

  const getThisTypeNodeOfSignature = (
    sigId: SignatureId
  ): TstsNode | undefined => ctx.signatureMap.get(sigId.id)?.thisTypeNode;

  const getDeclaringTypeNameOfSignature = (
    sigId: SignatureId
  ): string | undefined => ctx.signatureMap.get(sigId.id)?.declaringTypeTsName;

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
        declaringTypeTsName: entry.declaringTypeTsName,
        declaringTypeParameterNames: entry.declaringTypeParameterNames,
        declaringMemberName: entry.declaringMemberName,
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
      return entry ? { typeNode: entry.typeNode } : undefined;
    },
  };

  const captureTypeSyntax = (node: TstsNode): TypeSyntaxId => {
    const id = makeTypeSyntaxId(ctx.nextTypeSyntaxId.value++);
    const referenceDeclId = TstsSyntax.IsTypeReferenceNode(node)
      ? resolveTypeReferenceImpl(ctx, node)
      : undefined;
    ctx.typeSyntaxMap.set(id.id, {
      typeNode: node,
      ...(referenceDeclId ? { referenceDeclId } : {}),
    });
    return id;
  };

  const captureTypeArgs = (
    nodes: readonly TstsNode[]
  ): readonly TypeSyntaxId[] => nodes.map(captureTypeSyntax);

  return {
    resolveIdentifier: (node) => resolveIdentifierImpl(ctx, node),
    resolveTypeReference: (node) => resolveTypeReferenceImpl(ctx, node),
    resolvePropertyAccess: (node) => resolvePropertyAccessImpl(ctx, node),
    resolveElementAccess: (node) => resolveElementAccessImpl(ctx, node),
    resolveCallSignature: (node) => resolveCallSignatureImpl(ctx, node),
    resolveConstructorSignature: (node) =>
      resolveConstructorSignatureImpl(ctx, node),
    getSourceFact: <T>(node: TstsNode, key: SourceSemanticFactKey<T>) =>
      sourceSemantics.getFact(node, key),
    resolveImport,
    resolveExternalImportType: (node) =>
      resolveExternalImportTypeImpl(ctx, node),
    resolveImportedSourceValue: (node) =>
      resolveImportedSourceValueImpl(ctx, node),
    resolveImportedSourceNamespaceMember: (node) =>
      resolveImportedSourceNamespaceMemberImpl(ctx, node),
    resolveShorthandAssignment,
    getDeclaringTypeNameOfMember,
    getSourceFilePathOfMember,
    getSourceFilePathOfDecl,
    getFullyQualifiedName,
    getKindOfDecl,
    getTypeNodeOfDecl,
    getValueDeclarationNode,
    getDeclarationNodesOfDecl,
    getTypeNodeOfMember,
    getTypePredicateOfSignature,
    getThisTypeNodeOfSignature,
    getDeclaringTypeNameOfSignature,
    captureTypeSyntax,
    captureTypeArgs,
    _getHandleRegistry: () => handleRegistry,
  };
};
