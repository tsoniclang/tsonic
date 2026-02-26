/**
 * Array type emission
 *
 * All array types emit as native CLR arrays (T[]).
 * List<T> is only used when explicitly requested via new List<T>().
 */

import { IrType } from "@tsonic/frontend";
import { EmitterContext } from "../types.js";
import { emitTypeAst } from "./emitter.js";
import type { CSharpTypeAst } from "../core/format/backend-ast/types.js";

/**
 * Emit array types as CSharpTypeAst (arrayType nodes)
 */
export const emitArrayType = (
  type: Extract<IrType, { kind: "arrayType" }>,
  context: EmitterContext
): [CSharpTypeAst, EmitterContext] => {
  const [elementTypeAst, newContext] = emitTypeAst(type.elementType, context);
  return [
    { kind: "arrayType", elementType: elementTypeAst, rank: 1 },
    newContext,
  ];
};
