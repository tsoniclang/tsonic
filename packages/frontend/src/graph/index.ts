/**
 * Dependency graph builder - Public API
 */

export type { DependencyAnalysis } from "./types.js";
export { buildDependencyGraph } from "./builder.js";
export {
  extractModuleInfo,
  extractImport,
  extractExport,
} from "./extraction.js";
export { checkCircularDependencies } from "./circular.js";
export {
  isTopLevelCode,
  hasExecutableInitializer,
  hasExportModifier,
} from "./helpers.js";
