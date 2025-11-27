/**
 * Literal expression emitters
 */

import { IrExpression, IrType } from "@tsonic/frontend";
import { EmitterContext, CSharpFragment } from "../types.js";

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
 * @param expectedClrType - Optional expected C# type (for int-required contexts)
 */
export const emitLiteral = (
  expr: Extract<IrExpression, { kind: "literal" }>,
  context: EmitterContext,
  expectedClrType?: string
): [CSharpFragment, EmitterContext] => {
  const { value } = expr;

  if (value === null) {
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
    // Priority: explicit expectedClrType > context.isArrayIndex > default (double)
    const needsInteger =
      requiresInteger(expectedClrType) || context.isArrayIndex === true;

    if (needsInteger) {
      // Integer-required context: emit without decimal
      const text = Number.isInteger(value)
        ? String(value)
        : String(Math.floor(value));
      return [{ text }, context];
    }

    // TypeScript `number` is always `double` in C#
    // Emit as double: ensure decimal point for integer values
    if (Number.isInteger(value) && !String(value).includes(".")) {
      return [{ text: `${value}.0` }, context];
    }
    return [{ text: String(value) }, context];
  }

  if (typeof value === "boolean") {
    return [{ text: value ? "true" : "false" }, context];
  }

  return [{ text: String(value) }, context];
};

/**
 * Helper to determine expected CLR type from IrType for numeric contexts.
 * Returns the CLR type name if it requires integer, undefined otherwise.
 *
 * TODO: Expand this to handle more cases:
 * - Method parameter types (requires signature lookup)
 * - LINQ methods: Take(int), Skip(int), ElementAt(int)
 * - String methods: Substring(int, int)
 * - Generic type argument inference contexts
 */
export const getExpectedClrTypeForNumeric = (
  irType: IrType | undefined
): string | undefined => {
  if (!irType) return undefined;

  if (irType.kind === "primitiveType") {
    // TS number -> C# double (default)
    // TS doesn't have int type, so this won't trigger
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
