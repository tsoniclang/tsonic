/**
 * Helper functions for expression conversion
 */

import * as ts from "typescript";
import { IrType } from "../../types.js";
import { convertType } from "../../type-converter.js";
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
 * Derive identifier type from declaration TypeNode (DETERMINISTIC).
 *
 * This function looks up the identifier's declaration and extracts the type
 * from the TypeNode, NOT from TypeScript's computed type. This ensures:
 * - CLR type aliases like `int`, `byte`, `long` are preserved
 * - Types are deterministic and don't depend on TypeScript inference
 *
 * For variables without explicit type annotation (e.g., `const x = createArray()`),
 * derives the type from the initializer's declared return type.
 *
 * Returns undefined if:
 * - No declaration found
 * - Declaration has no TypeNode and no derivable initializer
 */
/**
 * Derive the return type of a call expression from its declaration.
 *
 * DETERMINISTIC: Uses only TypeNode from the function declaration.
 * This is a simplified version for use in deriveIdentifierType to avoid
 * circular dependencies with calls.ts.
 */
const deriveCallReturnType = (
  node: ts.CallExpression,
  checker: ts.TypeChecker
): IrType | undefined => {
  const signature = checker.getResolvedSignature(node);
  if (!signature) return undefined;

  const decl = signature.declaration;
  if (!decl) return undefined;

  let returnTypeNode: ts.TypeNode | undefined;

  if (
    ts.isMethodSignature(decl) ||
    ts.isMethodDeclaration(decl) ||
    ts.isFunctionDeclaration(decl) ||
    ts.isCallSignatureDeclaration(decl) ||
    ts.isArrowFunction(decl) ||
    ts.isFunctionExpression(decl)
  ) {
    returnTypeNode = decl.type;
  }

  if (!returnTypeNode) return undefined;

  return convertType(returnTypeNode, checker);
};

/**
 * Derive the constructed type from a new expression.
 *
 * For `new Foo<int>()`, returns `Foo<int>` as a reference type.
 */
const deriveNewExpressionType = (
  node: ts.NewExpression,
  checker: ts.TypeChecker
): IrType | undefined => {
  // Get the type name from the expression
  const getTypeName = (expr: ts.Expression): string | undefined => {
    if (ts.isIdentifier(expr)) {
      return expr.text;
    }
    if (ts.isPropertyAccessExpression(expr)) {
      const parts: string[] = [];
      let current: ts.Expression = expr;
      while (ts.isPropertyAccessExpression(current)) {
        parts.unshift(current.name.text);
        current = current.expression;
      }
      if (ts.isIdentifier(current)) {
        parts.unshift(current.text);
        return parts.join(".");
      }
    }
    return undefined;
  };

  const typeName = getTypeName(node.expression);
  if (!typeName) return undefined;

  // If explicit type arguments, include them
  if (node.typeArguments && node.typeArguments.length > 0) {
    return {
      kind: "referenceType",
      name: typeName,
      typeArguments: node.typeArguments.map((ta) => convertType(ta, checker)),
    };
  }

  return { kind: "referenceType", name: typeName };
};

/**
 * Derive type from an initializer expression.
 *
 * DETERMINISTIC: Only uses TypeNodes from declarations, not TS type inference.
 * Returns undefined if type cannot be determined from declarations alone.
 */
