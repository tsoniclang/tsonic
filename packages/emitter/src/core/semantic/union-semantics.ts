/**
 * Semantic union analysis helpers — boolean gates only.
 *
 * These helpers answer yes/no questions about union types without constructing
 * runtime frame/layout objects. Runtime helpers (buildRuntimeUnionFrame,
 * buildRuntimeUnionLayout) should only be used at storage/lowering boundaries
 * where materialization is needed.
 *
 * This module intentionally does NOT expose a member-list API. Canonical
 * member resolution (flattening, dedup, ordering) lives in runtime-unions.ts
 * via getCanonicalRuntimeUnionMembers. If a future call site needs semantic
 * member lists without the 2-8 arity ceiling, the correct path is to extract
 * the expansion pipeline from runtime-unions.ts into a shared helper — not to
 * approximate it here.
 */

import type { IrType } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import {
  resolveTypeAlias,
  stripNullish,
  splitRuntimeNullishUnionMembers,
} from "./type-resolution.js";
import { getCanonicalRuntimeUnionMembers } from "./runtime-unions.js";

/**
 * Is this type a semantic union (>= 2 non-nullish members after one level of
 * alias resolution)?
 *
 * For types within the 2-8 arity range, this delegates to
 * getCanonicalRuntimeUnionMembers which performs full expansion, dedup, and
 * ordering. For wider unions (> 8 members), it falls back to a shallow check:
 * strip nullish, resolve one alias level, and count top-level union members.
 *
 * The shallow fallback is sufficient for a boolean "is this a union?" gate
 * but does NOT guarantee full flattening of nested aliases. This is acceptable
 * because all current call sites use this only as a guard before entering
 * union-specific code paths — they do not depend on member identity.
 */
export const isSemanticUnion = (
  type: IrType,
  context: EmitterContext
): boolean => {
  // Fast path: canonical handles 2-8 with full expansion/dedup
  if (getCanonicalRuntimeUnionMembers(type, context) !== undefined) {
    return true;
  }

  // Fallback: check if the type resolves to a wide union (> 8 members)
  const stripped = stripNullish(type);
  const resolved = resolveTypeAlias(stripped, context);

  if (resolved.kind === "unionType") {
    const split = splitRuntimeNullishUnionMembers(resolved);
    const nonNullish = split ? split.nonNullishMembers : resolved.types;
    return nonNullish.length >= 2;
  }

  return false;
};

/**
 * Will this type be materialized as a runtime Union<T1..Tn> carrier?
 *
 * Behaviorally equivalent to `buildRuntimeUnionFrame(type, ctx) !== undefined`
 * but communicates semantic intent and avoids constructing a frame object.
 *
 * The runtime carrier constraint is: canonical union members within arity 2-8.
 * This delegates entirely to getCanonicalRuntimeUnionMembers which performs
 * full expansion, dedup, and ordering — so the result is exact.
 */
export const willCarryAsRuntimeUnion = (
  type: IrType,
  context: EmitterContext
): boolean => getCanonicalRuntimeUnionMembers(type, context) !== undefined;
