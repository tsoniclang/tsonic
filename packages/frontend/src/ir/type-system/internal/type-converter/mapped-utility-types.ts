/**
 * Mapped utility type expansion - Partial, Required, Readonly, Pick, Omit, Record
 *
 * DETERMINISTIC IR TYPING (INV-0 compliant):
 * These utility types are expanded using AST-based analysis only.
 * No banned APIs (getTypeAtLocation, getTypeOfSymbolAtLocation, typeToTypeNode).
 * Uses Binding for symbol resolution and extracts types from TypeNodes.
 */

import * as ts from "typescript";
import {
  IrType,
  IrObjectType,
  IrPropertySignature,
  IrInterfaceMember,
} from "../../../types.js";
import type { Binding, BindingInternal } from "../../../binding/index.js";

/**
 * Set of supported mapped utility types that can be expanded
 */
export const EXPANDABLE_UTILITY_TYPES = new Set([
  "Partial",
  "Required",
  "Readonly",
  "Pick",
  "Omit",
]);

/**
 * Check if a type name is an expandable utility type
 */
export const isExpandableUtilityType = (name: string): boolean =>
  EXPANDABLE_UTILITY_TYPES.has(name);

/**
 * Check if a TypeNode is a type parameter reference (symbol-based, INV-0 compliant)
 */
export const isTypeParameterNode = (
  node: ts.TypeNode,
  binding: Binding
): boolean => {
  if (!ts.isTypeReferenceNode(node)) return false;
  if (!ts.isIdentifier(node.typeName)) return false;

  // Use Binding to resolve the type reference
  const declId = binding.resolveTypeReference(node);
  if (!declId) return false;

  const declInfo = (binding as BindingInternal)
    ._getHandleRegistry()
    .getDecl(declId);
  if (!declInfo) return false;

  // Check if the declaration is a type parameter
  const decl = declInfo.declNode as ts.Declaration | undefined;
  return decl ? ts.isTypeParameterDeclaration(decl) : false;
};

/**
 * Check if a TypeNode recursively contains type parameters.
 * Uses symbol-based checks only (INV-0 compliant).
 */
export const typeNodeContainsTypeParameter = (
  node: ts.TypeNode,
  binding: Binding
): boolean => {
  if (isTypeParameterNode(node, binding)) {
    return true;
  }

  if (ts.isUnionTypeNode(node)) {
    return node.types.some((t) => typeNodeContainsTypeParameter(t, binding));
  }

  if (ts.isIntersectionTypeNode(node)) {
    return node.types.some((t) => typeNodeContainsTypeParameter(t, binding));
  }

  if (ts.isArrayTypeNode(node)) {
    return typeNodeContainsTypeParameter(node.elementType, binding);
  }

  if (ts.isTypeReferenceNode(node) && node.typeArguments) {
    return node.typeArguments.some((t) =>
      typeNodeContainsTypeParameter(t, binding)
    );
  }

  return false;
};

const isInternalMarkerMemberName = (name: string): boolean =>
  name === "__brand" ||
  name.startsWith("__tsonic_type_") ||
  name.startsWith("__tsonic_iface_") ||
  name.startsWith("__tsonic_binding_alias_");

/**
 * Extract members from an interface or type alias declaration (AST-based).
 * Used for utility type expansion.
 */
