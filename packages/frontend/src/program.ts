/**
 * TypeScript program creation and management
 * Main dispatcher - re-exports from program/ subdirectory
 */

export type { CompilerOptions, TsonicProgram } from "./program/index.js";
export type { ModuleDependencyGraphResult } from "./program/dependency-graph.js";
export type { TypeBinding } from "./program/index.js";
export {
  createProgram,
  getSourceFile,
  BindingRegistry,
  buildModuleDependencyGraph,
} from "./program/index.js";
