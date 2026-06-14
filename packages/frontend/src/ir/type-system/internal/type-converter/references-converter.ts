/**
 * Reference type converter — main convertTypeReference entry point.
 *
 * Handles primitive checks, Array/ReadonlyArray, conditional utilities,
 * Record expansion, mapped utilities, native target erasure wrappers, parameter
 * modifiers, and delegates to alias/declaration body handling.
 */

import type { TstsNode } from "@tsonic/tsts";
import { TstsSyntax } from "@tsonic/tsts";
import { IrType, IrDictionaryType } from "../../../types.js";
import { substituteIrType } from "../../../types/ir-substitution.js";
import {
  isPrimitiveTypeName,
  getPrimitiveType,
  isCorePrimitiveTypeName,
  getCorePrimitiveType,
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
  normalizeProviderInternalQualifiedName,
  normalizeNamespaceAliasQualifiedName,
  classifyDictionaryKeyTypeNode,
} from "./references-normalize.js";
import { makeTypeId } from "../universe/types.js";
import {
  extractStructuralMembersFromDeclarations,
  resolveSourceTargetIdentity,
  tryConvertPureIndexSignatureToDictionary,
} from "./references-structural.js";
import {
  handleTypeAliasDeclaration,
  entityNameToText,
} from "./references-alias.js";
import { numericPrimitiveFactKey } from "../../../../source-frontend/index.js";
import {
  classifySourceWrapperTypeReference,
  identifierText,
  nodeMembers,
  nodeTypeArguments,
} from "./tsts-syntax.js";
import { getSourceBindingAliasFromDeclaration } from "../source-binding-markers.js";

const tryReadNumericLiteral = (node: TstsNode): number | undefined => {
  if (TstsSyntax.IsNumericLiteral(node)) {
    return Number(TstsSyntax.Node_Text(node));
  }
  if (
    TstsSyntax.IsPrefixUnaryExpression(node) &&
    TstsSyntax.AsPrefixUnaryExpression(node)?.Operand &&
    TstsSyntax.IsNumericLiteral(
      TstsSyntax.AsPrefixUnaryExpression(node)!.Operand!
    ) &&
    (TstsSyntax.AsPrefixUnaryExpression(node)?.Operator ===
      TstsSyntax.KindMinusToken ||
      TstsSyntax.AsPrefixUnaryExpression(node)?.Operator ===
        TstsSyntax.KindPlusToken)
  ) {
    const expression = TstsSyntax.AsPrefixUnaryExpression(node)!;
    const value = Number(TstsSyntax.Node_Text(expression.Operand));
    return expression.Operator === TstsSyntax.KindMinusToken ? -value : value;
  }
  return undefined;
};

const tryReadEnumMemberLiteralValue = (
  member: TstsNode
): string | number | undefined => {
  const enumMember = TstsSyntax.AsEnumMember(member);
  const initializer = enumMember?.Initializer;
  if (initializer) {
    if (TstsSyntax.IsStringLiteral(initializer)) {
      return TstsSyntax.Node_Text(initializer);
    }
    return tryReadNumericLiteral(initializer);
  }

  let nextNumericValue = 0;
  for (const candidate of nodeMembers(member.Parent)) {
    if (candidate === member) {
      return nextNumericValue;
    }

    const candidateInitializer = TstsSyntax.AsEnumMember(candidate)?.Initializer;
    if (!candidateInitializer) {
      nextNumericValue += 1;
      continue;
    }

    const numericValue = tryReadNumericLiteral(candidateInitializer);
    if (numericValue === undefined) {
      return undefined;
    }
    nextNumericValue = numericValue + 1;
  }

  return undefined;
};

const SOURCE_INTRINSIC_REFERENCE_NAMES = new Set([
  "Iterable",
  "IterableIterator",
  "Iterator",
  "IteratorResult",
  "Generator",
  "AsyncIterable",
  "AsyncIterableIterator",
  "AsyncIterator",
  "AsyncGenerator",
  "Set",
  "ReadonlySet",
  "Map",
  "ReadonlyMap",
]);

const sourceIntrinsicTypeId = (name: string) =>
  SOURCE_INTRINSIC_REFERENCE_NAMES.has(name)
    ? makeTypeId(`tsonic.core:${name}`, name, "tsonic.core", name, "source")
    : undefined;