const extractMembersFromDeclaration = (
  decl: ts.Declaration,
  binding: Binding,
  convertType: (node: ts.TypeNode, binding: Binding) => IrType
): readonly IrInterfaceMember[] | null => {
  // Get type elements from declaration
  const typeElements = ts.isInterfaceDeclaration(decl)
    ? decl.members
    : ts.isTypeAliasDeclaration(decl) && ts.isTypeLiteralNode(decl.type)
      ? decl.type.members
      : undefined;

  if (!typeElements) {
    return null;
  }

  // Check for index signatures - can't expand these
  for (const member of typeElements) {
    if (ts.isIndexSignatureDeclaration(member)) {
      return null;
    }
  }

  const members: IrInterfaceMember[] = [];

  for (const member of typeElements) {
    if (ts.isPropertySignature(member)) {
      const propName = ts.isIdentifier(member.name)
        ? member.name.text
        : ts.isStringLiteral(member.name)
          ? member.name.text
          : undefined;

      if (!propName || !member.type || isInternalMarkerMemberName(propName)) {
        continue; // Skip computed keys or untyped properties
      }

      const isOptional = !!member.questionToken;
      const isReadonly =
        member.modifiers?.some(
          (m) => m.kind === ts.SyntaxKind.ReadonlyKeyword
        ) ?? false;

      members.push({
        kind: "propertySignature",
        name: propName,
        type: convertType(member.type, binding),
        isOptional,
        isReadonly,
      });
    }

    if (ts.isMethodSignature(member)) {
      const methodName = ts.isIdentifier(member.name)
        ? member.name.text
        : ts.isStringLiteral(member.name)
          ? member.name.text
          : undefined;

      if (!methodName || isInternalMarkerMemberName(methodName)) {
        continue; // Skip computed keys
      }

      members.push({
        kind: "methodSignature",
        name: methodName,
        parameters: member.parameters.map((param, index) => ({
          kind: "parameter" as const,
          pattern: {
            kind: "identifierPattern" as const,
            name: ts.isIdentifier(param.name) ? param.name.text : `arg${index}`,
          },
          type: param.type ? convertType(param.type, binding) : undefined,
          isOptional: !!param.questionToken,
          isRest: !!param.dotDotDotToken,
          passing: "value" as const,
        })),
        returnType: member.type ? convertType(member.type, binding) : undefined,
      });
    }
  }

  return members.length > 0 ? members : null;
};

/**
 * Extract literal keys from a TypeNode (AST-based).
 * Returns null if the type contains non-literal constituents or is a type parameter.
 */
const extractLiteralKeysFromTypeNode = (
  node: ts.TypeNode,
  binding: Binding
): Set<string> | null => {
  // Check for type parameter
  if (isTypeParameterNode(node, binding)) {
    return null;
  }

  // Handle string literal: "foo"
  if (ts.isLiteralTypeNode(node) && ts.isStringLiteral(node.literal)) {
    return new Set([node.literal.text]);
  }

  // Handle number literal: 1
  if (ts.isLiteralTypeNode(node) && ts.isNumericLiteral(node.literal)) {
    return new Set([node.literal.text]);
  }

  // Handle union: "a" | "b" | "c"
  if (ts.isUnionTypeNode(node)) {
    const keys = new Set<string>();
    for (const member of node.types) {
      if (ts.isLiteralTypeNode(member)) {
        if (ts.isStringLiteral(member.literal)) {
          keys.add(member.literal.text);
        } else if (ts.isNumericLiteral(member.literal)) {
          keys.add(member.literal.text);
        } else {
          return null; // Non-string/number literal
        }
      } else {
        return null; // Non-literal in union
      }
    }
    return keys;
  }

  // String keyword - infinite set, can't expand
  if (node.kind === ts.SyntaxKind.StringKeyword) {
    return null;
  }

  // Number keyword - infinite set, can't expand
  if (node.kind === ts.SyntaxKind.NumberKeyword) {
    return null;
  }

  return null; // Not supported
};

/**
 * Expand a mapped utility type to an IrObjectType.
 *
 * DETERMINISTIC IR TYPING (INV-0 compliant):
 * Uses AST-based analysis only. Gets members from type declarations,
 * not from ts.Type resolution.
 *
 * @param node - The TypeReferenceNode for the utility type
 * @param typeName - The name of the utility type (Partial, Required, etc.)
 * @param binding - The Binding layer for symbol resolution
 * @param convertType - Function to convert nested types
 * @returns IrObjectType with the expanded properties, or null if expansion fails
 */
