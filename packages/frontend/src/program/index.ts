/**
 * Program - Public API
 */

export type { CompilerOptions, TsonicProgram } from "./types.js";
export { defaultTsConfig } from "./config.js";
export { loadDotnetMetadata } from "./metadata.js";
export {
  collectTsDiagnostics,
  convertTsDiagnostic,
  getSourceLocation,
} from "./diagnostics.js";
export { createProgram } from "./creation.js";
export { getSourceFile } from "./queries.js";
