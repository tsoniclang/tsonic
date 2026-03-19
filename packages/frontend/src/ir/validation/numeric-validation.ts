/**
 * Numeric Validation — Facade
 *
 * Re-exports from sub-modules:
 * - numeric-expression-validation: emitCoercionError, validateExpression,
 *     scanExpressionForCalls (internal helpers)
 * - numeric-statement-processing: NumericCoercionResult, processStatement,
 *     processStatementWithReturnType, runNumericCoercionPass
 */

export type { NumericCoercionResult } from "./numeric-statement-processing.js";
export { runNumericCoercionPass } from "./numeric-statement-processing.js";

export {
  emitCoercionError,
  validateExpression,
  scanExpressionForCalls,
} from "./numeric-expression-validation.js";
