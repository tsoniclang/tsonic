/**
 * Array type emission
 *
 * All array types emit as native CLR arrays (T[]).
 * List<T> is only used when explicitly requested via new List<T>().
 */

import { IrType, stableIrTypeKey } from "@tsonic/frontend";
import { EmitterContext } from "../types.js";
import { emitTypeAst } from "./emitter.js";
import type { CSharpTypeAst } from "../core/format/backend-ast/types.js";
import {
  getIdentifierTypeName,
  stripNullableTypeAst,
} from "../core/format/backend-ast/utils.js";
import { normalizeStructuralEmissionType } from "../core/semantic/type-resolution.js";

const isRuntimeUnionTypeAst = (typeAst: CSharpTypeAst): boolean => {
  const concrete = stripNullableTypeAst(typeAst);
  const name = getIdentifierTypeName(concrete);
  return (
    name === "global::Tsonic.Runtime.Union" ||
    name === "Tsonic.Runtime.Union" ||
    name === "Union"
  );
};

/**
 * Emit array types as CSharpTypeAst (arrayType nodes)
 */
export const emitArrayType = (
  type: Extract<IrType, { kind: "arrayType" }>,
  context: EmitterContext
): [CSharpTypeAst, EmitterContext] => {
  const currentArrayKey = stableIrTypeKey(type);
  const elementContext = context.activeTypeEmissionKeys?.has(currentArrayKey)
    ? {
        ...context,
        activeTypeEmissionKeys: new Set(
          Array.from(context.activeTypeEmissionKeys).filter(
            (key) => key !== currentArrayKey
          )
        ),
      }
    : context;
  const [elementTypeAst, newContext] = emitTypeAst(
    normalizeStructuralEmissionType(type.elementType, elementContext),
    elementContext
  );
  const normalizedElementTypeAst: CSharpTypeAst = isRuntimeUnionTypeAst(
    elementTypeAst
  )
    ? { kind: "predefinedType", keyword: "object" }
    : elementTypeAst;
  return [
    { kind: "arrayType", elementType: normalizedElementTypeAst, rank: 1 },
    newContext,
  ];
};
