/**
 * Numeric Proof Analysis - Type inference, guard fact collection, and literal proofs
 *
 * FACADE: re-exports from numeric-proof-guard-facts and numeric-proof-inference.
 */

export type { ProofContext } from "./numeric-proof-guard-facts.js";

export {
  moduleLocation,
  cloneProofContext,
  withInt32ProofsFromTruthyCondition,
} from "./numeric-proof-guard-facts.js";

export {
  getNumericKindFromType,
  inferNumericKind,
  proveLiteral,
} from "./numeric-proof-inference.js";
