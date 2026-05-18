/**
 * Type-based guard emission cases for if-statements — facade re-exports.
 *
 * Implementations live in:
 *   - if-emit-instanceof-guards.ts
 *   - if-emit-typeof-array-guards.ts
 */

export {
  tryEmitInstanceofGuard,
  tryEmitNegatedInstanceofGuard,
  tryEmitNullableGuard,
} from "./if-emit-instanceof-guards.js";

export {
  tryEmitArrayIsArrayGuard,
  tryEmitTypeofGuard,
} from "./if-emit-typeof-array-guards.js";
