/**
 * IR Builder - Public API
 */

export type { IrBuildOptions } from "./types.js";
export { buildIrModule, buildIr } from "./orchestrator.js";
export { extractImports, extractImportSpecifiers } from "./imports.js";
export { extractExports } from "./exports.js";
export { extractStatements, isExecutableStatement } from "./statements.js";
export { hasExportModifier, hasDefaultModifier } from "./helpers.js";
