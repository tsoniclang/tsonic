/**
 * TypeScript program creation and management
 * Main dispatcher - re-exports from program/ subdirectory
 */

export type { CompilerOptions, TsonicProgram } from "./program/index.js";
export type { ModuleDependencyGraphResult } from "./program/dependency-graph.js";
export type { TypeBinding, SimpleBindingDescriptor } from "./program/index.js";
export {
  createProgram,
  getSourceFile,
  BindingRegistry,
  loadBindings,
  buildModuleDependencyGraph,
  collectSynthesizedTypeNames,
  runIrProcessingPipeline,
} from "./program/index.js";
