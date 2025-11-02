/**
 * ESM and TypeScript validation rules
 * Main dispatcher - re-exports from validation/ subdirectory
 */

export {
  validateProgram,
  validateSourceFile,
  validateImports,
  validateImportDeclaration,
  validateExports,
  validateUnsupportedFeatures,
  validateGenerics,
  getNodeLocation,
} from "./validation/index.js";
