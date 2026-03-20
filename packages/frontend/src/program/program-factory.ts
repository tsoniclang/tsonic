/**
 * Program factory — Facade
 *
 * Re-exports from sub-modules:
 * - program-assembly: createProgram (main entry point)
 * - module-resolution: module resolution helpers (re-exported for downstream consumers)
 */

export { createProgram } from "./program-assembly.js";
