/**
 * Program - Public API
 */

export type { CompilerOptions, TsonicProgram } from "./types.js";
export { loadExternalMetadata } from "./metadata.js";
export {
  BindingRegistry,
  loadBindings,
  type TypeBinding,
  type SimpleBindingDescriptor,
} from "./bindings.js";
export { createProgram } from "./creation.js";
export { getSourceFile } from "./queries.js";
export {
  buildModuleDependencyGraph,
  type ModuleDependencyGraphResult,
} from "./dependency-graph.js";
export {
  collectSynthesizedTypeNames,
  runIrProcessingPipeline,
  type IrProcessingPipelineOptions,
  type IrProcessingPipelineResult,
} from "./ir-processing-pipeline.js";
