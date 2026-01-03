/**
 * Type converter - Public API
 *
 * NOTE: convertBindingName was moved to ir/syntax/binding-patterns.ts
 * per Alice's spec (it's syntax→IR conversion, not type logic).
 *
 * Phase 5 Step 4: Added convertCapturedTypeNode for cast encapsulation.
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
