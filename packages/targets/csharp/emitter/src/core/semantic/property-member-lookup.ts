/**
 * Property/member lookup through type hierarchies — facade re-exports.
 *
 * Implementations live in:
 *   - property-lookup-resolution.ts
 *   - property-lookup-membership.ts
 */

export {
  getPropertyType,
  resolveLocalTypeInfo,
  resolveLocalTypeInfoWithoutBindings,
  resolveBindingBackedReferenceType,
} from "./property-lookup-resolution.js";

export {
  hasDeterministicPropertyMembership,
  getAllPropertySignatures,
  isTypeOnlyStructuralTarget,
} from "./property-lookup-membership.js";
