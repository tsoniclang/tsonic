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
  runNumericCoercionPass,
  type NumericCoercionResult,
} from "./numeric-coercion-pass.js";

export {
  runYieldLoweringPass,
  type YieldLoweringResult,
} from "./yield-lowering-pass.js";

export {
  runAttributeCollectionPass,
  type AttributeCollectionResult,
} from "./attribute-collection-pass.js";

export {
  runOverloadCollectionPass,
  type OverloadCollectionResult,
} from "./overload-collection-pass.js";

export {
  runOverloadFamilyConsistencyPass,
  type OverloadFamilyConsistencyResult,
} from "./overload-family-consistency-pass.js";

export {
  runAnonymousTypeLoweringPass,
  type AnonymousTypeLoweringResult,
} from "./anonymous-type-lowering-pass.js";

export {
  runRestTypeSynthesisPass,
  type RestTypeSynthesisResult,
} from "./rest-type-synthesis-pass.js";

export {
  runArrowReturnFinalizationPass,
  type ArrowReturnFinalizationResult,
} from "./arrow-return-finalization-pass.js";

export {
  runCallResolutionRefreshPass,
  type CallResolutionRefreshResult,
} from "./call-resolution-refresh-pass.js";

export {
  runVirtualMarkingPass,
  type VirtualMarkingResult,
} from "./virtual-marking-pass.js";
