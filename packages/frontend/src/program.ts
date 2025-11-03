/**
 * TypeScript program creation and management
 * Main dispatcher - re-exports from program/ subdirectory
 */

export type { CompilerOptions, TsonicProgram } from "./program/index.js";
export {
  createProgram,
  getSourceFile,
  BindingRegistry,
} from "./program/index.js";
