/**
 * Flow narrowing helpers (frontend) -- facade.
 *
 * Re-exports from sub-modules:
 *   - narrowing-resolvers.ts  (type-level narrowing helpers)
 *   - narrowing-collection.ts (collection orchestration & env application)
 */

export type { TypeNarrowing } from "./narrowing-resolvers.js";
export {
  collectTypeNarrowingsInTruthyExpr,
  collectTypeNarrowingsInFalsyExpr,
  withAppliedNarrowings,
  withAssignedAccessPathType,
} from "./narrowing-collection.js";
