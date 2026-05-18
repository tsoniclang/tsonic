/**
 * Narrowing refinement application — facade re-exports.
 *
 * Implementations live in:
 *   - nullable-typeof-refinements.ts
 *   - instanceof-predicate-refinements.ts
 */

export {
  applyDirectTypeofRefinement,
  applyArrayIsArrayRefinement,
  applySimpleNullableRefinement,
  applyTruthinessNullishRefinement,
} from "./nullable-typeof-refinements.js";

export {
  applyInstanceofRefinement,
  applyPredicateCallRefinement,
} from "./instanceof-predicate-refinements.js";
