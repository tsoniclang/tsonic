/**
 * Metadata and Bindings Loaders - Public API
 */

export { loadMetadataFile, loadMetadataDirectory } from "./loader.js";

export {
  loadBindingsFile,
  loadBindingsDirectory,
  buildBindingsRegistry,
  lookupTypeBinding,
} from "./bindings-loader.js";

export { loadLibrary, loadLibraries } from "./library-loader.js";
export type { LibraryData } from "./library-loader.js";
