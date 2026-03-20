/**
 * Numeric Proof Walk — Facade
 *
 * Re-exports IR tree traversal and proof attachment from sub-modules:
 * - numeric-proof-statement-walk: NumericProofResult, StatementProcessor, runNumericProofPass
 * - numeric-proof-expression-walk: processExpression
 */

export type { NumericProofResult } from "./numeric-proof-statement-walk.js";
export { runNumericProofPass } from "./numeric-proof-statement-walk.js";
