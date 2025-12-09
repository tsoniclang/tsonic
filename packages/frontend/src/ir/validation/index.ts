/**
 * IR Validation exports
 */

export {
  validateIrSoundness,
  type SoundnessValidationResult,
} from "./soundness-gate.js";

export {
  runNumericProofPass,
  type NumericProofResult,
} from "./numeric-proof-pass.js";

export {
  runYieldLoweringPass,
  type YieldLoweringResult,
} from "./yield-lowering-pass.js";
