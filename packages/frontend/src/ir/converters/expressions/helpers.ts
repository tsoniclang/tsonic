/**
 * Helper functions for expression conversion
 */

import * as ts from "typescript";
import { IrType, TSONIC_TO_NUMERIC_KIND } from "../../types.js";
import { convertType, convertTsTypeToIr } from "../../type-converter.js";
import { SourceLocation } from "../../../types/diagnostic.js";
import { getSourceLocation } from "../../../program/diagnostics.js";

/**
 * Get source span for a TypeScript node.
 * Returns a SourceLocation that can be used for diagnostics.
 */
export const getSourceSpan = (node: ts.Node): SourceLocation | undefined => {
  try {
    const sourceFile = node.getSourceFile();
    if (!sourceFile) {
      return undefined;
    }
    return getSourceLocation(
      sourceFile,
      node.getStart(sourceFile),
      node.getWidth(sourceFile)
    );
  } catch {
    return undefined;
  }
};

/**
 * Check if a TypeScript type is a numeric alias from @tsonic/core.
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
 * Attempt to recover numeric intent from a property declaration's type annotation.
 *
 * When TypeScript normalizes `int` to `number`, we can still find the original
 * annotation in the property's declaration AST.
 *
 * GUARDRAILS:
 * - Only accepts clean TypeReferenceNode with simple identifier (not qualified names)
 * - Only returns if identifier is in TSONIC_TO_NUMERIC_KIND vocabulary
 * - Rejects unions, intersections, or complex types
 * - CONSERVATIVE: If multiple declarations have conflicting numeric annotations,
 *   returns undefined to avoid incorrect recovery from partial declaration merges
 *
 * NOTE: Recovery is intentionally VOCABULARY-BASED (TSONIC_TO_NUMERIC_KIND),
 * not package-path based. Do not add special casing for @tsonic/core paths.
 */
const tryRecoverNumericReferenceFromPropertyDecl = (
  propSymbol: ts.Symbol
): IrType | undefined => {
  const declarations = propSymbol.declarations ?? [];

  // Collect all numeric annotations found across declarations
  const recoveredNames = new Set<string>();

  for (const decl of declarations) {
    // Only handle PropertySignature and PropertyDeclaration with type annotation
    if (
      (ts.isPropertySignature(decl) || ts.isPropertyDeclaration(decl)) &&
      decl.type
    ) {
      const typeNode = decl.type;

      // STRICT: Only accept TypeReferenceNode with simple identifier
      if (
        ts.isTypeReferenceNode(typeNode) &&
        ts.isIdentifier(typeNode.typeName)
      ) {
        const name = typeNode.typeName.text;

        // Only if name is in numeric vocabulary
        if (TSONIC_TO_NUMERIC_KIND.has(name)) {
          recoveredNames.add(name);
        }
      }
    }
  }

  // CONSERVATIVE: Only return if exactly one numeric annotation was found
  // If conflicting (e.g., one says `int`, another says `long`), return undefined
  if (recoveredNames.size === 1) {
    const names = [...recoveredNames];
    const name = names[0];
    if (name !== undefined) {
      return { kind: "referenceType", name };
    }
  }

  return undefined;
};

/**
 * Attempt to recover numeric intent from a method/function's return type annotation.
 *
 * For calls like arr.indexOf("x"), if the declaration says `indexOf(...): int`,
 * we recover "int" even if checker normalizes to "number".
 *
 * STRICT: Only handles common declaration types, not arrow functions or function types.
 * CONSERVATIVE: If signature has multiple declarations with conflicting return types,
 * returns undefined to avoid incorrect recovery.
 *
 * NOTE: Recovery is intentionally VOCABULARY-BASED (TSONIC_TO_NUMERIC_KIND),
 * not package-path based. Do not add special casing for @tsonic/core paths.
 */
const tryRecoverNumericReferenceFromSignatureReturnDecl = (
  signature: ts.Signature
): IrType | undefined => {
  const decl = signature.declaration;
  if (!decl) return undefined;

  // Get the return type annotation from the declaration
  // STRICT: Only accept method/function declarations, not arrow functions
  const returnTypeNode =
    ts.isMethodSignature(decl) ||
    ts.isMethodDeclaration(decl) ||
    ts.isFunctionDeclaration(decl) ||
    ts.isCallSignatureDeclaration(decl)
      ? decl.type
      : undefined;

  if (!returnTypeNode) return undefined;

  // STRICT: Only accept TypeReferenceNode with simple identifier
  if (
    ts.isTypeReferenceNode(returnTypeNode) &&
    ts.isIdentifier(returnTypeNode.typeName)
  ) {
    const name = returnTypeNode.typeName.text;

    if (TSONIC_TO_NUMERIC_KIND.has(name)) {
      return { kind: "referenceType", name };
    }
  }

  return undefined;
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
    const result = typeNode
      ? convertType(typeNode, checker)
      : // Fallback: use convertTsTypeToIr directly for complex types
        // This handles intersection types like List_1$instance<T> that can't be converted to TypeNodes
        convertTsTypeToIr(tsType, checker);

    // DECLARATION RECOVERY: If checker returned primitive "number", try to recover
    // numeric intent from the declaration AST. TypeScript sometimes normalizes type
    // aliases like `int` to plain `number`, losing the alias information.
    //
    // IMPORTANT: Recovery is intentionally VOCABULARY-BASED (TSONIC_TO_NUMERIC_KIND),
    // not package-path based. We recognize `int`, `long`, `byte`, etc. by NAME only.
    // Do not add special casing for "@tsonic/core" or other package paths.
    if (result?.kind === "primitiveType" && result.name === "number") {
      // For property access like arr.length, check the property declaration
      if (ts.isPropertyAccessExpression(node)) {
        const objType = checker.getTypeAtLocation(node.expression);
        const propName = node.name.text;
        const propSymbol = checker.getPropertyOfType(objType, propName);

        if (propSymbol) {
          const recovered =
            tryRecoverNumericReferenceFromPropertyDecl(propSymbol);
          if (recovered) {
            return recovered; // Return referenceType("int") instead of primitiveType("number")
          }
        }
      }

      // For call expressions like arr.indexOf("x"), check the signature return type
      if (ts.isCallExpression(node)) {
        const signature = checker.getResolvedSignature(node);
        if (signature) {
          const recovered =
            tryRecoverNumericReferenceFromSignatureReturnDecl(signature);
          if (recovered) {
            return recovered;
          }
        }
      }
    }

    return result;
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
