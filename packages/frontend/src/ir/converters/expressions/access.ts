/**
 * Member access expression converters
 */

import * as ts from "typescript";
import { IrMemberExpression, IrType, ComputedAccessKind } from "../../types.js";
import { getSourceSpan } from "./helpers.js";
import { convertExpression } from "../../expression-converter.js";
import {
  getBindingRegistry,
  getTypeRegistry,
  getNominalEnv,
} from "../statements/declarations/registry.js";
import { convertType } from "../../type-converter.js";
import { substituteIrType } from "../../nominal-env.js";
import type { Binding } from "../../binding/index.js";

/**
 * Normalize receiver IR type to a fully-qualified nominal type name and type arguments.
 *
 * Handles:
 * - referenceType: Use name (resolved to FQ) and typeArguments directly
 * - arrayType: Treat as "Array" (resolved to FQ) with [elementType]
 * - primitiveType: Map to "String", "Number", "Boolean" surfaces (resolved to FQ)
 *
 * Returns undefined for types that can't be normalized to nominals.
 */
const normalizeReceiverToNominal = (
  receiverIrType: IrType
): { nominal: string; typeArgs: readonly IrType[] } | undefined => {
  const registry = getTypeRegistry();

  // Helper to resolve simple name to FQ name
  const toFQName = (simpleName: string): string => {
    if (!registry) return simpleName;
    // Try to get FQ name from registry
    const fqName = registry.getFQName(simpleName);
    // If name already contains ".", it might already be FQ
    if (!fqName && simpleName.includes(".")) return simpleName;
    return fqName ?? simpleName;
  };

  if (receiverIrType.kind === "referenceType") {
    return {
      nominal: toFQName(receiverIrType.name),
      typeArgs: receiverIrType.typeArguments ?? [],
    };
  }

  if (receiverIrType.kind === "arrayType") {
    return {
      nominal: toFQName("Array"),
      typeArgs: [receiverIrType.elementType],
    };
  }

  if (receiverIrType.kind === "primitiveType") {
    const nominalMap: Record<string, string | undefined> = {
      string: "String",
      number: "Number",
      boolean: "Boolean",
      int: "Int32",
    };
    const simpleName = nominalMap[receiverIrType.name];
    if (simpleName) {
      return { nominal: toFQName(simpleName), typeArgs: [] };
    }
  }

  return undefined;
};

/**
 * Get the declared property type from a property access expression.
 *
 * DETERMINISTIC TYPING: Uses NominalEnv + TypeRegistry to walk inheritance chains
 * and substitute type parameters. Never uses TypeScript's type inference APIs.
 *
 * Flow:
 * 1. Normalize receiver IR type to nominal + type args
 * 2. Use NominalEnv.findMemberDeclaringType() to find which type declares the member
 * 3. Get declared member TypeNode from TypeRegistry
 * 4. Convert to IR pattern (may contain type parameters)
 * 5. Apply substituteIrType() to replace type parameters with concrete types
 *
 * @param node - Property access expression node
 * @param receiverIrType - Already-computed IR type of the receiver (object) expression
 * @param binding - Binding layer for symbol resolution (NOT for type inference)
 * @returns The deterministically computed property type, or undefined if not found
 */
const getDeclaredPropertyType = (
  node: ts.PropertyAccessExpression,
  receiverIrType: IrType | undefined,
  binding: Binding
): IrType | undefined => {
  try {
    const propertyName = node.name.text;
    const registry = getTypeRegistry();
    const nominalEnv = getNominalEnv();

    // If no receiver type or infrastructure not available, fall back to Binding lookup
    if (
      !receiverIrType ||
      receiverIrType.kind === "unknownType" ||
      !registry ||
      !nominalEnv
    ) {
      // Fall back to Binding lookup (for built-ins and CLR types)
      return getDeclaredPropertyTypeFallback(node, binding);
    }

    // 1. Normalize receiver to nominal + type args
    const normalized = normalizeReceiverToNominal(receiverIrType);
    if (!normalized) {
      // Can't normalize - fall back to Binding lookup
      return getDeclaredPropertyTypeFallback(node, binding);
    }

    const { nominal, typeArgs } = normalized;

    // 2. Find declaring type + substitution using NominalEnv
    const result = nominalEnv.findMemberDeclaringType(
      nominal,
      typeArgs,
      propertyName
    );

    if (!result) {
      // Member not found in inheritance chain - fall back to Binding lookup
      // This handles CLR-bound members and built-ins from globals
      return getDeclaredPropertyTypeFallback(node, binding);
    }

    const { targetNominal, substitution } = result;

    // 3. Get declared member TypeNode from registry
    const memberTypeNode = registry.getMemberTypeNode(
      targetNominal,
      propertyName
    );

    if (!memberTypeNode) {
      // TypeNode not found in registry - fall back to Binding lookup
      return getDeclaredPropertyTypeFallback(node, binding);
    }

    // 4. Convert TypeNode to IR pattern (may contain type parameters)
    const memberTypePattern = convertType(memberTypeNode, binding);

    // 5. Apply substitution to replace type parameters with concrete types
    const finalType = substituteIrType(memberTypePattern, substitution);

    return finalType;
  } catch {
    return undefined;
  }
};

/**
 * Fallback for getDeclaredPropertyType when NominalEnv can't resolve the member.
 * Uses Binding layer to resolve property declarations for:
 * - Built-in types from globals (string.length, Array.push, etc.)
 * - CLR-bound types from tsbindgen
 * - Types not registered in TypeRegistry
 */
const getDeclaredPropertyTypeFallback = (
  node: ts.PropertyAccessExpression,
  binding: Binding
): IrType | undefined => {
  try {
    // Resolve property member through Binding layer
    const memberId = binding.resolvePropertyAccess(node);
    if (!memberId) return undefined;

    const memberInfo = binding.getHandleRegistry().getMember(memberId);
    if (!memberInfo) return undefined;

    // If the member has a type node, convert it
    // For properties, this is the property type
    // For methods, this is the method's function type signature from the AST
    if (memberInfo.typeNode) {
      return convertType(memberInfo.typeNode as ts.TypeNode, binding);
    }

    return undefined;
  } catch {
    return undefined;
  }
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
