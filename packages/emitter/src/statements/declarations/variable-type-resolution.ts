/**
 * Variable declaration type resolution and local registration helpers
 * — facade re-exports.
 *
 * Implementations live in:
 *   - variable-type-helpers.ts
 *   - variable-local-type.ts
 */

export {
  TYPES_NEEDING_EXPLICIT_DECL,
  canEmitTypeExplicitly,
  isStructuralTypeAssertionInitializer,
  shouldTreatStructuralAssertionAsErased,
  needsExplicitLocalType,
  isExplicitCastLikeAst,
  shouldForceDeclaredInitializerCast,
  isNullishInitializer,
  isNullableValueUnion,
  shouldEmitReadonlyStaticField,
  resolveStaticFieldType,
} from "./variable-type-helpers.js";

export { resolveLocalTypeAst } from "./variable-local-type.js";
