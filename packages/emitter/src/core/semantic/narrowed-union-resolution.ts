/**
 * Narrowed runtime union member resolution.
 *
 * Resolves the reachable runtime union members for a named binding, accounting
 * for any active narrowing state (runtimeSubset bindings). This is the semantic
 * analysis payload that guard detection and condition-branch narrowing need:
 * members, their slot numbers, and the original union arity.
 *
 * Uses getCanonicalRuntimeUnionMembers (semantic member resolution) instead of
 * buildRuntimeUnionFrame (runtime frame construction) to discover members from
 * type information. Runtime frame/layout construction should only happen at
 * lowering/materialization boundaries.
 */

import type { IrType } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import { expandRuntimeUnionMembers } from "./runtime-union-expansion.js";
import { getCanonicalRuntimeUnionMembers } from "./runtime-unions.js";
import {
  findExactRuntimeUnionMemberIndices,
  findRuntimeUnionMemberIndices,
} from "./runtime-union-matching.js";

/**
 * The semantic payload for narrowed union member resolution.
 *
 * - members: the reachable IrType members (filtered by narrowing if active)
 * - candidateMemberNs: the 1-based slot numbers corresponding to each member
 * - runtimeUnionArity: the total arity of the original (un-narrowed) union
 */
export type NarrowedUnionMembers = {
  readonly members: readonly IrType[];
  readonly candidateMemberNs: readonly number[];
  readonly runtimeUnionArity: number;
};

/**
 * Resolve the reachable runtime union members for a named binding.
 *
 * 1. If the binding has a pre-cached runtimeSubset with source members and
 *    candidate slot numbers, filters those by the allowed runtimeMemberNs.
 * 2. Otherwise, resolves canonical members from the type via
 *    getCanonicalRuntimeUnionMembers, then applies runtimeSubset filtering
 *    if the binding is a narrowed runtimeSubset.
 *
 * Returns undefined if the type is not a runtime union or if narrowing
 * eliminates all members.
 */
