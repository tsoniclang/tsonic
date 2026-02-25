/**
 * Tuple type emission
 *
 * TypeScript tuples are emitted as System.ValueTuple<T1, T2, ...>
 * For tuples with more than 7 elements, .NET requires nesting:
 * ValueTuple<T1..T7, ValueTuple<T8..>> (recursive for 15+, 22+, etc.)
 */

import { IrType } from "@tsonic/frontend";
import { EmitterContext } from "../types.js";
import { emitTypeAst } from "./emitter.js";
import type { CSharpTypeAst } from "../core/format/backend-ast/types.js";

/**
 * Helper to emit a list of tuple element types as CSharpTypeAst, threading context through.
 */
const emitTupleElems = (
  elems: readonly IrType[],
  context: EmitterContext
): [CSharpTypeAst[], EmitterContext] => {
  const out: CSharpTypeAst[] = [];
  let ctx = context;
  for (const t of elems) {
    const [ast, next] = emitTypeAst(t, ctx);
    out.push(ast);
    ctx = next;
  }
  return [out, ctx];
};

/**
 * Emit tuple types as CSharpTypeAst (identifierType nodes for ValueTuple<>)
 *
 * TypeScript: [string, number, boolean]
 * C#: global::System.ValueTuple<string, double, bool>
 *
 * For 8+ elements, uses .NET's nested TRest pattern:
 * TypeScript: [T1, T2, T3, T4, T5, T6, T7, T8]
 * C#: global::System.ValueTuple<T1, T2, T3, T4, T5, T6, T7, global::System.ValueTuple<T8>>
 */
export const emitTupleType = (
  type: Extract<IrType, { kind: "tupleType" }>,
  context: EmitterContext
): [CSharpTypeAst, EmitterContext] => {
  const elems = type.elementTypes;

  // Empty tuple type [] → ValueTuple (non-generic)
  if (elems.length === 0) {
    return [
      { kind: "identifierType", name: "global::System.ValueTuple" },
      context,
    ];
  }

  // 1-7 elements: direct ValueTuple<T1, ..., Tn>
  if (elems.length <= 7) {
    const [typeAsts, ctx] = emitTupleElems(elems, context);
    return [
      {
        kind: "identifierType",
        name: "global::System.ValueTuple",
        typeArguments: typeAsts,
      },
      ctx,
    ];
  }

  // 8+ elements: nest as ValueTuple<T1..T7, ValueTuple<T8..>>
  const first7 = elems.slice(0, 7);
  const rest = elems.slice(7);

  const [first7TypeAsts, ctxAfterFirst7] = emitTupleElems(first7, context);

  // Recursively emit rest as nested tuple (handles 15+, 22+, etc.)
  const [restTypeAst, ctxAfterRest] = emitTupleType(
    { kind: "tupleType", elementTypes: rest },
    ctxAfterFirst7
  );

  return [
    {
      kind: "identifierType",
      name: "global::System.ValueTuple",
      typeArguments: [...first7TypeAsts, restTypeAst],
    },
    ctxAfterRest,
  ];
};
