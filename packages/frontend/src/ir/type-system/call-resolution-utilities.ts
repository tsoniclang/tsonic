/**
 * Call Resolution Utilities — Facade
 *
 * Re-exports pure type helpers, type ID attachment, and parameter expansion
 * from sub-modules:
 * - call-resolution-type-ids: type ID attachment, type conversion, polymorphic this
 * - call-resolution-parameters: parameter expansion, rest parameter building, candidate collection
 */

export {
  POLYMORPHIC_THIS_MARKER,
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
} from "./call-resolution-type-ids.js";

export {
  expandParameterTypesForInference,
  expandParameterTypesForArguments,
  buildResolvedRestParameter,
  collectExpectedReturnCandidates,
  collectNarrowingCandidates,
} from "./call-resolution-parameters.js";
