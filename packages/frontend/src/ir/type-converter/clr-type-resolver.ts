/**
 * CLR type resolver - Maps TypeScript inferred types to CLR type strings
 *
 * Used for module-level const declarations and class fields where C# requires
 * explicit types (cannot use 'var').
 */

import * as ts from "typescript";

/**
 * Resolve CLR type string from a TypeScript declaration node.
 * Uses the type checker to get the inferred type.
 *
 * Returns undefined if the type cannot be resolved to a CLR primitive.
 */
export const resolveClrType = (
  node: ts.VariableDeclaration | ts.PropertyDeclaration,
  checker: ts.TypeChecker
): string | undefined => {
  const type = checker.getTypeAtLocation(node);
  return mapTypeToClr(type, checker);
};

/**
 * Map a TypeScript type to its CLR equivalent.
 * Returns undefined for complex types that require IR representation.
 */
const mapTypeToClr = (
  type: ts.Type,
  checker: ts.TypeChecker
): string | undefined => {
  const flags = type.flags;

  // Primitives
  if (flags & ts.TypeFlags.Number) {
    return "double";
  }
  if (flags & ts.TypeFlags.String) {
    return "string";
  }
  if (flags & ts.TypeFlags.Boolean) {
    return "bool";
  }
  if (flags & ts.TypeFlags.BooleanLiteral) {
    return "bool";
  }
  if (flags & ts.TypeFlags.Void) {
    return "void";
  }

  // Number literal types (e.g., const x = 42)
  if (flags & ts.TypeFlags.NumberLiteral) {
    return "double";
  }

  // String literal types (e.g., const x = "hello")
  if (flags & ts.TypeFlags.StringLiteral) {
    return "string";
  }

  // Null and undefined
  if (flags & ts.TypeFlags.Null) {
    return "object";
  }
  if (flags & ts.TypeFlags.Undefined) {
    return "object";
  }

  // Object type - check if it's an array
  if (flags & ts.TypeFlags.Object) {
    const objectType = type as ts.ObjectType;

    // Check for array type
    if (checker.isArrayType(type)) {
      const typeArgs = checker.getTypeArguments(type as ts.TypeReference);
      if (typeArgs.length > 0) {
        const elementClr = mapTypeToClr(typeArgs[0]!, checker);
        if (elementClr) {
          return `Tsonic.Runtime.Array<${elementClr}>`;
        }
      }
      return "Tsonic.Runtime.Array<object>";
    }

    // Check for callable signatures (function types) - return undefined to let emitter handle
    const callSignatures = type.getCallSignatures();
    if (callSignatures.length > 0) {
      return undefined; // Function types need special handling in emitter
    }

    // Check for symbol with name (could be class, interface, etc.)
    if (objectType.symbol) {
      const name = objectType.symbol.name;
      // Known runtime types
      if (name === "Array") {
        return "Tsonic.Runtime.Array<object>";
      }
      if (name === "Object") {
        return "object";
      }
      if (name === "Function") {
        return "Delegate";
      }
      // Skip internal TypeScript symbol names
      if (name.startsWith("__")) {
        return undefined;
      }
      // For other named types, return the name (may need qualification later)
      if (name) {
        return name;
      }
    }

    // Anonymous object type - cannot resolve to simple CLR type
    return undefined;
  }

  // Any and unknown
  if (flags & ts.TypeFlags.Any) {
    return "object";
  }
  if (flags & ts.TypeFlags.Unknown) {
    return "object";
  }

  // Never type
  if (flags & ts.TypeFlags.Never) {
    return undefined;
  }

  // Union types - cannot resolve to simple CLR type
  if (flags & ts.TypeFlags.Union) {
    return undefined;
  }

  // Intersection types - cannot resolve to simple CLR type
  if (flags & ts.TypeFlags.Intersection) {
    return undefined;
  }

  return undefined;
};
