/**
 * Circular dependency detection
 */

import * as path from "node:path";
import { Diagnostic, createDiagnostic } from "../types/diagnostic.js";
import { Result, ok, error } from "../types/result.js";

/**
 * Check for circular dependencies using depth-first search
 */
export const checkCircularDependencies = (
  dependencies: ReadonlyMap<string, readonly string[]>
): Result<void, Diagnostic> => {
  const visited = new Set<string>();
  const stack = new Set<string>();

  const visit = (module: string, path: string[]): string[] | null => {
    if (stack.has(module)) {
      return [...path, module]; // Found cycle
    }

    if (visited.has(module)) {
      return null; // Already checked
    }

    visited.add(module);
    stack.add(module);

    const deps = dependencies.get(module) ?? [];
    for (const dep of deps) {
      const cycle = visit(dep, [...path, module]);
      if (cycle) {
        return cycle;
      }
    }

    stack.delete(module);
    return null;
  };

  for (const [module] of dependencies) {
    const cycle = visit(module, []);
    if (cycle) {
      return error(
        createDiagnostic(
          "TSN1002",
          "error",
          `Circular dependency detected: ${cycle.map((m) => path.basename(m)).join(" → ")}`,
          undefined,
          "Break the circular dependency by refactoring shared code"
        )
      );
    }
  }

  return ok(undefined);
};
