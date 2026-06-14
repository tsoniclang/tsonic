/**
 * Program - Public API
 */

export type { CompilerOptions, TsonicProgram } from "./types.js";
export { createProgram } from "./creation.js";
export { getSourceFile } from "./queries.js";
export {
  buildModuleDependencyGraph,
  type ModuleDependencyGraphResult,
} from "./dependency-graph.js";
export {
  runLoweringPipeline,
  type LoweringPipelineOptions,
  type LoweringPipelineResult,
} from "../lowering/index.js";
