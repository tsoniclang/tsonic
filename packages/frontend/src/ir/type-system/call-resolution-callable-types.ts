import type { IrFunctionType, IrType } from "../types/index.js";
import {
  substituteIrType as irSubstitute,
  TypeSubstitutionMap as IrSubstitutionMap,
} from "../types/ir-substitution.js";
import type { TypeParameterInfo } from "./types.js";
import type {
  CallQuery,
  RawSignatureInfo,
  ResolvedCall,
  TypeSystemState,
} from "./type-system-state.js";
import { addUndefinedToType } from "./type-system-state.js";
import { unknownType } from "./types.js";
import {
  buildResolvedRestParameter,
  containsMethodTypeParameter,
  delegateToFunctionType,
  expandParameterTypesForArguments,
} from "./call-resolution-utilities.js";
import {
  refineResolvedParameterTypesForArguments,
  scoreSignatureMatch,
} from "./call-resolution-inference.js";
import { resolveMethodTypeSubstitution } from "./call-resolution-method-substitution.js";

type CallableTypeQuery = Pick<
  CallQuery,
  "argumentCount" | "argTypes" | "explicitTypeArgs" | "expectedReturnType"
>;

export type ResolvedCallableType = {
  readonly callableType: IrFunctionType;
  readonly resolved: ResolvedCall;
};

const flattenCallableCandidates = (
  state: TypeSystemState,
  type: IrType | undefined
): readonly IrFunctionType[] => {
  if (!type) return [];

  if (type.kind === "functionType") {
    return [type];
  }

  if (type.kind === "intersectionType") {
    return type.types.flatMap((member) =>
      flattenCallableCandidates(state, member)
    );
  }

  const delegated = delegateToFunctionType(state, type);
  return delegated ? [delegated] : [];
};

const countRequiredParameters = (type: IrFunctionType): number =>
  type.parameters.filter(
    (parameter) => !parameter.isOptional && !parameter.isRest
  ).length;

const canAcceptArgumentCount = (
  type: IrFunctionType,
  argumentCount: number
): boolean => {
  const required = countRequiredParameters(type);
  if (argumentCount < required) return false;

  const hasRest = type.parameters.some((parameter) => parameter.isRest);
  if (!hasRest && argumentCount > type.parameters.length) {
    return false;
  }

  return true;
};

const toRawSignature = (type: IrFunctionType): RawSignatureInfo => {
  const typeParameters: TypeParameterInfo[] = (type.typeParameters ?? []).map(
    (parameter) => ({
      name: parameter.name,
      constraint: parameter.constraint,
      defaultType: parameter.default,
    })
  );

  return {
    parameterTypes: type.parameters.map((parameter) => parameter.type),
    parameterFlags: type.parameters.map((parameter) => ({
      isRest: parameter.isRest,
      isOptional: parameter.isOptional,
    })),
    thisParameterType: undefined,
    returnType: type.returnType,
    hasDeclaredReturnType: true,
    parameterModes: type.parameters.map((parameter) => parameter.passing),
    typeParameters,
    parameterNames: type.parameters.map((parameter, index) =>
      parameter.pattern.kind === "identifierPattern"
        ? parameter.pattern.name
        : `param${index}`
    ),
  };
};

const scoreSurfaceTypeSpecificity = (type: IrType | undefined): number => {
  if (!type) {
    return 0;
  }

  switch (type.kind) {
    case "unionType":
      return (
        -(type.types.length * 10) +
        type.types.reduce(
          (total, member) => total + scoreSurfaceTypeSpecificity(member),
          0
        )
      );
    case "intersectionType":
      return (
        -(type.types.length * 10) +
        type.types.reduce(
          (total, member) => total + scoreSurfaceTypeSpecificity(member),
          0
        )
      );
    case "arrayType":
      return 2 + scoreSurfaceTypeSpecificity(type.elementType);
    case "tupleType":
      return (
        2 +
        type.elementTypes.reduce(
          (total, member) => total + scoreSurfaceTypeSpecificity(member),
          0
        )
      );
    case "referenceType":
      return (
        3 +
        (type.typeArguments?.reduce(
          (total, member) => total + scoreSurfaceTypeSpecificity(member),
          0
        ) ?? 0)
      );
    case "functionType":
      return (
        3 +
        type.parameters.reduce(
          (total, parameter) =>
            total + scoreSurfaceTypeSpecificity(parameter?.type),
          0
        ) +
        scoreSurfaceTypeSpecificity(type.returnType)
      );
    case "objectType":
      return (
        3 +
        type.members.reduce(
          (total, member) =>
            total +
            (member.kind === "propertySignature"
              ? scoreSurfaceTypeSpecificity(member.type)
              : member.parameters.reduce(
                  (parameterTotal, parameter) =>
                    parameterTotal + scoreSurfaceTypeSpecificity(parameter.type),
                  scoreSurfaceTypeSpecificity(member.returnType)
                )),
          0
        )
      );
    case "dictionaryType":
      return (
        3 +
        scoreSurfaceTypeSpecificity(type.keyType) +
        scoreSurfaceTypeSpecificity(type.valueType)
      );
    case "literalType":
    case "primitiveType":
    case "voidType":
    case "neverType":
      return 3;
    default:
      return 1;
  }
};

