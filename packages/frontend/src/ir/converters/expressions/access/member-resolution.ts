/**
 * Member access property type resolution and name extraction helpers
 *
 * ALICE'S SPEC: All member type queries go through TypeSystem.typeOfMember().
 * Falls back to Binding-resolved MemberId only when the receiver type cannot
 * be normalized nominally (e.g., tsbindgen `$instance & __views` intersections).
 */

import * as ts from "typescript";
import { IrType, ComputedAccessKind } from "../../../types.js";
import type { ProgramContext } from "../../../program-context.js";

/**
 * Fallback for getDeclaredPropertyType when TypeSystem can't resolve the member.
 * Uses TypeSystem.typeOfMemberId() to get member types for:
 * - Built-in types from globals (Array.Length, string.Length, etc.)
 * - CLR-bound types from tsbindgen
 * - Types with inherited members not in TypeRegistry
 *
 * ALICE'S SPEC: Uses TypeSystem as single source of truth.
 */
const getDeclaredPropertyTypeFallback = (
  node: ts.PropertyAccessExpression,
  ctx: ProgramContext
): IrType | undefined => {
  // ALICE'S SPEC: Use TypeSystem.typeOfMemberId() to get member type
  const typeSystem = ctx.typeSystem;

  // Resolve property member through Binding layer
  const memberId = ctx.binding.resolvePropertyAccess(node);
  if (!memberId) return undefined;

  // Use TypeSystem.typeOfMemberId() to get the member's declared type
  const memberType = typeSystem.typeOfMemberId(memberId);

  // If TypeSystem returns unknownType, treat as not found
  if (memberType.kind === "unknownType") {
    return undefined;
  }

  return memberType;
};

/**
 * Get the declared property type from a property access expression.
 *
 * ALICE'S SPEC: Uses TypeSystem.typeOfMember() as primary source.
 * Falls back to Binding for inherited members not in TypeRegistry.
 *
 * @param node - Property access expression node
 * @param receiverIrType - Already-computed IR type of the receiver (object) expression
 * @param ctx - ProgramContext for type system and binding access
 * @returns The deterministically computed property type
 */
export const getDeclaredPropertyType = (
  node: ts.PropertyAccessExpression,
  receiverIrType: IrType | undefined,
  ctx: ProgramContext
): IrType | undefined => {
  const DEBUG = process.env.DEBUG_PROPERTY_TYPE === "1";
  const propertyName = node.name.text;

  if (DEBUG) {
    console.log(
      "[getDeclaredPropertyType]",
      propertyName,
      "on receiver:",
      receiverIrType
    );
  }

  // Try TypeSystem.typeOfMember() first
  const typeSystem = ctx.typeSystem;
  if (receiverIrType && receiverIrType.kind !== "unknownType") {
    const memberType = typeSystem.typeOfMember(receiverIrType, {
      kind: "byName",
      name: propertyName,
    });
    if (DEBUG) {
      console.log(
        "[getDeclaredPropertyType]",
        propertyName,
        "TypeSystem returned:",
        memberType
      );
    }
    // If TypeSystem returned a valid type (not unknownType), use it
    if (memberType.kind !== "unknownType") {
      return memberType;
    }
    // Fall through to Binding fallback
  }

  // Fallback: Use Binding for inherited members not in TypeRegistry
  // (e.g., Array.Length from Array$instance)
  const fallbackResult = getDeclaredPropertyTypeFallback(node, ctx);
  if (DEBUG) {
    console.log(
      "[getDeclaredPropertyType]",
      propertyName,
      "fallback returned:",
      fallbackResult
    );
  }
  return fallbackResult;
};

/**
 * Normalize a receiver type for computed access classification.
 *
 * This supports common TS shapes that appear at runtime:
 * - Nullish unions (`T | undefined` / `T | null | undefined`)
 * - tsbindgen-style intersection views (`T$instance & __T$views`, and primitives like
 *   `string & String$instance & __String$views`)
 *
 * The goal is to preserve deterministic proof behavior without heuristics.
 */
export const normalizeForComputedAccess = (
  type: IrType | undefined
): IrType | undefined => {
  if (!type) return undefined;

  if (type.kind === "unionType") {
    const nonNullish = type.types.filter(
      (t) =>
        !(
          t.kind === "primitiveType" &&
          (t.name === "null" || t.name === "undefined")
        )
    );
    if (nonNullish.length === 1) {
      const only = nonNullish[0];
      return only ? normalizeForComputedAccess(only) : undefined;
    }
  }

  if (type.kind === "intersectionType") {
    const pick =
      type.types.find((t) => t.kind === "arrayType") ??
      type.types.find((t) => t.kind === "dictionaryType") ??
      type.types.find(
        (t) => t.kind === "primitiveType" && t.name === "string"
      ) ??
      type.types.find((t) => t.kind === "referenceType");

    return pick ? normalizeForComputedAccess(pick) : type;
  }

  return type;
};

/**
 * Classify computed member access for proof pass.
 * This determines whether Int32 proof is required for the index.
 *
 * Classification is based on IR type kinds, NOT string matching.
 * CLR indexers (arrays, List<T>, etc.) require Int32 proof for indices.
 *
 * IMPORTANT: If classification cannot be determined reliably for a CLR-bound
 * reference type, we conservatively assume `clrIndexer` (requires Int32 proof).
 * This is safer than allowing arbitrary dictionary access without proof.
 *
 * @param objectType - The inferred type of the object being accessed
 * @returns The access kind classification
 */
