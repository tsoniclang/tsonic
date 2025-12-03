/**
 * Type inference - Converts TypeScript inferred types to IR types
 *
 * This uses the TypeChecker to get the inferred type and converts it to IR.
 * Used for declarations without explicit type annotations where the type
 * must be inferred from the initializer.
 *
 * Also provides contextual signature inference for lambda parameters.
 */

import * as ts from "typescript";
import type { IrType } from "../types.js";

/**
 * Result of inferring lambda parameter types from contextual signature.
 * Returns array of IrType (one per parameter) if all params can be inferred,
 * or undefined if inference fails for any parameter.
 */
export type LambdaParamInferenceResult = {
  readonly paramTypes: readonly (IrType | undefined)[];
  readonly allInferred: boolean;
};

/**
 * Infer parameter types for a lambda (arrow function or function expression)
 * from its contextual signature.
 *
 * Uses checker.getContextualType() + getCallSignatures() to find the contextual
 * signature for the lambda.
 *
 * Returns undefined if no contextual signature exists (free-floating lambda).
 * Returns paramTypes array where each element is IrType if inferred, or undefined if not.
 */
/**
 * Extract the non-nullish callable type from a contextual type.
 * For optional callbacks like sort's comparator, the contextual type is
 * `((a: T, b: T) => number) | undefined`. We need to extract the function type.
 */
const extractCallableType = (type: ts.Type): ts.Type | undefined => {
  // If type has call signatures directly, use it
  if (type.getCallSignatures().length > 0) {
    return type;
  }

  // If it's a union, try to find a callable member (excluding undefined/null)
  if (type.flags & ts.TypeFlags.Union) {
    const unionType = type as ts.UnionType;
    for (const member of unionType.types) {
      // Skip undefined and null
      if (
        member.flags & ts.TypeFlags.Undefined ||
        member.flags & ts.TypeFlags.Null
      ) {
        continue;
      }
      // Check if this member has call signatures
      if (member.getCallSignatures().length > 0) {
        return member;
      }
    }
  }

  return undefined;
};

export const inferLambdaParamTypes = (
  node: ts.ArrowFunction | ts.FunctionExpression,
  checker: ts.TypeChecker
): LambdaParamInferenceResult | undefined => {
  // Get contextual type for the lambda
  const contextualType = checker.getContextualType(node);
  if (!contextualType) {
    return undefined; // No contextual type - can't infer
  }

  // Extract callable type (handles union with undefined for optional callbacks)
  const callableType = extractCallableType(contextualType);
  if (!callableType) {
    return undefined; // No callable type found
  }

  // Get call signatures from callable type
  const signatures = callableType.getCallSignatures();
  if (signatures.length === 0) {
    return undefined; // No call signature - can't infer
  }

  // Use the first signature (most common case)
  // For overloaded functions, TS usually provides the resolved signature
  const signature = signatures[0];
  if (!signature) {
    return undefined;
  }

  const sigParams = signature.getParameters();
  const paramTypes: (IrType | undefined)[] = [];
  let allInferred = true;

  for (let i = 0; i < node.parameters.length; i++) {
    const param = node.parameters[i];
    if (!param) {
      paramTypes.push(undefined);
      allInferred = false;
      continue;
    }

    // If param has explicit type annotation, don't need inference
    if (param.type) {
      paramTypes.push(undefined); // Will use explicit type
      continue;
    }

    // Get the corresponding signature parameter
    const sigParam = sigParams[i];
    if (!sigParam) {
      // Lambda has more params than signature provides
      paramTypes.push(undefined);
      allInferred = false;
      continue;
    }

    // Get the TS type for this parameter from the signature
    const tsType = checker.getTypeOfSymbolAtLocation(
      sigParam,
      sigParam.valueDeclaration ?? node
    );

    // Reject any/unknown - these don't count as successful inference
    if (
      tsType.flags & ts.TypeFlags.Any ||
      tsType.flags & ts.TypeFlags.Unknown
    ) {
      paramTypes.push(undefined);
      allInferred = false;
      continue;
    }

    // Convert to IR type
    const irType = convertTsTypeToIr(tsType, checker);
    if (irType) {
      paramTypes.push(irType);
    } else {
      paramTypes.push(undefined);
      allInferred = false;
    }
  }

  return { paramTypes, allInferred };
};

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
      const firstArg = typeArgs[0];
      if (firstArg !== undefined) {
        const elementType = convertTsTypeToIr(firstArg, checker);
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
    return { kind: "typeParameterType", name };
  }

  // Any and unknown
  if (flags & ts.TypeFlags.Any || flags & ts.TypeFlags.Unknown) {
    return { kind: "anyType" };
  }

  // Union types - convert each member, require all to succeed
  if (flags & ts.TypeFlags.Union) {
    const unionType = type as ts.UnionType;
    const memberTypes = unionType.types
      .map((t) => convertTsTypeToIr(t, checker))
      .filter((t): t is IrType => t !== undefined);
    // If any member failed conversion, return undefined (keep TSN7405 strict)
    if (memberTypes.length !== unionType.types.length) {
      return undefined;
    }
    return { kind: "unionType", types: memberTypes };
  }

  // Intersection types - convert each member, require all to succeed
  if (flags & ts.TypeFlags.Intersection) {
    const intersectionType = type as ts.IntersectionType;
    const memberTypes = intersectionType.types
      .map((t) => convertTsTypeToIr(t, checker))
      .filter((t): t is IrType => t !== undefined);
    // If any member failed conversion, return undefined (keep TSN7405 strict)
    if (memberTypes.length !== intersectionType.types.length) {
      return undefined;
    }
    return { kind: "intersectionType", types: memberTypes };
  }

  return undefined;
};
