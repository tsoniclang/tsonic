/**
 * Structural member extraction from type declarations,
 * index-signature dictionary conversion, and type-alias body expansion.
 *
 * Split from references-structural.ts for file-size compliance (< 500 LOC).
 */

import * as ts from "typescript";
import { IrType, IrDictionaryType, IrInterfaceMember } from "../../../types.js";
import { substituteIrType } from "../../../types/ir-substitution.js";
import { CLR_PRIMITIVE_TYPE_SET, getClrPrimitiveType } from "./primitives.js";
import type { Binding, BindingInternal } from "../../../binding/index.js";
import { tryResolveDeterministicPropertyName } from "../../../syntax/property-names.js";
import { isOverloadStubImplementation } from "../../../syntax/overload-stubs.js";
import {
  classifyDictionaryKeyTypeNode,
  normalizeExpandedAliasType,
  getStructuralMembersCache,
  getTypeAliasBodyCache,
} from "./references-normalize.js";
import { shouldExtractFromDeclaration } from "./references-structural-bindings.js";
import { expandDirectAliasSyntax } from "./direct-alias-expansion.js";

/**
 * Extract structural members from type declarations (AST-based).
 *
 * DETERMINISTIC IR TYPING (INV-0 compliant):
 * Uses AST nodes directly instead of ts.Type computation.
 * Gets TypeNodes from declarations, not from getTypeOfSymbolAtLocation.
 *
 * Used to populate structuralMembers on referenceType for interfaces, object type aliases,
 * and public instance class surfaces.
 * This enables TSN5110 validation for object literal properties against expected types,
 * and preserves deterministic member typing for nominal classes used structurally across
 * callback/contextual-typing boundaries.
 *
 * Safety guards:
 * - Only extracts for interfaces/type-aliases/public instance classes (not enums/lib types)
 * - Uses cache to prevent infinite recursion on recursive types
 * - Skips unsupported keys instead of bailing entirely
 * - Returns undefined for index signatures (can't fully represent)
 *
 * @param declId - The DeclId for the type (from Binding.resolveTypeReference)
 * @param binding - The Binding layer for symbol resolution
 * @param convertType - Function to convert nested types
 * @returns Structural members or undefined if extraction fails/skipped
 */
