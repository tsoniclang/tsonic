/**
 * Type converter - Public API
 *
 * Syntax binding-pattern conversion lives outside the type converter; this
 * module only exposes type syntax to IR conversion.
 *
 * Captured TypeScript type nodes are converted through convertCapturedTypeNode.
 */

export {
  convertType,
  convertFunctionType,
  convertObjectType,
  convertCapturedTypeNode,
} from "./converter.js";
export {
  inferLambdaParamTypes,
  type LambdaParamInferenceResult,
} from "./inference.js";
