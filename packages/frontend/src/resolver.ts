/**
 * Module resolution with ESM rules enforcement
 * Main dispatcher - re-exports from resolver/ subdirectory
 */

export type {
  ResolvedModule,
  ResolvedExternalImport,
} from "./resolver/index.js";
export {
  resolveImport,
  resolveModulePath,
  getNamespaceFromPath,
  getClassNameFromPath,
  ExternalBindingsResolver,
  createExternalBindingsResolver,
} from "./resolver/index.js";
