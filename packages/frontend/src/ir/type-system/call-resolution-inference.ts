/**
 * Call Resolution Inference — Facade
 *
 * Re-exports generic type argument inference and selected-signature parameter
 * refinement from sub-modules:
 * - call-resolution-unification: inferMethodTypeArgsFromArguments
 * - call-resolution-scoring: refineParameterTypeForConcreteArgument,
 *     refineResolvedParameterTypesForArguments
 */

export { inferMethodTypeArgsFromArguments } from "./call-resolution-unification.js";
export {
  refineParameterTypeForConcreteArgument,
  refineResolvedParameterTypesForArguments,
} from "./call-resolution-scoring.js";
