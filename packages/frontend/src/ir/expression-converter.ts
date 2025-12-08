/**
 * Expression converter - TypeScript AST to IR expressions
 * Main dispatcher - delegates to specialized modules
 */

import * as ts from "typescript";
import {
  IrExpression,
  IrNumericNarrowingExpression,
  NumericKind,
  TSONIC_TO_NUMERIC_KIND,
} from "./types.js";
import { getBindingRegistry } from "./converters/statements/declarations/registry.js";
import { convertType } from "./type-converter.js";

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
import { getInferredType } from "./converters/expressions/helpers.js";

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
 */
export const convertExpression = (
  node: ts.Expression,
  checker: ts.TypeChecker
): IrExpression => {
  const inferredType = getInferredType(node, checker);

  if (ts.isStringLiteral(node) || ts.isNumericLiteral(node)) {
    return convertLiteral(node, checker);
  }
  if (
    node.kind === ts.SyntaxKind.TrueKeyword ||
    node.kind === ts.SyntaxKind.FalseKeyword
  ) {
    return {
      kind: "literal",
      value: node.kind === ts.SyntaxKind.TrueKeyword,
      raw: node.getText(),
      inferredType,
    };
  }
  if (node.kind === ts.SyntaxKind.NullKeyword) {
    return { kind: "literal", value: null, raw: "null", inferredType };
  }
  if (
    node.kind === ts.SyntaxKind.UndefinedKeyword ||
    ts.isVoidExpression(node)
  ) {
    return {
      kind: "literal",
      value: undefined,
      raw: "undefined",
      inferredType,
    };
  }
  if (ts.isIdentifier(node)) {
    // Check if this identifier is bound to a CLR type (e.g., console, Math, etc.)
    const binding = getBindingRegistry().getBinding(node.text);
    if (binding && binding.kind === "global") {
      return {
        kind: "identifier",
        name: node.text,
        inferredType,
        resolvedClrType: binding.type,
        resolvedAssembly: binding.assembly,
        csharpName: binding.csharpName, // Optional C# name from binding
      };
    }
    return { kind: "identifier", name: node.text, inferredType };
  }
  if (ts.isArrayLiteralExpression(node)) {
    return convertArrayLiteral(node, checker);
  }
  if (ts.isObjectLiteralExpression(node)) {
    return convertObjectLiteral(node, checker);
  }
  if (
    ts.isPropertyAccessExpression(node) ||
    ts.isElementAccessExpression(node)
  ) {
    return convertMemberExpression(node, checker);
  }
  if (ts.isCallExpression(node)) {
    return convertCallExpression(node, checker);
  }
  if (ts.isNewExpression(node)) {
    return convertNewExpression(node, checker);
  }
  if (ts.isBinaryExpression(node)) {
    return convertBinaryExpression(node, checker);
  }
  if (ts.isPrefixUnaryExpression(node)) {
    return convertUnaryExpression(node, checker);
  }
  if (ts.isPostfixUnaryExpression(node)) {
    return convertUpdateExpression(node, checker);
  }
  if (ts.isTypeOfExpression(node)) {
    return {
      kind: "unary",
      operator: "typeof",
      expression: convertExpression(node.expression, checker),
      inferredType,
    };
  }
  if (ts.isVoidExpression(node)) {
    return {
      kind: "unary",
      operator: "void",
      expression: convertExpression(node.expression, checker),
      inferredType,
    };
  }
  if (ts.isDeleteExpression(node)) {
    return {
      kind: "unary",
      operator: "delete",
      expression: convertExpression(node.expression, checker),
      inferredType,
    };
  }
  if (ts.isConditionalExpression(node)) {
    return convertConditionalExpression(node, checker);
  }
  if (ts.isFunctionExpression(node)) {
    return convertFunctionExpression(node, checker);
  }
  if (ts.isArrowFunction(node)) {
    return convertArrowFunction(node, checker);
  }
  if (
    ts.isTemplateExpression(node) ||
    ts.isNoSubstitutionTemplateLiteral(node)
  ) {
    return convertTemplateLiteral(node, checker);
  }
  if (ts.isSpreadElement(node)) {
    return {
      kind: "spread",
      expression: convertExpression(node.expression, checker),
      inferredType,
    };
  }
  if (node.kind === ts.SyntaxKind.ThisKeyword) {
    return { kind: "this", inferredType };
  }
  if (ts.isAwaitExpression(node)) {
    return {
      kind: "await",
      expression: convertExpression(node.expression, checker),
      inferredType,
    };
  }
  if (ts.isYieldExpression(node)) {
    return {
      kind: "yield",
      expression: node.expression
        ? convertExpression(node.expression, checker)
        : undefined,
      delegate: !!node.asteriskToken,
      inferredType,
    };
  }
  if (ts.isParenthesizedExpression(node)) {
    return convertExpression(node.expression, checker);
  }
  if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
    // Convert the inner expression
    const innerExpr = convertExpression(node.expression, checker);

    // Get the asserted type
    const assertedTypeNode = node.type;
    const assertedType = convertType(assertedTypeNode, checker);

    // Check if this is a numeric narrowing (e.g., `as int`, `as byte`)
    const numericKind = getNumericKindFromTypeNode(assertedTypeNode);
    if (numericKind !== undefined) {
      // Create a numeric narrowing expression that preserves the inner expression
      const narrowingExpr: IrNumericNarrowingExpression = {
        kind: "numericNarrowing",
        expression: innerExpr,
        targetKind: numericKind,
        inferredType: {
          kind: "primitiveType",
          name: "number",
          numericIntent: numericKind,
        },
      };
      return narrowingExpr;
    }

    // Non-numeric assertion - keep existing behavior (overwrite inferredType)
    return { ...innerExpr, inferredType: assertedType };
  }

  // Fallback - treat as identifier
  return { kind: "identifier", name: node.getText(), inferredType };
};

// Re-export commonly used functions for backward compatibility
export {
  getInferredType,
  extractTypeArguments,
  checkIfRequiresSpecialization,
} from "./converters/expressions/helpers.js";
