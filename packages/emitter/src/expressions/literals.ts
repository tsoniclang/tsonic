/**
 * Literal expression emitters
 *
 * EXPLICIT TYPE EMISSION:
 * - All numeric literals get explicit type suffixes based on expected type
 * - long → L, uint → U, ulong → UL, float → f, decimal → m
 * - int, byte, sbyte, short, ushort, double → no suffix needed
 */

import { IrExpression, IrType } from "@tsonic/frontend";
import { EmitterContext, CSharpFragment } from "../types.js";
import {
  containsTypeParameter,
  isDefinitelyValueType,
  stripNullish,
  resolveTypeAlias,
} from "../core/type-resolution.js";
import { emitType } from "../type-emitter.js";

/**
 * Get the C# literal suffix for a numeric type.
 * Returns the suffix to append to numeric literals for explicit typing.
 *
 * @param typeName - The primitive type name (e.g., "long", "float")
 * @returns The suffix string (e.g., "L", "f") or empty string if no suffix needed
 */
const getNumericSuffix = (typeName: string): string => {
  switch (typeName) {
    case "long":
      return "L";
    case "uint":
      return "U";
    case "ulong":
      return "UL";
    case "float":
      return "f";
    case "decimal":
      return "m";
    // int, byte, sbyte, short, ushort, double - no suffix needed
    default:
      return "";
  }
};

const isCharExpectedType = (
  expectedType: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!expectedType) return false;
  const effective = resolveTypeAlias(stripNullish(expectedType), context);
  return (
    (effective.kind === "primitiveType" && effective.name === "char") ||
    (effective.kind === "referenceType" && effective.name === "char")
  );
};

const escapeCSharpChar = (char: string): string => {
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

/**
 * Emit a literal value (string, number, boolean, null, undefined)
 *
 * @param expr - The literal expression
 * @param context - Emitter context
 * @param expectedType - Optional expected IR type (for null → default conversion in generic contexts)
 */
export const emitLiteral = (
  expr: Extract<IrExpression, { kind: "literal" }>,
  context: EmitterContext,
  expectedType?: IrType
): [CSharpFragment, EmitterContext] => {
  const { value } = expr;

  if (value === null) {
    // Emit "default" instead of "null" in two cases:
    // 1. Generic contexts where expected type contains type parameters (CS0403)
    //    Example: Result<T> { value: null } → { value = default }
    // 2. Value type contexts where null is invalid (CS0037)
    //    Example: Result<number, string> { value: null } → { value = default }
    if (expectedType) {
      const typeParams = context.typeParameters ?? new Set<string>();
      if (
        containsTypeParameter(expectedType, typeParams) ||
        isDefinitelyValueType(expectedType)
      ) {
        return [{ text: "default" }, context];
      }
    }
    return [{ text: "null" }, context];
  }

  if (value === undefined) {
    // `undefined` is represented as `default` in C#, but in contexts like:
    //   var x = cond ? 1 : undefined
    // the untyped `default` literal will be inferred as `int` instead of `int?`.
    //
    // When we have an expected type, emit a typed default to preserve optional/nullable intent.
    if (expectedType) {
      try {
        const [typeStr, next] = emitType(expectedType, context);
        return [{ text: `default(${typeStr})` }, next];
      } catch {
        // Fallback: keep emission valid even if the expected type is not directly nameable here.
        return [{ text: "default" }, context];
      }
    }
    return [{ text: "default" }, context];
  }

  if (typeof value === "string") {
    if (isCharExpectedType(expectedType, context)) {
      if (value.length !== 1) {
        throw new Error(
          `ICE: char literal must be length-1, got '${value}' (len=${value.length}). ` +
            `Frontend validation should have rejected this.`
        );
      }
      return [{ text: `'${escapeCSharpChar(value)}'` }, context];
    }

    // Escape the string for C#
    const escaped = value
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r")
      .replace(/\t/g, "\\t");
    return [{ text: `"${escaped}"` }, context];
  }

  if (typeof value === "number") {
    // Get the base literal text from raw lexeme or fallback to String(value)
    const baseLiteral = expr.raw ?? String(value);

    // Add type suffix based on expected type for explicit typing
    // This ensures literals match the declared type (e.g., long[] gets 1L, 2L, 3L)
    if (expectedType) {
      // Resolve aliases and strip nullish to get the effective type
      const effectiveType = resolveTypeAlias(
        stripNullish(expectedType),
        context
      );

      // Extract type name from primitiveType or referenceType
      const typeName =
        effectiveType.kind === "primitiveType"
          ? effectiveType.name
          : effectiveType.kind === "referenceType"
            ? effectiveType.name
            : undefined;

      if (typeName) {
        const suffix = getNumericSuffix(typeName);
        if (suffix) {
          // Validate decimal literals - reject exponent/hex/binary forms
          // C# decimal literals do not support these notations
          if (typeName === "decimal") {
            const hasExponent = /[eE]/.test(baseLiteral);
            const hasHex = /^0[xX]/.test(baseLiteral);
            const hasBinary = /^0[bB]/.test(baseLiteral);
            if (hasExponent || hasHex || hasBinary) {
              // ICE: Frontend should have rejected this with a diagnostic
              throw new Error(
                `ICE: Invalid decimal literal '${baseLiteral}' - ` +
                  `decimal does not support ${hasExponent ? "exponent" : hasHex ? "hex" : "binary"} notation. ` +
                  `Frontend validation should have caught this.`
              );
            }
          }
          return [{ text: baseLiteral + suffix }, context];
        }
      }
    }

    return [{ text: baseLiteral }, context];
  }

  if (typeof value === "boolean") {
    return [{ text: value ? "true" : "false" }, context];
  }

  return [{ text: String(value) }, context];
};
