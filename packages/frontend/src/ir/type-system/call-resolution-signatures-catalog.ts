/**
 * Receiver substitution helpers.
 *
 * Contains computeReceiverSubstitution for receiver type parameter binding.
 *
 * DAG position: depends on type-system-state
 */

import type { IrType } from "../types/index.js";
import type {
  TypeSystemState,
  TypeSubstitutionMap,
} from "./type-system-state.js";
import {
  resolveTypeIdByName,
  normalizeToNominal,
  resolveSourceReferenceFQName,
} from "./type-system-state.js";

// ─────────────────────────────────────────────────────────────────────────
// computeReceiverSubstitution — Receiver type → substitution map
// ─────────────────────────────────────────────────────────────────────────

/**
 * Compute receiver substitution for a method call.
 *
 * Given a receiver type (e.g., Array<string>) and a declaring type's TS name,
 * computes the substitution map for class type parameters.
 *
 * Phase 6: Uses TypeId-based NominalEnv.getInstantiation().
 */
export const computeReceiverSubstitution = (
  state: TypeSystemState,
  receiverType: IrType,
  declaringTypeTsName: string,
  _declaringMemberName: string,
  declaringTypeParameterNames?: readonly string[]
): TypeSubstitutionMap | undefined => {
  const normalized = normalizeToNominal(state, receiverType);
  if (!normalized) {
    return undefined;
  }

  const arityHint =
    normalized.typeArgs.length > 0
      ? normalized.typeArgs.length
      : declaringTypeParameterNames?.length;
  const declaringSourceFqName = resolveSourceReferenceFQName(state, {
    kind: "referenceType",
    name: declaringTypeTsName,
  });
  const declaringTypeId =
    (declaringSourceFqName
      ? resolveTypeIdByName(state, declaringSourceFqName, arityHint) ??
        resolveTypeIdByName(state, declaringSourceFqName)
      : undefined) ??
    resolveTypeIdByName(state, declaringTypeTsName, arityHint) ??
    resolveTypeIdByName(state, declaringTypeTsName);
  if (!declaringTypeId) {
    return undefined;
  }

  const nominalInstantiation = state.nominalEnv.getInstantiation(
    normalized.typeId,
    normalized.typeArgs,
    declaringTypeId
  );
  return nominalInstantiation ?? undefined;
};
