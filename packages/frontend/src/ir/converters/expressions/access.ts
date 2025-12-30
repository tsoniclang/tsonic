/**
 * Member access expression converters
 */

import * as ts from "typescript";
import { IrMemberExpression, IrType, ComputedAccessKind } from "../../types.js";
import { getInferredType, getSourceSpan } from "./helpers.js";
import { convertExpression } from "../../expression-converter.js";
import { getBindingRegistry } from "../statements/declarations/registry.js";
import { convertType } from "../../type-converter.js";
import { substituteTypeNode } from "./calls.js";

/**
 * Build a substitution map from type parameter names to their instantiated TypeNodes
 * for a property access expression.
 *
 * For a property access like `list.count` where `list: List<int>`,
 * this returns a map: { "T" -> int TypeNode }
 *
 * Similar to buildTypeParameterSubstitutionMap in calls.ts, but works for
 * PropertyAccessExpression instead of CallExpression.
 */
const buildPropertySubstitutionMap = (
  node: ts.PropertyAccessExpression,
  checker: ts.TypeChecker
): ReadonlyMap<string, ts.TypeNode> | undefined => {
  // Get the object's type and find its type parameters
  const objectType = checker.getTypeAtLocation(node.expression);

  // Get the class/interface/type alias declaration that defines the type parameters
  const symbol = objectType.aliasSymbol ?? objectType.getSymbol();
  if (!symbol) return undefined;

  const declarations = symbol.getDeclarations();
  if (!declarations || declarations.length === 0) return undefined;

  // Find the class/interface/type alias declaration with type parameters
  let typeParamDecls: readonly ts.TypeParameterDeclaration[] | undefined;
  for (const decl of declarations) {
    if (ts.isClassDeclaration(decl) && decl.typeParameters) {
      typeParamDecls = decl.typeParameters;
      break;
    }
    if (ts.isInterfaceDeclaration(decl) && decl.typeParameters) {
      typeParamDecls = decl.typeParameters;
      break;
    }
    if (ts.isTypeAliasDeclaration(decl) && decl.typeParameters) {
      typeParamDecls = decl.typeParameters;
      break;
    }
  }

  if (!typeParamDecls || typeParamDecls.length === 0) return undefined;

  // Get the type arguments from the object's declaration
  // IMPORTANT: We must trace back to the ORIGINAL source code AST to preserve
  // CLR type aliases like `int`. TypeScript's typeToTypeNode() does NOT preserve
  // type aliases - it synthesizes primitive keywords like NumberKeyword instead.
  const receiverSymbol = checker.getSymbolAtLocation(node.expression);
  if (!receiverSymbol) return undefined;

  const receiverDecls = receiverSymbol.getDeclarations();
  if (!receiverDecls) return undefined;

  for (const decl of receiverDecls) {
    // Helper to build substitution map from type argument nodes
    const buildMapFromTypeArgs = (
      typeArgNodes: ts.NodeArray<ts.TypeNode>
    ): Map<string, ts.TypeNode> | undefined => {
      if (typeParamDecls && typeArgNodes.length === typeParamDecls.length) {
        const substitutionMap = new Map<string, ts.TypeNode>();
        for (let i = 0; i < typeParamDecls.length; i++) {
          const paramDecl = typeParamDecls[i];
          const argNode = typeArgNodes[i];
          if (paramDecl && argNode) {
            substitutionMap.set(paramDecl.name.text, argNode);
          }
        }
        return substitutionMap;
      }
      return undefined;
    };

    // Check explicit type annotation first
    if (ts.isVariableDeclaration(decl) && decl.type) {
      if (ts.isTypeReferenceNode(decl.type) && decl.type.typeArguments) {
        const result = buildMapFromTypeArgs(decl.type.typeArguments);
        if (result) return result;
      }
    }

    // Check initializer: new List<int>()
    if (ts.isVariableDeclaration(decl) && decl.initializer) {
      // Handle direct NewExpression
      if (
        ts.isNewExpression(decl.initializer) &&
        decl.initializer.typeArguments
      ) {
        const result = buildMapFromTypeArgs(decl.initializer.typeArguments);
        if (result) return result;
      }

      // Handle AsExpression (type assertion): new List<int>() as List<int>
      if (ts.isAsExpression(decl.initializer)) {
        const asType = decl.initializer.type;
        if (ts.isTypeReferenceNode(asType) && asType.typeArguments) {
          const result = buildMapFromTypeArgs(asType.typeArguments);
          if (result) return result;
        }
      }
    }

    // Check property declarations with type annotation
    if (
      ts.isPropertyDeclaration(decl) &&
      decl.type &&
      ts.isTypeReferenceNode(decl.type) &&
      decl.type.typeArguments
    ) {
      const result = buildMapFromTypeArgs(decl.type.typeArguments);
      if (result) return result;
    }

    // Check property declaration initializer
    if (ts.isPropertyDeclaration(decl) && decl.initializer) {
      if (
        ts.isNewExpression(decl.initializer) &&
        decl.initializer.typeArguments
      ) {
        const result = buildMapFromTypeArgs(decl.initializer.typeArguments);
        if (result) return result;
      }
    }

    // Check parameter declarations
    if (
      ts.isParameter(decl) &&
      decl.type &&
      ts.isTypeReferenceNode(decl.type) &&
      decl.type.typeArguments
    ) {
      const result = buildMapFromTypeArgs(decl.type.typeArguments);
      if (result) return result;
    }
  }

  return undefined;
};

