/**
 * Backend AST Printer – Shared Utilities
 *
 * Escape helpers, keyword sets, identifier escaping, colon-detection,
 * operator precedence, and the type printer.
 *
 * These utilities are consumed by every other printer-* module but
 * never import from them, keeping the dependency graph acyclic.
 */

import type {
  CSharpTypeAst,
  CSharpExpressionAst,
  CSharpPatternAst,
  CSharpQualifiedNameAst,
  CSharpTriviaAst,
} from "./types.js";

export const escapeCSharpStringLiteral = (value: string): string =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");

export const escapeCSharpCharLiteral = (value: string): string => {
  switch (value) {
    case "'":
      return "\\'";
    case "\\":
      return "\\\\";
    case "\n":
      return "\\n";
    case "\r":
      return "\\r";
    case "\t":
      return "\\t";
    case "\0":
      return "\\0";
    default:
      return value;
  }
};

export const printTrivia = (trivia: CSharpTriviaAst): string => {
  switch (trivia.kind) {
    case "singleLineCommentTrivia":
      return `// ${trivia.text}`;
    case "blankLineTrivia":
      return "";
    default: {
      const exhaustive: never = trivia;
      throw new Error(
        `ICE: Unhandled trivia kind '${(exhaustive as CSharpTriviaAst).kind}' in printTrivia`
      );
    }
  }
};

export const nameMayPrintColon = (name: CSharpQualifiedNameAst): boolean =>
  name.aliasQualifier !== undefined;

export const typeMayPrintColon = (type: CSharpTypeAst): boolean => {
  switch (type.kind) {
    case "predefinedType":
    case "varType":
      return false;
    case "identifierType":
      return type.typeArguments?.some(typeMayPrintColon) === true;
    case "qualifiedIdentifierType":
      return (
        nameMayPrintColon(type.name) ||
        type.typeArguments?.some(typeMayPrintColon) === true
      );
    case "nullableType":
      return typeMayPrintColon(type.underlyingType);
    case "arrayType":
      return typeMayPrintColon(type.elementType);
    case "pointerType":
      return typeMayPrintColon(type.elementType);
    case "tupleType":
      return type.elements.some((element) => typeMayPrintColon(element.type));
    default: {
      const exhaustive: never = type;
      throw new Error(
        `ICE: Unhandled type AST kind '${(exhaustive as CSharpTypeAst).kind}' in typeMayPrintColon`
      );
    }
  }
};

export const patternMayPrintColon = (pattern: CSharpPatternAst): boolean => {
  switch (pattern.kind) {
    case "typePattern":
    case "declarationPattern":
      return typeMayPrintColon(pattern.type);
    case "varPattern":
    case "discardPattern":
      return false;
    case "constantPattern":
      return expressionMayPrintColon(pattern.expression);
    case "negatedPattern":
      return patternMayPrintColon(pattern.pattern);
    default: {
      const exhaustive: never = pattern;
      throw new Error(
        `ICE: Unhandled pattern AST kind '${(exhaustive as CSharpPatternAst).kind}' in patternMayPrintColon`
      );
    }
  }
};

export const expressionMayPrintColon = (expr: CSharpExpressionAst): boolean => {
  switch (expr.kind) {
    case "conditionalExpression":
      return true;
    case "identifierExpression":
      return false;
    case "qualifiedIdentifierExpression":
      return nameMayPrintColon(expr.name);
    case "typeReferenceExpression":
      return typeMayPrintColon(expr.type);
    case "parenthesizedExpression":
    case "awaitExpression":
    case "throwExpression":
    case "suppressNullableWarningExpression":
    case "argumentModifierExpression":
      return expressionMayPrintColon(expr.expression);
    case "prefixUnaryExpression":
    case "postfixUnaryExpression":
      return expressionMayPrintColon(expr.operand);
    case "memberAccessExpression":
    case "conditionalMemberAccessExpression":
      return expressionMayPrintColon(expr.expression);
    case "elementAccessExpression":
    case "conditionalElementAccessExpression":
      return (
        expressionMayPrintColon(expr.expression) ||
        expr.arguments.some(expressionMayPrintColon)
      );
    case "implicitElementAccessExpression":
      return expr.arguments.some(expressionMayPrintColon);
    case "invocationExpression":
      return (
        expressionMayPrintColon(expr.expression) ||
        expr.arguments.some(expressionMayPrintColon) ||
        expr.typeArguments?.some(typeMayPrintColon) === true
      );
    case "objectCreationExpression":
      return (
        typeMayPrintColon(expr.type) ||
        expr.arguments.some(expressionMayPrintColon) ||
        expr.initializer?.some(expressionMayPrintColon) === true
      );
    case "arrayCreationExpression":
      return (
        typeMayPrintColon(expr.elementType) ||
        (expr.sizeExpression
          ? expressionMayPrintColon(expr.sizeExpression)
          : false) ||
        expr.initializer?.some(expressionMayPrintColon) === true
      );
    case "stackAllocArrayCreationExpression":
      return (
        typeMayPrintColon(expr.elementType) ||
        expressionMayPrintColon(expr.sizeExpression)
      );
    case "assignmentExpression":
    case "binaryExpression":
      return (
        expressionMayPrintColon(expr.left) ||
        expressionMayPrintColon(expr.right)
      );
    case "castExpression":
      return (
        typeMayPrintColon(expr.type) || expressionMayPrintColon(expr.expression)
      );
    case "asExpression":
      return (
        typeMayPrintColon(expr.type) || expressionMayPrintColon(expr.expression)
      );
    case "isExpression":
      return (
        expressionMayPrintColon(expr.expression) ||
        patternMayPrintColon(expr.pattern)
      );
    case "defaultExpression":
      return expr.type ? typeMayPrintColon(expr.type) : false;
    case "sizeOfExpression":
    case "typeofExpression":
      return typeMayPrintColon(expr.type);
    case "lambdaExpression":
      return expr.parameters.some((p) =>
        p.type ? typeMayPrintColon(p.type) : false
      );
    case "interpolatedStringExpression":
      return expr.parts.some(
        (part) =>
          part.kind === "interpolation" &&
          expressionMayPrintColon(part.expression)
      );
    case "switchExpression":
      return (
        expressionMayPrintColon(expr.governingExpression) ||
        expr.arms.some(
          (arm) =>
            patternMayPrintColon(arm.pattern) ||
            (arm.whenClause
              ? expressionMayPrintColon(arm.whenClause)
              : false) ||
            expressionMayPrintColon(arm.expression)
        )
      );
    case "tupleExpression":
      return expr.elements.some(expressionMayPrintColon);
    case "nullLiteralExpression":
    case "booleanLiteralExpression":
    case "stringLiteralExpression":
    case "charLiteralExpression":
    case "numericLiteralExpression":
      return false;
    default: {
      const exhaustive: never = expr;
      throw new Error(
        `ICE: Unhandled expression AST kind '${(exhaustive as CSharpExpressionAst).kind}' in expressionMayPrintColon`
      );
    }
  }
};

