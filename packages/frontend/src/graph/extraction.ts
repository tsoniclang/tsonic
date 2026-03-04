/**
 * Module information extraction from TypeScript source files
 * Main dispatcher - re-exports from extraction/ subdirectory
 */

export {
  extractModuleInfo,
  extractImport,
  extractExport,
} from "./extraction/index.js";
