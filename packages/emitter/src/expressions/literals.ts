/**
 * Literal expression emitters
 */

import { IrExpression, IrType } from "@tsonic/frontend";
import { EmitterContext, CSharpFragment } from "../types.js";
import {
  containsTypeParameter,
  isDefinitelyValueType,
} from "../core/type-resolution.js";
import { isIntegerType } from "../core/type-compatibility.js";

/**
 * C# types that require integer values (not double).
 * Used to determine when numeric literals should emit as int vs double.
 */
const INT_REQUIRED_TYPES = new Set([
  "int",
  "Int32",
  "System.Int32",
  "long",
  "Int64",
  "System.Int64",
  "short",
  "Int16",
  "System.Int16",
  "byte",
  "Byte",
  "System.Byte",
  "sbyte",
  "SByte",
  "System.SByte",
  "uint",
  "UInt32",
  "System.UInt32",
  "ulong",
  "UInt64",
  "System.UInt64",
  "ushort",
  "UInt16",
  "System.UInt16",
]);

/**
 * Check if a C# type requires integer values
 */
export const requiresInteger = (clrType: string | undefined): boolean => {
  if (!clrType) return false;
  return INT_REQUIRED_TYPES.has(clrType);
};

/**
 * Emit a literal value (string, number, boolean, null, undefined)
 *
 * @param expr - The literal expression
 * @param context - Emitter context
 * @param expectedType - Optional expected IR type (for null → default conversion in generic contexts)
 * @param expectedClrType - Optional expected C# type (for int-required contexts)
 */
export const emitLiteral = (
  expr: Extract<IrExpression, { kind: "literal" }>,
  context: EmitterContext,
  expectedType?: IrType,
  expectedClrType?: string
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
    return [{ text: "default" }, context];
  }

  if (typeof value === "string") {
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
    // Check if context requires integer (array index, int parameter, etc.)
    // Priority: expectedType (IR) > expectedClrType (string) > context.isArrayIndex > default (double)
    const needsInteger =
      isIntegerType(expectedType) ||
      requiresInteger(expectedClrType) ||
      context.isArrayIndex === true;

    if (needsInteger) {
      // Integer-required context: emit without decimal
      const text = Number.isInteger(value)
        ? String(value)
        : String(Math.floor(value));
      return [{ text }, context];
    }

    // Let C# infer int vs double from the literal value
    // Integer literals (1, 2, 3) → C# infers int
    // Decimal literals (1.0, 3.14) → C# infers double
    return [{ text: String(value) }, context];
  }

  if (typeof value === "boolean") {
    return [{ text: value ? "true" : "false" }, context];
  }

  return [{ text: String(value) }, context];
};

/**
 * Map from NumericKind to C# type names
 */
const NUMERIC_KIND_TO_CLR: Record<string, string> = {
  SByte: "sbyte",
  Byte: "byte",
  Int16: "short",
  UInt16: "ushort",
  Int32: "int",
  UInt32: "uint",
  Int64: "long",
  UInt64: "ulong",
  Single: "float",
  Double: "double",
};

/**
 * Helper to determine expected CLR type from IrType for numeric contexts.
 * Returns the CLR type name if it requires specific numeric handling, undefined otherwise.
 *
 * Checks:
 * - numericIntent on primitive types (from proof system)
 * - Reference types that are known integer types
 */
export const getExpectedClrTypeForNumeric = (
  irType: IrType | undefined
): string | undefined => {
  if (!irType) return undefined;

  if (irType.kind === "primitiveType") {
    // Check for numeric intent from the proof system
    if (irType.name === "number" && irType.numericIntent !== undefined) {
      return NUMERIC_KIND_TO_CLR[irType.numericIntent] ?? undefined;
    }
    // TS number without intent -> C# double (default)
    return undefined;
  }

  if (irType.kind === "referenceType") {
    // Check if it's an int type from .NET interop
    if (requiresInteger(irType.name)) {
      return irType.name;
    }
  }

  return undefined;
};
