/**
 * Class-related helpers - Public API
 */

export { capitalize } from "./helpers.js";
export { emitParameters } from "./parameters.js";
export { emitClassMember } from "./members.js";
export { emitInterfaceMemberAsProperty } from "./properties.js";
export {
  extractInlineObjectTypes,
  emitExtractedType,
  type ExtractedType,
} from "./inline-types.js";
