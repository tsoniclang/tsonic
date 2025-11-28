/**
 * Formatting helper functions
 */

import { EmitterContext } from "./core.js";

/**
 * Get indentation string for current level
 */
export const getIndent = (context: EmitterContext): string => {
  const spaces = context.options.indent ?? 4;
  return " ".repeat(spaces * context.indentLevel);
};
