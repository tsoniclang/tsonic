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
import type { TypeId } from "./internal/universe/catalog-types.js";
import {
  resolveTypeIdByName,
  normalizeToNominal,
  resolveSourceReferenceFQName,
} from "./type-system-state.js";

const normalizeTsbindgenDeclaringTypeName = (name: string): string => {
  if (name.endsWith("$instance")) {
    return name.slice(0, -"$instance".length);
  }
  if (name.startsWith("__") && name.endsWith("$views")) {
    return name.slice(2, -"$views".length);
  }
  return name;
};

const enumerateEquivalentDeclaringTypeNames = (
  name: string
): readonly string[] => {
  const names: string[] = [];
  const push = (candidate: string | undefined): void => {
    if (!candidate) {
      return;
    }
    if (!names.includes(candidate)) {
      names.push(candidate);
    }
  };

  const baseName = normalizeTsbindgenDeclaringTypeName(name);
  push(name);
  push(baseName);
  push(`${baseName}$instance`);
  push(`__${baseName}$views`);

  return names;
};

const resolveDeclaringTypeCandidates = (
  state: TypeSystemState,
  declaringTypeTsName: string,
  arityHint: number | undefined,
  declaringClrType: string | undefined
): readonly TypeId[] => {
  const candidates: TypeId[] = [];
  const pushCandidate = (candidate: TypeId | undefined): void => {
    if (!candidate) {
      return;
    }
    if (
      candidates.some((existing) => existing.stableId === candidate.stableId)
    ) {
      return;
    }
    candidates.push(candidate);
  };

  pushCandidate(
    declaringClrType
      ? resolveTypeIdByName(state, declaringClrType, arityHint)
      : undefined
  );
  pushCandidate(
    declaringClrType ? resolveTypeIdByName(state, declaringClrType) : undefined
  );

  for (const candidateName of enumerateEquivalentDeclaringTypeNames(
    declaringTypeTsName
  )) {
    const sourceFqName = resolveSourceReferenceFQName(state, {
      kind: "referenceType",
      name: candidateName,
    });

    if (sourceFqName) {
      pushCandidate(resolveTypeIdByName(state, sourceFqName, arityHint));
      pushCandidate(resolveTypeIdByName(state, sourceFqName));
    }

    pushCandidate(resolveTypeIdByName(state, candidateName, arityHint));
    pushCandidate(resolveTypeIdByName(state, candidateName));
  }

  return candidates;
};

// ─────────────────────────────────────────────────────────────────────────
// computeReceiverSubstitution — Receiver type → substitution map
// ─────────────────────────────────────────────────────────────────────────

const resolveDeclaringTypeParameterNames = (
  state: TypeSystemState,
  declaringTypeIds: readonly TypeId[],
  explicitNames: readonly string[] | undefined
): readonly string[] | undefined => {
  if (explicitNames && explicitNames.length > 0) {
    return explicitNames;
  }

  for (const declaringTypeId of declaringTypeIds) {
    const typeParameters = state.unifiedCatalog
      .getTypeParameters(declaringTypeId)
      .map((parameter) => parameter.name);
    if (typeParameters.length > 0) {
      return typeParameters;
    }
  }

  return undefined;
};

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
  declaringTypeParameterNames?: readonly string[],
  declaringClrType?: string
): TypeSubstitutionMap | undefined => {
  const normalized = normalizeToNominal(state, receiverType);
  if (!normalized) {
    return undefined;
  }

  const arityHint =
    normalized.typeArgs.length > 0
      ? normalized.typeArgs.length
      : declaringTypeParameterNames?.length;
  const declaringTypeIds = resolveDeclaringTypeCandidates(
    state,
    declaringTypeTsName,
    arityHint,
    declaringClrType
  );
  const resolvedDeclaringTypeParameterNames =
    resolveDeclaringTypeParameterNames(
      state,
      declaringTypeIds,
      declaringTypeParameterNames
    );
  let emptyInstantiation: TypeSubstitutionMap | undefined;

  for (const declaringTypeId of declaringTypeIds) {
    const nominalInstantiation = state.nominalEnv.getInstantiation(
      normalized.typeId,
      normalized.typeArgs,
      declaringTypeId
    );
    if (nominalInstantiation && nominalInstantiation.size > 0) {
      return nominalInstantiation;
    }
    if (!emptyInstantiation && nominalInstantiation) {
      emptyInstantiation = nominalInstantiation;
    }

    if (
      resolvedDeclaringTypeParameterNames &&
      resolvedDeclaringTypeParameterNames.length > 0 &&
      normalized.typeId.stableId === declaringTypeId.stableId &&
      normalized.typeArgs.length === resolvedDeclaringTypeParameterNames.length
    ) {
      const directSubstitutionEntries =
        resolvedDeclaringTypeParameterNames.flatMap((name, index) => {
          const typeArgument = normalized.typeArgs[index];
          return typeArgument ? [[name, typeArgument] as const] : [];
        });
      return new Map(directSubstitutionEntries);
    }
  }

  return emptyInstantiation ?? undefined;
};
