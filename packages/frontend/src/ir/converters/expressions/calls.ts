/**
 * Call and new expression converters
 */

import * as ts from "typescript";
import { IrCallExpression, IrNewExpression } from "../../types.js";
import {
  getInferredType,
  extractTypeArguments,
  checkIfRequiresSpecialization,
} from "./helpers.js";
import { convertExpression } from "../../expression-converter.js";
import { convertType, convertTsTypeToIr } from "../../type-converter.js";
import { IrType } from "../../types.js";

/**
 * Extract argument passing modes from resolved signature
 * Returns array aligned with arguments, indicating ref/out/in/value for each
 */
const extractArgumentPassing = (
  node: ts.CallExpression | ts.NewExpression,
  checker: ts.TypeChecker
): readonly ("value" | "ref" | "out" | "in")[] | undefined => {
  try {
    const signature = checker.getResolvedSignature(node);
    if (!signature || !signature.declaration) {
      return undefined;
    }

    const decl = signature.declaration;
    let parameters: readonly ts.ParameterDeclaration[] = [];

    // Extract parameters from declaration
    if (
      ts.isFunctionDeclaration(decl) ||
      ts.isMethodDeclaration(decl) ||
      ts.isConstructorDeclaration(decl) ||
      ts.isArrowFunction(decl) ||
      ts.isFunctionExpression(decl)
    ) {
      parameters = decl.parameters;
    }

    if (parameters.length === 0) {
      return undefined;
    }

    // Build passing mode for each parameter
    const passingModes: ("value" | "ref" | "out" | "in")[] = [];

    for (const param of parameters) {
      let passing: "value" | "ref" | "out" | "in" = "value";

      // Check if parameter type is ref<T>, out<T>, or in<T>
      if (
        param.type &&
        ts.isTypeReferenceNode(param.type) &&
        ts.isIdentifier(param.type.typeName)
      ) {
        const typeName = param.type.typeName.text;
        if (
          (typeName === "ref" || typeName === "out" || typeName === "in") &&
          param.type.typeArguments &&
          param.type.typeArguments.length > 0
        ) {
          passing = typeName === "in" ? "in" : typeName;
        }
      }

      passingModes.push(passing);
    }

    return passingModes;
  } catch {
    return undefined;
  }
};

/**
 * Safely convert a ts.Type to IrType
 */
const convertTsTypeToIrSafe = (
  tsType: ts.Type,
  node: ts.Node,
  checker: ts.TypeChecker
): IrType | undefined => {
  try {
    const typeNode = checker.typeToTypeNode(
      tsType,
      node,
      ts.NodeBuilderFlags.None
    );
    return typeNode
      ? convertType(typeNode, checker)
      : convertTsTypeToIr(tsType, checker);
  } catch {
    return undefined;
  }
};

/**
 * Extract type predicate narrowing metadata from a call expression.
 * Returns narrowing info if the callee is a type predicate function (x is T).
 */
const extractNarrowing = (
  node: ts.CallExpression,
  checker: ts.TypeChecker
): IrCallExpression["narrowing"] => {
  try {
    const sig = checker.getResolvedSignature(node);
    if (!sig) return undefined;

    const pred = checker.getTypePredicateOfSignature(sig);
    // We only handle "param is T" predicates (not "this is T")
    if (
      pred &&
      pred.kind === ts.TypePredicateKind.Identifier &&
      pred.parameterIndex !== undefined &&
      pred.type
    ) {
      const targetType = convertTsTypeToIrSafe(pred.type, node, checker);
      if (targetType) {
        return {
          kind: "typePredicate",
          argIndex: pred.parameterIndex,
          targetType,
        };
      }
    }
    return undefined;
  } catch {
    return undefined;
  }
};

/**
 * Convert call expression
 */
export const convertCallExpression = (
  node: ts.CallExpression,
  checker: ts.TypeChecker
): IrCallExpression => {
  // Extract type arguments from the call signature
  const typeArguments = extractTypeArguments(node, checker);
  const requiresSpecialization = checkIfRequiresSpecialization(node, checker);
  const argumentPassing = extractArgumentPassing(node, checker);
  const narrowing = extractNarrowing(node, checker);

  return {
    kind: "call",
    callee: convertExpression(node.expression, checker),
    arguments: node.arguments.map((arg) => {
      if (ts.isSpreadElement(arg)) {
        return {
          kind: "spread" as const,
          expression: convertExpression(arg.expression, checker),
        };
      }
      return convertExpression(arg, checker);
    }),
    isOptional: node.questionDotToken !== undefined,
    inferredType: getInferredType(node, checker),
    typeArguments,
    requiresSpecialization,
    argumentPassing,
    narrowing,
  };
};

/**
 * Convert new expression
 */
export const convertNewExpression = (
  node: ts.NewExpression,
  checker: ts.TypeChecker
): IrNewExpression => {
  // Extract type arguments from the constructor signature
  const typeArguments = extractTypeArguments(node, checker);
  const requiresSpecialization = checkIfRequiresSpecialization(node, checker);

  return {
    kind: "new",
    callee: convertExpression(node.expression, checker),
    arguments:
      node.arguments?.map((arg) => {
        if (ts.isSpreadElement(arg)) {
          return {
            kind: "spread" as const,
            expression: convertExpression(arg.expression, checker),
          };
        }
        return convertExpression(arg, checker);
      }) ?? [],
    inferredType: getInferredType(node, checker),
    typeArguments,
    requiresSpecialization,
  };
};
