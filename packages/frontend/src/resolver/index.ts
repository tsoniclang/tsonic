/**
 * Module resolver - Public API
 */

export type { ResolvedModule } from "./types.js";
export {
  resolveImport,
  resolveLocalImport,
  resolveDotNetImport,
} from "./import-resolution.js";
export { resolveModulePath } from "./path-resolution.js";
export { getNamespaceFromPath, getClassNameFromPath } from "./naming.js";
