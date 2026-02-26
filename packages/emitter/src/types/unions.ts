/**
 * Union type emission
 */

import { IrType } from "@tsonic/frontend";
import { EmitterContext } from "../types.js";
import { emitTypeAst } from "./emitter.js";
import type { CSharpTypeAst } from "../core/format/backend-ast/types.js";

const getBareTypeParameterName = (type: IrType): string | undefined => {
  if (type.kind === "typeParameterType") return type.name;

  return undefined;
};

/**
 * Emit union types as CSharpTypeAst: nullable (T?), Union<T1, T2>, or object
 */
export const emitUnionType = (
  type: Extract<IrType, { kind: "unionType" }>,
  context: EmitterContext
): [CSharpTypeAst, EmitterContext] => {
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
    const [baseTypeAst, newContext] = emitTypeAst(
      { kind: "primitiveType", name: literalBase },
      context
    );
    return [
      hasNullish
        ? { kind: "nullableType", underlyingType: baseTypeAst }
        : baseTypeAst,
      newContext,
    ];
  }

  if (nonNullTypes.length === 1) {
    // This is a nullable type (T | null | undefined)
    const firstType = nonNullTypes[0];
    if (!firstType) {
      return [
        {
          kind: "nullableType",
          underlyingType: { kind: "predefinedType", keyword: "object" },
        },
        context,
      ];
    }

    // `T | null` where `T` is an unconstrained type parameter cannot be represented as `T?`
    // in C# (it forbids assigning null). Fall back to `object?` and rely on casts at use sites.
    const typeParamName = getBareTypeParameterName(firstType);
    if (typeParamName) {
      const constraintKind =
        context.typeParamConstraints?.get(typeParamName) ?? "unconstrained";
      if (constraintKind === "unconstrained") {
        return [
          {
            kind: "nullableType",
            underlyingType: { kind: "predefinedType", keyword: "object" },
          },
          context,
        ];
      }
    }

    const [baseTypeAst, newContext] = emitTypeAst(firstType, context);
    // Add ? suffix for nullable types (both value types and reference types)
    // This includes string?, int?, double?, etc. per spec/04-type-mappings.md
    return [{ kind: "nullableType", underlyingType: baseTypeAst }, newContext];
  }

  // Multi-type unions (2-8 types) → Union<T1, T2, ...>
  if (type.types.length >= 2 && type.types.length <= 8) {
    const typeArgAsts: CSharpTypeAst[] = [];
    let currentContext = context;

    for (const t of type.types) {
      const [typeAst, newContext] = emitTypeAst(t, currentContext);
      typeArgAsts.push(typeAst);
      currentContext = newContext;
    }

    return [
      {
        kind: "identifierType",
        name: "global::Tsonic.Runtime.Union",
        typeArguments: typeArgAsts,
      },
      currentContext,
    ];
  }

  // Fallback for unions with more than 8 types: use object
  return [{ kind: "predefinedType", keyword: "object" }, context];
};