/**
 * Convert TypeScript type reference to IR type
 * Handles both primitive type names and user-defined types
 */
export const convertTypeReference = (
  node: TstsNode,
  binding: Binding,
  convertType: (node: TstsNode, binding: Binding) => IrType
): IrType => {
  const typeReference = TstsSyntax.AsTypeReferenceNode(node);
  const typeArguments = nodeTypeArguments(node);
  const rawTypeName = entityNameToText(typeReference?.TypeName);
  const typeName = normalizeNamespaceAliasQualifiedName(
    normalizeProviderInternalQualifiedName(rawTypeName)
  );

  // Check for primitive type names
  if (isPrimitiveTypeName(typeName)) {
    return getPrimitiveType(typeName);
  }

  if (isCorePrimitiveTypeName(typeName)) {
    return getCorePrimitiveType(typeName);
  }

  // Check for source primitive aliases proven by TSTS extensions.
  const numericPrimitiveFact = binding.getSourceFact(
    node,
    numericPrimitiveFactKey
  );
  if (
    numericPrimitiveFact &&
    isCorePrimitiveTypeName(numericPrimitiveFact.sourceName)
  ) {
    return getCorePrimitiveType(numericPrimitiveFact.sourceName);
  }

  if (typeName === "JsPrimitive" || typeName === "JsValue") {
    return {
      kind: "referenceType",
      name: typeName,
      structuralOrigin: "namedReference",
    };
  }

  // Check for expandable conditional utility types (NonNullable, Exclude, Extract)
  if (
    isExpandableConditionalUtilityType(typeName) &&
    typeArguments.length
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
  const keyTypeNode = typeArguments[0];
  const valueTypeNode = typeArguments[1];
  if (typeName === "Record" && keyTypeNode && valueTypeNode) {
    const expandedRecord = expandRecordType(node, binding, convertType);
    if (expandedRecord) return expandedRecord;

    const keyType = classifyDictionaryKeyTypeNode(keyTypeNode);
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
  if (isExpandableUtilityType(typeName) && typeArguments.length) {
    const expanded = expandUtilityType(node, typeName, binding, convertType);
    if (expanded) return expanded;
  }

  // tsbindgen's `native targetOf<T>` is a conditional type used to coerce ergonomic primitives
  if (typeName === "native targetOf" && typeArguments.length === 1) {
    const inner = typeArguments[0];
    return inner ? convertType(inner, binding) : { kind: "unknownType" };
  }

  const sourceWrapper = classifySourceWrapperTypeReference(
    node,
    binding.getSourceFact
  );
  if (sourceWrapper?.kind === "extension-receiver") {
    return convertType(sourceWrapper.innerType, binding);
  }

  if (sourceWrapper?.kind === "field-storage") {
    return convertType(sourceWrapper.innerType, binding);
  }

  // `Rewrap<TReceiver, TNewShape>` erases to the new shape
  if (typeName === "Rewrap" && typeArguments.length === 2) {
    const newShape = typeArguments[1];
    return newShape ? convertType(newShape, binding) : { kind: "unknownType" };
  }

  if (sourceWrapper?.kind === "parameter-passing") {
    return {
      kind: "referenceType",
      name: sourceWrapper.referenceName,
      typeArguments: [convertType(sourceWrapper.innerType, binding)],
      structuralOrigin: "namedReference",
    };
  }

  // DETERMINISTIC: Check if this is a type parameter or type alias using Binding
  const declId = binding.resolveTypeReference(node);
  let resolvedDeclNode: TstsNode | undefined;
  if (declId) {
    const declInfo = (binding as BindingInternal)
      ._getHandleRegistry()
      .getDecl(declId);
    if (declInfo) {
      const declNode = (declInfo.typeDeclNode ??
        declInfo.declNode) as TstsNode | undefined;
      resolvedDeclNode = declNode;
      if (declNode && TstsSyntax.IsTypeParameterDeclaration(declNode)) {
        return { kind: "typeParameterType", name: typeName };
      }

      if (declNode && TstsSyntax.IsEnumMember(declNode)) {
        const literalValue = tryReadEnumMemberLiteralValue(declNode);
        return literalValue === undefined
          ? { kind: "unknownType" }
          : { kind: "literalType", value: literalValue };
      }

      // ExtensionMethods import specifier erasure
      if (
        declNode &&
        TstsSyntax.IsImportSpecifier(declNode) &&
        (identifierText(TstsSyntax.AsImportSpecifier(declNode)?.PropertyName) ??
          identifierText(TstsSyntax.AsImportSpecifier(declNode)?.name)) ===
          "ExtensionMethods" &&
        typeArguments.length === 1
      ) {
        const shape = typeArguments[0];
        return shape ? convertType(shape, binding) : { kind: "unknownType" };
      }

      const firstTypeArg = typeArguments[0];
      const isConcreteClassReference =
        declNode &&
        (TstsSyntax.IsClassDeclaration(declNode) ||
          TstsSyntax.IsClassExpression(declNode));
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
      if (declNode && TstsSyntax.IsTypeAliasDeclaration(declNode)) {
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
  const convertedTypeArguments = typeArguments.map((t) =>
    convertType(t, binding)
  );
  const externalImportIdentity = binding.resolveExternalImportType(node);
  if (externalImportIdentity) {
    return {
      kind: "referenceType",
      name: externalImportIdentity.sourceName,
      typeArguments: convertedTypeArguments,
      providerQualifiedName: externalImportIdentity.providerQualifiedName,
      structuralOrigin: "namedReference",
    };
  }

  // Use resolved symbol name to keep IR nominal identity stable
  const resolvedName = (() => {
    if (!declId) return typeName;
    const declInfo = (binding as BindingInternal)
      ._getHandleRegistry()
      .getDecl(declId);
    return declInfo?.fqName ?? typeName;
  })();
  const providerQualifiedName = resolveSourceTargetIdentity(declId, binding);
  const markerQualifiedName = resolvedDeclNode
    ? getSourceBindingAliasFromDeclaration(resolvedDeclNode)
    : undefined;
  const referenceName = markerQualifiedName ?? resolvedName;

  // ExtensionMethods wrapper erasure for resolved names
  if (
    (resolvedName.startsWith("ExtensionMethods_") ||
      resolvedName === "ExtensionMethods") &&
    typeArguments.length === 1
  ) {
    const shape = typeArguments[0];
    return shape ? convertType(shape, binding) : { kind: "unknownType" };
  }

  const substitutedStructuralMembers = (() => {
    if (!structuralMembers || structuralMembers.length === 0) {
      return structuralMembers;
    }

    const declaringType =
      resolvedDeclNode &&
      (TstsSyntax.IsClassDeclaration(resolvedDeclNode) ||
        TstsSyntax.IsInterfaceDeclaration(resolvedDeclNode) ||
        TstsSyntax.IsTypeAliasDeclaration(resolvedDeclNode))
        ? resolvedDeclNode
        : undefined;
    const formalTypeParameters =
      declaringType
        ? (TstsSyntax.Node_TypeParameters(declaringType) ?? [])
            .map((parameter) =>
              identifierText(TstsSyntax.Node_Name(parameter))
            )
            .filter((name): name is string => name !== undefined)
        : [];
    const substitution = (() => {
      if (formalTypeParameters.length === 0) {
        return undefined;
      }

      const map = new Map<string, IrType>();
      for (
        let i = 0;
        i <
        Math.min(
          formalTypeParameters.length,
          convertedTypeArguments?.length ?? 0
        );
        i++
      ) {
        const formal = formalTypeParameters[i];
        const explicit = convertedTypeArguments?.[i];
        if (formal && explicit) {
          map.set(formal, explicit);
        }
      }

      return map.size > 0 ? map : undefined;
    })();
    if (!substitution || substitution.size === 0) {
      return structuralMembers;
    }

    const substitutedType = substituteIrType(
      {
        kind: "referenceType",
        name: referenceName,
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

  const firstTypeArg = typeArguments[0];
  const isConcreteClassReference =
    !!resolvedDeclNode &&
    (TstsSyntax.IsClassDeclaration(resolvedDeclNode) ||
      TstsSyntax.IsClassExpression(resolvedDeclNode));

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
    name: referenceName,
    typeArguments: convertedTypeArguments,
    providerQualifiedName,
    typeId: providerQualifiedName
      ? undefined
      : sourceIntrinsicTypeId(referenceName),
    structuralOrigin: "namedReference",
    ...(substitutedStructuralMembers
      ? { structuralMembers: substitutedStructuralMembers }
      : {}),
  };
};