export const resolveNarrowedUnionMembers = (
  originalName: string,
  unionSourceType: IrType,
  context: EmitterContext
): NarrowedUnionMembers | undefined => {
  const narrowed = context.narrowedBindings?.get(originalName);

  if (
    narrowed?.kind === "expr" &&
    narrowed.type &&
    narrowed.sourceType &&
    narrowed.type !== narrowed.sourceType
  ) {
    const sourceMembers = getCanonicalRuntimeUnionMembers(
      narrowed.sourceType,
      context
    );
    const narrowedMembers =
      getCanonicalRuntimeUnionMembers(narrowed.type, context) ??
      expandRuntimeUnionMembers(narrowed.type, context);

    if (sourceMembers && narrowedMembers) {
      const candidateMemberNs = narrowedMembers.flatMap((member) => {
        const exactMatches = findExactRuntimeUnionMemberIndices(
          sourceMembers,
          member,
          context
        );
        if (exactMatches.length > 0) {
          const index = exactMatches[0];
          return index === undefined ? [] : [index + 1];
        }

        const semanticMatches = findRuntimeUnionMemberIndices(
          sourceMembers,
          member,
          context
        );
        const index = semanticMatches[0];
        return index === undefined ? [] : [index + 1];
      });

      if (candidateMemberNs.length === narrowedMembers.length) {
        return {
          members: narrowedMembers,
          candidateMemberNs,
          runtimeUnionArity: sourceMembers.length,
        };
      }
    }
  }

  // Fast path: pre-cached runtimeSubset with source member data
  if (
    narrowed?.kind === "runtimeSubset" &&
    narrowed.sourceMembers &&
    narrowed.sourceCandidateMemberNs &&
    narrowed.sourceMembers.length === narrowed.sourceCandidateMemberNs.length
  ) {
    const allowedMemberNs = new Set(narrowed.runtimeMemberNs);
    const narrowedMembers = narrowed.sourceMembers.filter((_, index) =>
      allowedMemberNs.has(
        narrowed.sourceCandidateMemberNs?.[index] ?? index + 1
      )
    );
    const narrowedCandidateMemberNs = narrowed.sourceCandidateMemberNs.filter(
      (memberN) => allowedMemberNs.has(memberN)
    );

    if (
      narrowedMembers.length === 0 ||
      narrowedMembers.length !== narrowedCandidateMemberNs.length
    ) {
      return undefined;
    }

    return {
      members: narrowedMembers,
      candidateMemberNs: narrowedCandidateMemberNs,
      runtimeUnionArity: narrowed.runtimeUnionArity,
    };
  }

  // Resolve the effective source type, accounting for narrowing state
  const runtimeSourceType =
    narrowed?.kind === "runtimeSubset"
      ? (narrowed.sourceType ?? unionSourceType)
      : (narrowed?.type ?? narrowed?.sourceType ?? unionSourceType);

  // Semantic member resolution — no frame object construction
  const members = getCanonicalRuntimeUnionMembers(runtimeSourceType, context);
  if (!members) return undefined;

  const runtimeUnionArity = members.length;
  const candidateMemberNs = members.map((_, index) => index + 1);

  // No narrowing active — return full member set
  if (!narrowed || narrowed.kind !== "runtimeSubset") {
    return {
      members,
      candidateMemberNs,
      runtimeUnionArity,
    };
  }

  // Apply runtimeSubset filtering
  const allowedMemberNs = new Set(narrowed.runtimeMemberNs);
  const narrowedMembers = members.filter((_, index) =>
    allowedMemberNs.has(index + 1)
  );
  const narrowedCandidateMemberNs = candidateMemberNs.filter((memberN) =>
    allowedMemberNs.has(memberN)
  );

  if (
    narrowedMembers.length === 0 ||
    narrowedMembers.length !== narrowedCandidateMemberNs.length
  ) {
    return undefined;
  }

  return {
    members: narrowedMembers,
    candidateMemberNs: narrowedCandidateMemberNs,
    runtimeUnionArity,
  };
};

export const resolveAlignedRuntimeUnionMembers = (
  originalName: string | undefined,
  effectiveType: IrType | undefined,
  carrierSourceType: IrType | undefined,
  context: EmitterContext
): NarrowedUnionMembers | undefined => {
  if (!effectiveType) {
    return undefined;
  }

  if (originalName) {
    const boundFrame = resolveNarrowedUnionMembers(
      originalName,
      effectiveType,
      context
    );
    if (boundFrame) {
      return boundFrame;
    }
  }

  if (!carrierSourceType) {
    return undefined;
  }

  const carrierMembers = getCanonicalRuntimeUnionMembers(
    carrierSourceType,
    context
  );
  if (!carrierMembers) {
    return undefined;
  }

  const semanticEffectiveMembers =
    getCanonicalRuntimeUnionMembers(effectiveType, context) ??
    expandRuntimeUnionMembers(effectiveType, context);
  if (semanticEffectiveMembers.length === 0) {
    return undefined;
  }

  const alignedMembers = carrierMembers.flatMap((carrierMember, index) => {
    const exactMatches = findExactRuntimeUnionMemberIndices(
      semanticEffectiveMembers,
      carrierMember,
      context
    );
    if (exactMatches.length > 0) {
      return [{ member: carrierMember, memberN: index + 1 }];
    }

    const semanticMatches = findRuntimeUnionMemberIndices(
      semanticEffectiveMembers,
      carrierMember,
      context
    );
    return semanticMatches.length > 0
      ? [{ member: carrierMember, memberN: index + 1 }]
      : [];
  });

  if (alignedMembers.length === 0) {
    return undefined;
  }

  return {
    members: alignedMembers.map(({ member }) => member),
    candidateMemberNs: alignedMembers.map(({ memberN }) => memberN),
    runtimeUnionArity: carrierMembers.length,
  };
};
