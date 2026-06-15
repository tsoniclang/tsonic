/**
 * Program - Public API
 */

export type { CompilerOptions, TsonicProgram } from "./types.js";
export { createProgram } from "./creation.js";
export {
  getProgramDeclarationSourceFiles,
  getProgramRuntimeSourceFiles,
  getProgramSemanticSourceFiles,
  getSourceFile,
} from "./queries.js";
