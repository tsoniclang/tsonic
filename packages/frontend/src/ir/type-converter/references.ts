/**
 * Reference type conversion
 */

import * as ts from "typescript";
import { IrType, IrDictionaryType } from "../types.js";
import { isPrimitiveTypeName, getPrimitiveType } from "./primitives.js";
import {
  isExpandableUtilityType,
  expandUtilityType,
  isExpandableConditionalUtilityType,
  expandConditionalUtilityType,
  expandRecordType,
} from "./utility-types.js";

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

  // Check for expandable conditional utility types (NonNullable, Exclude, Extract)
  // These are expanded at compile time by delegating to TypeScript's type checker
  if (
    isExpandableConditionalUtilityType(typeName) &&
    node.typeArguments?.length
  ) {
    const expanded = expandConditionalUtilityType(
      node,
      typeName,
      checker,
      convertType
    );
    if (expanded) return expanded;
    // Fall through to referenceType if can't expand (e.g., type parameter)
  }

  // Check for Record<K, V> utility type
  // First try to expand to IrObjectType for finite literal keys
  // Falls back to IrDictionaryType ONLY for string/number keys (not type parameters)
  const typeArgsForRecord = node.typeArguments;
  const keyTypeNode = typeArgsForRecord?.[0];
  const valueTypeNode = typeArgsForRecord?.[1];
  if (typeName === "Record" && keyTypeNode && valueTypeNode) {
    // Try to expand to IrObjectType for finite literal keys
    const expandedRecord = expandRecordType(node, checker, convertType);
    if (expandedRecord) return expandedRecord;

    // Only create dictionary if K is exactly 'string' or 'number'
    // Type parameters should fall through to referenceType
    //
    // NOTE: We check SyntaxKind FIRST because getTypeAtLocation fails on synthesized nodes
    // (from typeToTypeNode). For synthesized nodes like NumberKeyword, getTypeAtLocation
    // returns `any` instead of the correct type. Checking SyntaxKind handles both cases.
    const isStringKey =
      keyTypeNode.kind === ts.SyntaxKind.StringKeyword ||
      !!(checker.getTypeAtLocation(keyTypeNode).flags & ts.TypeFlags.String);
    const isNumberKey =
      keyTypeNode.kind === ts.SyntaxKind.NumberKeyword ||
      !!(checker.getTypeAtLocation(keyTypeNode).flags & ts.TypeFlags.Number);

    if (isStringKey || isNumberKey) {
      const keyType = convertType(keyTypeNode, checker);
      const valueType = convertType(valueTypeNode, checker);

      return {
        kind: "dictionaryType",
        keyType,
        valueType,
      } as IrDictionaryType;
    }
    // Type parameter or other complex key type - fall through to referenceType
  }

  // Check for expandable utility types (Partial, Required, Readonly, Pick, Omit)
  // These are expanded to IrObjectType at compile time for concrete types
  if (isExpandableUtilityType(typeName) && node.typeArguments?.length) {
    const expanded = expandUtilityType(node, typeName, checker, convertType);
    if (expanded) return expanded;
    // Fall through to referenceType if can't expand (e.g., type parameter)
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
