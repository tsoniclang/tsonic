/**
 * Guard detection and resolution functions for conditional statements
 * — facade re-exports.
 *
 * Implementations live in:
 *   - guard-detectors-discriminant.ts
 *   - guard-detectors-structural.ts
 */

export {
  tryResolveDiscriminantEqualityGuard,
  tryResolvePropertyTruthinessGuard,
} from "./guard-detectors-discriminant.js";

export {
  tryResolvePredicateGuard,
  tryResolveInstanceofGuard,
} from "./guard-detectors-structural.js";
