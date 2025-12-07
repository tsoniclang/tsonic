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
import { convertType } from "./converter.js";

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

  // Pick signature that can cover lambda arity (avoid overload mismatches)
  const signature =
    signatures.find(
      (s) => s.getParameters().length >= node.parameters.length
    ) ?? signatures[0];
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

    // A1: Contextual any/unknown from lib.d.ts is acceptable - map to unknownType
    // This enables Promise executor inference where reject has `any`
    if (tsType.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) {
      paramTypes.push({ kind: "unknownType" });
      continue; // Don't set allInferred=false - we did infer something safe
    }

    // A2: Prefer typeToTypeNode → convertType (handles function types)
    // convertTsTypeToIr returns undefined for callable signatures
    const typeNode = checker.typeToTypeNode(
      tsType,
      param ?? node,
      ts.NodeBuilderFlags.None
    );

    let irType: IrType | undefined;
    if (typeNode) {
      // Guard: if typeToTypeNode produced AnyKeyword, use unknownType
      if (typeNode.kind === ts.SyntaxKind.AnyKeyword) {
        irType = { kind: "unknownType" };
      } else {
        irType = convertType(typeNode, checker);
        // Extra safety: if convertType somehow produced anyType, coerce to unknownType
        if (irType && irType.kind === "anyType") {
          irType = { kind: "unknownType" };
        }
      }
    } else {
      // Fallback to convertTsTypeToIr for cases TS can't produce a node
      irType = convertTsTypeToIr(tsType, checker);
    }

    // Final fallback: use unknownType rather than failing inference
    paramTypes.push(irType ?? { kind: "unknownType" });
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
      // Cannot convert element type - use anyType as marker
      // The IR soundness gate will catch this and emit TSN7414
      return { kind: "arrayType", elementType: { kind: "anyType" } };
    }

    // Check for symbol with name FIRST (class, interface, delegate types like Action)
    // This must come before callable check because delegates like Action have call signatures
    // but should be returned as named reference types
    const objectType = type as ts.ObjectType;

    // First check aliasSymbol (for type aliases like Action = () => void)
    // Then check symbol (for interfaces/classes)
    const typeSymbol = type.aliasSymbol ?? objectType.symbol;
    if (typeSymbol) {
      const name = typeSymbol.name;
      // Skip internal TypeScript symbol names
      if (
        !name.startsWith("__") &&
        name &&
        name !== "Object" &&
        name !== "Array"
      ) {
        // For named types, return as reference type with type arguments if generic
        // Use aliasTypeArguments for type aliases, getTypeArguments for others
        const typeArgs =
          type.aliasTypeArguments ??
          checker.getTypeArguments(type as ts.TypeReference);
        if (typeArgs && typeArgs.length > 0) {
          const irTypeArgs = Array.from(typeArgs)
            .map((arg) => convertTsTypeToIr(arg, checker))
            .filter((t): t is IrType => t !== undefined);
          if (irTypeArgs.length === typeArgs.length) {
            return { kind: "referenceType", name, typeArguments: irTypeArgs };
          }
        }
        return { kind: "referenceType", name };
      }
    }

    // Check for callable signatures (anonymous function types)
    const callSignatures = type.getCallSignatures();
    if (callSignatures.length > 0) {
      // Anonymous function types need complex handling - return undefined for now
      return undefined;
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

  // Any type - keep as anyType so validation can catch it (TSN7401)
  if (flags & ts.TypeFlags.Any) {
    return { kind: "anyType" };
  }

  // Unknown type - this is legitimate, user explicitly wrote 'unknown'
  if (flags & ts.TypeFlags.Unknown) {
    return { kind: "unknownType" };
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
