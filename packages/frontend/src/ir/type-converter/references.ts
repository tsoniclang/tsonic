/**
 * Reference type conversion
 */

import * as ts from "typescript";
import { IrType, IrDictionaryType } from "../types.js";
import { isPrimitiveTypeName, getPrimitiveType } from "./primitives.js";
import { getParameterModifierRegistry } from "../../types/parameter-modifiers.js";

/**
 * Convert TypeScript type reference to IR type
 * Handles both primitive type names and user-defined types
 */
export const convertTypeReference = (
  node: ts.TypeReferenceNode,
  checker: ts.TypeChecker,
  convertType: (node: ts.TypeNode, checker: ts.TypeChecker) => IrType
): IrType => {
  const typeName = ts.isIdentifier(node.typeName)
    ? node.typeName.text
    : node.typeName.getText();

  // Check for primitive type names
  if (isPrimitiveTypeName(typeName)) {
    return getPrimitiveType(typeName);
  }

  // Check for Array<T> utility type → convert to arrayType with explicit origin
  // This ensures Array<T> and T[] are treated identically
  const firstTypeArg = node.typeArguments?.[0];
  if (typeName === "Array" && firstTypeArg) {
    return {
      kind: "arrayType",
      elementType: convertType(firstTypeArg, checker),
      origin: "explicit",
    };
  }

  // Check for Record<K, V> utility type → convert to IrDictionaryType
  const typeArgsForRecord = node.typeArguments;
  const keyTypeNode = typeArgsForRecord?.[0];
  const valueTypeNode = typeArgsForRecord?.[1];
  if (typeName === "Record" && keyTypeNode && valueTypeNode) {
    const keyType = convertType(keyTypeNode, checker);
    const valueType = convertType(valueTypeNode, checker);

    return {
      kind: "dictionaryType",
      keyType,
      valueType,
    } as IrDictionaryType;
  }

  // Check if this is a parameter modifier type (ref/out/In) from @tsonic/types
  const registry = getParameterModifierRegistry();
  const modifierKind = registry.getParameterModifierKind(typeName);

  const typeArgsForModifier = node.typeArguments;
  const firstModifierArg = typeArgsForModifier?.[0];
  if (modifierKind && firstModifierArg !== undefined) {
    // This is ref<T>, out<T>, or In<T> from @tsonic/types
    // Convert it to a special IR type that preserves the modifier
    const wrappedType = convertType(firstModifierArg, checker);

    return {
      kind: "referenceType",
      name: typeName,
      typeArguments: [wrappedType],
      // Add metadata to indicate this is a parameter modifier
      parameterModifier: modifierKind,
    } as IrType & { parameterModifier?: "ref" | "out" | "in" };
  }

  // Check if this is a type parameter reference (e.g., T in Container<T>)
  // Use the type checker to determine if the reference resolves to a type parameter
  const type = checker.getTypeAtLocation(node);
  if (type.flags & ts.TypeFlags.TypeParameter) {
    return { kind: "typeParameterType", name: typeName };
  }

  // Reference type (user-defined or library)
  return {
    kind: "referenceType",
    name: typeName,
    typeArguments: node.typeArguments?.map((t) => convertType(t, checker)),
  };
};
