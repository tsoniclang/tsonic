/**
 * Helper functions for expression conversion
 *
 * ALICE'S SPEC: All type resolution goes through TypeSystem.
 * NO getHandleRegistry() calls allowed here.
 */

import * as ts from "typescript";
import { IrType } from "../../types.js";
import { SourceLocation } from "../../../types/diagnostic.js";
import { getSourceLocation } from "../../../program/diagnostics.js";
import type { ProgramContext } from "../../program-context.js";

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
 * ALICE'S SPEC: Uses TypeSystem.resolveCall() exclusively.
 * This is a simplified version for use in deriveIdentifierType to avoid
 * circular dependencies with calls.ts.
 */
const deriveCallReturnType = (
  node: ts.CallExpression,
  ctx: ProgramContext
): IrType | undefined => {
  const typeSystem = ctx.typeSystem;

  const sigId = ctx.binding.resolveCallSignature(node);
  if (!sigId) return undefined;

  // Use TypeSystem.resolveCall() - returns fully resolved return type
  const resolved = typeSystem.resolveCall({
    sigId,
    argumentCount: node.arguments.length,
  });

  // If TypeSystem returns unknownType, treat it as unresolvable
  if (resolved.returnType.kind === "unknownType") {
    return undefined;
  }

  return resolved.returnType;
};

/**
 * Derive the constructed type from a new expression.
 *
 * Phase 15 (Alice's spec): Uses constructor-signature-based logic with resolveCall.
 * This enables deterministic generic inference from argument types.
 */
const deriveNewExpressionType = (
  node: ts.NewExpression,
  ctx: ProgramContext
): IrType | undefined => {
  const typeSystem = ctx.typeSystem;

  // Get constructor signature ID
  const sigId = ctx.binding.resolveConstructorSignature(node);
  if (!sigId) return undefined;

  // Extract explicit type arguments
  const explicitTypeArgs = node.typeArguments
    ? node.typeArguments.map((ta) =>
        typeSystem.typeFromSyntax(ctx.binding.captureTypeSyntax(ta))
      )
    : undefined;

  // Derive argTypes conservatively from syntax (similar to deriveTypeFromInitializer)
  const argTypes: (IrType | undefined)[] = [];
  const args = node.arguments ?? [];
  for (const arg of args) {
    if (ts.isSpreadElement(arg)) {
      argTypes.push(undefined);
    } else if (ts.isNumericLiteral(arg)) {
      argTypes.push({ kind: "primitiveType", name: "number" });
    } else if (ts.isStringLiteral(arg)) {
      argTypes.push({ kind: "primitiveType", name: "string" });
    } else if (
      arg.kind === ts.SyntaxKind.TrueKeyword ||
      arg.kind === ts.SyntaxKind.FalseKeyword
    ) {
      argTypes.push({ kind: "primitiveType", name: "boolean" });
    } else if (ts.isIdentifier(arg)) {
      argTypes.push(deriveIdentifierType(arg, ctx));
    } else if (ts.isNewExpression(arg)) {
      // Recursive call for nested new expressions
      argTypes.push(deriveNewExpressionType(arg, ctx));
    } else {
      argTypes.push(undefined);
    }
  }

  // Resolve the constructor call with argTypes for inference
  const resolved = typeSystem.resolveCall({
    sigId,
    argumentCount: args.length,
    explicitTypeArgs,
    argTypes,
  });

  // Return the resolved returnType (the constructed type)
  if (resolved.returnType.kind === "unknownType") {
    return undefined;
  }

  return resolved.returnType;
};

/**
 * Derive type from an initializer expression.
 *
 * DETERMINISTIC: Only uses TypeNodes from declarations, not TS type inference.
 * Returns undefined if type cannot be determined from declarations alone.
 */
