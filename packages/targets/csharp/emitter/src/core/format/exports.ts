/**
 * Export handling
 */

import { IrExport } from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";

/**
 * Emit an export declaration
 */
export const emitExport = (
  exp: IrExport,
  context: EmitterContext
): EmitterContext => {
  switch (exp.kind) {
    case "named":
      // Named exports are handled by marking declarations as public
      return context;

    case "default":
      // Default exports are surfaced through JS bindings and are type-only for C# emission.
      return context;

    case "declaration":
      // Export declarations are already handled in the body
      return context;

    default:
      return context;
  }
};
