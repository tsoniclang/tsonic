/**
 * Literal type emission
 */

import { IrType } from "@tsonic/frontend";
import { EmitterContext } from "../types.js";
import type { CSharpTypeAst } from "../core/format/backend-ast/types.js";

/**
 * Emit literal types as CSharpTypeAst (predefinedType nodes)
 *
 * Literal types emit as their base primitive type:
 * - string literal → predefinedType("string")
 * - number literal → predefinedType("double")
 * - boolean literal → predefinedType("bool")
 * - other → predefinedType("object")
 */
export const emitLiteralType = (
  type: Extract<IrType, { kind: "literalType" }>,
  context: EmitterContext
): [CSharpTypeAst, EmitterContext] => {
  // For literal types, we emit the base type
  if (typeof type.value === "string") {
    return [{ kind: "predefinedType", keyword: "string" }, context];
  }
  if (typeof type.value === "number") {
    return [{ kind: "predefinedType", keyword: "double" }, context];
  }
  if (typeof type.value === "boolean") {
    return [{ kind: "predefinedType", keyword: "bool" }, context];
  }
  return [{ kind: "predefinedType", keyword: "object" }, context];
};