export const needsPrefixUnarySeparator = (
  operatorToken: string,
  operand: CSharpExpressionAst
): boolean => {
  if (operatorToken !== "-" && operatorToken !== "+") {
    return false;
  }

  const unwrapped =
    operand.kind === "parenthesizedExpression" ? operand.expression : operand;

  return (
    unwrapped.kind === "prefixUnaryExpression" &&
    unwrapped.operatorToken === operatorToken
  );
};

export const printNumericLiteral = (
  expr: Extract<CSharpExpressionAst, { kind: "numericLiteralExpression" }>
): string => {
  const suffix = expr.suffix ?? "";
  const hasRealParts =
    expr.fractionalPart !== undefined || expr.exponentDigits !== undefined;

  if (hasRealParts) {
    const fractional =
      expr.fractionalPart !== undefined ? `.${expr.fractionalPart}` : "";
    const exponent =
      expr.exponentDigits !== undefined
        ? `e${expr.exponentSign ?? ""}${expr.exponentDigits}`
        : "";
    return `${expr.wholePart}${fractional}${exponent}${suffix}`;
  }

  switch (expr.base) {
    case "decimal":
      return `${expr.wholePart}${suffix}`;
    case "hexadecimal":
      return `0x${expr.wholePart}${suffix}`;
    case "binary":
      return `0b${expr.wholePart}${suffix}`;
    default: {
      const exhaustive: never = expr.base;
      throw new Error(
        `ICE: Unhandled numeric literal base '${exhaustive as string}'`
      );
    }
  }
};

// ============================================================
// C# reserved keywords for identifier escaping
// ============================================================

export const CSHARP_KEYWORDS = new Set([
  "abstract",
  "as",
  "bool",
  "break",
  "byte",
  "case",
  "catch",
  "char",
  "checked",
  "class",
  "const",
  "continue",
  "decimal",
  "default",
  "delegate",
  "do",
  "double",
  "else",
  "enum",
  "event",
  "explicit",
  "extern",
  "finally",
  "fixed",
  "float",
  "for",
  "foreach",
  "goto",
  "if",
  "implicit",
  "in",
  "int",
  "interface",
  "internal",
  "is",
  "lock",
  "long",
  "namespace",
  "new",
  "null",
  "object",
  "operator",
  "out",
  "override",
  "params",
  "private",
  "protected",
  "public",
  "readonly",
  "ref",
  "return",
  "sbyte",
  "sealed",
  "short",
  "sizeof",
  "stackalloc",
  "static",
  "string",
  "struct",
  "switch",
  "throw",
  "try",
  "typeof",
  "uint",
  "ulong",
  "unchecked",
  "unsafe",
  "ushort",
  "using",
  "virtual",
  "void",
  "volatile",
  "while",
]);

/**
 * C# predefined type keywords that should NOT be escaped with @
 * when used in type position (they are the type name itself).
 */
export const PREDEFINED_TYPE_KEYWORDS = new Set([
  "bool",
  "byte",
  "char",
  "decimal",
  "double",
  "float",
  "int",
  "long",
  "object",
  "sbyte",
  "short",
  "string",
  "uint",
  "ulong",
  "ushort",
  "void",
  "nint",
  "nuint",
]);

/**
 * Escape a C# identifier if it's a keyword.
 * Preserves predefined type keywords when used as types.
 */
export const escapeIdentifier = (name: string): string =>
  CSHARP_KEYWORDS.has(name) ? `@${name}` : name;

/**
 * Escape segments in a qualified name AST.
 */
export const escapeQualifiedName = (
  name: CSharpQualifiedNameAst,
  preservePredefinedTypeKeywords: boolean = false
): string => {
  const escaped = [...name.segments]
    .map((segment) =>
      CSHARP_KEYWORDS.has(segment) &&
      !(preservePredefinedTypeKeywords && PREDEFINED_TYPE_KEYWORDS.has(segment))
        ? `@${segment}`
        : segment
    )
    .join(".");

  return name.aliasQualifier ? `${name.aliasQualifier}::${escaped}` : escaped;
};

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
