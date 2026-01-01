/**
 * Expression converter - TypeScript AST to IR expressions
 * Main dispatcher - delegates to specialized modules
 */

import * as ts from "typescript";
import {
  IrExpression,
  IrNumericNarrowingExpression,
  IrType,
  NumericKind,
  TSONIC_TO_NUMERIC_KIND,
} from "./types.js";
import { getBindingRegistry } from "./converters/statements/declarations/registry.js";
import { convertType } from "./type-converter.js";
import type { Binding } from "./binding/index.js";

// Import expression converters from specialized modules
import { convertLiteral } from "./converters/expressions/literals.js";
import {
  convertArrayLiteral,
  convertObjectLiteral,
} from "./converters/expressions/collections.js";
import { convertMemberExpression } from "./converters/expressions/access.js";
import {
  convertCallExpression,
  convertNewExpression,
} from "./converters/expressions/calls.js";
import {
  convertBinaryExpression,
  convertUnaryExpression,
  convertUpdateExpression,
} from "./converters/expressions/operators.js";
import {
  convertFunctionExpression,
  convertArrowFunction,
} from "./converters/expressions/functions.js";
import {
  convertConditionalExpression,
  convertTemplateLiteral,
} from "./converters/expressions/other.js";
import {
  deriveIdentifierType,
  getSourceSpan,
} from "./converters/expressions/helpers.js";

/**
 * Extract the NumericKind from a type node if it references a known numeric alias.
 *
 * Examples:
 * - `int` → "Int32"
 * - `byte` → "Byte"
 * - `long` → "Int64"
 * - `string` → undefined (not numeric)
 */
const getNumericKindFromTypeNode = (
  typeNode: ts.TypeNode
): NumericKind | undefined => {
  // Handle type reference nodes (e.g., `int`, `byte`, `Int32`)
  if (ts.isTypeReferenceNode(typeNode)) {
    const typeName = typeNode.typeName;
    if (ts.isIdentifier(typeName)) {
      const name = typeName.text;
      // Look up the type alias name in our mapping
      const kind = TSONIC_TO_NUMERIC_KIND.get(name);
      if (kind !== undefined) {
        return kind;
      }
    }
  }

  return undefined;
};

/**
 * Main expression conversion dispatcher
 * Converts TypeScript expression nodes to IR expressions
 *
 * @param node - The TypeScript expression node to convert
 * @param binding - The Binding layer for symbol resolution
 * @param expectedType - Expected type from context (e.g., LHS annotation, parameter type).
 *                       Pass `undefined` explicitly when no contextual type exists.
 *                       Used for deterministic typing of literals and arrays.
 */
