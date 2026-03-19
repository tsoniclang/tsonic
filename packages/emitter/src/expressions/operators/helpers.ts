/**
 * Shared type-checking helpers for operator emitters
 */

import { IrExpression, IrType } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import { resolveEffectiveExpressionType } from "../../core/semantic/narrowed-expression-types.js";
import {
  resolveTypeAlias,
  stripNullish,
} from "../../core/semantic/type-resolution.js";
import { unwrapTransparentExpression } from "../../core/semantic/transparent-expressions.js";

/**
 * Check if an expression has proven Int32 type from the numeric proof pass.
 * Mirrors the same check in access.ts for consistency.
 */
export const hasInt32Proof = (expr: IrExpression): boolean => {
  if (
    expr.inferredType?.kind === "primitiveType" &&
    expr.inferredType.name === "int"
  ) {
    return true;
  }
  if (
    expr.inferredType?.kind === "referenceType" &&
    expr.inferredType.name === "int"
  ) {
    return true;
  }
  return false;
};

/**
 * Get operator precedence for proper parenthesization
 */
export const getPrecedence = (operator: string): number => {
  const precedences: Record<string, number> = {
    "||": 5,
    // C# precedence: `??` binds less tightly than `||` / `&&` but more tightly than `?:`.
    "??": 4,
    "&&": 6,
    "|": 7,
    "^": 8,
    "&": 9,
    "==": 10,
    "!=": 10,
    "===": 10,
    "!==": 10,
    "<": 11,
    ">": 11,
    "<=": 11,
    ">=": 11,
    instanceof: 11,
    in: 11,
    "<<": 12,
    ">>": 12,
    ">>>": 12,
    "+": 13,
    "-": 13,
    "*": 14,
    "/": 14,
    "%": 14,
    "**": 15,
  };

  return precedences[operator] ?? 16;
};

/**
 * Check if an expression has char type (either from string indexer or a variable typed as char).
 * In C#, string[int] returns char, not string like in TypeScript.
 * The IR now correctly sets inferredType to char for string indexer access.
 */
export const isCharTyped = (expr: IrExpression): boolean => {
  return (
    (expr.inferredType?.kind === "primitiveType" &&
      expr.inferredType.name === "char") ||
    (expr.inferredType?.kind === "referenceType" &&
      expr.inferredType.name === "char")
  );
};

export const isCharType = (type: IrType | undefined): boolean => {
  if (!type) return false;
  const stripped = stripNullish(type);
  return (
    (stripped.kind === "primitiveType" && stripped.name === "char") ||
    (stripped.kind === "referenceType" && stripped.name === "char")
  );
};

export const stripNullishFromType = (
  type: IrType | undefined
): IrType | undefined => {
  if (!type) return undefined;
  if (type.kind !== "unionType") return type;
  const nonNullish = type.types.filter(
    (t) =>
      !(
        t.kind === "primitiveType" &&
        (t.name === "null" || t.name === "undefined")
      )
  );
  if (nonNullish.length === 1) {
    const only = nonNullish[0];
    return only ? stripNullishFromType(only) : undefined;
  }
  return type;
};

export const isStringTyped = (expr: IrExpression): boolean => {
  const type = stripNullishFromType(expr.inferredType);
  if (!type) return false;
  if (type.kind === "primitiveType") return type.name === "string";
  if (type.kind === "referenceType") return type.name === "string";
  if (type.kind === "intersectionType") {
    return type.types.some(
      (part) =>
        (part.kind === "primitiveType" && part.name === "string") ||
        (part.kind === "referenceType" && part.name === "string")
    );
  }
  return false;
};

/**
 * Check if an expression is a single-character string literal.
 * Returns the character if so, undefined otherwise.
 */
export const getSingleCharLiteral = (
  expr: IrExpression
): string | undefined => {
  if (expr.kind !== "literal") return undefined;
  if (typeof expr.value !== "string") return undefined;
  if (expr.value.length !== 1) return undefined;
  return expr.value;
};

/**
 * Escape a character for use in a C# char literal.
 * Handles special characters like quotes, backslash, newline, etc.
 */
export const escapeCharLiteral = (char: string): string => {
  switch (char) {
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
      return char;
  }
};

export const isNullishLiteral = (e: IrExpression): boolean =>
  (e.kind === "literal" && (e.value === undefined || e.value === null)) ||
  (e.kind === "identifier" && (e.name === "undefined" || e.name === "null"));

type DictionaryComputedAccessExpression = Extract<
  IrExpression,
  { kind: "memberAccess" }
> & {
  readonly isComputed: true;
  readonly property: IrExpression;
};

export const getDictionaryComputedAccess = (
  expr: IrExpression,
  context: EmitterContext
): DictionaryComputedAccessExpression | undefined => {
  const target = unwrapTransparentExpression(expr);
  if (
    target.kind !== "memberAccess" ||
    !target.isComputed ||
    typeof target.property === "string"
  ) {
    return undefined;
  }

  if (target.accessKind === "dictionary") {
    return target as DictionaryComputedAccessExpression;
  }

  const effectiveObjectType =
    resolveEffectiveExpressionType(target.object, context) ??
    target.object.inferredType;
  if (!effectiveObjectType) {
    return undefined;
  }

  return resolveTypeAlias(stripNullish(effectiveObjectType), context).kind ===
    "dictionaryType"
    ? (target as DictionaryComputedAccessExpression)
    : undefined;
};

/**
 * Check if an IR type is boolean
 */
export const isBooleanType = (type: IrExpression["inferredType"]): boolean => {
  if (!type) return false;
  return type.kind === "primitiveType" && type.name === "boolean";
};
