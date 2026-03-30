/**
 * Member access resolution helpers — facade re-exports.
 *
 * Implementations live in:
 *   - access-resolution-types.ts
 *   - access-resolution-receivers.ts
 */

export {
  hasInt32Proof,
  type MemberAccessUsage,
  stripClrGenericArity,
  createStringLiteralExpression,
  isObjectTypeAst,
  isPlainObjectIrType,
  hasSourceDeclaredMember,
  hasPropertyFromBindingsRegistry,
  emitMemberName,
  isStaticTypeReference,
} from "./access-resolution-types.js";

export {
  eraseOutOfScopeArrayWrapperTypeParameters,
  emitArrayWrapperElementTypeAst,
  emitStorageCompatibleArrayWrapperElementTypeAst,
  maybeReifyErasedArrayElement,
  maybeReifyStorageErasedMemberRead,
  tryEmitStorageCompatibleNarrowedMemberRead,
  resolveEffectiveReceiverType,
  resolveEmittedReceiverTypeAst,
  tryEmitBroadArrayAssertionReceiverStorageAst,
} from "./access-resolution-receivers.js";
