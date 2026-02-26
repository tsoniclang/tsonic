/**
 * Primitive type emission
 *
 * INVARIANT A: "number" always emits as C# "double". No exceptions.
 * INVARIANT B: "int" always emits as C# "int". No exceptions.
 *
 * These are distinct types in the IR, not decorated versions of each other.
 * The numericIntent field on literals is for expression-level classification,
 * NOT for type-level emission decisions.
 */

import { IrType } from "@tsonic/frontend";
import { EmitterContext } from "../types.js";
import type { CSharpTypeAst } from "../core/format/backend-ast/types.js";

const PRIMITIVE_TYPE_MAP: Record<string, string> = {
  number: "double",
  int: "int",
  string: "string",
  boolean: "bool",
  char: "char",
  null: "object",
  undefined: "object",
};

/**
 * Emit primitive types as CSharpTypeAst (predefinedType nodes)
 *
 * For numeric types:
 * - primitiveType(name="number") → predefinedType("double")
 * - primitiveType(name="int") → predefinedType("int")
 */
export const emitPrimitiveType = (
  type: Extract<IrType, { kind: "primitiveType" }>,
  context: EmitterContext
): [CSharpTypeAst, EmitterContext] => {
  const keyword = PRIMITIVE_TYPE_MAP[type.name] ?? "object";
  return [{ kind: "predefinedType", keyword }, context];
};
