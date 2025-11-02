/**
 * Type Emitter - IR types to C# types
 * Main dispatcher - re-exports from types/ subdirectory
 */

export {
  emitType,
  emitTypeParameters,
  emitParameterType,
  emitPrimitiveType,
  emitReferenceType,
  emitArrayType,
  emitFunctionType,
  emitObjectType,
  emitUnionType,
  emitIntersectionType,
  emitLiteralType,
} from "./types/index.js";