export const convertExpression = (
  node: ts.Expression,
  binding: Binding,
  expectedType: IrType | undefined
): IrExpression => {
  // DETERMINISTIC TYPING: No top-level getInferredType() call.
  // Each expression type derives its inferredType from the appropriate source.

  if (ts.isStringLiteral(node) || ts.isNumericLiteral(node)) {
    return convertLiteral(node, binding);
  }
  if (
    node.kind === ts.SyntaxKind.TrueKeyword ||
    node.kind === ts.SyntaxKind.FalseKeyword
  ) {
    // Boolean literals have deterministic type
    return {
      kind: "literal",
      value: node.kind === ts.SyntaxKind.TrueKeyword,
      raw: node.getText(),
      inferredType: { kind: "primitiveType", name: "boolean" },
      sourceSpan: getSourceSpan(node),
    };
  }
  if (node.kind === ts.SyntaxKind.NullKeyword) {
    // Null literal - type is context-dependent, undefined for now
    return {
      kind: "literal",
      value: null,
      raw: "null",
      inferredType: undefined,
      sourceSpan: getSourceSpan(node),
    };
  }
  if (
    node.kind === ts.SyntaxKind.UndefinedKeyword ||
    ts.isVoidExpression(node)
  ) {
    // Undefined literal - type is void
    return {
      kind: "literal",
      value: undefined,
      raw: "undefined",
      inferredType: { kind: "voidType" },
      sourceSpan: getSourceSpan(node),
    };
  }
  if (ts.isIdentifier(node)) {
    // DETERMINISTIC: Derive type from declaration TypeNode
    const identifierType = deriveIdentifierType(node, binding);

    // Check if this identifier is an aliased import (e.g., import { String as ClrString })
    // We need the original name for binding lookup
    let originalName: string | undefined;
    const declId = binding.resolveIdentifier(node);
    if (declId) {
      const declInfo = binding.getHandleRegistry().getDecl(declId);
      // If the fqName differs from the identifier text, it's an aliased import
      if (declInfo?.fqName && declInfo.fqName !== node.text) {
        originalName = declInfo.fqName;
      }
    }

    // Check if this identifier is bound to a CLR type (e.g., console, Math, etc.)
    const clrBinding = getBindingRegistry().getBinding(node.text);
    if (clrBinding && clrBinding.kind === "global") {
      return {
        kind: "identifier",
        name: node.text,
        inferredType: identifierType,
        sourceSpan: getSourceSpan(node),
        resolvedClrType: clrBinding.type,
        resolvedAssembly: clrBinding.assembly,
        csharpName: clrBinding.csharpName, // Optional C# name from binding
        originalName,
        declId,
      };
    }
    return {
      kind: "identifier",
      name: node.text,
      inferredType: identifierType,
      sourceSpan: getSourceSpan(node),
      originalName,
      declId,
    };
  }
  if (ts.isArrayLiteralExpression(node)) {
    return convertArrayLiteral(node, binding, expectedType);
  }
  if (ts.isObjectLiteralExpression(node)) {
    return convertObjectLiteral(node, binding, expectedType);
  }
  if (
    ts.isPropertyAccessExpression(node) ||
    ts.isElementAccessExpression(node)
  ) {
    return convertMemberExpression(node, binding);
  }
  if (ts.isCallExpression(node)) {
    return convertCallExpression(node, binding);
  }
  if (ts.isNewExpression(node)) {
    return convertNewExpression(node, binding);
  }
  if (ts.isBinaryExpression(node)) {
    return convertBinaryExpression(node, binding, expectedType);
  }
  if (ts.isPrefixUnaryExpression(node)) {
    return convertUnaryExpression(node, binding);
  }
  if (ts.isPostfixUnaryExpression(node)) {
    return convertUpdateExpression(node, binding);
  }
  if (ts.isTypeOfExpression(node)) {
    // typeof always returns string
    return {
      kind: "unary",
      operator: "typeof",
      expression: convertExpression(node.expression, binding, undefined),
      inferredType: { kind: "primitiveType", name: "string" },
      sourceSpan: getSourceSpan(node),
    };
  }
  if (ts.isVoidExpression(node)) {
    // void always returns undefined (void type)
    return {
      kind: "unary",
      operator: "void",
      expression: convertExpression(node.expression, binding, undefined),
      inferredType: { kind: "voidType" },
      sourceSpan: getSourceSpan(node),
    };
  }
  if (ts.isDeleteExpression(node)) {
    // delete always returns boolean
    return {
      kind: "unary",
      operator: "delete",
      expression: convertExpression(node.expression, binding, undefined),
      inferredType: { kind: "primitiveType", name: "boolean" },
      sourceSpan: getSourceSpan(node),
    };
  }
  if (ts.isConditionalExpression(node)) {
    return convertConditionalExpression(node, binding, expectedType);
  }
  if (ts.isFunctionExpression(node)) {
    // DETERMINISTIC: Pass expectedType for parameter type inference
    return convertFunctionExpression(node, binding, expectedType);
  }
  if (ts.isArrowFunction(node)) {
    // DETERMINISTIC: Pass expectedType for parameter type inference
    return convertArrowFunction(node, binding, expectedType);
  }
  if (
    ts.isTemplateExpression(node) ||
    ts.isNoSubstitutionTemplateLiteral(node)
  ) {
    return convertTemplateLiteral(node, binding);
  }
  if (ts.isSpreadElement(node)) {
    // Spread inherits type from expression (the array being spread)
    const spreadExpr = convertExpression(node.expression, binding, undefined);
    return {
      kind: "spread",
      expression: spreadExpr,
      inferredType: spreadExpr.inferredType,
      sourceSpan: getSourceSpan(node),
    };
  }
  if (node.kind === ts.SyntaxKind.ThisKeyword) {
    // 'this' type depends on context - undefined for now
    return {
      kind: "this",
      inferredType: undefined,
      sourceSpan: getSourceSpan(node),
    };
  }
  if (ts.isAwaitExpression(node)) {
    // await unwraps Promise - for now pass through the expression's type
    // (full unwrapping would require detecting Promise<T> and returning T)
    const awaitedExpr = convertExpression(node.expression, binding, undefined);
    return {
      kind: "await",
      expression: awaitedExpr,
      inferredType: undefined, // Would need Promise unwrapping
      sourceSpan: getSourceSpan(node),
    };
  }
  if (ts.isYieldExpression(node)) {
    // yield type depends on generator context - undefined for now
    return {
      kind: "yield",
      expression: node.expression
        ? convertExpression(node.expression, binding, undefined)
        : undefined,
      delegate: !!node.asteriskToken,
      inferredType: undefined,
      sourceSpan: getSourceSpan(node),
    };
  }
  if (ts.isParenthesizedExpression(node)) {
    return convertExpression(node.expression, binding, expectedType);
  }
  if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
    // Convert the inner expression
    const innerExpr = convertExpression(node.expression, binding, undefined);

    // Get the asserted type
    const assertedTypeNode = node.type;
    const assertedType = convertType(assertedTypeNode, binding);

    // Check if this is a numeric narrowing (e.g., `as int`, `as byte`)
    const numericKind = getNumericKindFromTypeNode(assertedTypeNode);
    if (numericKind !== undefined) {
      // Determine the inferredType based on the targetKind
      // INVARIANT: "Int32" → primitiveType(name="int")
      // Other numeric kinds remain as referenceType (handled by assertedType)
      const inferredType =
        numericKind === "Int32"
          ? { kind: "primitiveType" as const, name: "int" as const }
          : assertedType;

      // Create a numeric narrowing expression that preserves the inner expression
      const narrowingExpr: IrNumericNarrowingExpression = {
        kind: "numericNarrowing",
        expression: innerExpr,
        targetKind: numericKind,
        inferredType,
        sourceSpan: getSourceSpan(node),
      };
      return narrowingExpr;
    }

    // Check if this is `as number` or `as double` - explicit widening intent
    // This creates a numericNarrowing with targetKind: "Double" to distinguish
    // from a plain literal (which also has inferredType: number but no assertion)
    if (
      assertedType.kind === "primitiveType" &&
      assertedType.name === "number"
    ) {
      // Check if the inner expression is numeric (literal or already classified)
      const isNumericInner =
        (innerExpr.kind === "literal" && typeof innerExpr.value === "number") ||
        innerExpr.kind === "numericNarrowing";

      if (isNumericInner) {
        const narrowingExpr: IrNumericNarrowingExpression = {
          kind: "numericNarrowing",
          expression: innerExpr,
          targetKind: "Double",
          inferredType: assertedType,
          sourceSpan: getSourceSpan(node),
        };
        return narrowingExpr;
      }
    }

    // Check if this is a type erasure (unknown/any) - NOT a runtime cast
    // `x as unknown` or `x as any` just tells TS to forget the type
    if (
      assertedType.kind === "unknownType" ||
      assertedType.kind === "anyType"
    ) {
      return innerExpr;
    }

    // Check if this is a parameter modifier type (out<T>, ref<T>, in<T>)
    // These are not real type casts - they're parameter passing annotations
    const isParameterModifierType =
      assertedType.kind === "referenceType" &&
      (assertedType.name === "out" ||
        assertedType.name === "ref" ||
        assertedType.name === "in" ||
        assertedType.name === "inref");

    if (isParameterModifierType) {
      // Just return the inner expression - the parameter modifier is handled elsewhere
      return innerExpr;
    }

    // Non-numeric assertion - create type assertion node for C# cast
    return {
      kind: "typeAssertion",
      expression: innerExpr,
      targetType: assertedType,
      inferredType: assertedType,
      sourceSpan: getSourceSpan(node),
    };
  }

  // Fallback - treat as identifier with unknown type
  return {
    kind: "identifier",
    name: node.getText(),
    inferredType: undefined,
    sourceSpan: getSourceSpan(node),
  };
};

// Re-export commonly used functions for backward compatibility
export {
  deriveIdentifierType,
  extractTypeArguments,
  checkIfRequiresSpecialization,
} from "./converters/expressions/helpers.js";
