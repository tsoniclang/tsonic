/**
 * Intersection type emission
 */

import { IrType } from "@tsonic/frontend";
import { EmitterContext } from "../types.js";
import type { CSharpTypeAst } from "../core/format/backend-ast/types.js";

/**
 * Emit intersection types as CSharpTypeAst (C# doesn't have intersection types)
 */
export const emitIntersectionType = (
  _type: Extract<IrType, { kind: "intersectionType" }>,
  context: EmitterContext
): [CSharpTypeAst, EmitterContext] => {
  // C# doesn't have intersection types
  // For MVP, we'll use object
  // In a more complete implementation, we might generate an interface
  return [{ kind: "predefinedType", keyword: "object" }, context];
};
