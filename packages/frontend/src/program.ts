/**
 * TSTS-backed program creation and management
 * Main dispatcher - re-exports from program/ subdirectory
 */

export type { CompilerOptions, TsonicProgram } from "./program/index.js";
export {
  createProgram,
  getProgramDeclarationSourceFiles,
  getProgramRuntimeSourceFiles,
  getProgramSemanticSourceFiles,
  getSourceFile,
} from "./program/index.js";
