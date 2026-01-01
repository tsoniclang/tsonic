/**
 * Type converter - TypeScript types to IR types
 * Main dispatcher - re-exports from type-system/internal/type-converter/
 *
 * NOTE: type-converter is now part of type-system internals per Alice's spec.
 * These files are allowed to use HandleRegistry since they're inside type-system.
 */

export {
  convertType,
  convertFunctionType,
  convertObjectType,
  convertBindingName,
  inferLambdaParamTypes,
  type LambdaParamInferenceResult,
} from "./type-system/internal/type-converter/index.js";
