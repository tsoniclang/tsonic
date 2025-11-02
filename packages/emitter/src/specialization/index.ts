/**
 * Specialization system barrel exports
 */

// Types
export type { SpecializationRequest } from "./types.js";

// Collection
export { collectSpecializations } from "./collection.js";

// Generation
export { generateSpecializations } from "./generation.js";

// Naming
export {
  generateSpecializedFunctionName,
  generateSpecializedClassName,
} from "./naming.js";

// Helpers
export { createSpecializationKey, serializeType } from "./helpers.js";

// Substitution
export {
  substituteType,
  substituteStatement,
  substituteExpression,
} from "./substitution.js";
