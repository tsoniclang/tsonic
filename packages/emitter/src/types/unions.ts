/**
 * Union type emission
 */

import { IrType, isAwaitableIrType, stableIrTypeKey } from "@tsonic/frontend";
import { EmitterContext } from "../types.js";
import { emitTypeAst } from "./emitter.js";
import type { CSharpTypeAst } from "../core/format/backend-ast/types.js";
import {
  identifierType,
  nullableType,
} from "../core/format/backend-ast/builders.js";
import {
  getIdentifierTypeName,
  stableTypeKeyFromAst,
} from "../core/format/backend-ast/utils.js";
import { splitRuntimeNullishUnionMembers } from "../core/semantic/type-resolution.js";
import { buildRuntimeUnionLayout } from "../core/semantic/runtime-unions.js";
import { resolveStructuralReferenceType } from "../core/semantic/structural-shape-matching.js";

const getBareTypeParameterName = (type: IrType): string | undefined => {
  if (type.kind === "typeParameterType") return type.name;

  return undefined;
};

const stripNullableAst = (typeAst: CSharpTypeAst): CSharpTypeAst =>
  typeAst.kind === "nullableType"
    ? stripNullableAst(typeAst.underlyingType)
    : typeAst;

const isObjectLikeTypeAst = (typeAst: CSharpTypeAst): boolean => {
  const concrete = stripNullableAst(typeAst);
  if (concrete.kind === "predefinedType") {
    return concrete.keyword === "object";
  }

  const name = getIdentifierTypeName(concrete);
  return (
    name === "object" ||
    name === "System.Object" ||
    name === "global::System.Object"
  );
};

const isRuntimeUnionTypeAst = (typeAst: CSharpTypeAst): boolean => {
  const concrete = stripNullableAst(typeAst);
  const name = getIdentifierTypeName(concrete);
  return (
    name === "global::Tsonic.Runtime.Union" ||
    name === "Tsonic.Runtime.Union" ||
    name === "Union"
  );
};

const flattenRuntimeUnionTypeAsts = (
  types: readonly CSharpTypeAst[]
): readonly CSharpTypeAst[] => {
  const flattened: CSharpTypeAst[] = [];

  const pushFlattened = (typeAst: CSharpTypeAst): void => {
    const concrete = stripNullableAst(typeAst);
    if (
      isRuntimeUnionTypeAst(concrete) &&
      (concrete.kind === "identifierType" ||
        concrete.kind === "qualifiedIdentifierType") &&
      concrete.typeArguments &&
      concrete.typeArguments.length > 0
    ) {
      for (const member of concrete.typeArguments) {
        pushFlattened(member);
      }
      return;
    }

    flattened.push(typeAst);
  };

  for (const typeAst of types) {
    pushFlattened(typeAst);
  }

  return flattened;
};

const dedupeTypeAsts = (
  types: readonly CSharpTypeAst[]
): readonly CSharpTypeAst[] => {
  const deduped = new Map<string, CSharpTypeAst>();
  for (const typeAst of flattenRuntimeUnionTypeAsts(types)) {
    deduped.set(stableTypeKeyFromAst(typeAst), typeAst);
  }
  return Array.from(deduped.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, typeAst]) => typeAst);
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

  // Check if it's a nullable/runtime-absence union (T | null | undefined | void)
  const runtimeNullishSplit = splitRuntimeNullishUnionMembers(type);
  const nonNullTypes = runtimeNullishSplit?.nonNullishMembers ?? type.types;
  const hasNullish = runtimeNullishSplit?.hasRuntimeNullish ?? false;

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
    return [hasNullish ? nullableType(baseTypeAst) : baseTypeAst, newContext];
  }

  const rawUniqueTypeCount = new Set(
    nonNullTypes.map((member) => stableIrTypeKey(member))
  ).size;

  if (rawUniqueTypeCount > 8) {
    return [
      hasNullish
        ? nullableType({ kind: "predefinedType", keyword: "object" })
        : { kind: "predefinedType", keyword: "object" },
      context,
    ];
  }

  const uniqueNonNullTypeAsts: CSharpTypeAst[] = [];
  let currentContext = context;

  for (const member of nonNullTypes) {
    const emittedMember =
      resolveStructuralReferenceType(member, currentContext) ?? member;
    const [typeAst, nextContext] = emitTypeAst(emittedMember, currentContext);
    currentContext = nextContext;
    uniqueNonNullTypeAsts.push(typeAst);
  }
  const dedupedNonNullTypeAsts = dedupeTypeAsts(uniqueNonNullTypeAsts);
  const hasAwaitableMember = nonNullTypes.some((member) =>
    isAwaitableIrType(member)
  );

  if (
    dedupedNonNullTypeAsts.length > 1 &&
    dedupedNonNullTypeAsts.some(isObjectLikeTypeAst) &&
    !hasAwaitableMember
  ) {
    const objectAst: CSharpTypeAst = {
      kind: "predefinedType",
      keyword: "object",
    };
    return [hasNullish ? nullableType(objectAst) : objectAst, currentContext];
  }

  if (dedupedNonNullTypeAsts.length === 1) {
    // This is a nullable type (T | null | undefined)
    const firstType = nonNullTypes[0];
    const firstTypeAst = dedupedNonNullTypeAsts[0];

    if (!firstType || !firstTypeAst) {
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
          nullableType({ kind: "predefinedType", keyword: "object" }),
          currentContext,
        ];
      }
    }

    if (!hasNullish) {
      return [firstTypeAst, currentContext];
    }

    return [nullableType(firstTypeAst), currentContext];
  }

  // Multi-type unions (2-8 types) → Union<T1, T2, ...> (nullable if runtime-nullish)
  const [runtimeLayout, runtimeLayoutContext] = buildRuntimeUnionLayout(
    type,
    context,
    emitTypeAst
  );
  const dedupedTypeAsts = runtimeLayout?.memberTypeAsts;

  if (
    dedupedTypeAsts &&
    dedupedTypeAsts.some(isObjectLikeTypeAst) &&
    !hasAwaitableMember
  ) {
    const objectAst: CSharpTypeAst = {
      kind: "predefinedType",
      keyword: "object",
    };
    return [
      hasNullish ? nullableType(objectAst) : objectAst,
      runtimeLayoutContext,
    ];
  }

  if (
    dedupedTypeAsts &&
    dedupedTypeAsts.length >= 2 &&
    dedupedTypeAsts.length <= 8
  ) {
    const unionAst = identifierType(
      "global::Tsonic.Runtime.Union",
      dedupedTypeAsts
    );
    return [
      hasNullish ? nullableType(unionAst) : unionAst,
      runtimeLayoutContext,
    ];
  }

  // Fallback for unions with more than 8 types: use object
  return [
    hasNullish
      ? nullableType({ kind: "predefinedType", keyword: "object" })
      : { kind: "predefinedType", keyword: "object" },
    context,
  ];
};