export const extractStructuralMembersFromDeclarations = (
  declId: number | undefined,
  binding: Binding,
  convertType: (node: ts.TypeNode, binding: Binding) => IrType
): readonly IrInterfaceMember[] | undefined => {
  if (declId === undefined) {
    return undefined;
  }

  // Check cache first (handles recursion)
  const structuralMembersCache = getStructuralMembersCache(binding);
  const cached = structuralMembersCache.get(declId);
  if (cached === "in-progress") {
    // Recursive reference - return undefined to break cycle
    return undefined;
  }
  if (cached !== undefined) {
    return cached === null ? undefined : cached;
  }

  // Get declaration info from HandleRegistry
  const registry = (binding as BindingInternal)._getHandleRegistry();
  const declInfo = registry.getDecl({ id: declId, __brand: "DeclId" } as never);
  if (!declInfo?.declNode) {
    structuralMembersCache.set(declId, null);
    return undefined;
  }

  const decl = declInfo.declNode as ts.Declaration;

  // Check if this declaration should have structural members extracted
  if (!shouldExtractFromDeclaration(decl)) {
    structuralMembersCache.set(declId, null);
    return undefined;
  }

  // Mark as in-progress before recursing.
  structuralMembersCache.set(declId, "in-progress");

  try {
    const members: IrInterfaceMember[] = [];
    const accessorGroups = new Map<
      string,
      {
        getter?: ts.GetAccessorDeclaration;
        setter?: ts.SetAccessorDeclaration;
      }
    >();

    const getModifiers = (
      node: ts.Node
    ): readonly ts.ModifierLike[] | undefined =>
      ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;

    const hasModifier = (
      modifiers: readonly ts.ModifierLike[] | undefined,
      kind: ts.SyntaxKind
    ): boolean => modifiers?.some((m) => m.kind === kind) ?? false;

    const isPublicInstanceClassMember = (member: ts.ClassElement): boolean => {
      if (ts.isConstructorDeclaration(member)) return false;
      const modifiers = getModifiers(member);
      if (hasModifier(modifiers, ts.SyntaxKind.StaticKeyword)) {
        return false;
      }
      if (
        hasModifier(modifiers, ts.SyntaxKind.PrivateKeyword) ||
        hasModifier(modifiers, ts.SyntaxKind.ProtectedKeyword)
      ) {
        return false;
      }
      if (
        "name" in member &&
        member.name &&
        ts.isPrivateIdentifier(member.name)
      ) {
        return false;
      }
      return true;
    };

    const getMemberName = (
      name: ts.PropertyName | ts.PrivateIdentifier | undefined
    ): string | undefined => tryResolveDeterministicPropertyName(name);

    // Get the member source (interface members, type literal members, or class members)
    const typeElements = ts.isInterfaceDeclaration(decl)
      ? decl.members
      : ts.isTypeAliasDeclaration(decl) && ts.isTypeLiteralNode(decl.type)
        ? decl.type.members
        : ts.isClassDeclaration(decl)
          ? decl.members
          : undefined;

    if (!typeElements) {
      structuralMembersCache.set(declId, null);
      return undefined;
    }

    // Check for index signatures - can't fully represent these structurally
    for (const member of typeElements) {
      if (ts.isIndexSignatureDeclaration(member)) {
        structuralMembersCache.set(declId, null);
        return undefined;
      }
    }

    // Extract members from AST (TypeNodes directly)
    for (const member of typeElements) {
      if (
        ts.isGetAccessorDeclaration(member) ||
        ts.isSetAccessorDeclaration(member)
      ) {
        if (
          ts.isClassDeclaration(decl) &&
          !isPublicInstanceClassMember(member)
        ) {
          continue;
        }

        const accessorName = getMemberName(member.name);

        if (
          !accessorName ||
          accessorName.startsWith("__tsonic_type_") ||
          accessorName.startsWith("__tsonic_binding_alias_")
        ) {
          continue;
        }

        const existing = accessorGroups.get(accessorName) ?? {};
        if (ts.isGetAccessorDeclaration(member)) {
          existing.getter = member;
        } else {
          existing.setter = member;
        }
        accessorGroups.set(accessorName, existing);
        continue;
      }

      // Property signature / declaration
      if (ts.isPropertySignature(member) || ts.isPropertyDeclaration(member)) {
        if (
          ts.isPropertyDeclaration(member) &&
          !isPublicInstanceClassMember(member)
        ) {
          continue;
        }

        const propName = getMemberName(member.name);

        if (
          !propName ||
          propName.startsWith("__tsonic_type_") ||
          propName.startsWith("__tsonic_binding_alias_")
        ) {
          continue; // Skip computed/symbol keys
        }

        const isOptional = !!member.questionToken;
        const isReadonly = hasModifier(
          getModifiers(member),
          ts.SyntaxKind.ReadonlyKeyword
        );

        // DETERMINISTIC: Get type from TypeNode in declaration
        const declTypeNode = member.type;
        if (!declTypeNode) {
          continue; // Skip properties without type annotation
        }

        // Check for CLR primitive type aliases
        if (ts.isTypeReferenceNode(declTypeNode)) {
          const typeName = ts.isIdentifier(declTypeNode.typeName)
            ? declTypeNode.typeName.text
            : undefined;
          if (typeName && CLR_PRIMITIVE_TYPE_SET.has(typeName)) {
            // Resolve to check it comes from @tsonic/core (symbol-based, allowed)
            // Use Binding to resolve the type reference
            const typeRefDeclId = binding.resolveTypeReference(declTypeNode);
            if (typeRefDeclId) {
              const typeRefDeclInfo = registry.getDecl(typeRefDeclId);
              const refDeclNode = typeRefDeclInfo?.declNode as
                | ts.Declaration
                | undefined;
              const refSourceFile = refDeclNode?.getSourceFile();
              if (refSourceFile?.fileName.includes("@tsonic/core")) {
                members.push({
                  kind: "propertySignature",
                  name: propName,
                  type: getClrPrimitiveType(typeName as "int" | "char"),
                  isOptional,
                  isReadonly,
                });
                continue;
              }
            }
          }
        }

        // Convert the TypeNode to IrType
        members.push({
          kind: "propertySignature",
          name: propName,
          type: convertType(declTypeNode, binding),
          isOptional,
          isReadonly,
        });
      }

      // Method signature / declaration
      if (ts.isMethodSignature(member) || ts.isMethodDeclaration(member)) {
        if (
          ts.isMethodDeclaration(member) &&
          !isPublicInstanceClassMember(member)
        ) {
          continue;
        }
        if (
          ts.isMethodDeclaration(member) &&
          isOverloadStubImplementation(member)
        ) {
          continue;
        }

        const methodName = getMemberName(member.name);

        if (!methodName) {
          continue; // Skip computed keys
        }

        members.push({
          kind: "methodSignature",
          name: methodName,
          parameters: member.parameters.map((param, index) => ({
            kind: "parameter" as const,
            pattern: {
              kind: "identifierPattern" as const,
              name: ts.isIdentifier(param.name)
                ? param.name.text
                : `arg${index}`,
            },
            type: param.type ? convertType(param.type, binding) : undefined,
            isOptional: !!param.questionToken,
            isRest: !!param.dotDotDotToken,
            passing: "value" as const,
          })),
          returnType: member.type
            ? convertType(member.type, binding)
            : undefined,
        });
      }
    }

    for (const [memberName, pair] of accessorGroups) {
      const getterTypeNode = pair.getter?.type;
      const setterTypeNode = pair.setter?.parameters[0]?.type;
      const propertyTypeNode = getterTypeNode ?? setterTypeNode;

      if (!propertyTypeNode) {
        continue;
      }

      members.push({
        kind: "propertySignature",
        name: memberName,
        type: convertType(propertyTypeNode, binding),
        isOptional: false,
        isReadonly: !!pair.getter && !pair.setter,
      });
    }

    const result = members.length > 0 ? members : undefined;
    structuralMembersCache.set(declId, result ?? null);
    return result;
  } catch {
    // On any error, settle cache to null (not extractable)
    structuralMembersCache.set(declId, null);
    return undefined;
  }
};

