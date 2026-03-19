/**
 * Initializer & Call Return Type Inference (facade)
 *
 * Sub-modules:
 * - inference-initializers-call.ts     : tryInferTypeFromLiteralInitializer, tryInferReturnTypeFromCallExpression
 * - inference-initializers-variable.ts : tryInferTypeFromInitializer
 */

export {
  tryInferTypeFromLiteralInitializer,
  tryInferReturnTypeFromCallExpression,
} from "./inference-initializers-call.js";

export { tryInferTypeFromInitializer } from "./inference-initializers-variable.js";
