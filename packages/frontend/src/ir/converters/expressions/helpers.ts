/**
 * Helper functions for expression conversion
 */

import * as ts from "typescript";
import { IrType, TSONIC_TO_NUMERIC_KIND } from "../../types.js";
import { convertType, convertTsTypeToIr } from "../../type-converter.js";

/**
 * Check if a TypeScript type is a numeric alias from @tsonic/types.
 * Returns true for types like `int`, `byte`, `float`, etc.
 *
 * This is used to prevent numeric intent from leaking through contextual typing.
 * When an expression like `a + b` is inside `(a + b) as int`, TypeScript's
 * contextual type for the binary is `int`. We must NOT use this contextual type
 * for inferredType because it would make the binary appear to have numeric intent
 * when we haven't proven it does.
 */
const isNumericAliasType = (tsType: ts.Type): boolean => {
  // Check if it's a type alias that resolves to a numeric kind
  const symbol = tsType.aliasSymbol ?? tsType.getSymbol();
  if (symbol) {
    const name = symbol.getName();
    if (TSONIC_TO_NUMERIC_KIND.has(name)) {
      return true;
    }
  }
  return false;
};

/**
 * Helper to get inferred type from TypeScript node
 * Prefers contextual type (from assignment target, return position, etc.)
 * over literal type to handle cases like empty arrays `[]` correctly.
 *
 * IMPORTANT: For numeric types, we do NOT use contextual type. This prevents
 * numeric intent from leaking through TypeScript's contextual typing.
 * The `numericNarrowing` IR node is the ONLY source of numeric intent.
 */
export const getInferredType = (
  node: ts.Node,
  checker: ts.TypeChecker
): IrType | undefined => {
  try {
    // Get the actual type first
    const actualType = checker.getTypeAtLocation(node);

    // Try contextual type (from assignment target, parameter, return, etc.)
    // This is essential for empty arrays: [] has literal type never[] but contextual
    // type Player[] when assigned to a Player[] variable
    const expr = ts.isExpression(node) ? node : undefined;
    const contextualType = expr ? checker.getContextualType(expr) : undefined;

    // CRITICAL: Do NOT use contextual type if it's a numeric alias.
    // This prevents numeric intent from leaking into inner expressions.
    // Example: (a + b) as int - the binary should NOT have int intent from contextual typing.
    // Only the numericNarrowing node should carry the intent.
    const tsType =
      contextualType && !isNumericAliasType(contextualType)
        ? contextualType
        : actualType;

    // First try typeToTypeNode for simple types
    const typeNode = checker.typeToTypeNode(
      tsType,
      node,
      ts.NodeBuilderFlags.None
    );

    // If typeNode conversion works, use convertType
    if (typeNode) {
      return convertType(typeNode, checker);
    }

    // Fallback: use convertTsTypeToIr directly for complex types
    // This handles intersection types like List_1$instance<T> that can't be converted to TypeNodes
    return convertTsTypeToIr(tsType, checker);
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

/**
 * Get the contextual type for an expression (for object literals).
 * Returns an IrType with type arguments if the contextual type is a named type
 * (interface, class, generic), or undefined if it's an anonymous/primitive type.
 *
 * This captures the full type including generic type arguments (e.g., Container<T>),
 * which is essential for emitting correct C# object initializers.
 */
export const getContextualType = (
  node: ts.Expression,
  checker: ts.TypeChecker
): IrType | undefined => {
  try {
    const contextualType = checker.getContextualType(node);
    if (!contextualType) {
      return undefined;
    }

    // Check if it's an object type with a symbol (named type)
    const symbol = contextualType.getSymbol();
    if (!symbol) {
      return undefined;
    }

    // Get the symbol name
    const name = symbol.getName();

    // Skip anonymous types and built-in types
    if (name === "__type" || name === "__object" || name === "Object") {
      return undefined;
    }

    // Check that it's actually a class or interface declaration
    const declarations = symbol.getDeclarations();
    if (declarations && declarations.length > 0) {
      const firstDecl = declarations[0];
      if (
        firstDecl &&
        (ts.isInterfaceDeclaration(firstDecl) ||
          ts.isClassDeclaration(firstDecl) ||
          ts.isTypeAliasDeclaration(firstDecl))
      ) {
        // Convert the full contextual type to IR, capturing type arguments
        return convertTsTypeToIr(contextualType, checker);
      }
    }

    return undefined;
  } catch {
    return undefined;
  }
};

/**
 * @deprecated Use getContextualType instead - returns IrType with type arguments
 */
export const getContextualTypeName = (
  node: ts.Expression,
  checker: ts.TypeChecker
): string | undefined => {
  const irType = getContextualType(node, checker);
  if (irType && irType.kind === "referenceType") {
    return irType.name;
  }
  return undefined;
};
