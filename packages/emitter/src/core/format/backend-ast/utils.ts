/**
 * Backend AST utility functions
 *
 * Helpers for extracting information from C# AST nodes without
 * going through the printer.
 */

import type { CSharpExpressionAst } from "./types.js";

/**
 * Extract a dotted name string from a C# expression AST.
 *
 * Handles identifierExpression, memberAccessExpression, and parenthesized
 * wrappers. Used for specialization name generation, int-cast analysis,
 * and diagnostic messages where a human-readable name is needed.
 *
 * Falls back to `<kind>` for unrecognized shapes (should not occur in
 * practice for callee/type-name positions).
 */
export const extractCalleeNameFromAst = (ast: CSharpExpressionAst): string => {
  switch (ast.kind) {
    case "identifierExpression":
      return ast.identifier;
    case "memberAccessExpression":
      return `${extractCalleeNameFromAst(ast.expression)}.${ast.memberName}`;
    case "parenthesizedExpression":
      return extractCalleeNameFromAst(ast.expression);
    default:
      return `<${ast.kind}>`;
  }
};
