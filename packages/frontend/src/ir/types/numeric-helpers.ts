/**
 * Numeric Helper Functions for Literal Type Inference
 *
 * These functions determine whether a numeric literal is an integer (Int32)
 * or floating-point (Double) based on the raw lexeme.
 *
 * Key rule: The SOURCE TEXT determines the type, not the numeric value.
 * - Integer literals (42, 0xFF, 0b101) → Int32
 * - Floating literals (42.0, 3.14, 1e3) → Double
 */

import { NumericKind, NUMERIC_RANGES } from "./numeric-kind.js";

/**
 * Check if a raw lexeme represents a valid integer (no decimal point, no exponent).
 * This is critical for correctness - we must validate the SOURCE text, not the JS number.
 * Supports numeric separators (underscores) per JS/TS syntax: 1_000_000, 0xFF_FF, etc.
 *
 * Invalid underscore placement (rejected):
 * - Double underscores: 1__2
 * - Leading underscore: _123
 * - Trailing underscore: 123_
 * - Underscore after prefix: 0x_FF, 0b_10, 0o_77
 */
export const isValidIntegerLexeme = (raw: string): boolean => {
  // Must not contain decimal point or exponent
  if (raw.includes(".") || raw.includes("e") || raw.includes("E")) {
    return false;
  }

  // Explicit early rejection of invalid underscore placement
  if (raw.includes("__")) {
    return false; // Double underscore: 1__2
  }
  if (raw.startsWith("_") || raw.startsWith("-_")) {
    return false; // Leading underscore: _123 or -_123
  }
  if (raw.endsWith("_")) {
    return false; // Trailing underscore: 123_
  }
  // Underscore immediately after prefix: 0x_FF, 0b_10, 0o_77
  if (/^-?0[xXoObB]_/.test(raw)) {
    return false;
  }

  // Must be a valid integer pattern (optional sign, digits with optional underscores)
  // Handle hex (0x), octal (0o), binary (0b) prefixes
  return /^-?(?:0[xX][\da-fA-F]+(?:_[\da-fA-F]+)*|0[oO][0-7]+(?:_[0-7]+)*|0[bB][01]+(?:_[01]+)*|\d+(?:_\d+)*)$/.test(
    raw
  );
};

/**
 * Parse a raw lexeme as a BigInt for precise range checking.
 * Returns undefined if parsing fails.
 * Strips numeric separators (underscores) before parsing.
 *
 * INVARIANT: Only call this AFTER isValidIntegerLexeme(raw) returns true.
 */
export const parseBigIntFromRaw = (raw: string): bigint | undefined => {
  try {
    // Step 1: Normalize - strip numeric separators (underscores)
    const normalized = raw.replace(/_/g, "");

    // Handle different bases
    if (normalized.startsWith("0x") || normalized.startsWith("0X")) {
      return BigInt(normalized);
    }
    if (normalized.startsWith("0o") || normalized.startsWith("0O")) {
      return BigInt(normalized);
    }
    if (normalized.startsWith("0b") || normalized.startsWith("0B")) {
      return BigInt(normalized);
    }
    // Handle negative numbers
    if (normalized.startsWith("-")) {
      return -BigInt(normalized.slice(1));
    }
    return BigInt(normalized);
  } catch {
    return undefined;
  }
};

/**
 * Check if a BigInt value fits within the range of a numeric kind.
 */
export const bigIntFitsInKind = (value: bigint, kind: NumericKind): boolean => {
  const range = NUMERIC_RANGES.get(kind);
  if (range === undefined) {
    return false;
  }
  return value >= range.min && value <= range.max;
};

/**
 * Infer the numeric kind from a raw literal lexeme.
 *
 * Rules:
 * - Integer literals (no decimal, no exponent, fits in Int32) → Int32
 * - Everything else (floating point, large integers) → Double
 *
 * This function is used at IR build time to attach numericIntent to literals.
 */
export const inferNumericKindFromRaw = (raw: string): NumericKind => {
  if (isValidIntegerLexeme(raw)) {
    const bigValue = parseBigIntFromRaw(raw);
    if (bigValue !== undefined && bigIntFitsInKind(bigValue, "Int32")) {
      return "Int32";
    }
  }
  return "Double";
};