const countCompatibleArguments = (
  state: TypeSystemState,
  resolved: ResolvedCall,
  argTypes: readonly (IrType | undefined)[],
  argumentCount: number
): number => {
  let compatible = 0;
  const pairCount = Math.min(
    argumentCount,
    resolved.parameterTypes.length,
    argTypes.length
  );

  for (let index = 0; index < pairCount; index += 1) {
    const parameterType = resolved.parameterTypes[index];
    const argumentType = argTypes[index];
    if (!parameterType || !argumentType) {
      continue;
    }

    if (scoreSignatureMatch(state, [parameterType], [argumentType], 1) > 0) {
      compatible += 1;
    }
  }

  return compatible;
};

const countBroadNumberIndependentCompatibleArguments = (
  state: TypeSystemState,
  resolved: ResolvedCall,
  argTypes: readonly (IrType | undefined)[],
  argumentCount: number
): number => {
  let compatible = 0;
  const pairCount = Math.min(
    argumentCount,
    resolved.parameterTypes.length,
    argTypes.length
  );

  for (let index = 0; index < pairCount; index += 1) {
    const parameterType = resolved.parameterTypes[index];
    const argumentType = argTypes[index];
    if (!parameterType || !argumentType) {
      continue;
    }

    if (
      argumentType.kind === "primitiveType" &&
      argumentType.name === "number"
    ) {
      continue;
    }

    if (scoreSignatureMatch(state, [parameterType], [argumentType], 1) > 0) {
      compatible += 1;
    }
  }

  return compatible;
};

const explicitlyAcceptsBroadNumber = (type: IrType | undefined): boolean => {
  if (!type) {
    return false;
  }

  if (type.kind === "primitiveType") {
    return type.name === "number";
  }

  if (type.kind === "unionType") {
    return type.types.some((member) => explicitlyAcceptsBroadNumber(member));
  }

  return false;
};

const countBroadNumberExplicitlyAcceptedArguments = (
  resolved: ResolvedCall,
  argTypes: readonly (IrType | undefined)[],
  argumentCount: number
): number => {
  let compatible = 0;
  const pairCount = Math.min(
    argumentCount,
    resolved.parameterTypes.length,
    argTypes.length
  );

  for (let index = 0; index < pairCount; index += 1) {
    const parameterType = resolved.parameterTypes[index];
    const argumentType = argTypes[index];
    if (!parameterType || !argumentType) {
      continue;
    }

    if (
      argumentType.kind === "primitiveType" &&
      argumentType.name === "number" &&
      explicitlyAcceptsBroadNumber(parameterType)
    ) {
      compatible += 1;
    }
  }

  return compatible;
};

const countUnresolvedMethodParameterOccurrences = (
  candidate: IrFunctionType,
  resolved: ResolvedCall,
  argumentCount: number
): number => {
  const methodTypeParameterNames = new Set(
    (candidate.typeParameters ?? []).map((parameter) => parameter.name)
  );

  if (methodTypeParameterNames.size === 0) {
    return 0;
  }

  return resolved.parameterTypes
    .slice(0, argumentCount)
    .reduce(
      (total, parameterType) =>
        total +
        (parameterType &&
        containsMethodTypeParameter(parameterType, methodTypeParameterNames)
          ? 1
          : 0),
      0
    );
};

const buildCallableScore = (
  state: TypeSystemState,
  candidate: IrFunctionType,
  resolved: ResolvedCall,
  query: CallableTypeQuery
): readonly [number, number, number, number, number, number, number, number] => {
  const hasRest = candidate.parameters.some((parameter) => parameter.isRest);
  const exactArity =
    !hasRest && candidate.parameters.length === query.argumentCount;
  const compatibilityScore = query.argTypes
    ? scoreSignatureMatch(
        state,
        resolved.parameterTypes.slice(0, query.argumentCount),
        query.argTypes.slice(0, query.argumentCount),
        query.argumentCount
      )
    : 0;
  const compatibleArgumentCount = query.argTypes
    ? countCompatibleArguments(
        state,
        resolved,
        query.argTypes,
        query.argumentCount
      )
    : 0;
  const broadNumberIndependentCompatibleArgumentCount = query.argTypes
    ? countBroadNumberIndependentCompatibleArguments(
        state,
        resolved,
        query.argTypes,
        query.argumentCount
      )
    : 0;
  const broadNumberExplicitlyAcceptedArgumentCount = query.argTypes
    ? countBroadNumberExplicitlyAcceptedArguments(
        resolved,
        query.argTypes,
        query.argumentCount
      )
    : 0;
  const unresolvedMethodParameterOccurrences =
    countUnresolvedMethodParameterOccurrences(
      candidate,
      resolved,
      query.argumentCount
    );
  const surfaceSpecificity = resolved.surfaceParameterTypes
    .slice(0, query.argumentCount)
    .reduce(
      (total, parameterType) =>
        total + scoreSurfaceTypeSpecificity(parameterType),
      0
    );

  return [
    broadNumberIndependentCompatibleArgumentCount,
    broadNumberExplicitlyAcceptedArgumentCount,
    compatibleArgumentCount,
    exactArity ? 1 : 0,
    -unresolvedMethodParameterOccurrences,
    compatibilityScore,
    surfaceSpecificity,
    hasRest ? -candidate.parameters.length : 100 - candidate.parameters.length,
  ];
};

