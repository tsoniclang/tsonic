/**
 * ProgramContext — Per-compilation context for all semantic state (facade)
 *
 * Sub-modules:
 * - program-context-types.ts   : ProgramContext type, package-resolution helpers
 * - program-context-factory.ts : createProgramContext factory
 */

export type { ProgramContext } from "./program-context-types.js";
export { createProgramContext } from "./program-context-factory.js";
