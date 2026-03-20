/**
 * Record type expansion and type assignability helpers.
 *
 * Contains expandRecordType for expanding Record<K, T> to IrObjectType,
 * flattenUnionIrType, and isProvablyAssignable.
 */

import * as ts from "typescript";
import { IrType, IrObjectType, IrPropertySignature } from "../../../types.js";
import type { Binding } from "../../../binding/index.js";
import {
  isTypeParameterNode,
  typeNodeContainsTypeParameter,
} from "./mapped-utility-expansion.js";

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
