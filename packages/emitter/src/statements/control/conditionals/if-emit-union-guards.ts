/**
 * Union-narrowing guard emission cases for if-statements — facade re-exports.
 *
 * Implementations live in:
 *   - if-emit-predicate-guards.ts
 *   - if-emit-property-discriminant-guards.ts
 */

export {
  tryEmitPredicateGuard,
  tryEmitInGuard,
} from "./if-emit-predicate-guards.js";

export {
  tryEmitPropertyTruthinessGuard,
  tryEmitDiscriminantEqualityGuard,
  tryEmitNegatedPredicateGuard,
} from "./if-emit-property-discriminant-guards.js";
