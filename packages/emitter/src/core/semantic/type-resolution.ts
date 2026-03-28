/**
 * Type resolution — facade re-exports.
 *
 * This file preserves the public import surface for the 50+ consumers that
 * import from "./type-resolution.js". The actual implementations live in
 * focused sub-modules:
 *
 * - nullish-value-helpers.ts — nullish stripping, value-type classification,
 *   array-like element extraction, and type-alias resolution
 * - property-member-lookup.ts — property/member lookup through type hierarchies,
 *   binding registries, and type-member indices
 * - structural-resolution.ts — type-parameter substitution, structural shape
 *   matching, and structural-to-nominal type resolution
 * - union-member-matching.ts — union member matching by typeof tags, predicate
 *   targets, and object-literal keys
 */

export {
  stripNullish,
  isRuntimeNullishType,
  isRuntimeNullishMember,
  splitRuntimeNullishUnionMembers,
  isDefinitelyValueType,
  getArrayLikeElementType,
  resolveArrayLikeReceiverType,
  resolveTypeAlias,
} from "./nullish-value-helpers.js";

export {
  getPropertyType,
  resolveLocalTypeInfo,
  hasDeterministicPropertyMembership,
  getAllPropertySignatures,
  isTypeOnlyStructuralTarget,
} from "./property-member-lookup.js";

export {
  containsTypeParameter,
  substituteTypeArgs,
  isCompilerGeneratedStructuralReferenceType,
  resolveStructuralReferenceType,
  normalizeStructuralEmissionType,
} from "./structural-resolution.js";

export {
  matchesTypeofTag,
  narrowTypeByNotTypeofTag,
  narrowTypeByTypeofTag,
  selectObjectLiteralUnionMember,
  selectUnionMemberForObjectLiteral,
  findUnionMemberIndex,
  unionMemberMatchesTarget,
} from "./union-member-matching.js";
