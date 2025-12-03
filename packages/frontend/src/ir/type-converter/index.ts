/**
 * Type converter - Public API
 */

export {
  convertType,
  convertFunctionType,
  convertObjectType,
} from "./converter.js";
export { convertBindingName } from "./patterns.js";
export {
  inferType,
  convertTsTypeToIr,
  inferLambdaParamTypes,
  type LambdaParamInferenceResult,
} from "./inference.js";