export const classifyComputedAccess = (
  objectType: IrType | undefined,
  ctx: ProgramContext
): ComputedAccessKind => {
  const normalized = normalizeForComputedAccess(objectType);
  if (!normalized) return "unknown";
  objectType = normalized;

  // TypeScript array type (number[], T[], etc.)
  // Requires Int32 proof
  if (objectType.kind === "arrayType") {
    return "clrIndexer";
  }

  // IR dictionary type - this is the PRIMARY way to detect dictionaries
  // tsbindgen should emit dictionaryType for Record<K,V> and {[key: K]: V}
  if (objectType.kind === "dictionaryType") {
    return "dictionary";
  }

  // String character access: string[int]
  if (objectType.kind === "primitiveType" && objectType.name === "string") {
    return "stringChar";
  }

  if (objectType.kind === "referenceType") {
    const indexer = ctx.typeSystem.getIndexerInfo(objectType);
    if (!indexer) return "clrIndexer";
    return indexer.keyClrType === "System.Int32" ? "clrIndexer" : "dictionary";
  }

  return "unknown";
};

/**
 * Extract the type name from an inferred type for binding lookup.
 * Handles tsbindgen's naming convention where instance types are suffixed with $instance
 * (e.g., List_1$instance → List_1 for binding lookup)
 *
 * Also handles intersection types like `TypeName$instance & __TypeName$views`
 * which are common in tsbindgen-generated types. In this case, we look for
 * the $instance member and extract the type name from it.
 */
export const extractTypeName = (
  inferredType: IrType | undefined
): string | undefined => {
  if (!inferredType) return undefined;

  // Handle common nullish unions like `Uri | undefined` by stripping null/undefined.
  // This enables CLR member binding after explicit null checks in source code.
  if (inferredType.kind === "unionType") {
    const nonNullish = inferredType.types.filter(
      (t) =>
        !(
          t.kind === "primitiveType" &&
          (t.name === "null" || t.name === "undefined")
        )
    );
    if (nonNullish.length === 1) {
      const only = nonNullish[0];
      return only ? extractTypeName(only) : undefined;
    }
  }

  // Handle primitive types - map to their CLR type names for binding lookup
  // This enables binding resolution for methods like string.Split(), number.ToString()
  if (inferredType.kind === "primitiveType") {
    switch (inferredType.name) {
      case "string":
        return "String"; // System.String
      case "number":
        return "Double"; // System.Double (TS number is double)
      case "boolean":
        return "Boolean"; // System.Boolean
      case "char":
        return "Char"; // System.Char
      default:
        return undefined;
    }
  }

  // Handle literal types - determine the CLR type from the value type
  // This enables binding resolution for string literals like "hello".Split(" ")
  if (inferredType.kind === "literalType") {
    const valueType = typeof inferredType.value;
    switch (valueType) {
      case "string":
        return "String"; // System.String
      case "number":
        return "Double"; // System.Double
      case "boolean":
        return "Boolean"; // System.Boolean
      default:
        return undefined;
    }
  }

  if (inferredType.kind === "referenceType") {
    const name = inferredType.name;

    // Strip $instance suffix from tsbindgen-generated type names
    // e.g., "List_1$instance" → "List_1" for binding lookup
    if (name.endsWith("$instance")) {
      return name.slice(0, -"$instance".length);
    }

    return name;
  }

  // Handle intersection types: TypeName$instance & __TypeName$views
  // This happens when TypeScript expands a type alias to its underlying intersection
  // during property access (e.g., listener.prefixes returns HttpListenerPrefixCollection
  // which is HttpListenerPrefixCollection$instance & __HttpListenerPrefixCollection$views)
  if (inferredType.kind === "intersectionType") {
    // Look for a member that ends with $instance - that's the main type
    for (const member of inferredType.types) {
      if (
        member.kind === "referenceType" &&
        member.name.endsWith("$instance")
      ) {
        // Found the $instance member, strip the suffix to get the type name
        return member.name.slice(0, -"$instance".length);
      }
    }

    // Fallback: look for any referenceType that's not a $views type
    for (const member of inferredType.types) {
      if (
        member.kind === "referenceType" &&
        !member.name.startsWith("__") &&
        !member.name.endsWith("$views")
      ) {
        return member.name;
      }
    }
  }

  return undefined;
};

/**
 * Derive element type from object type for element access.
 * - Array type → element type
 * - Dictionary type → value type
 * - String → string (single character)
 * - Other → undefined
 */
export const deriveElementType = (
  objectType: IrType | undefined,
  ctx: ProgramContext
): IrType | undefined => {
  objectType = normalizeForComputedAccess(objectType);
  if (!objectType) return undefined;

  if (objectType.kind === "arrayType") {
    return objectType.elementType;
  }

  if (objectType.kind === "dictionaryType") {
    return objectType.valueType;
  }

  if (objectType.kind === "primitiveType" && objectType.name === "string") {
    // string[n] returns a single character (string in TS, char in C#)
    return { kind: "primitiveType", name: "string" };
  }

  if (
    objectType.kind === "referenceType" &&
    objectType.name === "Span" &&
    objectType.typeArguments &&
    objectType.typeArguments.length === 1
  ) {
    return objectType.typeArguments[0];
  }

  if (objectType.kind === "referenceType") {
    return ctx.typeSystem.getIndexerInfo(objectType)?.valueType;
  }

  return undefined;
};
