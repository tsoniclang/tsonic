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
 * Format a list of using statements (BCL/runtime only, not local modules)
 */
export const formatUsings = (usings: ReadonlySet<string>): string => {
  const sorted = Array.from(usings).sort((a, b) => {
    // Tsonic packages first (Runtime, then JSRuntime)
    const getTsonicPriority = (ns: string): number => {
      if (ns === "Tsonic.Runtime" || ns.startsWith("static Tsonic.Runtime"))
        return 1;
      if (ns === "Tsonic.JSRuntime" || ns.startsWith("static Tsonic.JSRuntime"))
        return 2;
      return 3;
    };

    const aPriority = getTsonicPriority(a);
    const bPriority = getTsonicPriority(b);
    if (aPriority !== bPriority) return aPriority - bPriority;

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
