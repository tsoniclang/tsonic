/**
 * Specialization Generator - Generate monomorphized versions of generic declarations
 * Per spec/15-generics.md §5-6 - Monomorphisation
 * Main dispatcher - delegates to specialized modules
 */

// Re-export everything from specialization modules for backward compatibility
export type { SpecializationRequest } from "./specialization/types.js";
export { collectSpecializations } from "./specialization/collection.js";
export { generateSpecializations } from "./specialization/generation.js";
export {
  generateSpecializedFunctionName,
  generateSpecializedClassName,
} from "./specialization/naming.js";
export {
  createSpecializationKey,
  serializeType,
} from "./specialization/helpers.js";
export {
  substituteType,
  substituteStatement,
  substituteExpression,
} from "./specialization/substitution.js";
