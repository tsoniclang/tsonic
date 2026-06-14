/**
 * TSTS-backed program creation and management
 * Main dispatcher - re-exports from program/ subdirectory
 */

export type { CompilerOptions, TsonicProgram } from "./program/index.js";
export type { ModuleDependencyGraphResult } from "./program/dependency-graph.js";
export {
  createProgram,
  getSourceFile,
  buildModuleDependencyGraph,
  runLoweringPipeline,
} from "./program/index.js";
