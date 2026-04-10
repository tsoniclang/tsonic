/**
 * Semantic union analysis helpers — boolean gates only.
 *
 * These helpers answer yes/no questions about union types without constructing
 * runtime frame/layout objects. Runtime helpers (buildRuntimeUnionFrame,
 * buildRuntimeUnionLayout) should only be used at storage/lowering boundaries
 * where materialization is needed.
 *
 * IMPORTANT: These gates use alias-preserving semantic member discovery,
 * not runtime-union expansion. A single reference type like `MiddlewareLike`
 * is NOT a union here, even if it aliases one. Only explicit `unionType` IR
 * nodes with >= 2 non-nullish members are unions in the semantic view.
 */

import type { IrType } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import { getCanonicalRuntimeUnionMembers } from "./runtime-unions.js";
import { getSemanticUnionMembers } from "./semantic-union-members.js";

/**
 * Is this type a semantic union (>= 2 non-nullish members)?
 *
 * Uses alias-preserving member discovery: reference types are preserved as
 * single members, not expanded through their alias definitions. This means
 * `MiddlewareLike` (a reference to a union alias) is NOT a semantic union —
 * it is a single reference member. Only explicit `unionType` IR nodes like
 * `PathSpec | MiddlewareLike` are semantic unions.
 *
 * This ensures semantic analysis results are stable regardless of whether
 * moduleMap / typeAliasIndex are populated.
 */
export const isSemanticUnion = (
  type: IrType,
  context: EmitterContext
): boolean => getSemanticUnionMembers(type, context) !== undefined;

/**
 * Will this type be materialized as a compiler-owned runtime union carrier?
 *
 * Behaviorally equivalent to `buildRuntimeUnionFrame(type, ctx) !== undefined`
 * but communicates semantic intent and avoids constructing a frame object.
 *
 * This delegates entirely to getCanonicalRuntimeUnionMembers which performs
 * full expansion, dedup, and ordering — so the result is exact.
 */
export const willCarryAsRuntimeUnion = (
  type: IrType,
  context: EmitterContext
): boolean => getCanonicalRuntimeUnionMembers(type, context) !== undefined;
