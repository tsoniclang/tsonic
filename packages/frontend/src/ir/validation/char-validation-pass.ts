/**
 * Char Validation Pass — Facade
 *
 * Re-exports from sub-modules:
 * - char-validation-types: CharValidationResult, runCharValidationPass,
 *     validation context and helpers
 * - char-validation-expressions: expression and statement validation
 */

export type { CharValidationResult } from "./char-validation-types.js";
export { runCharValidationPass } from "./char-validation-types.js";
