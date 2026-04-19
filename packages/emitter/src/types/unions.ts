/**
 * Union type emission
 */

import { IrType, isAwaitableIrType } from "@tsonic/frontend";
import { EmitterContext } from "../types.js";
import { emitTypeAst } from "./emitter.js";
import type { CSharpTypeAst } from "../core/format/backend-ast/types.js";
import { nullableType } from "../core/format/backend-ast/builders.js";
import { stableTypeKeyFromAst } from "../core/format/backend-ast/utils.js";
import { splitRuntimeNullishUnionMembers } from "../core/semantic/type-resolution.js";
import {
  buildRuntimeUnionLayout,
  buildRuntimeUnionTypeAst,
} from "../core/semantic/runtime-unions.js";
import { shouldUseBroadObjectForUnionStorage } from "../core/semantic/storage-types.js";
import { resolveStructuralReferenceType } from "../core/semantic/structural-shape-matching.js";

const dedupeTypeAsts = (
  types: readonly CSharpTypeAst[]
): readonly CSharpTypeAst[] => {
  const deduped = new Map<string, CSharpTypeAst>();
  for (const typeAst of types) {
    deduped.set(stableTypeKeyFromAst(typeAst), typeAst);
  }
  return Array.from(deduped.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, typeAst]) => typeAst);
};

/**
 * Emit union types as CSharpTypeAst: nullable (T?), compiler-owned union carrier, or object
 */
export const emitUnionType = (
  type: Extract<IrType, { kind: "unionType" }>,
  context: EmitterContext
): [CSharpTypeAst, EmitterContext] => {
  // C# doesn't have native union types
  // Strategy:
  // 1. Nullable types (T | null | undefined) → T?
  // 2. Multi-type unions → compiler-owned runtime carrier
  // 3. Broad/object-like unions → object

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
  const usesBroadObjectStorage = shouldUseBroadObjectForUnionStorage(
    type,
    currentContext
  );

  if (
    dedupedNonNullTypeAsts.length > 1 &&
    usesBroadObjectStorage &&
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

    if (!hasNullish) {
      return [firstTypeAst, currentContext];
    }

    return [nullableType(firstTypeAst), currentContext];
  }

  // Multi-type unions (2+ types) → compiler-owned runtime carrier (nullable if runtime-nullish)
  const [runtimeLayout, runtimeLayoutContext] = buildRuntimeUnionLayout(
    type,
    context,
    emitTypeAst
  );
  const dedupedTypeAsts = runtimeLayout?.memberTypeAsts;

  if (dedupedTypeAsts && usesBroadObjectStorage && !hasAwaitableMember) {
    const objectAst: CSharpTypeAst = {
      kind: "predefinedType",
      keyword: "object",
    };
    return [
      hasNullish ? nullableType(objectAst) : objectAst,
      runtimeLayoutContext,
    ];
  }

  if (dedupedTypeAsts && dedupedTypeAsts.length >= 2) {
    const unionAst = buildRuntimeUnionTypeAst(runtimeLayout);
    return [
      hasNullish ? nullableType(unionAst) : unionAst,
      runtimeLayoutContext,
    ];
  }

  // Fallback for union shapes that cannot be carried precisely: use object
  return [
    hasNullish
      ? nullableType({ kind: "predefinedType", keyword: "object" })
      : { kind: "predefinedType", keyword: "object" },
    context,
  ];
};
