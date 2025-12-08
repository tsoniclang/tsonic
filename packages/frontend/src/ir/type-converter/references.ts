/**
 * Reference type conversion
 */

import * as ts from "typescript";
import { IrType, IrDictionaryType } from "../types.js";
import { isPrimitiveTypeName, getPrimitiveType } from "./primitives.js";

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

  // NOTE: ref<T>, out<T>, In<T> are no longer supported as types.
  // Parameter modifiers will be expressed via syntax in the future.
  // If someone uses ref<T> etc., it will fall through to referenceType
  // and the validation pass will reject it with a hard error.

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