const deriveTypeFromInitializer = (
  initializer: ts.Expression,
  checker: ts.TypeChecker
): IrType | undefined => {
  // Call expression: const arr = createArray()
  if (ts.isCallExpression(initializer)) {
    return deriveCallReturnType(initializer, checker);
  }

  // New expression: const list = new List<int>()
  if (ts.isNewExpression(initializer)) {
    return deriveNewExpressionType(initializer, checker);
  }

  // Identifier: const y = x (derive type from x's declaration)
  if (ts.isIdentifier(initializer)) {
    // Recursive call - will look up the identifier's declaration
    // Note: This uses the main function, which is defined below
    // TypeScript hoisting makes this work
    return deriveIdentifierType(initializer, checker);
  }

  // Literals - derive from the literal itself
  if (ts.isNumericLiteral(initializer)) {
    return { kind: "primitiveType", name: "number" };
  }
  if (ts.isStringLiteral(initializer)) {
    return { kind: "primitiveType", name: "string" };
  }
  if (
    initializer.kind === ts.SyntaxKind.TrueKeyword ||
    initializer.kind === ts.SyntaxKind.FalseKeyword
  ) {
    return { kind: "primitiveType", name: "boolean" };
  }

  // Array literal - return Array type (element type from first element if possible)
  if (ts.isArrayLiteralExpression(initializer)) {
    // For array literals, we can try to derive element type from first element
    if (initializer.elements.length > 0) {
      const firstElem = initializer.elements[0];
      if (firstElem && !ts.isSpreadElement(firstElem)) {
        const elementType = deriveTypeFromInitializer(firstElem, checker);
        if (elementType) {
          return { kind: "arrayType", elementType };
        }
      }
    }
    // Empty array or couldn't derive element type
    return undefined;
  }

  // Property access: const len = arr.length (need to trace through)
  // Member access typing is complex - defer to undefined for now
  // The proof pass will handle this

  return undefined;
};

export const deriveIdentifierType = (
  node: ts.Identifier,
  checker: ts.TypeChecker
): IrType | undefined => {
  const symbol = checker.getSymbolAtLocation(node);
  if (!symbol) return undefined;

  const declarations = symbol.getDeclarations();
  if (!declarations || declarations.length === 0) return undefined;

  for (const decl of declarations) {
    // Variable declaration: const x: int = 5
    if (ts.isVariableDeclaration(decl)) {
      // First, check for explicit type annotation
      if (decl.type) {
        return convertType(decl.type, checker);
      }

      // No explicit type - try to derive from initializer
      if (decl.initializer) {
        const initType = deriveTypeFromInitializer(decl.initializer, checker);
        if (initType) {
          return initType;
        }
      }

      // Can't derive type - continue to next declaration
      continue;
    }

    // Parameter declaration: function f(x: int)
    if (ts.isParameter(decl) && decl.type) {
      return convertType(decl.type, checker);
    }

    // Property declaration: class C { x: int }
    if (ts.isPropertyDeclaration(decl) && decl.type) {
      return convertType(decl.type, checker);
    }

    // Property signature: interface I { x: int }
    if (ts.isPropertySignature(decl) && decl.type) {
      return convertType(decl.type, checker);
    }

    // Function declaration: function f(): int
    if (ts.isFunctionDeclaration(decl)) {
      // For function identifiers, return a function type with return type
      // We simplify parameters since full IrParameter is complex
      return {
        kind: "functionType",
        parameters: decl.parameters.map((p) => ({
          kind: "parameter" as const,
          pattern: {
            kind: "identifierPattern" as const,
            name: ts.isIdentifier(p.name) ? p.name.text : "_",
          },
          type: p.type ? convertType(p.type, checker) : undefined,
          isOptional: !!p.questionToken,
          isRest: !!p.dotDotDotToken,
          passing: "value" as const,
        })),
        returnType: decl.type
          ? convertType(decl.type, checker)
          : { kind: "voidType" },
      };
    }

    // Class declaration: class C {}
    if (ts.isClassDeclaration(decl) && decl.name) {
      return {
        kind: "referenceType",
        name: decl.name.text,
      };
    }

    // Enum declaration: enum E {}
    if (ts.isEnumDeclaration(decl)) {
      return {
        kind: "referenceType",
        name: decl.name.text,
      };
    }

    // Interface declaration: interface I {}
    if (ts.isInterfaceDeclaration(decl)) {
      return {
        kind: "referenceType",
        name: decl.name.text,
      };
    }
  }

  return undefined;
};