/**
 * Get the declared property type from a property access expression.
 *
 * This function extracts the property type from the **property declaration's TypeNode**,
 * NOT from TypeScript's inferred type. This is critical for preserving CLR type aliases.
 *
 * For generic types, type parameters are substituted using the object's type arguments.
 * For example: `list.count` where `list: List<int>` returns `int`, not `T`.
 *
 * Returns undefined if:
 * - No property symbol found
 * - No declaration on property
 * - No type annotation on declaration
 */
const getDeclaredPropertyType = (
  node: ts.PropertyAccessExpression,
  checker: ts.TypeChecker
): IrType | undefined => {
  try {
    // 1. Get the object's type and find the property symbol
    const objectType = checker.getTypeAtLocation(node.expression);
    const propertyName = node.name.text;
    const propSymbol = checker.getPropertyOfType(objectType, propertyName);

    if (!propSymbol) return undefined;

    // 2. Get the property's declaration
    const declarations = propSymbol.getDeclarations();
    if (!declarations || declarations.length === 0) return undefined;

    // Find a declaration with a type annotation
    let propertyTypeNode: ts.TypeNode | undefined;
    for (const decl of declarations) {
      if (ts.isPropertySignature(decl) && decl.type) {
        propertyTypeNode = decl.type;
        break;
      }
      if (ts.isPropertyDeclaration(decl) && decl.type) {
        propertyTypeNode = decl.type;
        break;
      }
      // Also handle get accessor declarations (readonly properties)
      if (ts.isGetAccessorDeclaration(decl) && decl.type) {
        propertyTypeNode = decl.type;
        break;
      }
    }

    if (!propertyTypeNode) return undefined;

    // 3. Build substitution map from object's type arguments
    const substitutionMap = buildPropertySubstitutionMap(node, checker);

    // 4. Apply substitution to property TypeNode
    const substitutedTypeNode = substitutionMap
      ? substituteTypeNode(propertyTypeNode, substitutionMap, checker)
      : undefined;

    const finalTypeNode = substitutedTypeNode ?? propertyTypeNode;

    // 5. Convert to IrType
    return convertType(finalTypeNode, checker);
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
  inferredType: ReturnType<typeof getInferredType>
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
 * Convert property access or element access expression
 */
export const convertMemberExpression = (
  node: ts.PropertyAccessExpression | ts.ElementAccessExpression,
  checker: ts.TypeChecker
): IrMemberExpression => {
  const isOptional = node.questionDotToken !== undefined;
  const inferredType = getInferredType(node, checker);
  const sourceSpan = getSourceSpan(node);

  if (ts.isPropertyAccessExpression(node)) {
    const object = convertExpression(node.expression, checker);
    const propertyName = node.name.text;

    // Try to resolve hierarchical binding
    const memberBinding = resolveHierarchicalBinding(object, propertyName);

    // Property type resolution priority:
    // 1. Declared property type from AST (preserves CLR aliases)
    // 2. For built-in types (string, number, etc.), use TS inference as acceptable fallback
    //    because these have stable semantics and don't involve CLR aliases
    // 3. For generic receivers, use receiver's IR type to instantiate
    //
    // Note: We allow TS inference fallback for primitives (string.length, etc.)
    // because those are built-in and don't have user-defined CLR type aliases.
    // For user-defined generics, getDeclaredPropertyType handles substitution.
    const declaredType = getDeclaredPropertyType(node, checker);

    // Use declared type if available, otherwise fall back to TS inference
    // The fallback is acceptable for built-in types; for user-defined generics
    // getDeclaredPropertyType handles the substitution properly
    const propertyInferredType = declaredType ?? inferredType;

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
    const object = convertExpression(node.expression, checker);
    const objectType = getInferredType(node.expression, checker);

    // Classify the access kind for proof pass
    // This determines whether Int32 proof is required for the index
    const accessKind = classifyComputedAccess(objectType);

    return {
      kind: "memberAccess",
      object,
      property: convertExpression(node.argumentExpression, checker),
      isComputed: true,
      isOptional,
      inferredType,
      sourceSpan,
      accessKind,
    };
  }
};
