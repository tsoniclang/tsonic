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

/**
 * Format a list of using statements
 */
export const formatUsings = (usings: ReadonlySet<string>): string => {
  const sorted = Array.from(usings).sort((a, b) => {
    // Tsonic.Runtime ALWAYS FIRST (per spec/06-code-generation.md)
    const aIsTsonicRuntime =
      a === "Tsonic.Runtime" || a.startsWith("static Tsonic.Runtime");
    const bIsTsonicRuntime =
      b === "Tsonic.Runtime" || b.startsWith("static Tsonic.Runtime");
    if (aIsTsonicRuntime && !bIsTsonicRuntime) return -1;
    if (!aIsTsonicRuntime && bIsTsonicRuntime) return 1;

    // System namespaces second
    const aIsSystem = a.startsWith("System");
    const bIsSystem = b.startsWith("System");
    if (aIsSystem && !bIsSystem) return -1;
    if (!aIsSystem && bIsSystem) return 1;

    // Microsoft namespaces third
    const aIsMicrosoft = a.startsWith("Microsoft");
    const bIsMicrosoft = b.startsWith("Microsoft");
    if (aIsMicrosoft && !bIsMicrosoft) return -1;
    if (!aIsMicrosoft && bIsMicrosoft) return 1;

    // Alphabetical within groups
    return a.localeCompare(b);
  });

  return sorted.map((u) => `using ${u};`).join("\n");
};
