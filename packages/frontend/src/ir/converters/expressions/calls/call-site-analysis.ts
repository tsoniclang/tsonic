/**
 * Call-site analysis helpers — Facade
 *
 * Re-exports from sub-modules:
 * - call-site-analysis-unification: CallSiteArgModifier, unifyTypeTemplate,
 *     deriveSubstitutionsFromExpectedReturn, substituteTypeParameters
 * - call-site-analysis-argument-passing: unwrapCallSiteArgumentModifier,
 *     applyCallSiteArgumentModifiers, extractArgumentPassing,
 *     extractArgumentPassingFromParameterModifiers, extractArgumentPassingFromBinding
 */

export type { CallSiteArgModifier } from "./call-site-analysis-unification.js";
export {
  unifyTypeTemplate,
  deriveSubstitutionsFromExpectedReturn,
  substituteTypeParameters,
} from "./call-site-analysis-unification.js";

export {
  unwrapCallSiteArgumentModifier,
  applyCallSiteArgumentModifiers,
  extractArgumentPassing,
  extractArgumentPassingFromParameterModifiers,
  extractArgumentPassingFromBinding,
  extractArgumentPassingFromClrMemberOverloads,
} from "./call-site-analysis-argument-passing.js";
