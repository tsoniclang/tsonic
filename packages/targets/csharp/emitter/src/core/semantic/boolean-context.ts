/**
 * Boolean-context emission (truthiness / ToBoolean) — facade module.
 *
 * Re-exports the public API from the implementation sub-modules:
 * - truthiness-evaluation.ts  — AST helpers, runtime truthiness, isBooleanType
 * - boolean-condition-emission.ts — toBooleanConditionAst, emitBooleanConditionAst
 */

export { isBooleanType } from "./truthiness-evaluation.js";
export {
  type EmitExprAstFn,
  toBooleanConditionAst,
  emitBooleanConditionAst,
} from "./boolean-condition-emission.js";
