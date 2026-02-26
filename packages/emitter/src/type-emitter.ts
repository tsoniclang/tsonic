/**
 * Type Emitter - IR types to C# types
 * Main dispatcher - re-exports from types/ subdirectory
 */

export {
  emitTypeAst,
  emitTypeParametersAst,
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