/**
 * Extract explicit type arguments from a call or new expression.
 *
 * DETERMINISTIC TYPING: Only returns type arguments that are explicitly
 * specified in the source code. Does NOT use TypeScript's type inference
 * to infer type arguments. For inferred type arguments, use expectedType
 * threading in the caller (Step 6 of deterministic typing).
 */
export const extractTypeArguments = (
  node: ts.CallExpression | ts.NewExpression,
  checker: ts.TypeChecker
): readonly IrType[] | undefined => {
  try {
    // Only return explicitly specified type arguments
    // DETERMINISTIC: No typeToTypeNode for inferred type args
    if (node.typeArguments && node.typeArguments.length > 0) {
      return node.typeArguments.map((typeArg) => convertType(typeArg, checker));
    }

    // No explicit type arguments - return undefined
    // The caller should use expectedType threading if type args are needed
    return undefined;
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
 * Get the contextual type for an expression from explicit TypeNodes.
 *
 * DETERMINISTIC TYPING: Only extracts types from explicit TypeNodes in the
 * source code. Does NOT use TypeScript's getContextualType (banned API).
 * Returns undefined if no explicit type annotation is found.
 *
 * For complete expectedType threading (covering all contexts), see Step 6
 * of deterministic typing implementation.
 */
export const getContextualType = (
  node: ts.Expression,
  checker: ts.TypeChecker
): IrType | undefined => {
  try {
    const parent = node.parent;

    // Variable declaration: const x: Foo = { ... }
    if (ts.isVariableDeclaration(parent) && parent.type) {
      return convertType(parent.type, checker);
    }

    // Return statement: function f(): Foo { return { ... } }
    if (ts.isReturnStatement(parent)) {
      // Walk up to find enclosing function
      let current: ts.Node = parent;
      while (current && !ts.isFunctionLike(current)) {
        current = current.parent;
      }
      if (current && ts.isFunctionLike(current) && current.type) {
        return convertType(current.type, checker);
      }
    }

    // Property assignment in object literal: { prop: { ... } }
    if (ts.isPropertyAssignment(parent)) {
      const propName = ts.isIdentifier(parent.name)
        ? parent.name.text
        : ts.isStringLiteral(parent.name)
          ? parent.name.text
          : undefined;

      if (propName && ts.isObjectLiteralExpression(parent.parent)) {
        const parentType = getContextualType(parent.parent, checker);
        if (parentType?.kind === "objectType") {
          const member = parentType.members.find(
            (m) => m.kind === "propertySignature" && m.name === propName
          );
          if (member?.kind === "propertySignature") {
            return member.type;
          }
        }
        // For referenceType, we would need TypeRegistry to find member type
        // This will be handled in Step 6 with full expectedType threading
      }
    }

    // Array element: const arr: Foo[] = [{ ... }]
    if (ts.isArrayLiteralExpression(parent)) {
      const arrayType = getContextualType(parent, checker);
      if (arrayType?.kind === "arrayType") {
        return arrayType.elementType;
      }
    }

    // Call argument: f({ ... }) where f(x: Foo)
    // This requires finding the parameter type from the resolved signature
    // For now, use getResolvedSignature (allowed) to get the declaration
    if (ts.isCallExpression(parent) || ts.isNewExpression(parent)) {
      const argIndex = parent.arguments
        ? parent.arguments.indexOf(node as ts.Expression)
        : -1;
      if (argIndex >= 0) {
        const sig = checker.getResolvedSignature(parent);
        const decl = sig?.declaration;
        if (decl && decl.parameters && decl.parameters[argIndex]) {
          const paramDecl = decl.parameters[argIndex];
          // Check it's a ParameterDeclaration (not JSDocParameterTag)
          if (paramDecl && ts.isParameter(paramDecl) && paramDecl.type) {
            return convertType(paramDecl.type, checker);
          }
        }
      }
    }

    // DETERMINISTIC: No fallback to checker.getContextualType
    // Return undefined if we can't find an explicit type annotation
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
