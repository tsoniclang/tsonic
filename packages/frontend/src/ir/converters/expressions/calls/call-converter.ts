/**
 * Call expression converter - facade
 *
 * Re-exports from:
 * - call-resolution.ts: call argument expansion + getDeclaredReturnType
 * - call-expression.ts: convertCallExpression
 *
 * Selected signatures come from the source semantic boundary and are finalized
 * through TypeSystem.resolveCall().
 */

export { getDeclaredReturnType } from "./call-resolution.js";
export { convertCallExpression } from "./call-expression.js";
