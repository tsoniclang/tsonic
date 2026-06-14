/**
 * Dependency graph builder - Public API
 */

export type { DependencyAnalysis } from "./types.js";
export { buildDependencyGraph } from "./builder.js";
export { checkCircularDependencies } from "./circular.js";
