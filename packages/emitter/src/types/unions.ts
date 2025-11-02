/**
 * Union type emission
 */

import { IrType } from "@tsonic/frontend";
import { EmitterContext, addUsing } from "../types.js";
import { emitType } from "./emitter.js";

/**
 * Emit union types as nullable (T?), Union<T1, T2>, or object
 */
export const emitUnionType = (
  type: Extract<IrType, { kind: "unionType" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  // C# doesn't have native union types
  // Strategy:
  // 1. Nullable types (T | null | undefined) → T?
  // 2. Two-type unions → Union<T1, T2>
  // 3. Multi-type unions → object (fallback)

  // Check if it's a nullable type (T | null | undefined)
  const nonNullTypes = type.types.filter(
    (t) =>
      !(
        t.kind === "primitiveType" &&
        (t.name === "null" || t.name === "undefined")
      )
  );

  if (nonNullTypes.length === 1) {
    // This is a nullable type (T | null | undefined)
    const firstType = nonNullTypes[0];
    if (!firstType) {
      return ["object?", context];
    }
    const [baseType, newContext] = emitType(firstType, context);
    // Add ? suffix for nullable types (both value types and reference types)
    // This includes string?, int?, double?, etc. per spec/04-type-mappings.md
    return [`${baseType}?`, newContext];
  }

  // Multi-type unions (2-8 types) → Union<T1, T2, ...>
  if (type.types.length >= 2 && type.types.length <= 8) {
    const typeStrings: string[] = [];
    let currentContext = context;

    for (const t of type.types) {
      const [typeStr, newContext] = emitType(t, currentContext);
      typeStrings.push(typeStr);
      currentContext = newContext;
    }

    const finalContext = addUsing(currentContext, "Tsonic.Runtime");
    return [`Union<${typeStrings.join(", ")}>`, finalContext];
  }

  // Fallback for unions with more than 8 types: use object
  return ["object", context];
};