export const expandUtilityType = (
  node: ts.TypeReferenceNode,
  typeName: string,
  binding: Binding,
  convertType: (node: ts.TypeNode, binding: Binding) => IrType
): IrObjectType | null => {
  const debug = !!process.env.DEBUG_UTILITY;
  if (debug) console.log(`[UTILITY] Expanding ${typeName}`);

  const typeArgs = node.typeArguments;
  if (!typeArgs || typeArgs.length === 0) {
    if (debug) console.log(`[UTILITY] No type args`);
    return null;
  }

  // Get the target type argument (first argument for all mapped utilities)
  const targetArg = typeArgs[0];
  if (!targetArg) {
    if (debug) console.log(`[UTILITY] No target arg`);
    return null;
  }

  // Check if target is a type parameter (can't expand generics)
  if (isTypeParameterNode(targetArg, binding)) {
    if (debug) console.log(`[UTILITY] Target is type param`);
    return null;
  }

  // For Pick/Omit, check if the keys argument is a type parameter
  if ((typeName === "Pick" || typeName === "Omit") && typeArgs.length >= 2) {
    const keysArg = typeArgs[1];
    if (keysArg && isTypeParameterNode(keysArg, binding)) {
      if (debug) console.log(`[UTILITY] Keys is type param`);
      return null;
    }
  }

  // Get base members - either from declaration or from recursive expansion
  let baseMembers: readonly IrInterfaceMember[] | null = null;

  // Get the target type's declaration
  if (!ts.isTypeReferenceNode(targetArg)) {
    // Only support named type references (not inline object types)
    if (debug)
      console.log(
        `[UTILITY] Target not TypeRef: ${ts.SyntaxKind[targetArg.kind]}`
      );
    return null;
  }

  const targetName = ts.isIdentifier(targetArg.typeName)
    ? targetArg.typeName.text
    : undefined;
  if (!targetName) {
    if (debug) console.log(`[UTILITY] No target name`);
    return null;
  }
  if (debug) console.log(`[UTILITY] Target: ${targetName}`);

  // Check if target is itself a utility type (nested utility types)
  if (isExpandableUtilityType(targetName) && targetArg.typeArguments?.length) {
    // Recursively expand the inner utility type first
    const innerExpanded = expandUtilityType(
      targetArg,
      targetName,
      binding,
      convertType
    );
    if (innerExpanded) {
      if (debug)
        console.log(
          `[UTILITY] Recursively expanded ${targetName}, got ${innerExpanded.members.length} members`
        );
      baseMembers = innerExpanded.members;
    } else {
      if (debug)
        console.log(`[UTILITY] Recursive expansion of ${targetName} failed`);
      return null;
    }
  } else {
    // Not a utility type, resolve from declaration using Binding
    const declId = binding.resolveTypeReference(targetArg);
    if (!declId) {
      if (debug) console.log(`[UTILITY] No DeclId for ${targetName}`);
      return null;
    }

    const declInfo = (binding as BindingInternal)
      ._getHandleRegistry()
      .getDecl(declId);
    if (!declInfo?.declNode) {
      if (debug) console.log(`[UTILITY] No declaration for ${targetName}`);
      return null;
    }

    const decl = declInfo.declNode as ts.Declaration;
    if (debug)
      console.log(`[UTILITY] Found declaration: ${ts.SyntaxKind[decl.kind]}`);

    // Check if it's an interface or type alias
    if (!ts.isInterfaceDeclaration(decl) && !ts.isTypeAliasDeclaration(decl)) {
      if (debug) console.log(`[UTILITY] No interface/type alias decl`);
      return null;
    }

    // Extract members from declaration (AST-based)
    baseMembers = extractMembersFromDeclaration(decl, binding, convertType);
    if (!baseMembers) {
      if (debug)
        console.log(`[UTILITY] extractMembersFromDeclaration returned null`);
      return null;
    }
    if (debug) console.log(`[UTILITY] Extracted ${baseMembers.length} members`);
  }

  if (!baseMembers) {
    return null;
  }

  // Handle Pick/Omit - filter members by keys
  if (typeName === "Pick" || typeName === "Omit") {
    const keysArg = typeArgs[1];
    if (!keysArg) {
      return null;
    }

    const keys = extractLiteralKeysFromTypeNode(keysArg, binding);
    if (!keys) {
      return null; // Can't extract literal keys
    }

    const filteredMembers = baseMembers.filter((m) => {
      const include =
        typeName === "Pick" ? keys.has(m.name) : !keys.has(m.name);
      return include;
    });

    return { kind: "objectType", members: filteredMembers };
  }

  // Apply Partial/Required/Readonly transformations
  const transformedMembers = baseMembers.map((m): IrInterfaceMember => {
    if (m.kind === "propertySignature") {
      const isOptional =
        typeName === "Partial"
          ? true
          : typeName === "Required"
            ? false
            : m.isOptional;
      const isReadonly = typeName === "Readonly" ? true : m.isReadonly;

      return {
        ...m,
        isOptional,
        isReadonly,
      };
    }
    return m;
  });

  return { kind: "objectType", members: transformedMembers };
};

