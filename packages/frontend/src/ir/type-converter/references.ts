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

  // Check for Record<K, V> utility type → convert to IrDictionaryType
  if (typeName === "Record" && node.typeArguments?.length === 2) {
    const keyType = convertType(node.typeArguments[0]!, checker);
    const valueType = convertType(node.typeArguments[1]!, checker);

    return {
      kind: "dictionaryType",
      keyType,
      valueType,
    } as IrDictionaryType;
  }

  // Check if this is a parameter modifier type (ref/out/In) from @tsonic/types
  const registry = getParameterModifierRegistry();
  const modifierKind = registry.getParameterModifierKind(typeName);

  if (modifierKind && node.typeArguments && node.typeArguments.length > 0) {
    // This is ref<T>, out<T>, or In<T> from @tsonic/types
    // Convert it to a special IR type that preserves the modifier
    const wrappedType = convertType(node.typeArguments[0]!, checker);

    return {
      kind: "referenceType",
      name: typeName,
      typeArguments: [wrappedType],
      // Add metadata to indicate this is a parameter modifier
      parameterModifier: modifierKind,
    } as IrType & { parameterModifier?: "ref" | "out" | "in" };
  }

  // Reference type (user-defined or library)
  return {
    kind: "referenceType",
    name: typeName,
    typeArguments: node.typeArguments?.map((t) => convertType(t, checker)),
  };
};
