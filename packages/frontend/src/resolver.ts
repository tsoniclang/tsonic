/**
 * Module resolution with ESM rules enforcement
 * Main dispatcher - re-exports from resolver/ subdirectory
 */

export type { ResolvedModule, ResolvedClrImport } from "./resolver/index.js";
export {
  resolveImport,
  resolveModulePath,
  getNamespaceFromPath,
  getClassNameFromPath,
  ClrBindingsResolver,
  createClrBindingsResolver,
} from "./resolver/index.js";