/**
 * Try to convert a pure index-signature interface/type alias to dictionaryType.
 *
 * This supports idiomatic TS dictionary surfaces:
 *   interface MetricsTotals { [metric: string]: int }
 *   type MetricsTotals = { [metric: string]: int }
 *
 * Without this, computed access `totals["pageviews"]` is misclassified as
 * a CLR indexer and fails numeric proof (TSN5107). This is not a workaround:
 * index-signature-only shapes are structural dictionaries and should compile
 * to `Dictionary<K, V>` / `Record<K, V>` behavior.
 */
export const tryConvertPureIndexSignatureToDictionary = (
  decl: ts.Declaration,
  convertType: (node: ts.TypeNode, binding: Binding) => IrType,
  binding: Binding
): IrDictionaryType | undefined => {
  const typeElements = ts.isInterfaceDeclaration(decl)
    ? decl.members
    : ts.isTypeAliasDeclaration(decl) && ts.isTypeLiteralNode(decl.type)
      ? decl.type.members
      : undefined;
  if (!typeElements) return undefined;

  const indexSignatures = typeElements.filter(ts.isIndexSignatureDeclaration);
  const otherMembers = typeElements.filter(
    (m) => !ts.isIndexSignatureDeclaration(m)
  );
  if (indexSignatures.length === 0 || otherMembers.length > 0) {
    return undefined;
  }

  const indexSig = indexSignatures[0];
  const keyParam = indexSig?.parameters[0];
  const keyTypeNode = keyParam?.type;
  const keyType: IrType = (() => {
    if (!keyTypeNode) {
      return { kind: "primitiveType", name: "string" };
    }
    return (
      classifyDictionaryKeyTypeNode(keyTypeNode, convertType, binding) ?? {
        kind: "primitiveType",
        name: "string",
      }
    );
  })();
  const valueType = indexSig?.type
    ? convertType(indexSig.type, binding)
    : { kind: "anyType" as const };

  return {
    kind: "dictionaryType",
    keyType,
    valueType,
  };
};

/**
 * Expand a type alias body with optional type-parameter substitution.
 *
 * Shared helper used by both declaration-file alias erasure and user-defined
 * type alias erasure paths in convertTypeReference.
 */
export const expandTypeAliasBody = (
  declId: number,
  declNode: ts.TypeAliasDeclaration,
  node: ts.TypeReferenceNode,
  binding: Binding,
  convertType: (node: ts.TypeNode, binding: Binding) => IrType
): IrType | undefined => {
  const directExpanded = expandDirectAliasSyntax(
    declNode,
    node,
    binding,
    convertType
  );
  if (directExpanded) {
    return normalizeExpandedAliasType(directExpanded);
  }

  const key = declId;
  const typeAliasBodyCache = getTypeAliasBodyCache(binding);
  const cached = typeAliasBodyCache.get(key);

  if (cached === "in-progress") {
    return undefined;
  }

  const base =
    cached ??
    (() => {
      typeAliasBodyCache.set(key, "in-progress");
      const converted = convertType(declNode.type, binding);
      typeAliasBodyCache.set(key, converted);
      return converted;
    })();

  const aliasTypeParams = (declNode.typeParameters ?? []).map(
    (tp) => tp.name.text
  );
  const refTypeArgs = (node.typeArguments ?? []).map((t) =>
    convertType(t, binding)
  );

  if (aliasTypeParams.length > 0 && refTypeArgs.length > 0) {
    const subst = new Map<string, IrType>();
    for (
      let i = 0;
      i < Math.min(aliasTypeParams.length, refTypeArgs.length);
      i++
    ) {
      const name = aliasTypeParams[i];
      const arg = refTypeArgs[i];
      if (name && arg) subst.set(name, arg);
    }
    return normalizeExpandedAliasType(
      subst.size > 0 ? substituteIrType(base, subst) : base
    );
  }

  return normalizeExpandedAliasType(base);
};
