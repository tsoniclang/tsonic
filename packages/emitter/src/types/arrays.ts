/**
 * Array type emission
 */

import { IrType } from "@tsonic/frontend";
import { EmitterContext } from "../types.js";
import { emitType } from "./emitter.js";

/**
 * Emit array types as global::System.Collections.Generic.List<T>
 */
export const emitArrayType = (
  type: Extract<IrType, { kind: "arrayType" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  const [elementType, newContext] = emitType(type.elementType, context);
  return [
    `global::System.Collections.Generic.List<${elementType}>`,
    newContext,
  ];
};
