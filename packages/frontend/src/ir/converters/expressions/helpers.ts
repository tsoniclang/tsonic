/**
 * Helper functions for expression conversion
 */

import * as ts from "typescript";
import { IrType } from "../../types.js";
import { convertType } from "../../type-converter.js";

/**
 * Helper to get inferred type from TypeScript node
 */
export const getInferredType = (
  node: ts.Node,
  checker: ts.TypeChecker
): IrType | undefined => {
  try {
    const tsType = checker.getTypeAtLocation(node);
    const typeNode = checker.typeToTypeNode(
      tsType,
      node,
      ts.NodeBuilderFlags.None
    );
    return typeNode ? convertType(typeNode, checker) : undefined;
  } catch {
    // If type extraction fails, return undefined
    return undefined;
  }
};

/**
 * Extract type arguments from a call or new expression
 * This captures both explicit type arguments and inferred ones
 */
export const extractTypeArguments = (
  node: ts.CallExpression | ts.NewExpression,
  checker: ts.TypeChecker
): readonly IrType[] | undefined => {
  try {
    // First check for explicit type arguments
    if (node.typeArguments && node.typeArguments.length > 0) {
      return node.typeArguments.map((typeArg) => convertType(typeArg, checker));
    }

    // Try to get inferred type arguments from resolved signature
    const signature = checker.getResolvedSignature(node);
    if (!signature) {
      return undefined;
    }

    const typeParameters = signature.typeParameters;
    if (!typeParameters || typeParameters.length === 0) {
      return undefined;
    }

    // Get the type arguments inferred by the checker
    const typeArgs: IrType[] = [];
    for (const typeParam of typeParameters) {
      // Try to resolve the instantiated type for this parameter
      const typeNode = checker.typeToTypeNode(
        typeParam as ts.Type,
        node,
        ts.NodeBuilderFlags.None
      );
      if (typeNode) {
        typeArgs.push(convertType(typeNode, checker));
      }
    }

    return typeArgs.length > 0 ? typeArgs : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Check if a call/new expression requires specialization
 * Returns true for conditional types, infer, variadic generics, this typing
 */
export const checkIfRequiresSpecialization = (
  node: ts.CallExpression | ts.NewExpression,
  checker: ts.TypeChecker
): boolean => {
  try {
    const signature = checker.getResolvedSignature(node);
    if (!signature || !signature.declaration) {
      return false;
    }

    const decl = signature.declaration;

    // Check for conditional return types
    if (
      ts.isFunctionDeclaration(decl) ||
      ts.isMethodDeclaration(decl) ||
      ts.isFunctionTypeNode(decl)
    ) {
      if (decl.type && ts.isConditionalTypeNode(decl.type)) {
        return true;
      }
    }

    // Check for variadic type parameters (rest parameters with generic types)
    const typeParameters = signature.typeParameters;
    if (typeParameters) {
      for (const typeParam of typeParameters) {
        const constraint = typeParam.getConstraint();
        if (constraint) {
          const constraintStr = checker.typeToString(constraint);
          // Check for unknown[] which indicates variadic
          if (
            constraintStr.includes("unknown[]") ||
            constraintStr.includes("any[]")
          ) {
            return true;
          }
        }
      }
    }

    return false;
  } catch {
    return false;
  }
};

/**
 * Convert TypeScript binary operator token to string
 */
export const convertBinaryOperator = (
  token: ts.BinaryOperatorToken
): string => {
  const operatorMap: Record<number, string> = {
    [ts.SyntaxKind.PlusToken]: "+",
    [ts.SyntaxKind.MinusToken]: "-",
    [ts.SyntaxKind.AsteriskToken]: "*",
    [ts.SyntaxKind.SlashToken]: "/",
    [ts.SyntaxKind.PercentToken]: "%",
    [ts.SyntaxKind.AsteriskAsteriskToken]: "**",
    [ts.SyntaxKind.EqualsEqualsToken]: "==",
    [ts.SyntaxKind.ExclamationEqualsToken]: "!=",
    [ts.SyntaxKind.EqualsEqualsEqualsToken]: "===",
    [ts.SyntaxKind.ExclamationEqualsEqualsToken]: "!==",
    [ts.SyntaxKind.LessThanToken]: "<",
    [ts.SyntaxKind.GreaterThanToken]: ">",
    [ts.SyntaxKind.LessThanEqualsToken]: "<=",
    [ts.SyntaxKind.GreaterThanEqualsToken]: ">=",
    [ts.SyntaxKind.LessThanLessThanToken]: "<<",
    [ts.SyntaxKind.GreaterThanGreaterThanToken]: ">>",
    [ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken]: ">>>",
    [ts.SyntaxKind.AmpersandToken]: "&",
    [ts.SyntaxKind.BarToken]: "|",
    [ts.SyntaxKind.CaretToken]: "^",
    [ts.SyntaxKind.AmpersandAmpersandToken]: "&&",
    [ts.SyntaxKind.BarBarToken]: "||",
    [ts.SyntaxKind.QuestionQuestionToken]: "??",
    [ts.SyntaxKind.InKeyword]: "in",
    [ts.SyntaxKind.InstanceOfKeyword]: "instanceof",
    [ts.SyntaxKind.EqualsToken]: "=",
    [ts.SyntaxKind.PlusEqualsToken]: "+=",
    [ts.SyntaxKind.MinusEqualsToken]: "-=",
    [ts.SyntaxKind.AsteriskEqualsToken]: "*=",
    [ts.SyntaxKind.SlashEqualsToken]: "/=",
    [ts.SyntaxKind.PercentEqualsToken]: "%=",
    [ts.SyntaxKind.AsteriskAsteriskEqualsToken]: "**=",
    [ts.SyntaxKind.LessThanLessThanEqualsToken]: "<<=",
    [ts.SyntaxKind.GreaterThanGreaterThanEqualsToken]: ">>=",
    [ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken]: ">>>=",
    [ts.SyntaxKind.AmpersandEqualsToken]: "&=",
    [ts.SyntaxKind.BarEqualsToken]: "|=",
    [ts.SyntaxKind.CaretEqualsToken]: "^=",
    [ts.SyntaxKind.AmpersandAmpersandEqualsToken]: "&&=",
    [ts.SyntaxKind.BarBarEqualsToken]: "||=",
    [ts.SyntaxKind.QuestionQuestionEqualsToken]: "??=",
  };

  return operatorMap[token.kind] ?? "=";
};

/**
 * Check if a binary operator token is an assignment operator
 */
export const isAssignmentOperator = (
  token: ts.BinaryOperatorToken
): boolean => {
  return (
    token.kind >= ts.SyntaxKind.FirstAssignment &&
    token.kind <= ts.SyntaxKind.LastAssignment
  );
};
