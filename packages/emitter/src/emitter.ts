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

  for (const module of modules) {
    const outputPath = module.filePath.replace(/\.ts$/, ".cs");
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

// Re-export emitModule for backward compatibility
export { emitModule } from "./core/module-emitter.js";
