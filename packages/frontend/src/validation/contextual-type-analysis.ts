/**
 * Contextual Type Analysis for Static Safety
 *
 * Provides AST-based contextual type detection helpers used by the
 * static safety validator.
 *
 * FACADE: re-exports from synthesis-eligibility and contextual-type-checks.
 */

export type { BasicEligibilityResult } from "./synthesis-eligibility.js";
export { checkBasicSynthesisEligibility } from "./synthesis-eligibility.js";

export {
  lambdaHasExpectedTypeContext,
  arrayLiteralHasContextualType,
  findContainingFunction,
  objectLiteralHasContextualType,
  isAllowedGenericFunctionValueIdentifierUse,
  getReferencedIdentifierSymbol,
} from "./contextual-type-checks.js";
