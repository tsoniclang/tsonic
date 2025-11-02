/**
 * Module resolution with ESM rules enforcement
 * Main dispatcher - re-exports from resolver/ subdirectory
 */

export type { ResolvedModule } from "./resolver/index.js";
export {
  resolveImport,
  resolveModulePath,
  getNamespaceFromPath,
  getClassNameFromPath,
} from "./resolver/index.js";
