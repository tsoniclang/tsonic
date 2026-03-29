/**
 * Type-parameter substitution, structural shape matching, and structural-to-nominal
 * type resolution — facade re-exports.
 *
 * Implementations live in:
 *   - type-param-substitution.ts
 *   - structural-shape-matching.ts
 */

export {
  containsTypeParameter,
  substituteTypeArgs,
} from "./type-param-substitution.js";

export {
  isCompilerGeneratedStructuralReferenceType,
  resolveIteratorResultReferenceType,
  resolveStructuralReferenceType,
  normalizeStructuralEmissionType,
} from "./structural-shape-matching.js";
