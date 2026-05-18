/**
 * Backend AST Printer – Identifier and Escape Utilities
 *
 * String/char escape helpers, trivia printing, keyword sets,
 * identifier escaping, qualified name escaping, prefix unary
 * separator detection, and numeric literal formatting.
 */

import type {
  CSharpExpressionAst,
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
