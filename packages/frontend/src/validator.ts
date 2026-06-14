/**
 * ESM and TypeScript validation rules
 * Main dispatcher - re-exports from validation/ subdirectory
 */

export {
  validateProgram,
  validateSourceFile,
  validateImports,
  validateImportModule,
  validateExports,
  validateUnsupportedFeatures,
  validateGenerics,
  getNodeLocation,
} from "./validation/index.js";
