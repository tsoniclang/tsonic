/**
 * Export handling
 */

import { IrExport } from "@tsonic/frontend";
import { EmitterContext, getIndent } from "../../types.js";
import { emitExpression } from "../../expression-emitter.js";

/**
 * Emit an export declaration
 */
export const emitExport = (
  exp: IrExport,
  context: EmitterContext
): [string | null, EmitterContext] => {
  switch (exp.kind) {
    case "named":
      // Named exports are handled by marking declarations as public
      return [null, context];

    case "default": {
      // Default exports need special handling
      // For MVP, we'll emit a comment
      const [exprFrag, newContext] = emitExpression(exp.expression, context);
      const ind = getIndent(context);
      return [`${ind}// Default export: ${exprFrag.text}`, newContext];
    }

    case "declaration":
      // Export declarations are already handled in the body
      return [null, context];

    default:
      return [null, context];
  }
};
