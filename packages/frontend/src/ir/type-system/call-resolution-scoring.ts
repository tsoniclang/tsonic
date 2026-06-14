/**
 * Call Resolution Parameter Refinement.
 *
 * TSTS selects the call signature. This module only refines already-selected
 * parameter surfaces for deterministic lowering.
 *
 * DAG position: depends on type-system-state, type-system-relations, call-resolution-utilities
 */

import type { IrType } from "../types/index.js";
import type { TypeSystemState } from "./type-system-state.js";
import { isAssignableTo, typesEqual } from "./type-system-relations.js";
import { expandParameterTypesForArguments } from "./call-resolution-utilities.js";

// ─────────────────────────────────────────────────────────────────────────
// refineParameterTypeForConcreteArgument — Union parameter refinement
// ─────────────────────────────────────────────────────────────────────────

export const refineParameterTypeForConcreteArgument = (
  state: TypeSystemState,
  parameterType: IrType | undefined,
  argumentType: IrType | undefined
): IrType | undefined => {
  if (!parameterType || !argumentType) {
    return parameterType;
  }

  if (parameterType.kind !== "unionType") {
    return parameterType;
  }

  const matchingMembers = parameterType.types.filter((candidate) =>
    isAssignableTo(state, argumentType, candidate)
  );

  const nonNullishMembers = parameterType.types.filter(
    (candidate) =>
      !(
        candidate.kind === "primitiveType" &&
        (candidate.name === "null" || candidate.name === "undefined")
      )
  );
  const shouldPreserveNullableParameterSurface = (
    candidate: IrType | undefined
  ): boolean =>
    !!candidate &&
    nonNullishMembers.length === 1 &&
    candidate.kind === "primitiveType" &&
    (candidate.name === "null" || candidate.name === "undefined");

  if (matchingMembers.length === 1) {
    const only = matchingMembers[0];
    return shouldPreserveNullableParameterSurface(only) ? parameterType : only;
  }

  const distinctMatches = matchingMembers.filter((candidate, index) => {
    for (let i = 0; i < index; i += 1) {
      const previous = matchingMembers[i];
      if (previous && typesEqual(previous, candidate)) {
        return false;
      }
    }
    return true;
  });

  if (distinctMatches.length === 1) {
    const only = distinctMatches[0];
    return shouldPreserveNullableParameterSurface(only) ? parameterType : only;
  }

  return parameterType;
};

export const refineResolvedParameterTypesForArguments = (
  state: TypeSystemState,
  parameters: readonly { readonly isRest: boolean }[],
  parameterTypes: readonly (IrType | undefined)[],
  argTypes: readonly (IrType | undefined)[] | undefined,
  argumentCount: number
): readonly (IrType | undefined)[] => {
  const expandedParameterTypes = expandParameterTypesForArguments(
    parameters,
    parameterTypes,
    argumentCount
  );
  if (!argTypes || argTypes.length === 0) {
    return expandedParameterTypes;
  }

  let changed = false;
  const refined = expandedParameterTypes.map((parameterType, index) => {
    if (index >= argumentCount) {
      return parameterType;
    }

    const next = refineParameterTypeForConcreteArgument(
      state,
      parameterType,
      argTypes[index]
    );
    if (next !== parameterType) {
      changed = true;
    }
    return next;
  });

  return changed ? refined : expandedParameterTypes;
};