const compareCallableScores = (
  left: readonly [number, number, number, number, number, number, number, number],
  right: readonly [number, number, number, number, number, number, number, number]
): number => {
  for (let index = 0; index < left.length; index += 1) {
    const delta = left[index]! - right[index]!;
    if (delta !== 0) {
      return delta;
    }
  }

  return 0;
};

const resolveCallableTypeCandidate = (
  state: TypeSystemState,
  type: IrFunctionType,
  query: CallableTypeQuery
): ResolvedCallableType | undefined => {
  const rawSig = toRawSignature(type);
  let workingParams = [...rawSig.parameterTypes];
  let workingReturn = rawSig.returnType;

  if (rawSig.typeParameters.length > 0) {
    const diagnosticsStart = state.diagnostics.length;
    const substitution = resolveMethodTypeSubstitution(
      state,
      rawSig,
      {
        argTypes: query.argTypes,
        explicitTypeArgs: query.explicitTypeArgs,
        expectedReturnType: query.expectedReturnType,
        receiverType: undefined,
      },
      undefined,
      workingParams,
      undefined,
      workingReturn,
      undefined
    );

    if (substitution.kind === "error") {
      state.diagnostics.length = diagnosticsStart;
      return undefined;
    }

    state.diagnostics.length = diagnosticsStart;

    const callSubst = substitution.substitution;
    if (callSubst.size > 0) {
      workingParams = workingParams.map((parameter) =>
        parameter
          ? irSubstitute(parameter, callSubst as IrSubstitutionMap)
          : undefined
      );
      workingReturn = irSubstitute(
        workingReturn,
        callSubst as IrSubstitutionMap
      );
    }

    const unresolved = new Set(
      rawSig.typeParameters
        .map((parameter) => parameter.name)
        .filter((name) => !callSubst.has(name))
    );
    if (
      unresolved.size > 0 &&
      containsMethodTypeParameter(workingReturn, unresolved)
    ) {
      workingReturn = unknownType;
    }
  }

  const normalizedParams = workingParams.map((parameter, index) =>
    parameter && rawSig.parameterFlags[index]?.isOptional
      ? addUndefinedToType(parameter)
      : parameter
  );

  const resolved: ResolvedCall = {
    thisParameterType: undefined,
    restParameter: buildResolvedRestParameter(
      rawSig.parameterFlags,
      normalizedParams
    ),
    surfaceRestParameter: buildResolvedRestParameter(
      rawSig.parameterFlags,
      normalizedParams
    ),
    surfaceParameterTypes: expandParameterTypesForArguments(
      rawSig.parameterFlags,
      normalizedParams,
      query.argumentCount
    ),
    parameterTypes: refineResolvedParameterTypesForArguments(
      state,
      rawSig.parameterFlags,
      normalizedParams,
      query.argTypes,
      query.argumentCount
    ),
    parameterModes: rawSig.parameterModes,
    returnType: workingReturn,
    hasDeclaredReturnType: rawSig.hasDeclaredReturnType,
    typePredicate: undefined,
    diagnostics: [],
  };

  return {
    callableType: type,
    resolved,
  };
};

export const resolveCallableType = (
  state: TypeSystemState,
  type: IrType | undefined,
  query: CallableTypeQuery
): ResolvedCallableType | undefined => {
  const arityCompatibleCandidates = flattenCallableCandidates(state, type).filter(
    (candidate) => canAcceptArgumentCount(candidate, query.argumentCount)
  );
  const candidates =
    query.explicitTypeArgs && query.explicitTypeArgs.length > 0
      ? arityCompatibleCandidates.filter(
          (candidate) => (candidate.typeParameters?.length ?? 0) > 0
        )
      : arityCompatibleCandidates;
  if (candidates.length === 0) {
    return undefined;
  }

  let best: ResolvedCallableType | undefined;
  let bestScore:
    | readonly [number, number, number, number, number, number, number, number]
    | undefined;

  for (const candidate of candidates) {
    const resolved = resolveCallableTypeCandidate(state, candidate, query);
    if (!resolved) {
      continue;
    }

    const score = buildCallableScore(state, candidate, resolved.resolved, query);
    if (!best || !bestScore || compareCallableScores(score, bestScore) > 0) {
      best = resolved;
      bestScore = score;
    }
  }

  return best;
};
