/**
 * Union type emission
 */

import { IrType } from "@tsonic/frontend";
import { EmitterContext } from "../types.js";
import { emitType } from "./emitter.js";

const getBareTypeParameterName = (
  type: IrType,
  context: EmitterContext
): string | undefined => {
  if (type.kind === "typeParameterType") return type.name;

  // Legacy representation: type parameters sometimes arrive as referenceType nodes.
  if (
    type.kind === "referenceType" &&
    (context.typeParameters?.has(type.name) ?? false) &&
    (!type.typeArguments || type.typeArguments.length === 0)
  ) {
    return type.name;
  }

  return undefined;
};

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

  const hasNullish = nonNullTypes.length !== type.types.length;

  // Literal unions (e.g. "a" | "b" | "c") are just the base primitive at runtime.
  // Emit them as the primitive type (optionally nullable) rather than a runtime Union wrapper.
  //
  // This preserves TS-level narrowing while producing correct, idiomatic C#.
  const literalBase = (() => {
    let base: "string" | "number" | "boolean" | undefined = undefined;

    for (const t of nonNullTypes) {
      if (t.kind !== "literalType") return undefined;
      const v = t.value;
      const next =
        typeof v === "string"
          ? "string"
          : typeof v === "number"
            ? "number"
            : typeof v === "boolean"
              ? "boolean"
              : undefined;
      if (!next) return undefined;
      if (!base) base = next;
      else if (base !== next) return undefined;
    }

    return base;
  })();

  if (literalBase) {
    const [baseType, newContext] = emitType(
      { kind: "primitiveType", name: literalBase },
      context
    );
    return [hasNullish ? `${baseType}?` : baseType, newContext];
  }

  if (nonNullTypes.length === 1) {
    // This is a nullable type (T | null | undefined)
    const firstType = nonNullTypes[0];
    if (!firstType) {
      return ["object?", context];
    }

    // `T | null` where `T` is an unconstrained type parameter cannot be represented as `T?`
    // in C# (it forbids assigning null). Fall back to `object?` and rely on casts at use sites.
    const typeParamName = getBareTypeParameterName(firstType, context);
    if (typeParamName) {
      const constraintKind =
        context.typeParamConstraints?.get(typeParamName) ?? "unconstrained";
      if (constraintKind === "unconstrained") {
        return ["object?", context];
      }
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

    return [
      `global::Tsonic.Runtime.Union<${typeStrings.join(", ")}>`,
      currentContext,
    ];
  }

  // Fallback for unions with more than 8 types: use object
  return ["object", context];
};
