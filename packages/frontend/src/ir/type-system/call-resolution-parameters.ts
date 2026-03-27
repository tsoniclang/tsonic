/**
 * Call Resolution Parameters — Rest/optional parameter expansion and type candidate expansion
 *
 * Contains:
 * - expandParameterTypesForInference: expand rest params for inference
 * - expandParameterTypesForArguments: expand rest params for argument matching
 * - buildResolvedRestParameter: resolve rest parameter structure
 * - collectExpectedReturnCandidates: return type candidate expansion
 * - collectNarrowingCandidates: narrowing candidate expansion
 *
 * DAG position: depends on type-system-state
 */

import type { IrType, IrReferenceType } from "../types/index.js";
import {
  substituteIrType as irSubstitute,
  TypeSubstitutionMap as IrSubstitutionMap,
} from "../types/ir-substitution.js";
import { stableIrTypeKey, unwrapAsyncWrapperType } from "../types/type-ops.js";
import type { TypeSystemState } from "./type-system-state.js";
import { resolveTypeIdByName } from "./type-system-state.js";

// ─────────────────────────────────────────────────────────────────────────
// Parameter expansion helpers — Rest/optional parameter type expansion
// ─────────────────────────────────────────────────────────────────────────

export const expandParameterTypesForInference = (
  parameters: readonly { readonly isRest: boolean }[],
  parameterTypes: readonly (IrType | undefined)[],
  argumentCount: number
): readonly (IrType | undefined)[] => {
  const restIndex = parameters.findIndex((parameter) => parameter.isRest);
  if (restIndex < 0) {
    return parameterTypes;
  }

  const restParam = parameters[restIndex];
  const restType = parameterTypes[restIndex];
  if (!restParam || !restType) {
    return parameterTypes;
  }

  const expanded = parameterTypes.slice(0, restIndex);
  const restElementType =
    restType.kind === "arrayType" ? restType.elementType : restType;

  while (expanded.length < argumentCount) {
    expanded.push(restElementType);
  }

  return expanded;
};

const getExpandedRestArgumentType = (
  restType: IrType,
  relativeArgumentIndex: number
): IrType => {
  if (restType.kind === "arrayType") {
    return restType.elementType;
  }

  if (restType.kind === "tupleType") {
    const direct = restType.elementTypes[relativeArgumentIndex];
    if (direct) {
      return direct;
    }
    const fallback = restType.elementTypes[restType.elementTypes.length - 1];
    return fallback ?? restType;
  }

  if (
    restType.kind === "referenceType" &&
    (restType.name === "Array" ||
      restType.name === "ReadonlyArray")
  ) {
    const onlyTypeArgument = restType.typeArguments?.[0];
    if (onlyTypeArgument) {
      return onlyTypeArgument;
    }
  }

  return restType;
};

export const expandParameterTypesForArguments = (
  parameters: readonly { readonly isRest: boolean }[],
  parameterTypes: readonly (IrType | undefined)[],
  argumentCount: number
): readonly (IrType | undefined)[] => {
  if (parameterTypes.length === 0) {
    return parameterTypes;
  }

  const restIndex = parameters.findIndex((parameter) => parameter.isRest);
  if (restIndex < 0) {
    return parameterTypes;
  }

  const expanded: (IrType | undefined)[] = [];
  for (
    let argumentIndex = 0;
    argumentIndex < argumentCount;
    argumentIndex += 1
  ) {
    if (argumentIndex < restIndex) {
      expanded.push(parameterTypes[argumentIndex]);
      continue;
    }

    const restType = parameterTypes[restIndex];
    if (!restType) {
      expanded.push(undefined);
      continue;
    }

    expanded.push(
      getExpandedRestArgumentType(restType, argumentIndex - restIndex)
    );
  }

  return expanded;
};

