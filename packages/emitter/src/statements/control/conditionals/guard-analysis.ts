/**
 * Guard analysis and type narrowing helpers for conditional statements.
 *
 * Facade module that re-exports all public types and functions from the
 * split sub-modules:
 * - guard-types.ts: Guard info types, shared helpers, and utility functions
 * - guard-detectors.ts: Guard detection/resolution functions (tryResolve*)
 */

// Types, shared helpers, and utilities
export type {
  GuardInfo,
  InstanceofGuardInfo,
  DiscriminantEqualityGuardInfo,
  PropertyExistenceGuardInfo,
  PropertyTruthinessGuardInfo,
  RuntimeUnionFrame,
  NullableGuardInfo,
} from "./guard-types.js";

export {
  resolveRuntimeUnionFrame,
  isDefinitelyTerminating,
  isNullOrUndefined,
  tryResolveSimpleNullableGuard,
  tryResolveNullableGuard,
} from "./guard-types.js";

// Guard detection/resolution functions
export {
  tryResolveDiscriminantEqualityGuard,
  tryResolvePropertyExistenceGuard,
  tryResolvePropertyTruthinessGuard,
  tryResolvePredicateGuard,
  tryResolveInstanceofGuard,
} from "./guard-detectors.js";
