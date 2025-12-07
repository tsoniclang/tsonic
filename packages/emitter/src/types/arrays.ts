/**
 * Array type emission
 *
 * In dotnet mode:
 * - origin: "explicit" → emit native CLR array (T[])
 * - origin: undefined → emit List<T>
 *
 * In js mode: always emit List<T> (JS semantics)
 */

import { IrType } from "@tsonic/frontend";
import { EmitterContext } from "../types.js";
import { emitType } from "./emitter.js";

/**
 * Emit array types
 *
 * - Explicit T[] annotation in dotnet mode → native T[]
 * - Otherwise → List<T>
 */
export const emitArrayType = (
  type: Extract<IrType, { kind: "arrayType" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  const [elementType, newContext] = emitType(type.elementType, context);
  const runtime = context.options.runtime ?? "js";

  // In dotnet mode with explicit array annotation, emit native CLR array
  if (runtime === "dotnet" && type.origin === "explicit") {
    return [`${elementType}[]`, newContext];
  }

  // Default: emit List<T> for JS semantics or inferred arrays
  return [
    `global::System.Collections.Generic.List<${elementType}>`,
    newContext,
  ];
};
