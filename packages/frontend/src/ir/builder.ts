/**
 * IR Builder - Main module for converting TypeScript AST to IR
 * Main dispatcher - re-exports from builder/ subdirectory
 */

export type { IrBuildOptions } from "./builder/types.js";
export { buildIrModule, buildIr } from "./builder/orchestrator.js";
export { extractImports, extractImportSpecifiers } from "./builder/imports.js";
export { extractExports } from "./builder/exports.js";
export {
  extractStatements,
  isExecutableStatement,
} from "./builder/statements.js";
export { hasExportModifier, hasDefaultModifier } from "./builder/helpers.js";
