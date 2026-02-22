import { IrExpression } from "@tsonic/frontend";

/**
 * Parenthesization helpers for C# precedence correctness.
 *
 * C# precedence differs from TS in a few critical places:
 * - Cast expressions like `(T)x` bind *less* tightly than postfix operators like `.`, `[]`, `()`.
 *   So `(${T})x.Member` parses as `(${T})(x.Member)` unless wrapped: `((T)x).Member`.
 * - The `as` operator also requires parentheses when used as a postfix receiver: `(x as T).Member`.
 * - The `?:` conditional operator must be parenthesized before postfix: `(cond ? a : b).Member`.
 *
 * Additionally, conditional access chains (`?.`, `?[`) must NOT be wrapped when continuing a chain,
 * otherwise null-propagation semantics change:
 *   `x?.Y.Z` is not equivalent to `(x?.Y).Z`.
 */

const hasConditionalAccessChain = (text: string): boolean =>
  text.includes("?.") || text.includes("?[");

const needsParensForPostfixByKind = (kind: IrExpression["kind"]): boolean => {
  // These IR kinds emit C# primary/postfix expressions that can be directly followed by
  // `.member`, `[index]`, or `(args)` without changing parse/semantics.
  switch (kind) {
    case "identifier":
    case "memberAccess":
    case "call":
    case "new":
    case "asinterface":
    case "defaultof":
    case "this":
    case "literal":
    case "array":
    case "object":
    case "templateLiteral":
      return false;
    default:
      return true;
  }
};

const needsParensForPostfixByText = (text: string): boolean => {
  const trimmed = text.trim();

  // Cast-like forms frequently start with '(' (e.g. `(int)expr`) and must be wrapped
  // when used as a postfix receiver/callee.
  if (trimmed.startsWith("(")) return true;

  // `as` has low precedence and must be wrapped before postfix operators.
  if (trimmed.includes(" as ")) return true;

  return false;
};

export const formatPostfixExpressionText = (
  expr: IrExpression,
  text: string
): string => {
  // Never wrap conditional access chains when continuing a postfix chain, otherwise
  // we change null-propagation semantics.
  if (hasConditionalAccessChain(text)) return text;

  if (
    needsParensForPostfixByKind(expr.kind) ||
    needsParensForPostfixByText(text)
  ) {
    return `(${text})`;
  }

  return text;
};

const needsParensForCastOperandByKind = (
  kind: IrExpression["kind"]
): boolean => {
  // Cast operands must be a C# unary-expression; wrap composite expressions.
  switch (kind) {
    case "identifier":
    case "memberAccess":
    case "call":
    case "new":
    case "this":
    case "literal":
    case "array":
    case "object":
    case "templateLiteral":
    case "unary":
    case "update":
    case "await":
    case "numericNarrowing":
    case "typeAssertion":
    case "trycast":
    case "stackalloc":
    case "defaultof":
      return false;
    default:
      return true;
  }
};

export const formatCastOperandText = (
  expr: IrExpression,
  text: string
): string => {
  if (needsParensForCastOperandByKind(expr.kind)) return `(${text})`;
  return text;
};
