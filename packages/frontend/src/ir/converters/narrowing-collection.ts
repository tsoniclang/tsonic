/**
 * Flow narrowing collection & application — Facade
 *
 * Re-exports from sub-modules:
 * - narrowing-truthy: collectTypeNarrowingsInTruthyExpr, collectTypeNarrowingsInFalsyExpr
 * - narrowing-environment: withAppliedNarrowings, withAssignedAccessPathType
 */

export {
  collectTypeNarrowingsInTruthyExpr,
  collectTypeNarrowingsInFalsyExpr,
} from "./narrowing-truthy.js";

export {
  withAppliedNarrowings,
  withAssignedAccessPathType,
} from "./narrowing-environment.js";
