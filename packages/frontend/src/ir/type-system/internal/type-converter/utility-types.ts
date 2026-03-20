/**
 * Utility type expansion - facade
 *
 * Re-exports mapped utility types (Partial, Required, Readonly, Pick, Omit, Record)
 * and conditional utility types (NonNullable, Exclude, Extract, ReturnType,
 * Parameters, Awaited, ConstructorParameters, InstanceType).
 */

export {
  EXPANDABLE_UTILITY_TYPES,
  isExpandableUtilityType,
  expandUtilityType,
  expandRecordType,
} from "./mapped-utility-types.js";

export {
  EXPANDABLE_CONDITIONAL_UTILITY_TYPES,
  isExpandableConditionalUtilityType,
  expandConditionalUtilityType,
} from "./conditional-utility-types.js";
