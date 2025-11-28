/**
 * Module resolution with ESM rules enforcement
 * Main dispatcher - re-exports from resolver/ subdirectory
 */

export type { ResolvedModule, ResolvedDotNetImport } from "./resolver/index.js";
export {
  resolveImport,
  resolveModulePath,
  getNamespaceFromPath,
  getClassNameFromPath,
  DotNetImportResolver,
  createDotNetImportResolver,
} from "./resolver/index.js";
