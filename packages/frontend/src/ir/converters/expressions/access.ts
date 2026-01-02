/**
 * Member access expression converters
 *
 * ALICE'S SPEC: All member type queries go through TypeSystem.typeOfMember().
 * Falls back to Binding for inherited members from external packages that
 * TypeRegistry/NominalEnv can't resolve (e.g., Array$instance.length).
 *
 * TODO(alice): Fix TypeRegistry to properly register inherited members so
 * the Binding fallback can be removed.
 */

import * as ts from "typescript";
import { IrMemberExpression, IrType, ComputedAccessKind } from "../../types.js";
import { getSourceSpan } from "./helpers.js";
import { convertExpression } from "../../expression-converter.js";
import {
  getBindingRegistry,
  getTypeSystem,
} from "../statements/declarations/registry.js";
import type { Binding } from "../../binding/index.js";

/**
 * Fallback for getDeclaredPropertyType when TypeSystem can't resolve the member.
 * Uses TypeSystem.typeOfMemberId() to get member types for:
 * - Built-in types from globals (Array.length, string.length, etc.)
 * - CLR-bound types from tsbindgen
 * - Types with inherited members not in TypeRegistry
 *
 * ALICE'S SPEC: Uses TypeSystem as single source of truth.
 */
const getDeclaredPropertyTypeFallback = (
  node: ts.PropertyAccessExpression,
  binding: Binding
): IrType | undefined => {
  // ALICE'S SPEC: Use TypeSystem.typeOfMemberId() to get member type
  const typeSystem = getTypeSystem();
  if (!typeSystem) return undefined;

  // Resolve property member through Binding layer
  const memberId = binding.resolvePropertyAccess(node);
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
 * @param binding - Binding layer for fallback resolution
 * @returns The deterministically computed property type
 */
const getDeclaredPropertyType = (
  node: ts.PropertyAccessExpression,
  receiverIrType: IrType | undefined,
  binding: Binding
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
  const typeSystem = getTypeSystem();
  if (typeSystem && receiverIrType && receiverIrType.kind !== "unknownType") {
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
  // (e.g., Array.length from Array$instance)
  const fallbackResult = getDeclaredPropertyTypeFallback(node, binding);
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
 * Classify computed member access for proof pass.
 * This determines whether Int32 proof is required for the index.
 *
 * Classification is based on IR type kinds, NOT string matching.
 * CLR indexers (arrays, List<T>, etc.) require Int32 proof for indices.
 *
 * IMPORTANT: If classification cannot be determined reliably, returns "unknown"
 * which causes a compile-time error (TSN5109). This is safer than misclassifying.
 *
 * @param objectType - The inferred type of the object being accessed
 * @returns The access kind classification
 */
const classifyComputedAccess = (
  objectType: IrType | undefined
): ComputedAccessKind => {
  if (!objectType) return "unknown";

  // TypeScript array type (number[], T[], etc.)
  // Both clrIndexer and jsRuntimeArray require Int32 proof
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

  // Reference types - default to clrIndexer (safe: requires Int32 proof)
  // Dictionary detection requires resolvedClrType to be reliable
  if (objectType.kind === "referenceType") {
    const clr = objectType.resolvedClrType;

    // Dictionary types: no Int32 requirement (key is typed K)
    // Use exact prefix matching for System.Collections.Generic.Dictionary
    // Only detect if resolvedClrType is present (guaranteed by bindings)
    if (clr) {
      if (
        clr.startsWith("global::System.Collections.Generic.Dictionary`") ||
        clr.startsWith("System.Collections.Generic.Dictionary`")
      ) {
        return "dictionary";
      }
    }

    // All other reference types (List<T>, Array, Span<T>, IList<T>, etc.)
    // default to clrIndexer which requires Int32 proof.
    // This is SAFE: if this is actually a Dictionary without resolvedClrType,
    // the user would get a compile error (TSN5107) when using non-Int32 key,
    // which is a safe failure mode (fails at compile time, not runtime).
    return "clrIndexer";
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
const extractTypeName = (
  inferredType: IrType | undefined
): string | undefined => {
  if (!inferredType) return undefined;

  // Handle primitive types - map to their CLR type names for binding lookup
  // This enables binding resolution for methods like string.split(), number.toString()
  if (inferredType.kind === "primitiveType") {
    switch (inferredType.name) {
      case "string":
        return "String"; // System.String
      case "number":
        return "Double"; // System.Double (TS number is double)
      case "boolean":
        return "Boolean"; // System.Boolean
      default:
        return undefined;
    }
  }

  // Handle literal types - determine the CLR type from the value type
  // This enables binding resolution for string literals like "hello".split(" ")
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
 * Resolve hierarchical binding for a member access
 * Handles namespace.type, type.member, directType.member, and instance.member patterns
 */
const resolveHierarchicalBinding = (
  object: ReturnType<typeof convertExpression>,
  propertyName: string
): IrMemberExpression["memberBinding"] => {
  const registry = getBindingRegistry();

  // Case 1: object is identifier → check if it's a namespace, then check if property is a type
  if (object.kind === "identifier") {
    const namespace = registry.getNamespace(object.name);
    if (namespace) {
      // Found namespace binding, check if property is a type within this namespace
      // Note: After schema swap, we look up by alias (TS identifier)
      const type = namespace.types.find((t) => t.alias === propertyName);
      if (type) {
        // This member access is namespace.type - we don't emit a member binding here
        // because we're just accessing a type, not calling a member
        return undefined;
      }
    }

    // Case 1b: object is a direct type import (like `Console` imported directly)
    // Check if the identifier is a type alias, and if so, look up the member
    // First try by local name, then by original name (handles aliased imports like `import { String as ClrString }`)
    const directType =
      registry.getType(object.name) ??
      (object.originalName ? registry.getType(object.originalName) : undefined);
    if (directType) {
      const member = directType.members.find((m) => m.alias === propertyName);
      if (member) {
        // Found a member binding for direct type import!
        return {
          assembly: member.binding.assembly,
          type: member.binding.type,
          member: member.binding.member,
          parameterModifiers: member.parameterModifiers,
        };
      }
    }
  }

  // Case 2: object is member expression with a type reference → check if property is a member
  if (object.kind === "memberAccess" && !object.isComputed) {
    // Walk up the chain to find if this is a type reference
    // For systemLinq.enumerable, the object is "systemLinq" and property is "enumerable"
    if (object.object.kind === "identifier") {
      const namespace = registry.getNamespace(object.object.name);
      if (namespace && typeof object.property === "string") {
        const type = namespace.types.find((t) => t.alias === object.property);
        if (type) {
          // The object is a type reference (namespace.type), now check if property is a member
          const member = type.members.find((m) => m.alias === propertyName);
          if (member) {
            // Found a member binding!
            return {
              assembly: member.binding.assembly,
              type: member.binding.type,
              member: member.binding.member,
              parameterModifiers: member.parameterModifiers,
            };
          }
        }
      }
    }
  }

  // Case 3: Instance member access (e.g., numbers.add where numbers is List<T>)
  // Use the object's inferred type to look up the member binding
  const objectTypeName = extractTypeName(object.inferredType);

  if (objectTypeName) {
    // Look up member by type alias and property name
    const member = registry.getMember(objectTypeName, propertyName);
    if (member) {
      return {
        assembly: member.binding.assembly,
        type: member.binding.type,
        member: member.binding.member,
        parameterModifiers: member.parameterModifiers,
      };
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
const deriveElementType = (
  objectType: IrType | undefined
): IrType | undefined => {
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

  return undefined;
};

/**
 * Convert property access or element access expression
 */
export const convertMemberExpression = (
  node: ts.PropertyAccessExpression | ts.ElementAccessExpression,
  binding: Binding
): IrMemberExpression => {
  const isOptional = node.questionDotToken !== undefined;
  const sourceSpan = getSourceSpan(node);

  if (ts.isPropertyAccessExpression(node)) {
    const object = convertExpression(node.expression, binding, undefined);
    const propertyName = node.name.text;

    // Try to resolve hierarchical binding
    const memberBinding = resolveHierarchicalBinding(object, propertyName);

    // DETERMINISTIC TYPING: Property type comes from NominalEnv + TypeRegistry for
    // user-defined types (including inherited members), with fallback to Binding layer
    // for built-ins and CLR types.
    //
    // The receiver's inferredType enables NominalEnv to walk inheritance chains
    // and substitute type parameters correctly for inherited generic members.
    //
    // Built-ins like string.length work because globals declare them with proper types.
    // If getDeclaredPropertyType returns undefined, it means the property declaration
    // is missing - use unknownType as poison so validation can emit TSN5203.
    //
    // EXCEPTION: If memberBinding exists AND declaredType is undefined, return undefined.
    // This handles pure CLR-bound methods like Console.WriteLine that have no TS declaration.
    const declaredType = getDeclaredPropertyType(
      node,
      object.inferredType,
      binding
    );

    // DETERMINISTIC TYPING: Set inferredType for validation passes (like numeric proof).
    // The emitter uses memberBinding separately for C# casing (e.g., length -> Length).
    //
    // Priority order for inferredType:
    // 1. If declaredType exists, use it (covers built-ins like string.length -> int)
    // 2. If memberBinding exists but no declaredType, use undefined (pure CLR-bound)
    // 3. Otherwise, poison with unknownType for validation (TSN5203)
    //
    // Note: Both memberBinding AND inferredType can be set - they serve different purposes:
    // - memberBinding: used by emitter for C# member names
    // - inferredType: used by validation passes for type checking
    //
    // Class fields without explicit type annotations will emit TSN5203.
    // Users must add explicit types like `count: int = 0` instead of `count = 0`.
    const propertyInferredType = declaredType
      ? declaredType
      : memberBinding
        ? undefined
        : { kind: "unknownType" as const };

    return {
      kind: "memberAccess",
      object,
      property: propertyName,
      isComputed: false,
      isOptional,
      inferredType: propertyInferredType,
      sourceSpan,
      memberBinding,
    };
  } else {
    // Element access (computed): obj[expr]
    const object = convertExpression(node.expression, binding, undefined);

    // DETERMINISTIC TYPING: Use object's inferredType (not getInferredType)
    const objectType = object.inferredType;

    // Classify the access kind for proof pass
    // This determines whether Int32 proof is required for the index
    const accessKind = classifyComputedAccess(objectType);

    // Derive element type from object type
    const elementType = deriveElementType(objectType);

    return {
      kind: "memberAccess",
      object,
      property: convertExpression(node.argumentExpression, binding, undefined),
      isComputed: true,
      isOptional,
      inferredType: elementType,
      sourceSpan,
      accessKind,
    };
  }
};
