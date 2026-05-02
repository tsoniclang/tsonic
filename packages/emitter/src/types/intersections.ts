/**
 * Intersection type emission
 */

import { IrType } from "@tsonic/frontend";
import { EmitterContext } from "../types.js";
import type { CSharpTypeAst } from "../core/format/backend-ast/types.js";

/**
 * Reject intersection types that reached C# type emission.
 */
export const emitIntersectionType = (
  type: Extract<IrType, { kind: "intersectionType" }>,
  _context: EmitterContext
): [CSharpTypeAst, EmitterContext] => {
  throw new Error(
    `ICE: Intersection type reached emitter after soundness validation: ${JSON.stringify(type)}`
  );
};
