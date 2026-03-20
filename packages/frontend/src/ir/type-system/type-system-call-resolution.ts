/**
 * TypeSystem Call Resolution — Facade
 *
 * Re-exports all call resolution sub-modules and the main `resolveCall` entry point.
 *
 * Sub-modules:
 * - call-resolution-utilities: Pure type helpers, type ID attachment, parameter expansion
 * - call-resolution-signatures: Signature extraction, structural lookup, delegate conversion,
 *   receiver substitution, unified-catalog overload resolution
 * - call-resolution-inference: Generic type argument inference, overload scoring, parameter refinement
 * - call-resolution-resolve: Main resolveCall entry point
 */

// ─── Re-exports from sub-modules ─────────────────────────────────────────

export {
  substitutePolymorphicThis,
  attachParameterTypeIds,
  attachTypeParameterTypeIds,
  attachInterfaceMemberTypeIds,
  attachTypeIds,
  convertTypeNode,
  delegateToFunctionType,
  mapEntriesEqual,
  containsMethodTypeParameter,
  normalizeCatalogTsName,
  expandParameterTypesForInference,
  expandParameterTypesForArguments,
  buildResolvedRestParameter,
  collectExpectedReturnCandidates,
  collectNarrowingCandidates,
  POLYMORPHIC_THIS_MARKER,
} from "./call-resolution-utilities.js";

export {
  getRawSignature,
  lookupStructuralMember,
  computeReceiverSubstitution,
  tryResolveCallFromUnifiedCatalog,
} from "./call-resolution-signatures.js";

export {
  inferMethodTypeArgsFromArguments,
  isArityCompatible,
  scoreSignatureMatch,
  refineParameterTypeForConcreteArgument,
  refineResolvedParameterTypesForArguments,
} from "./call-resolution-inference.js";

export { resolveCall } from "./call-resolution-resolve.js";
