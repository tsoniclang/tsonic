/**
 * Call Resolution Inference — Facade
 *
 * Re-exports generic type argument inference, overload scoring, and parameter
 * refinement from sub-modules:
 * - call-resolution-unification: inferMethodTypeArgsFromArguments
 * - call-resolution-scoring: isArityCompatible, scoreSignatureMatch,
 *     refineParameterTypeForConcreteArgument, refineResolvedParameterTypesForArguments
 */

export { inferMethodTypeArgsFromArguments } from "./call-resolution-unification.js";
export {
  isArityCompatible,
  scoreSignatureMatch,
  refineParameterTypeForConcreteArgument,
  refineResolvedParameterTypesForArguments,
} from "./call-resolution-scoring.js";
