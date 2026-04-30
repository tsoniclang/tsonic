/**
 * Flow narrowing resolvers (facade).
 *
 * Sub-modules:
 * - narrowing-resolvers-typeof.ts    : typeof, shared utilities, call-predicate narrowing
 * - narrowing-resolvers-equality.ts  : equality-literal, instanceof narrowing
 */

export type { BoundDecl, TypeNarrowing } from "./narrowing-resolvers-typeof.js";

export {
  unwrapExpr,
  getStringLiteralText,
  isEqualityOperator,
  isInequalityOperator,
  makeTypeNarrowing,
  tryResolveCallPredicateNarrowing,
  extractIdentifierPropertyAccess,
  filterTypeByResolvedCandidates,
} from "./narrowing-resolvers-typeof.js";

export type { EqualityLiteralTarget } from "./narrowing-resolvers-equality.js";

export {
  tryResolveEqualityLiteralTarget,
  candidateMatchesEqualityLiteral,
  narrowTypeByEqualityLiteral,
  tryResolveEqualityLiteralNarrowing,
  resolveInstanceofTargetType,
} from "./narrowing-resolvers-equality.js";
