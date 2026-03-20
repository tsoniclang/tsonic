/**
 * Boolean-condition emission — facade re-exports.
 *
 * Implementations live in:
 *   - boolean-condition-main.ts
 *   - boolean-condition-union.ts
 */

export {
  type EmitExprAstFn,
  toBooleanConditionAst,
  emitBooleanConditionAst,
} from "./boolean-condition-main.js";
