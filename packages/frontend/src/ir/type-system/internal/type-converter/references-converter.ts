/**
 * Reference type converter — main convertTypeReference entry point.
 *
 * Handles primitive checks, Array/ReadonlyArray, conditional utilities,
 * Record expansion, mapped utilities, CLR erasure wrappers, parameter
 * modifiers, and delegates to alias/declaration body handling.
 */

import * as ts from "typescript";
import { IrType, IrDictionaryType } from "../../../types.js";
import {
  buildSubstitutionFromExplicitTypeArgs,
  substituteIrType,
} from "../../../types/ir-substitution.js";
import {
  isPrimitiveTypeName,
  getPrimitiveType,
  isClrPrimitiveTypeName,
  getClrPrimitiveType,
} from "./primitives.js";
import {
  isExpandableUtilityType,
  expandUtilityType,
  isExpandableConditionalUtilityType,
  expandConditionalUtilityType,
  expandRecordType,
} from "./utility-types.js";
import type { Binding, BindingInternal } from "../../../binding/index.js";
import {
  normalizeSystemInternalQualifiedName,
  normalizeNamespaceAliasQualifiedName,
  classifyDictionaryKeyTypeNode,
} from "./references-normalize.js";
import {
  extractStructuralMembersFromDeclarations,
  resolveSourceClrIdentity,
  tryConvertPureIndexSignatureToDictionary,
} from "./references-structural.js";
import {
  handleTypeAliasDeclaration,
  entityNameToText,
} from "./references-alias.js";

/**
 * Convert TypeScript type reference to IR type
 * Handles both primitive type names and user-defined types
 */
