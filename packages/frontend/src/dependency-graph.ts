/**
 * Module dependency graph builder
 * Main dispatcher - re-exports from graph/ subdirectory
 */

export type { DependencyAnalysis } from "./graph/types.js";
export { buildDependencyGraph } from "./graph/builder.js";
export { checkCircularDependencies } from "./graph/circular.js";
