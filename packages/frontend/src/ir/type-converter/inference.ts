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
      // DETERMINISTIC: If TS can't produce a TypeNode, use unknownType
      // We don't fall back to type inference
      irType = { kind: "unknownType" };
    }

    // Final fallback: use unknownType rather than failing inference
    paramTypes.push(irType ?? { kind: "unknownType" });
  }

  return { paramTypes, allInferred };
};
