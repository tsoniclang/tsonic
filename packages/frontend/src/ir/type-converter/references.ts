/**
 * Reference type conversion
 */

import * as ts from "typescript";
import {
  IrType,
  IrDictionaryType,
  IrInterfaceMember,
  IrPropertySignature,
  IrMethodSignature,
} from "../types.js";
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

/**
 * Extract structural members from a resolved type.
 *
 * Used to populate structuralMembers on referenceType for interfaces and type aliases.
 * This enables TSN5110 validation for object literal properties against expected types.
 *
 * Returns undefined if:
 * - Type is a type parameter (generic)
 * - Type has no properties
 * - Type has index signatures (can't be fully represented)
 * - Type has non-string keys (symbols, computed)
 *
 * @param resolvedType - The resolved TypeScript type
 * @param node - The enclosing node for type-to-node conversion
 * @param checker - The TypeScript type checker
 * @param convertType - Function to convert nested types
 * @returns Structural members or undefined if extraction fails
 */
const extractStructuralMembers = (
  resolvedType: ts.Type,
  node: ts.Node,
  checker: ts.TypeChecker,
  convertType: (node: ts.TypeNode, checker: ts.TypeChecker) => IrType
): readonly IrInterfaceMember[] | undefined => {
  // Don't extract for type parameters
  if (resolvedType.flags & ts.TypeFlags.TypeParameter) {
    return undefined;
  }

  // Get properties
  const properties = resolvedType.getProperties();
  if (!properties || properties.length === 0) {
    return undefined;
  }

  // Check for index signatures - can't fully represent these structurally
  const stringIndexType = checker.getIndexInfoOfType(
    resolvedType,
    ts.IndexKind.String
  );
  const numberIndexType = checker.getIndexInfoOfType(
    resolvedType,
    ts.IndexKind.Number
  );
  if (stringIndexType || numberIndexType) {
    return undefined;
  }

  // Extract members
  const members: IrInterfaceMember[] = [];

  for (const prop of properties) {
    const propName = prop.getName();

    // Skip non-string keys (symbols, computed)
    if (propName.startsWith("__@") || propName.startsWith("[")) {
      return undefined; // Can't represent all members, bail out
    }

    const propType = checker.getTypeOfSymbolAtLocation(prop, node);
    const declarations = prop.getDeclarations();

    // Check optional/readonly
    const isOptional = (prop.flags & ts.SymbolFlags.Optional) !== 0;
    const isReadonly =
      declarations?.some((decl) => {
        if (ts.isPropertySignature(decl) || ts.isPropertyDeclaration(decl)) {
          return (
            decl.modifiers?.some(
              (m) => m.kind === ts.SyntaxKind.ReadonlyKeyword
            ) ?? false
          );
        }
        return false;
      }) ?? false;

    // Check if it's a method
    const isMethod =
      declarations?.some(
        (decl) => ts.isMethodSignature(decl) || ts.isMethodDeclaration(decl)
      ) ?? false;

    const typeNodeFlags = ts.NodeBuilderFlags.NoTruncation;
    const propTypeNode = checker.typeToTypeNode(propType, node, typeNodeFlags);

    if (isMethod && propTypeNode && ts.isFunctionTypeNode(propTypeNode)) {
      // Method signature
      const methSig: IrMethodSignature = {
        kind: "methodSignature",
        name: propName,
        parameters: propTypeNode.parameters.map((param, index) => ({
          kind: "parameter" as const,
          pattern: {
            kind: "identifierPattern" as const,
            name: ts.isIdentifier(param.name) ? param.name.text : `arg${index}`,
          },
          type: param.type ? convertType(param.type, checker) : undefined,
          isOptional: !!param.questionToken,
          isRest: !!param.dotDotDotToken,
          passing: "value" as const,
        })),
        returnType: propTypeNode.type
          ? convertType(propTypeNode.type, checker)
          : undefined,
      };
      members.push(methSig);
    } else {
      // Property signature
      const propSig: IrPropertySignature = {
        kind: "propertySignature",
        name: propName,
        type: propTypeNode
          ? convertType(propTypeNode, checker)
          : { kind: "anyType" },
        isOptional,
        isReadonly,
      };
      members.push(propSig);
    }
  }

  return members.length > 0 ? members : undefined;
};

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

  // Check for CLR primitive type names (e.g., int from @tsonic/types)
  // These are compiler-known types that map to distinct primitives, not referenceType
  if (isClrPrimitiveTypeName(typeName)) {
    return getClrPrimitiveType(typeName);
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

  // Extract structural members for interfaces and type aliases.
  // This enables TSN5110 validation for object literal properties.
  const structuralMembers = extractStructuralMembers(
    type,
    node,
    checker,
    convertType
  );

  // Reference type (user-defined or library)
  return {
    kind: "referenceType",
    name: typeName,
    typeArguments: node.typeArguments?.map((t) => convertType(t, checker)),
    structuralMembers,
  };
};
