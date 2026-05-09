/**
 * Call expression converter - facade
 *
 * Re-exports from:
 * - call-resolution.ts: callable-candidate helpers + getDeclaredReturnType
 * - call-expression.ts: convertCallExpression
 *
 * All call resolution goes through TypeSystem.resolveCall().
 * NO FALLBACKS ALLOWED. If TypeSystem can't resolve, return unknownType.
 */

export { getDeclaredReturnType } from "./call-resolution.js";
export { convertCallExpression } from "./call-expression.js";
