/**
 * Type inference - Converts TypeScript inferred types to IR types
 *
 * This uses the TypeChecker to get the inferred type and converts it to IR.
 * Used for declarations without explicit type annotations where the type
 * must be inferred from the initializer.
 */

import * as ts from "typescript";
import type { IrType } from "../types.js";

/**
 * Infer IR type from a declaration node using the TypeChecker.
 * Returns undefined for complex types that cannot be easily represented.
 */
export const inferType = (
  node: ts.VariableDeclaration | ts.PropertyDeclaration,
  checker: ts.TypeChecker
): IrType | undefined => {
  const type = checker.getTypeAtLocation(node);
  return convertTsTypeToIr(type, checker);
};

/**
 * Convert a TypeScript Type (from checker) to IR type.
 * This is different from convertType which takes a TypeNode (syntax).
 */
export const convertTsTypeToIr = (
  type: ts.Type,
  checker: ts.TypeChecker
): IrType | undefined => {
  const flags = type.flags;

  // Primitives
  if (flags & ts.TypeFlags.Number || flags & ts.TypeFlags.NumberLiteral) {
    return { kind: "primitiveType", name: "number" };
  }
  if (flags & ts.TypeFlags.String || flags & ts.TypeFlags.StringLiteral) {
    return { kind: "primitiveType", name: "string" };
  }
  if (flags & ts.TypeFlags.Boolean || flags & ts.TypeFlags.BooleanLiteral) {
    return { kind: "primitiveType", name: "boolean" };
  }
  if (flags & ts.TypeFlags.Void) {
    return { kind: "voidType" };
  }
  if (flags & ts.TypeFlags.Null) {
    return { kind: "primitiveType", name: "null" };
  }
  if (flags & ts.TypeFlags.Undefined) {
    return { kind: "primitiveType", name: "undefined" };
  }

  // Object type - check if it's an array
  if (flags & ts.TypeFlags.Object) {
    // Check for array type
    if (checker.isArrayType(type)) {
      const typeArgs = checker.getTypeArguments(type as ts.TypeReference);
      if (typeArgs.length > 0) {
        const elementType = convertTsTypeToIr(typeArgs[0]!, checker);
        if (elementType) {
          return { kind: "arrayType", elementType };
        }
      }
      return { kind: "arrayType", elementType: { kind: "anyType" } };
    }

    // Check for callable signatures (function types)
    const callSignatures = type.getCallSignatures();
    if (callSignatures.length > 0) {
      // Function types need complex handling - return undefined for now
      return undefined;
    }

    // Check for symbol with name (class, interface, etc.)
    const objectType = type as ts.ObjectType;
    if (objectType.symbol) {
      const name = objectType.symbol.name;
      // Skip internal TypeScript symbol names
      if (name.startsWith("__")) {
        return undefined;
      }
      // For named types, return as reference type with type arguments if generic
      if (name && name !== "Object" && name !== "Array") {
        // Extract type arguments for generic types
        const typeRef = type as ts.TypeReference;
        const typeArgs = checker.getTypeArguments(typeRef);
        if (typeArgs && typeArgs.length > 0) {
          const irTypeArgs = typeArgs
            .map((arg) => convertTsTypeToIr(arg, checker))
            .filter((t): t is IrType => t !== undefined);
          if (irTypeArgs.length === typeArgs.length) {
            return { kind: "referenceType", name, typeArguments: irTypeArgs };
          }
        }
        return { kind: "referenceType", name };
      }
    }

    // Anonymous object type
    return undefined;
  }

  // Type parameters (e.g., T in Container<T>)
  if (flags & ts.TypeFlags.TypeParameter) {
    const typeParam = type as ts.TypeParameter;
    const name = typeParam.symbol?.name ?? "T";
    return { kind: "referenceType", name };
  }

  // Any and unknown
  if (flags & ts.TypeFlags.Any || flags & ts.TypeFlags.Unknown) {
    return { kind: "anyType" };
  }

  // Union and intersection types - too complex for simple inference
  if (flags & ts.TypeFlags.Union || flags & ts.TypeFlags.Intersection) {
    return undefined;
  }

  return undefined;
};
