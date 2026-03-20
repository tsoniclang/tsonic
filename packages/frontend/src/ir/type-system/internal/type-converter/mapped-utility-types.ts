/**
 * Mapped utility type expansion (facade)
 *
 * Sub-modules:
 * - mapped-utility-expansion.ts : Partial, Required, Readonly, Pick, Omit expansion
 * - mapped-utility-record.ts    : Record expansion, assignability helpers
 */

export {
  EXPANDABLE_UTILITY_TYPES,
  isExpandableUtilityType,
  isTypeParameterNode,
  typeNodeContainsTypeParameter,
  expandUtilityType,
} from "./mapped-utility-expansion.js";

export {
  expandRecordType,
  flattenUnionIrType,
  isProvablyAssignable,
} from "./mapped-utility-record.js";