const deriveTypeFromInitializer = (
  initializer: ts.Expression,
  ctx: ProgramContext
): IrType | undefined => {
  // Call expression: const arr = createArray()
  if (ts.isCallExpression(initializer)) {
    return deriveCallReturnType(initializer, ctx);
  }

  // New expression: const list = new List<int>()
  if (ts.isNewExpression(initializer)) {
    return deriveNewExpressionType(initializer, ctx);
  }

  // Identifier: const y = x (derive type from x's declaration)
  if (ts.isIdentifier(initializer)) {
    // Recursive call - will look up the identifier's declaration
    // Note: This uses the main function, which is defined below
    // TypeScript hoisting makes this work
    return deriveIdentifierType(initializer, ctx);
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
        const elementType = deriveTypeFromInitializer(firstElem, ctx);
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
  ctx: ProgramContext
): IrType | undefined => {
  const typeSystem = ctx.typeSystem;

  const declId = ctx.binding.resolveIdentifier(node);
  if (!declId) return undefined;

  // ALICE'S SPEC: Use TypeSystem.typeOfDecl() exclusively
  const declType = typeSystem.typeOfDecl(declId);

  // TypeSystem returns unknownType if it can't resolve - treat as unresolvable
  if (declType.kind === "unknownType") {
    return undefined;
  }

  return declType;
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
  ctx: ProgramContext
): readonly IrType[] | undefined => {
  try {
    // Only return explicitly specified type arguments
    // DETERMINISTIC: No typeToTypeNode for inferred type args
    if (node.typeArguments && node.typeArguments.length > 0) {
      // PHASE 4 (Alice's spec): Use captureTypeSyntax + typeFromSyntax
      const typeSystem = ctx.typeSystem;
      return node.typeArguments.map((typeArg) =>
        typeSystem.typeFromSyntax(ctx.binding.captureTypeSyntax(typeArg))
      );
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
 *
 * DETERMINISTIC: Uses Binding API to resolve signatures and extract declaration info.
 */
export const checkIfRequiresSpecialization = (
  node: ts.CallExpression | ts.NewExpression,
  ctx: ProgramContext
): boolean => {
  try {
    // Handle both CallExpression and NewExpression
    const sigId = ts.isCallExpression(node)
      ? ctx.binding.resolveCallSignature(node)
      : ctx.binding.resolveConstructorSignature(node);
    if (!sigId) return false;

    // ALICE'S SPEC: Use TypeSystem for all type checks
    const typeSystem = ctx.typeSystem;

    // ALICE'S SPEC (Phase 5): Use semantic methods instead of getSignatureInfo

    // Check for conditional return types
    if (typeSystem.signatureHasConditionalReturn(sigId)) {
      return true;
    }

    // Check for variadic type parameters (e.g., T extends unknown[])
    if (typeSystem.signatureHasVariadicTypeParams(sigId)) {
      return true;
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
  ctx: ProgramContext
): IrType | undefined => {
  try {
    // PHASE 4 (Alice's spec): Use captureTypeSyntax + typeFromSyntax
    const typeSystem = ctx.typeSystem;

    const parent = node.parent;

    // Variable declaration: const x: Foo = { ... }
    if (ts.isVariableDeclaration(parent) && parent.type) {
      return typeSystem.typeFromSyntax(
        ctx.binding.captureTypeSyntax(parent.type)
      );
    }

    // Return statement: function f(): Foo { return { ... } }
    if (ts.isReturnStatement(parent)) {
      // Walk up to find enclosing function
      let current: ts.Node = parent;
      while (current && !ts.isFunctionLike(current)) {
        current = current.parent;
      }
      if (current && ts.isFunctionLike(current) && current.type) {
        return typeSystem.typeFromSyntax(
          ctx.binding.captureTypeSyntax(current.type)
        );
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
        const parentType = getContextualType(parent.parent, ctx);
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
      const arrayType = getContextualType(parent, ctx);
      if (arrayType?.kind === "arrayType") {
        return arrayType.elementType;
      }
    }

    // Call argument: f({ ... }) where f(x: Foo)
    // Use TypeSystem.resolveCall() to get parameter types
    if (ts.isCallExpression(parent) || ts.isNewExpression(parent)) {
      const argIndex = parent.arguments
        ? parent.arguments.indexOf(node as ts.Expression)
        : -1;
      if (argIndex >= 0) {
        // Handle both CallExpression and NewExpression
        const sigId = ts.isCallExpression(parent)
          ? ctx.binding.resolveCallSignature(parent)
          : ctx.binding.resolveConstructorSignature(parent);
        if (sigId) {
          // ALICE'S SPEC: Use TypeSystem.resolveCall() for parameter types
          const resolved = typeSystem.resolveCall({
            sigId,
            argumentCount: parent.arguments?.length ?? 0,
          });
          const paramType = resolved.parameterTypes[argIndex];
          if (paramType && paramType.kind !== "unknownType") {
            return paramType;
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