export const buildResolvedRestParameter = (
  parameterFlags: readonly { readonly isRest: boolean }[],
  parameterTypes: readonly (IrType | undefined)[]
):
  | {
      readonly index: number;
      readonly arrayType: IrType | undefined;
      readonly elementType: IrType | undefined;
    }
  | undefined => {
  const index = parameterFlags.findIndex((parameter) => parameter.isRest);
  if (index < 0) {
    return undefined;
  }

  const arrayType = parameterTypes[index];
  if (!arrayType) {
    return {
      index,
      arrayType: undefined,
      elementType: undefined,
    };
  }

  const elementType =
    arrayType.kind === "arrayType"
      ? arrayType.elementType
      : arrayType.kind === "referenceType" &&
          (arrayType.name === "Array" ||
            arrayType.name === "ReadonlyArray") &&
          arrayType.typeArguments?.length === 1
        ? arrayType.typeArguments[0]
        : undefined;

  return {
    index,
    arrayType,
    elementType,
  };
};

// ─────────────────────────────────────────────────────────────────────────
// collectExpectedReturnCandidates — Return type candidate expansion
// ─────────────────────────────────────────────────────────────────────────

export const collectExpectedReturnCandidates = (
  state: TypeSystemState,
  type: IrType
): readonly IrType[] => {
  return collectExpandedTypeCandidates(state, type, {
    includeOriginal: true,
    unwrapAsyncWrappers: true,
    flattenToLeaves: false,
  });
};

export const collectNarrowingCandidates = (
  state: TypeSystemState,
  type: IrType
): readonly IrType[] => {
  return collectExpandedTypeCandidates(state, type, {
    includeOriginal: false,
    unwrapAsyncWrappers: false,
    flattenToLeaves: true,
  });
};

const collectExpandedTypeCandidates = (
  state: TypeSystemState,
  type: IrType,
  options: {
    readonly includeOriginal: boolean;
    readonly unwrapAsyncWrappers: boolean;
    readonly flattenToLeaves: boolean;
  }
): readonly IrType[] => {
  const queue: IrType[] = [type];
  const out: IrType[] = [];
  const seen = new Set<string>();

  const enqueue = (candidate: IrType | undefined): void => {
    if (!candidate) return;
    const key = stableIrTypeKey(candidate);
    if (seen.has(key)) return;
    seen.add(key);
    queue.push(candidate);
  };

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;

    if (current.kind === "unionType") {
      for (const member of current.types) enqueue(member);
      if (!options.flattenToLeaves) {
        out.push(current);
      }
      continue;
    }

    let expandedAlias: IrType | undefined;
    if (current.kind === "referenceType") {
      expandedAlias = expandReferenceAlias(state, current);
      if (expandedAlias) {
        enqueue(expandedAlias);
      }

      if (options.unwrapAsyncWrappers) {
        enqueue(unwrapAsyncWrapperType(current));
      }
    }

    if (options.includeOriginal || !expandedAlias) {
      out.push(current);
    }
  }

  return out;
};

const expandReferenceAlias = (
  state: TypeSystemState,
  type: IrReferenceType
): IrType | undefined => {
  const typeId =
    type.typeId ??
    resolveTypeIdByName(
      state,
      type.resolvedClrType ?? type.name,
      type.typeArguments?.length ?? 0
    );
  if (!typeId) return undefined;

  const entry = state.unifiedCatalog.getByTypeId(typeId);
  if (!entry?.aliasedType) return undefined;

  const aliasSubst = new Map<string, IrType>();
  const aliasTypeParams = entry.typeParameters;
  const aliasTypeArgs = type.typeArguments ?? [];
  for (
    let i = 0;
    i < Math.min(aliasTypeParams.length, aliasTypeArgs.length);
    i++
  ) {
    const tp = aliasTypeParams[i];
    const ta = aliasTypeArgs[i];
    if (tp && ta) aliasSubst.set(tp.name, ta);
  }

  return aliasSubst.size > 0
    ? irSubstitute(entry.aliasedType, aliasSubst as IrSubstitutionMap)
    : entry.aliasedType;
};
