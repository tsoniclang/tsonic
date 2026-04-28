/**
 * Numeric Proof Pass - HARD GATE for numeric type narrowings
 *
 * Facade module that re-exports from focused sub-modules:
 * - numeric-proof-analysis.ts: Type inference, guard facts, literal proofs
 * - numeric-proof-proving.ts: Narrowing proof construction
 * - numeric-proof-walk.ts: IR tree traversal and proof attachment
 *
 * CRITICAL: If this pass emits ANY errors, the emitter MUST NOT run.
 * If we cannot prove a narrowing, compilation FAILS.
 *
 * This follows Alice's "Provably-Sound Numeric Types" specification:
 * "If Tsonic cannot prove a numeric narrowing is sound, it must fail compilation."
 */

export {
  runNumericProofPass,
  type NumericProofResult,
} from "./numeric-proof-walk.js";
