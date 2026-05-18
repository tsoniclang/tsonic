/**
 * Module resolver - Public API
 */

export type { ResolvedModule } from "./types.js";
export {
  resolveImport,
  resolveLocalImport,
  resolveExternalSurfaceImport,
} from "./import-resolution.js";
export { resolveModulePath } from "./path-resolution.js";
export { getNamespaceFromPath } from "./namespace.js";
export { getClassNameFromPath } from "./naming.js";
export {
  ExternalBindingsResolver,
  createExternalBindingsResolver,
  type ResolvedExternalImport,
} from "./external-bindings-resolver.js";
