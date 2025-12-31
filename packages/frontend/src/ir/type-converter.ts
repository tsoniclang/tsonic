/**
 * Type converter - TypeScript types to IR types
 * Main dispatcher - re-exports from type-converter/ subdirectory
 */

export {
  convertType,
  convertFunctionType,
  convertObjectType,
  convertBindingName,
  inferLambdaParamTypes,
  type LambdaParamInferenceResult,
} from "./type-converter/index.js";
