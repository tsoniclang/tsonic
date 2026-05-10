/**
 * Type converter - TypeScript types to IR types
 * Main dispatcher - re-exports from type-system/internal/type-converter/
 *
 * Type converter internals are owned by the TypeSystem.
 * These files are allowed to use HandleRegistry since they're inside type-system.
 */

export {
  convertType,
  convertFunctionType,
  convertObjectType,
  convertCapturedTypeNode,
  inferLambdaParamTypes,
  type LambdaParamInferenceResult,
} from "./type-converter/index.js";
