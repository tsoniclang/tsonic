/**
 * Class-related helpers (members, constructors, parameters, interface members)
 * Main dispatcher - re-exports from classes/ subdirectory
 */

export {
  emitClassMember,
  emitInterfaceMemberAsProperty,
  extractInlineObjectTypes,
  emitExtractedType,
  type ExtractedType,
  emitParameters,
  emitParametersWithDestructuring,
  type ParameterEmissionResult,
  capitalize,
} from "./classes/index.js";