/**
 * Expand Record<K, T> to IrObjectType when K is a finite set of literal keys.
 *
 * DETERMINISTIC IR TYPING (INV-0 compliant):
 * Uses AST-based analysis only. Extracts literal keys from TypeNode,
 * not from ts.Type.
 *
 * Gating conditions:
 * - Returns null if K contains type parameters (generic context)
 * - Returns null if K is string or number (should remain IrDictionaryType)
 * - Returns null if K contains non-literal types
 *
 * Examples:
 * - Record<"a" | "b", number> → IrObjectType with props {a: number, b: number}
 * - Record<1 | 2, string> → IrObjectType with props {"1": string, "2": string}
 * - Record<string, number> → null (use IrDictionaryType)
 * - Record<K, T> → null (type parameter)
 *
 * @param node - The TypeReferenceNode for Record<K, T>
 * @param binding - The Binding layer for symbol resolution
 * @param convertType - Function to convert nested types
 * @returns IrObjectType with the expanded properties, or null if should use dictionary
 */
export const expandRecordType = (
  node: ts.TypeReferenceNode,
  binding: Binding,
  convertType: (node: ts.TypeNode, binding: Binding) => IrType
): IrObjectType | null => {
  const typeArgs = node.typeArguments;
  if (!typeArgs || typeArgs.length !== 2) {
    return null;
  }

  const keyTypeNode = typeArgs[0];
  const valueTypeNode = typeArgs[1];

  if (!keyTypeNode || !valueTypeNode) {
    return null;
  }

  // Check for type parameters in key (AST-based)
  if (typeNodeContainsTypeParameter(keyTypeNode, binding)) {
    return null;
  }

  // Check for type parameters in value (AST-based)
  if (typeNodeContainsTypeParameter(valueTypeNode, binding)) {
    return null;
  }

  // Try to extract finite literal keys (AST-based)
  const literalKeys = extractLiteralKeysFromTypeNode(keyTypeNode, binding);
  if (literalKeys === null || literalKeys.size === 0) {
    // Not a finite set of literals - use IrDictionaryType
    return null;
  }

  // Convert the value type
  const irValueType = convertType(valueTypeNode, binding);

  // Build IrObjectType with a property for each key
  // Prefix numeric keys with '_' to make them valid C# identifiers
  const members: IrPropertySignature[] = Array.from(literalKeys).map((key) => ({
    kind: "propertySignature" as const,
    name: /^\d/.test(key) ? `_${key}` : key,
    type: irValueType,
    isOptional: false,
    isReadonly: false,
  }));

  return { kind: "objectType", members };
};

type TriBool = true | false | null;

export const flattenUnionIrType = (type: IrType): readonly IrType[] => {
  if (type.kind === "neverType") return [];
  if (type.kind !== "unionType") return [type];

  const flat: IrType[] = [];
  for (const t of type.types) {
    flat.push(...flattenUnionIrType(t));
  }
  return flat;
};

export const isProvablyAssignable = (
  source: IrType,
  target: IrType
): TriBool => {
  // Union target: assignable if assignable to any constituent
  if (target.kind === "unionType") {
    let sawUnknown = false;
    for (const t of target.types) {
      const res = isProvablyAssignable(source, t);
      if (res === true) return true;
      if (res === null) sawUnknown = true;
    }
    return sawUnknown ? null : false;
  }

  // Top types
  if (target.kind === "anyType") return true;
  if (target.kind === "unknownType") return true;

  // Bottom
  if (target.kind === "neverType") return source.kind === "neverType";
  if (source.kind === "neverType") return true;

  // Exact literals
  if (source.kind === "literalType" && target.kind === "literalType") {
    return source.value === target.value;
  }

  // Primitive <-> primitive
  if (source.kind === "primitiveType" && target.kind === "primitiveType") {
    return source.name === target.name;
  }

  // Literal -> primitive
  if (source.kind === "literalType" && target.kind === "primitiveType") {
    switch (typeof source.value) {
      case "string":
        return target.name === "string";
      case "number":
        // Numeric literal types are always assignable to `number`.
        // Assignability to `int` is intentionally left unknown here (range-dependent).
        if (target.name === "number") return true;
        if (target.name === "int") return null;
        return false;
      case "boolean":
        return target.name === "boolean";
      default:
        return null;
    }
  }

  // Primitive -> literal is never provable (would require narrowing)
  if (source.kind === "primitiveType" && target.kind === "literalType") {
    return false;
  }

  // Other kinds (reference types, functions, objects, etc.) require richer typing.
  return null;
};
