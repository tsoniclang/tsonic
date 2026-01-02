/**
 * Type converter - Public API
 *
 * NOTE: convertBindingName was moved to ir/syntax/binding-patterns.ts
 * per Alice's spec (it's syntax→IR conversion, not type logic).
 */

export {
  convertType,
  convertFunctionType,
  convertObjectType,
} from "./converter.js";
export {
  inferLambdaParamTypes,
  type LambdaParamInferenceResult,
} from "./inference.js";
