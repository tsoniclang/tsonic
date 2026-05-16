/**
 * Semantic union member discovery — alias-preserving.
 *
 * This module provides union member analysis for semantic consumers:
 * guard detection, branch type reasoning, predicate matching.
 *
 * The key difference from runtime-unions.ts expansion:
 * - Authored alias identity is preserved as a single member.
 *   `PathSpec | MiddlewareLike` yields two members, not their expanded contents.
 * - Explicit `unionType` nodes are flattened (they are structural, not aliases).
 * - Nullish types are stripped (same as runtime path).
 *
 * Runtime carrier construction (buildRuntimeUnionFrame, buildRuntimeUnionLayout)
 * still uses full expansion via getCanonicalRuntimeUnionMembers. That is correct
 * for lowering — the carrier needs the expanded member set.
 *
 * Semantic consumers must use these helpers so that analysis results are
 * stable regardless of whether moduleMap / typeAliasIndex are populated.
 */

import { IrType } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import { stripNullish } from "./type-resolution.js";
import { getRuntimeUnionReferenceMembers } from "./runtime-union-shared.js";
import { areIrTypesEquivalent } from "./type-equivalence.js";

/**
 * Discover the semantic union members of a type.
 *
 * Flattens explicit `unionType` structure and strips nullish members,
 * but preserves authored alias references (referenceType nodes) as
 * single members. This ensures that `PathSpec | MiddlewareLike` yields
 * exactly two members regardless of what those aliases expand to at
 * lowering time.
 *
 * Returns undefined if the type is not a union or has fewer than 2
 * non-nullish members.
 */
export const getSemanticUnionMembers = (
  type: IrType,
  context: EmitterContext
): readonly IrType[] | undefined => {
  const stripped = stripNullish(type);
  const members = flattenSemanticUnionMembers(stripped);
  if (members.length < 2) return undefined;

  const deduped: IrType[] = [];
  for (const member of members) {
    if (
      deduped.some((candidate) =>
        areIrTypesEquivalent(candidate, member, context)
      )
    ) {
      continue;
    }
    deduped.push(member);
  }

  return deduped.length >= 2 ? deduped : undefined;
};

/**
 * Find the index of a semantic union member that matches a target type.
 *
 * Uses context-aware type equivalence to find which authored member
 * corresponds to the predicate target. This avoids raw-name comparison and
 * requires deterministic nominal/CLR/structural identity before matching
 * reference types.
 *
 * Returns the 0-based index, or undefined if no match or multiple matches.
 */
export const findSemanticUnionMemberIndex = (
  members: readonly IrType[],
  target: IrType,
  context: EmitterContext
): number | undefined => {
  const strippedTarget = stripNullish(target);
  const matches: number[] = [];

  for (let i = 0; i < members.length; i += 1) {
    const member = members[i];
    if (!member) continue;

    if (areIrTypesEquivalent(member, strippedTarget, context)) {
      matches.push(i);
      continue;
    }

    // If the target is a union and any of its non-nullish members match
    // this member, count it (handles `value is PathSpec` where PathSpec
    // might appear as a direct member)
    if (strippedTarget.kind === "unionType") {
      const targetMembers = flattenSemanticUnionMembers(strippedTarget);
      if (targetMembers.some((t) => areIrTypesEquivalent(t, member, context))) {
        matches.push(i);
        continue;
      }
    }

    // If the member is a union and the target matches one of its members
    if (member.kind === "unionType") {
      const memberMembers = flattenSemanticUnionMembers(member);
      if (
        memberMembers.some((m) =>
          areIrTypesEquivalent(m, strippedTarget, context)
        )
      ) {
        matches.push(i);
        continue;
      }
    }
  }

  return matches.length === 1 ? matches[0] : undefined;
};

/**
 * Flatten a type into its semantic union members.
 *
 * - Strips nullish/undefined/null members
 * - Flattens nested `unionType` nodes (structural unions)
 * - Preserves `referenceType` nodes as-is (authored aliases)
 * - Preserves all other type kinds as-is
 */
const flattenSemanticUnionMembers = (type: IrType): readonly IrType[] => {
  if (type.kind === "unionType") {
    return type.types.flatMap((member) => {
      if (isNullishType(member)) return [];
      if (member.kind === "unionType") {
        return flattenSemanticUnionMembers(member);
      }
      return [member];
    });
  }

  // Intersection types that contain a runtime union carrier (e.g.,
  // Union<Ok, Err> & __Union$views) should be treated as unions.
  if (type.kind === "intersectionType") {
    const unionCarrier = type.types.find(
      (t): t is Extract<IrType, { kind: "referenceType" }> =>
        t.kind === "referenceType" &&
        getRuntimeUnionReferenceMembers(t) !== undefined
    );
    if (unionCarrier) {
      const members = getRuntimeUnionReferenceMembers(unionCarrier);
      if (members && members.length >= 2) {
        return members;
      }
    }
  }

  // Reference types that are runtime union carriers (e.g., Union<A, B>)
  if (type.kind === "referenceType") {
    const members = getRuntimeUnionReferenceMembers(type);
    if (members && members.length >= 2) {
      return members;
    }
  }

  if (isNullishType(type)) return [];
  return [type];
};

const isNullishType = (type: IrType): boolean => {
  if (type.kind === "primitiveType") {
    return type.name === "null" || type.name === "undefined";
  }
  if (type.kind === "literalType") {
    return type.value === null || type.value === undefined;
  }
  if (type.kind === "voidType") return true;
  return false;
};
