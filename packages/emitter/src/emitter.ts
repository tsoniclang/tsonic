/**
 * Main C# Emitter - Public API
 * Orchestrates code generation from IR
 */

import { IrModule } from "@tsonic/frontend";
import { EmitterOptions } from "./types.js";
import { emitModule } from "./core/module-emitter.js";

/**
 * Emit a complete C# file from an IR module
 */
export const emitCSharpFile = (
  module: IrModule,
  options: Partial<EmitterOptions> = {}
): string => {
  return emitModule(module, options);
};

/**
 * Batch emit multiple IR modules
 */
export const emitCSharpFiles = (
  modules: readonly IrModule[],
  options: Partial<EmitterOptions> = {}
): Map<string, string> => {
  const results = new Map<string, string>();

  // Find common root directory for all modules
  const commonRoot = findCommonRoot(modules.map((m) => m.filePath));

  for (const module of modules) {
    // Create relative path from common root
    const relativePath = module.filePath.startsWith(commonRoot)
      ? module.filePath.slice(commonRoot.length).replace(/^\//, "")
      : module.filePath;
    const outputPath = relativePath.replace(/\.ts$/, ".cs");

    // Mark this module as entry point if it matches the entry point path
    const isEntryPoint = !!(
      options.entryPointPath && module.filePath === options.entryPointPath
    );
    const moduleOptions = {
      ...options,
      isEntryPoint,
    };
    const code = emitModule(module, moduleOptions);
    results.set(outputPath, code);
  }

  return results;
};

/**
 * Find the common root directory for a set of file paths
 */
const findCommonRoot = (paths: readonly string[]): string => {
  if (paths.length === 0) return "";
  if (paths.length === 1) {
    const firstPath = paths[0];
    if (!firstPath) return "";
    const lastSlash = firstPath.lastIndexOf("/");
    return lastSlash >= 0 ? firstPath.slice(0, lastSlash + 1) : "";
  }

  // Split all paths into segments
  const segments = paths.map((p) => p.split("/"));
  const firstSegments = segments[0];
  if (!firstSegments) return "";

  const minLength = Math.min(...segments.map((s) => s.length));

  let commonLength = 0;
  for (let i = 0; i < minLength; i++) {
    const segment = firstSegments[i];
    if (segment && segments.every((s) => s[i] === segment)) {
      commonLength = i + 1;
    } else {
      break;
    }
  }

  return firstSegments.slice(0, commonLength).join("/") + "/";
};

// Re-export emitModule for backward compatibility
export { emitModule } from "./core/module-emitter.js";
