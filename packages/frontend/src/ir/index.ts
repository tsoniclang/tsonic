/**
 * IR module exports
 *
 * Phase 5 Step 4: Singleton registries removed.
 * Each compilation creates a fresh ProgramContext via buildIr().
 */

export * from "./types.js";
export {
  buildIr,
  buildIrModule,
  isExecutableStatement,
  type IrBuildOptions,
} from "./builder.js";
export { createBinding, type Binding } from "./binding/index.js";
export {
  createProgramContext,
  type ProgramContext,
} from "./program-context.js";
