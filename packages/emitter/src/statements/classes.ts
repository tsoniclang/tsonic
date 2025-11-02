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
  capitalize,
} from "./classes/index.js";
