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
 * Returns undefined if:
 * - No declaration found
 * - Declaration has no TypeNode (untyped parameter, etc.)
 *
 * For variables without explicit type but with initializer, returns undefined
 * (caller should derive from initializer's inferredType).
 */
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
    if (ts.isVariableDeclaration(decl) && decl.type) {
      return convertType(decl.type, checker);
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
 * DETERMINISTIC TYPING: This returns a referenceType with the type name.
 * Type arguments come from the parent context's explicit TypeNode, not from
 * TypeScript's computed types.
 */
export const getContextualType = (
  node: ts.Expression,
  checker: ts.TypeChecker
): IrType | undefined => {
  try {
    // First try to get type from parent's explicit TypeNode (deterministic)
    const parent = node.parent;

    // Variable declaration: const x: Foo = { ... }
    if (ts.isVariableDeclaration(parent) && parent.type) {
      return convertType(parent.type, checker);
    }

    // Property assignment in object literal: { prop: { ... } }
    // The parent object's contextual type determines this property's type
    if (ts.isPropertyAssignment(parent)) {
      // Get the property name
      const propName = ts.isIdentifier(parent.name)
        ? parent.name.text
        : ts.isStringLiteral(parent.name)
          ? parent.name.text
          : undefined;

      if (propName && ts.isObjectLiteralExpression(parent.parent)) {
        // Recursively get the parent object's contextual type
        const parentType = getContextualType(parent.parent, checker);
        if (parentType?.kind === "objectType") {
          const member = parentType.members.find(
            (m) => m.kind === "propertySignature" && m.name === propName
          );
          if (member?.kind === "propertySignature") {
            return member.type;
          }
        }
      }
    }

    // Parameter: function f(x: Foo) { ... } - called with { ... }
    // For this we check TypeScript's contextual type symbol
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
        // DETERMINISTIC: Return referenceType with just the name
        // Type arguments would need to come from explicit TypeNodes in context
        return { kind: "referenceType", name };
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
