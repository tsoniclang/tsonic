/**
 * Call Resolution Scoring — Arity checking, overload scoring, and parameter type refinement.
 *
 * Contains isArityCompatible, scoreSignatureMatch, refineParameterTypeForConcreteArgument,
 * and refineResolvedParameterTypesForArguments.
 *
 * DAG position: depends on type-system-state, type-system-relations, call-resolution-utilities
 */

import type { IrType } from "../types/index.js";
import type { MethodSignatureEntry } from "./internal/universe/types.js";
import type { TypeSystemState } from "./type-system-state.js";
import { normalizeToNominal } from "./type-system-state.js";
import { isAssignableTo, typesEqual } from "./type-system-relations.js";
import {
  expandParameterTypesForArguments,
  delegateToFunctionType,
} from "./call-resolution-utilities.js";

// ─────────────────────────────────────────────────────────────────────────
// isArityCompatible — Pure arity check for overload resolution
// ─────────────────────────────────────────────────────────────────────────

export const isArityCompatible = (
  signature: MethodSignatureEntry,
  argumentCount: number
): boolean => {
  const params = signature.parameters;
  if (params.length === 0) return argumentCount === 0;

  // Rest parameter can absorb any extra args.
  const restIndex = params.findIndex((p) => p.isRest);
  if (restIndex >= 0) {
    // Only support `...rest` in the last position.
    if (restIndex !== params.length - 1) return false;

    // Must supply all non-rest parameters.
    if (argumentCount < restIndex) return false;
    return true;
  }

  // Too many args for non-rest signature.
  if (argumentCount > params.length) return false;

  // Missing args must correspond to optional parameters.
  for (let i = argumentCount; i < params.length; i++) {
    const p = params[i];
    if (!p || !p.isOptional) return false;
  }

  return true;
};

// ─────────────────────────────────────────────────────────────────────────
// scoreSignatureMatch — Overload scoring
// ─────────────────────────────────────────────────────────────────────────

export const scoreSignatureMatch = (
  state: TypeSystemState,
  parameterTypes: readonly (IrType | undefined)[],
  argTypes: readonly (IrType | undefined)[],
  argumentCount: number
): number => {
  const scoreTypeCompatibility = (
    parameterType: IrType,
    argumentType: IrType
  ): number => {
    if (typesEqual(parameterType, argumentType)) {
      return 4;
    }

    if (isAssignableTo(state, argumentType, parameterType)) {
      return 3;
    }

    const pNom = normalizeToNominal(state, parameterType);
    const aNom = normalizeToNominal(state, argumentType);
    if (!pNom || !aNom) return 0;

    if (pNom.typeId.stableId === aNom.typeId.stableId) {
      return 2;
    }

    const inst = state.nominalEnv.getInstantiation(
      aNom.typeId,
      aNom.typeArgs,
      pNom.typeId
    );
    return inst ? 1 : 0;
  };

  const scoreFunctionLikeCompatibility = (
    parameterType: IrType,
    argumentType: IrType
  ): number => {
    const parameterFn =
      parameterType.kind === "functionType"
        ? parameterType
        : delegateToFunctionType(state, parameterType);
    const argumentFn =
      argumentType.kind === "functionType"
        ? argumentType
        : delegateToFunctionType(state, argumentType);

    if (!parameterFn || !argumentFn) {
      return 0;
    }

    let score = 0;
    if (parameterFn.parameters.length === argumentFn.parameters.length) {
      score += 8;
    } else {
      score -=
        Math.abs(parameterFn.parameters.length - argumentFn.parameters.length) *
        2;
    }

    const pairCount = Math.min(
      parameterFn.parameters.length,
      argumentFn.parameters.length
    );
    for (let index = 0; index < pairCount; index += 1) {
      const parameter = parameterFn.parameters[index];
      const argument = argumentFn.parameters[index];
      if (!parameter?.type || !argument?.type) continue;
      score += scoreTypeCompatibility(parameter.type, argument.type);
    }

    if (
      argumentFn.returnType.kind !== "unknownType" &&
      argumentFn.returnType.kind !== "anyType"
    ) {
      score += scoreTypeCompatibility(
        parameterFn.returnType,
        argumentFn.returnType
      );
    }

    return score;
  };

  let score = 0;
  const pairs = Math.min(argumentCount, parameterTypes.length, argTypes.length);
  for (let i = 0; i < pairs; i++) {
    const pt = parameterTypes[i];
    const at = argTypes[i];
    if (!pt || !at) continue;
    const compatibleParameterType =
      refineParameterTypeForConcreteArgument(state, pt, at) ?? pt;

    const functionLikeScore = scoreFunctionLikeCompatibility(
      compatibleParameterType,
      at
    );
    if (functionLikeScore !== 0) {
      score += functionLikeScore;
      continue;
    }

    score += scoreTypeCompatibility(compatibleParameterType, at);
  }

  return score;
};

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