export const convertTypeReference = (
  node: ts.TypeReferenceNode,
  binding: Binding,
  convertType: (node: ts.TypeNode, binding: Binding) => IrType
): IrType => {
  const rawTypeName = entityNameToText(node.typeName);
  const typeName = normalizeNamespaceAliasQualifiedName(
    normalizeSystemInternalQualifiedName(rawTypeName)
  );

  // Check for primitive type names
  if (isPrimitiveTypeName(typeName)) {
    return getPrimitiveType(typeName);
  }

  // Check for CLR primitive type names (e.g., int from @tsonic/core)
  if (isClrPrimitiveTypeName(typeName)) {
    return getClrPrimitiveType(typeName);
  }

  // Check for expandable conditional utility types (NonNullable, Exclude, Extract)
  if (
    isExpandableConditionalUtilityType(typeName) &&
    node.typeArguments?.length
  ) {
    const expanded = expandConditionalUtilityType(
      node,
      typeName,
      binding,
      convertType
    );
    if (expanded) return expanded;
  }

  // Check for Record<K, V> utility type
  const typeArgsForRecord = node.typeArguments;
  const keyTypeNode = typeArgsForRecord?.[0];
  const valueTypeNode = typeArgsForRecord?.[1];
  if (typeName === "Record" && keyTypeNode && valueTypeNode) {
    const expandedRecord = expandRecordType(node, binding, convertType);
    if (expandedRecord) return expandedRecord;

    const keyType = classifyDictionaryKeyTypeNode(
      keyTypeNode,
      convertType,
      binding
    );
    if (keyType) {
      const valueType = convertType(valueTypeNode, binding);

      return {
        kind: "dictionaryType",
        keyType,
        valueType,
      } as IrDictionaryType;
    }
  }

  // Check for expandable utility types (Partial, Required, Readonly, Pick, Omit)
  if (isExpandableUtilityType(typeName) && node.typeArguments?.length) {
    const expanded = expandUtilityType(node, typeName, binding, convertType);
    if (expanded) return expanded;
  }

  // tsbindgen's `CLROf<T>` is a conditional type used to coerce ergonomic primitives
  if (typeName === "CLROf" && node.typeArguments?.length === 1) {
    const inner = node.typeArguments[0];
    return inner ? convertType(inner, binding) : { kind: "unknownType" };
  }

  // `thisarg<T>` is a TS-only marker
  if (typeName === "thisarg" && node.typeArguments?.length === 1) {
    const inner = node.typeArguments[0];
    return inner ? convertType(inner, binding) : { kind: "unknownType" };
  }

  // `field<T>` is a TS-only marker
  if (typeName === "field" && node.typeArguments?.length === 1) {
    const inner = node.typeArguments[0];
    return inner ? convertType(inner, binding) : { kind: "unknownType" };
  }

  // `Rewrap<TReceiver, TNewShape>` erases to the new shape
  if (typeName === "Rewrap" && node.typeArguments?.length === 2) {
    const newShape = node.typeArguments[1];
    return newShape ? convertType(newShape, binding) : { kind: "unknownType" };
  }

  // Handle parameter passing modifiers: out<T>, ref<T>, inref<T>
  if (
    (typeName === "out" || typeName === "ref" || typeName === "inref") &&
    node.typeArguments &&
    node.typeArguments.length === 1
  ) {
    const innerTypeArg = node.typeArguments[0];
    if (!innerTypeArg) {
      return { kind: "anyType" };
    }
    return {
      kind: "referenceType",
      name: typeName,
      typeArguments: [convertType(innerTypeArg, binding)],
      structuralOrigin: "namedReference",
    };
  }

  // DETERMINISTIC: Check if this is a type parameter or type alias using Binding
  const declId = binding.resolveTypeReference(node);
  let resolvedDeclNode: ts.Declaration | undefined;
  if (declId) {
    const declInfo = (binding as BindingInternal)
      ._getHandleRegistry()
      .getDecl(declId);
    if (declInfo) {
      const declNode = (declInfo.typeDeclNode ?? declInfo.declNode) as
        | ts.Declaration
        | undefined;
      resolvedDeclNode = declNode;
      if (declNode && ts.isTypeParameterDeclaration(declNode)) {
        return { kind: "typeParameterType", name: typeName };
      }

      // ExtensionMethods import specifier erasure
      if (
        declNode &&
        ts.isImportSpecifier(declNode) &&
        (declNode.propertyName ?? declNode.name).text === "ExtensionMethods" &&
        node.typeArguments?.length === 1
      ) {
        const shape = node.typeArguments[0];
        return shape ? convertType(shape, binding) : { kind: "unknownType" };
      }

      const firstTypeArg = node.typeArguments?.[0];
      const isConcreteClassReference =
        declNode &&
        (ts.isClassDeclaration(declNode) || ts.isClassExpression(declNode));
      if (
        !isConcreteClassReference &&
        (typeName === "Array" || typeName === "ReadonlyArray") &&
        firstTypeArg
      ) {
        return {
          kind: "arrayType",
          elementType: convertType(firstTypeArg, binding),
          origin: "explicit",
        };
      }

      // Pure index-signature interface/type alias: treat as dictionaryType.
      const pureIndexSigDict = declNode
        ? tryConvertPureIndexSignatureToDictionary(
            declNode,
            convertType,
            binding
          )
        : undefined;
      if (pureIndexSigDict) {
        return pureIndexSigDict;
      }

      // Type alias declarations require special handling
      if (declNode && ts.isTypeAliasDeclaration(declNode)) {
        const aliasResult = handleTypeAliasDeclaration(
          node,
          typeName,
          declId,
          declInfo,
          declNode,
          binding,
          convertType
        );
        if (aliasResult) return aliasResult;
      }
    }
  }

  // Extract structural members from declarations (AST-based)
  const structuralMembers = extractStructuralMembersFromDeclarations(
    declId?.id,
    binding,
    convertType
  );
  const convertedTypeArguments = node.typeArguments?.map((t) =>
    convertType(t, binding)
  );

  // Use resolved symbol name to keep IR nominal identity stable
  const resolvedName = (() => {
    if (!declId) return typeName;
    const declInfo = (binding as BindingInternal)
      ._getHandleRegistry()
      .getDecl(declId);
    return declInfo?.fqName ?? typeName;
  })();
  const resolvedClrType = resolveSourceClrIdentity(declId, binding);

  // ExtensionMethods wrapper erasure for resolved names
  if (
    (resolvedName.startsWith("ExtensionMethods_") ||
      resolvedName === "ExtensionMethods") &&
    node.typeArguments?.length === 1
  ) {
    const shape = node.typeArguments[0];
    return shape ? convertType(shape, binding) : { kind: "unknownType" };
  }

  const substitutedStructuralMembers = (() => {
    if (!structuralMembers || structuralMembers.length === 0) {
      return structuralMembers;
    }

    const declaringType =
      resolvedDeclNode &&
      (ts.isClassDeclaration(resolvedDeclNode) ||
        ts.isInterfaceDeclaration(resolvedDeclNode) ||
        ts.isTypeAliasDeclaration(resolvedDeclNode))
        ? resolvedDeclNode
        : undefined;
    const formalTypeParameters =
      declaringType?.typeParameters?.map((parameter) => parameter.name.text) ??
      [];
    const substitution =
      convertedTypeArguments && convertedTypeArguments.length > 0
        ? buildSubstitutionFromExplicitTypeArgs(
            convertedTypeArguments,
            formalTypeParameters
          )
        : undefined;
    if (!substitution || substitution.size === 0) {
      return structuralMembers;
    }

    const substitutedType = substituteIrType(
      {
        kind: "referenceType",
        name: resolvedName,
        typeArguments: convertedTypeArguments,
        structuralMembers,
        structuralOrigin: "namedReference",
      },
      substitution
    );
    return substitutedType.kind === "referenceType"
      ? substitutedType.structuralMembers
      : structuralMembers;
  })();

  const firstTypeArg = node.typeArguments?.[0];
  const isConcreteClassReference =
    !!resolvedDeclNode &&
    (ts.isClassDeclaration(resolvedDeclNode) ||
      ts.isClassExpression(resolvedDeclNode));

  if (
    !isConcreteClassReference &&
    (typeName === "Array" || typeName === "ReadonlyArray") &&
    firstTypeArg
  ) {
    return {
      kind: "arrayType",
      elementType: convertType(firstTypeArg, binding),
      origin: "explicit",
    };
  }

  // Reference type (user-defined or library)
  return {
    kind: "referenceType",
    name: resolvedName,
    typeArguments: convertedTypeArguments,
    resolvedClrType,
    structuralOrigin: "namedReference",
    ...(substitutedStructuralMembers
      ? { structuralMembers: substitutedStructuralMembers }
      : {}),
  };
};
