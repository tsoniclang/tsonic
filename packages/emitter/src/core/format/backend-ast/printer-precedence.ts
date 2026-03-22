/**
 * Backend AST Printer – Operator Precedence and Type Printer
 *
 * Operator precedence tables, expression precedence classification,
 * parenthesization logic, and the C# type printer.
 */

import type { CSharpTypeAst, CSharpExpressionAst } from "./types.js";

import {
  escapeIdentifier,
  escapeQualifiedName,
} from "./printer-identifiers.js";

// ============================================================
// Operator precedence for parenthesization
// ============================================================

/**
 * C# operator precedence levels (higher = binds tighter).
 * Used by the printer to insert parentheses only when necessary.
 */
export const getOperatorPrecedence = (op: string): number => {
  switch (op) {
    // Assignment operators (lowest)
    case "=":
    case "+=":
    case "-=":
    case "*=":
    case "/=":
    case "%=":
    case "&=":
    case "|=":
    case "^=":
    case "<<=":
    case ">>=":
    case "??=":
      return 1;
    // Conditional ternary
    // (handled separately, not via this function)
    // Null-coalescing
    case "??":
      return 3;
    // Logical OR
    case "||":
      return 4;
    // Logical AND
    case "&&":
      return 5;
    // Bitwise OR
    case "|":
      return 6;
    // Bitwise XOR
    case "^":
      return 7;
    // Bitwise AND
    case "&":
      return 8;
    // Equality
    case "==":
    case "!=":
      return 9;
    // Relational (includes is, as - handled separately)
    case "<":
    case ">":
    case "<=":
    case ">=":
      return 10;
    // Shift
    case "<<":
    case ">>":
      return 11;
    // Additive
    case "+":
    case "-":
      return 12;
    // Multiplicative
    case "*":
    case "/":
    case "%":
      return 13;
    default:
      return 0;
  }
};

/**
 * Get the effective precedence of an expression for parenthesization decisions.
 */
export const getExpressionPrecedence = (expr: CSharpExpressionAst): number => {
  switch (expr.kind) {
    case "assignmentExpression":
      return 1;
    case "conditionalExpression":
      return 2;
    case "binaryExpression":
      return getOperatorPrecedence(expr.operatorToken);
    case "isExpression":
    case "asExpression":
      return 10; // Relational level
    case "prefixUnaryExpression":
      return 14; // Unary prefix
    case "postfixUnaryExpression":
      return 15; // Unary postfix
    case "castExpression":
      return 14; // Cast is at unary level
    case "awaitExpression":
      return 14; // Await is at unary level
    // Primary expressions (highest precedence)
    case "nullLiteralExpression":
    case "booleanLiteralExpression":
    case "stringLiteralExpression":
    case "charLiteralExpression":
    case "numericLiteralExpression":
    case "identifierExpression":
    case "qualifiedIdentifierExpression":
    case "typeReferenceExpression":
    case "parenthesizedExpression":
    case "memberAccessExpression":
    case "conditionalMemberAccessExpression":
    case "elementAccessExpression":
    case "conditionalElementAccessExpression":
    case "implicitElementAccessExpression":
    case "invocationExpression":
    case "objectCreationExpression":
    case "arrayCreationExpression":
    case "stackAllocArrayCreationExpression":
    case "defaultExpression":
    case "sizeOfExpression":
    case "typeofExpression":
    case "interpolatedStringExpression":
    case "suppressNullableWarningExpression":
    case "switchExpression":
    case "declarationExpression":
      return 16;
    case "argumentModifierExpression":
      return 16; // Argument modifier is used in argument position only
    case "tupleExpression":
      return 16; // Tuple literals are primary expressions
    case "lambdaExpression":
      return 0; // Lambda needs parens almost everywhere
    case "throwExpression":
      return 0; // Throw expression is very low precedence
    default:
      return 0;
  }
};

/**
 * Whether an expression needs parenthesization when used as an operand
 * of a binary expression with the given parent precedence.
 */
export const needsParensInBinary = (
  child: CSharpExpressionAst,
  parentPrecedence: number,
  isRightOperand: boolean
): boolean => {
  const childPrec = getExpressionPrecedence(child);

  if (childPrec < parentPrecedence) return true;

  // For same-precedence, right-associative operators (assignment)
  // don't need parens on the right side
  if (childPrec === parentPrecedence && isRightOperand) {
    // Assignment is right-associative
    if (child.kind === "assignmentExpression") {
      return false;
    }
    // Associative operators at exclusive precedence levels: grouping doesn't
    // change semantics, so right-side parens are unnecessary.
    // Each of these operators is the sole occupant of its precedence level,
    // so same-prec right child must be the same operator.
    if (
      child.kind === "binaryExpression" &&
      (child.operatorToken === "&&" ||
        child.operatorToken === "||" ||
        child.operatorToken === "|" ||
        child.operatorToken === "&" ||
        child.operatorToken === "^")
    ) {
      return false;
    }
    // Left-associative (and ?? for readability): right operand at same precedence needs parens
    return true;
  }

  return false;
};

// ============================================================
// Type Printer
// ============================================================

export const printType = (type: CSharpTypeAst): string => {
  switch (type.kind) {
    case "predefinedType":
      return type.keyword;

    case "identifierType": {
      if (type.name.includes(".") || type.name.includes("::")) {
        throw new Error(
          `ICE: Simple identifierType '${type.name}' contains qualification. Use qualifiedIdentifierType AST instead.`
        );
      }
      const name = escapeIdentifier(type.name);
      if (!type.typeArguments || type.typeArguments.length === 0) {
        return name;
      }
      const args = type.typeArguments.map(printType).join(", ");
      return `${name}<${args}>`;
    }

    case "qualifiedIdentifierType": {
      const name = escapeQualifiedName(type.name, true);
      if (!type.typeArguments || type.typeArguments.length === 0) {
        return name;
      }
      const args = type.typeArguments.map(printType).join(", ");
      return `${name}<${args}>`;
    }

    case "nullableType":
      return type.underlyingType.kind === "nullableType"
        ? printType(type.underlyingType)
        : `${printType(type.underlyingType)}?`;

    case "arrayType": {
      const elem = printType(type.elementType);
      if (type.rank === 1) {
        return `${elem}[]`;
      }
      const commas = ",".repeat(type.rank - 1);
      return `${elem}[${commas}]`;
    }

    case "pointerType":
      return `${printType(type.elementType)}*`;

    case "tupleType": {
      const elems = type.elements
        .map((e) =>
          e.name ? `${printType(e.type)} ${e.name}` : printType(e.type)
        )
        .join(", ");
      return `(${elems})`;
    }

    case "varType":
      return "var";

    default: {
      const exhaustiveCheck: never = type;
      throw new Error(
        `ICE: Unhandled type AST kind: ${(exhaustiveCheck as CSharpTypeAst).kind}`
      );
    }
  }
};
