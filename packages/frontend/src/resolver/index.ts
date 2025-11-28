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
export { getNamespaceFromPath } from "./namespace.js";
export { getClassNameFromPath } from "./naming.js";
export {
  DotNetImportResolver,
  createDotNetImportResolver,
  type ResolvedDotNetImport,
} from "./dotnet-import-resolver.js";
