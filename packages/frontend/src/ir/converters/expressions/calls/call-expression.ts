/**
 * Call expression converter — Facade
 *
 * Re-exports from sub-modules:
 * - call-general: convertCallExpression (main entry point)
 * - call-intrinsics: tryConvertIntrinsicCall (used internally by call-general)
 */

export { convertCallExpression } from "./call-general.js";
