/**
 * Module resolver - Public API
 */

export type { ResolvedModule } from "./types.js";
export {
  resolveImport,
  resolveLocalImport,
  resolveClrImport,
} from "./import-resolution.js";
export { resolveModulePath } from "./path-resolution.js";
export { getNamespaceFromPath } from "./namespace.js";
export { getClassNameFromPath } from "./naming.js";
export {
  ClrBindingsResolver,
  createClrBindingsResolver,
  type ResolvedClrImport,
} from "./clr-bindings-resolver.js";
