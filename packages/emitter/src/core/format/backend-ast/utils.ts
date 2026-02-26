/**
 * Backend AST utility functions
 *
 * Helpers for extracting information from C# AST nodes without
 * going through the printer.
 */

import type { CSharpExpressionAst, CSharpTypeAst } from "./types.js";

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

/**
 * Convert a C# type AST into deterministic C# type text.
 *
 * This utility is used for non-emission metadata tasks (specialization keys,
 * JSON AOT registry keys, etc.) where a stable textual form is required.
 */
export const renderTypeAst = (type: CSharpTypeAst): string => {
  switch (type.kind) {
    case "predefinedType":
      return type.keyword;
    case "identifierType": {
      const args =
        type.typeArguments && type.typeArguments.length > 0
          ? `<${type.typeArguments.map(renderTypeAst).join(", ")}>`
          : "";
      return `${type.name}${args}`;
    }
    case "nullableType":
      return `${renderTypeAst(type.underlyingType)}?`;
    case "arrayType": {
      const rank =
        type.rank > 1 ? `[${",".repeat(Math.max(0, type.rank - 1))}]` : "[]";
      return `${renderTypeAst(type.elementType)}${rank}`;
    }
    case "pointerType":
      return `${renderTypeAst(type.elementType)}*`;
    case "tupleType":
      return `(${type.elements
        .map((e) =>
          e.name ? `${renderTypeAst(e.type)} ${e.name}` : renderTypeAst(e.type)
        )
        .join(", ")})`;
    case "varType":
      return "var";
    default: {
      const exhaustive: never = type;
      throw new Error(
        `ICE: Unhandled CSharpTypeAst kind '${(exhaustive as CSharpTypeAst).kind}' in renderTypeAst`
      );
    }
  }
};
