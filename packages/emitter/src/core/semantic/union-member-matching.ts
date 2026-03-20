/**
 * Union member matching and selection — facade re-exports.
 *
 * Implementations live in:
 *   - union-typeof-matching.ts
 *   - union-predicate-matching.ts
 */

export {
  matchesTypeofTag,
  narrowTypeByNotTypeofTag,
  narrowTypeByTypeofTag,
} from "./union-typeof-matching.js";

export {
  selectObjectLiteralUnionMember,
  selectUnionMemberForObjectLiteral,
  findUnionMemberIndex,
  unionMemberMatchesTarget,
} from "./union-predicate-matching.js";
