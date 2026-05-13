import type { IrType } from "../types/index.js";
import type { SignatureId } from "./types.js";
import type {
  CallQuery,
  ResolvedCall,
  TypeSystemState,
} from "./type-system-state.js";
import { getRawSignature } from "./call-resolution-signatures.js";
import { resolveCall } from "./call-resolution-resolve.js";
import {
  refineParameterTypeForConcreteArgument,
  scoreSignatureMatch,
} from "./call-resolution-scoring.js";
import { isAssignableTo, typesEqual } from "./type-system-relations.js";
import {
  containsMethodTypeParameter,
  delegateToFunctionType,
  expandParameterTypesForArguments,
} from "./call-resolution-utilities.js";
import {
  normalizeToNominal,
  stripTsonicExtensionWrappers,
  emitDiagnostic,
} from "./type-system-state-helpers.js";
import {
  getIterableShape,
  getKnownIterableCarrierMode,
} from "./iterable-type-shapes.js";

type CandidateSelection = {
  readonly sigId: SignatureId | undefined;
  readonly resolved: ResolvedCall | undefined;
};

type CandidateDiagnostics = readonly TypeSystemState["diagnostics"][number][];

type ScoredCandidate = {
  readonly sigId: SignatureId;
  readonly evaluation: {
    readonly resolved: ResolvedCall;
    readonly diagnostics: CandidateDiagnostics;
  };
  readonly score: CandidateScore;
};

type CandidateScore = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

const scoreReceiverCompatibility = (
  state: TypeSystemState,
  resolved: ResolvedCall,
  receiverType: IrType | undefined
): number => {
  if (!receiverType || !resolved.thisParameterType) {
    return 0;
  }

  const effectiveReceiverType = stripTsonicExtensionWrappers(receiverType);
  const expectedReceiverType = resolved.thisParameterType;
  const normalizedActual = normalizeToNominal(state, effectiveReceiverType);
  const normalizedExpected = normalizeToNominal(state, expectedReceiverType);

  if (
    normalizedActual &&
    normalizedExpected &&
    normalizedActual.typeId.stableId === normalizedExpected.typeId.stableId
  ) {
    return 3;
  }

  if (
    typesEqual(effectiveReceiverType, expectedReceiverType) ||
    (isAssignableTo(state, effectiveReceiverType, expectedReceiverType) &&
      isAssignableTo(state, expectedReceiverType, effectiveReceiverType))
  ) {
    return 2;
  }

  if (isAssignableTo(state, effectiveReceiverType, expectedReceiverType)) {
    return 1;
  }

  return -1;
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
                    parameterTotal +
                    scoreSurfaceTypeSpecificity(parameter.type),
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

const scoreSurfaceParameterSpecificity = (
  resolved: ResolvedCall,
  argumentCount: number
): number =>
  resolved.surfaceParameterTypes
    .slice(0, argumentCount)
    .reduce(
      (total, parameterType) =>
        total + scoreSurfaceTypeSpecificity(parameterType),
      0
    );

const scoreParameterSpecificity = (
  parameterType: IrType | undefined,
  methodTypeParameterNames: ReadonlySet<string>
): number => {
  if (!parameterType) {
    return 0;
  }

  switch (parameterType.kind) {
    case "unknownType":
    case "anyType":
      return 0;
    case "typeParameterType":
      return methodTypeParameterNames.has(parameterType.name) ? 0 : 2;
    case "unionType": {
      if (parameterType.types.length === 0) {
        return 0;
      }

      return 1;
    }
    case "intersectionType":
      return (
        3 +
        parameterType.types.reduce(
          (total, member) =>
            total + scoreParameterSpecificity(member, methodTypeParameterNames),
          0
        )
      );
    case "arrayType":
      return (
        3 +
        scoreParameterSpecificity(
          parameterType.elementType,
          methodTypeParameterNames
        )
      );
    case "tupleType":
      return (
        3 +
        parameterType.elementTypes.reduce(
          (total, member) =>
            total + scoreParameterSpecificity(member, methodTypeParameterNames),
          0
        )
      );
    case "functionType":
      return (
        3 +
        parameterType.parameters.reduce(
          (total, parameter) =>
            total +
            scoreParameterSpecificity(
              parameter?.type,
              methodTypeParameterNames
            ),
          0
        ) +
        scoreParameterSpecificity(
          parameterType.returnType,
          methodTypeParameterNames
        )
      );
    case "referenceType":
      return (
        3 +
        (parameterType.typeArguments?.reduce(
          (total, typeArgument) =>
            total +
            scoreParameterSpecificity(typeArgument, methodTypeParameterNames),
          0
        ) ?? 0)
      );
    case "objectType":
      return (
        3 +
        parameterType.members.reduce(
          (total, member) =>
            total +
            (member.kind === "propertySignature"
              ? scoreParameterSpecificity(member.type, methodTypeParameterNames)
              : member.parameters.reduce(
                  (parameterTotal, parameter) =>
                    parameterTotal +
                    scoreParameterSpecificity(
                      parameter.type,
                      methodTypeParameterNames
                    ),
                  scoreParameterSpecificity(
                    member.returnType,
                    methodTypeParameterNames
                  )
                )),
          0
        )
      );
    case "dictionaryType":
      return (
        3 +
        scoreParameterSpecificity(
          parameterType.keyType,
          methodTypeParameterNames
        ) +
        scoreParameterSpecificity(
          parameterType.valueType,
          methodTypeParameterNames
        )
      );
    case "literalType":
    case "primitiveType":
    case "voidType":
    case "neverType":
      return 3;
    default:
      return containsMethodTypeParameter(
        parameterType,
        methodTypeParameterNames
      )
        ? 1
        : 2;
  }
};

const scoreSignatureSpecificity = (
  state: TypeSystemState,
  sigId: SignatureId,
  argumentCount: number
): number => {
  const rawSignature = getRawSignature(state, sigId);
  if (!rawSignature) {
    return 0;
  }

  const methodTypeParameterNames = new Set(
    rawSignature.typeParameters.map((parameter) => parameter.name)
  );
  const expandedParameterTypes = expandParameterTypesForArguments(
    rawSignature.parameterFlags,
    rawSignature.parameterTypes,
    argumentCount
  );

  return expandedParameterTypes
    .slice(0, argumentCount)
    .reduce(
      (total, parameterType) =>
        total +
        scoreParameterSpecificity(parameterType, methodTypeParameterNames),
      0
    );
};

const scoreConcreteSurfaceExactness = (
  state: TypeSystemState,
  sigId: SignatureId,
  argTypes: readonly (IrType | undefined)[] | undefined,
  argumentCount: number
): number => {
  if (!argTypes || argTypes.length === 0) {
    return 0;
  }

  const rawSignature = getRawSignature(state, sigId);
  if (!rawSignature) {
    return 0;
  }

  const methodTypeParameterNames = new Set(
    rawSignature.typeParameters.map((parameter) => parameter.name)
  );
  const expandedParameterTypes = expandParameterTypesForArguments(
    rawSignature.parameterFlags,
    rawSignature.parameterTypes,
    argumentCount
  );

  let exactness = 0;
  const pairCount = Math.min(
    argumentCount,
    expandedParameterTypes.length,
    argTypes.length
  );

  for (let index = 0; index < pairCount; index += 1) {
    const rawParameterType = expandedParameterTypes[index];
    const argumentType = argTypes[index];
    if (!rawParameterType || !argumentType) {
      continue;
    }
    const compatibleParameterType =
      refineParameterTypeForConcreteArgument(
        state,
        rawParameterType,
        argumentType
      ) ?? rawParameterType;

    if (
      containsMethodTypeParameter(
        compatibleParameterType,
        methodTypeParameterNames
      )
    ) {
      continue;
    }

    if (typesEqual(compatibleParameterType, argumentType)) {
      exactness += 1;
      continue;
    }

    if (
      isAssignableTo(state, argumentType, compatibleParameterType) &&
      isAssignableTo(state, compatibleParameterType, argumentType)
    ) {
      exactness += 1;
    }
  }

  return exactness;
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

const countIterableCarrierCompatibleArguments = (
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

    const parameterMode = getKnownIterableCarrierMode(state, parameterType);
    if (!parameterMode) {
      continue;
    }

    const argumentShape = getIterableShape(state, argumentType);
    if (argumentShape?.mode === parameterMode) {
      compatible += 1;
    }
  }

  return compatible;
};

const countExactFunctionArityMatches = (
  state: TypeSystemState,
  resolved: ResolvedCall,
  argTypes: readonly (IrType | undefined)[],
  argumentCount: number
): number => {
  let exactMatches = 0;
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

    const parameterFunctionType =
      parameterType.kind === "functionType"
        ? parameterType
        : delegateToFunctionType(state, parameterType);
    const argumentFunctionType =
      argumentType.kind === "functionType"
        ? argumentType
        : delegateToFunctionType(state, argumentType);
    if (!parameterFunctionType || !argumentFunctionType) {
      continue;
    }

    if (
      parameterFunctionType.parameters.length ===
      argumentFunctionType.parameters.length
    ) {
      exactMatches += 1;
    }
  }

  return exactMatches;
};

const buildCandidateScore = (
  state: TypeSystemState,
  sigId: SignatureId,
  resolved: ResolvedCall,
  receiverType: IrType | undefined,
  argTypes: readonly (IrType | undefined)[] | undefined,
  argumentCount: number
): CandidateScore => {
  const receiverCompatibilityScore = scoreReceiverCompatibility(
    state,
    resolved,
    receiverType
  );
  const participatingParameterTypes = resolved.parameterTypes.slice(
    0,
    argumentCount
  );
  const participatingArgTypes = argTypes?.slice(0, argumentCount);
  const compatibilityScore = argTypes
    ? scoreSignatureMatch(
        state,
        participatingParameterTypes,
        participatingArgTypes ?? [],
        argumentCount
      )
    : 0;
  const compatibleArgumentCount = argTypes
    ? countCompatibleArguments(
        state,
        {
          ...resolved,
          parameterTypes: participatingParameterTypes,
        },
        participatingArgTypes ?? [],
        argumentCount
      )
    : 0;
  const broadNumberIndependentCompatibleArgumentCount = argTypes
    ? countBroadNumberIndependentCompatibleArguments(
        state,
        {
          ...resolved,
          parameterTypes: participatingParameterTypes,
        },
        participatingArgTypes ?? [],
        argumentCount
      )
    : 0;
  const broadNumberExplicitlyAcceptedArgumentCount = argTypes
    ? countBroadNumberExplicitlyAcceptedArguments(
        {
          ...resolved,
          parameterTypes: participatingParameterTypes,
        },
        participatingArgTypes ?? [],
        argumentCount
      )
    : 0;
  const iterableCarrierCompatibleArgumentCount = argTypes
    ? countIterableCarrierCompatibleArguments(
        state,
        {
          ...resolved,
          parameterTypes: participatingParameterTypes,
        },
        participatingArgTypes ?? [],
        argumentCount
      )
    : 0;
  const exactFunctionArityMatches = argTypes
    ? countExactFunctionArityMatches(
        state,
        {
          ...resolved,
          parameterTypes: participatingParameterTypes,
        },
        participatingArgTypes ?? [],
        argumentCount
      )
    : 0;
  const concreteSurfaceExactness = scoreConcreteSurfaceExactness(
    state,
    sigId,
    argTypes,
    argumentCount
  );
  const specificityScore = scoreSignatureSpecificity(
    state,
    sigId,
    argumentCount
  );
  const surfaceSpecificityScore = scoreSurfaceParameterSpecificity(
    resolved,
    argumentCount
  );
  const exactArityNonRest =
    resolved.selectionMeta &&
    !resolved.selectionMeta.hasRestParameter &&
    resolved.selectionMeta.parameterCount === argumentCount
      ? 1
      : 0;
  const nonRest =
    resolved.selectionMeta && !resolved.selectionMeta.hasRestParameter ? 1 : 0;

  return [
    receiverCompatibilityScore,
    broadNumberIndependentCompatibleArgumentCount,
    broadNumberExplicitlyAcceptedArgumentCount,
    iterableCarrierCompatibleArgumentCount,
    compatibleArgumentCount,
    exactFunctionArityMatches,
    exactArityNonRest,
    concreteSurfaceExactness,
    surfaceSpecificityScore,
    specificityScore,
    compatibilityScore,
    nonRest,
  ];
};

const compareCandidateScores = (
  left: CandidateScore,
  right: CandidateScore
): number => {
  for (let index = 0; index < left.length; index += 1) {
    const leftScore = left[index] ?? 0;
    const rightScore = right[index] ?? 0;
    const delta = leftScore - rightScore;
    if (delta !== 0) {
      return delta;
    }
  }

  return 0;
};

const resolveCandidateWithoutLeakingDiagnostics = (
  state: TypeSystemState,
  query: CallQuery
): {
  readonly resolved: ResolvedCall;
  readonly diagnostics: readonly (typeof state.diagnostics)[number][];
} => {
  const diagnosticStart = state.diagnostics.length;
  const resolved = resolveCall(state, query);
  const diagnostics = state.diagnostics.slice(diagnosticStart);
  state.diagnostics.length = diagnosticStart;
  return { resolved, diagnostics };
};

export const selectBestCallCandidate = (
  state: TypeSystemState,
  fallbackSigId: SignatureId | undefined,
  candidateSigIds: readonly SignatureId[] | undefined,
  query: Omit<CallQuery, "sigId">
): CandidateSelection => {
  const uniqueCandidates = new Map<number, SignatureId>();
  if (fallbackSigId) {
    uniqueCandidates.set(fallbackSigId.id, fallbackSigId);
  }
  for (const candidate of candidateSigIds ?? []) {
    uniqueCandidates.set(candidate.id, candidate);
  }

  const orderedCandidates = Array.from(uniqueCandidates.values());
  if (orderedCandidates.length === 0) {
    return {
      sigId: undefined,
      resolved: undefined,
    };
  }

  const definedArgTypes =
    query.argTypes?.filter((type): type is IrType => type !== undefined) ?? [];
  if (definedArgTypes.length === 0) {
    if (!fallbackSigId && orderedCandidates.length > 1) {
      emitDiagnostic(
        state,
        "TSN5202",
        "Cannot select overload without argument type facts; call is ambiguous",
        query.site
      );
      return {
        sigId: undefined,
        resolved: undefined,
      };
    }

    const chosenSigId = fallbackSigId ?? orderedCandidates[0];
    if (!chosenSigId) {
      return {
        sigId: undefined,
        resolved: undefined,
      };
    }
    const { resolved, diagnostics } = resolveCandidateWithoutLeakingDiagnostics(
      state,
      { ...query, sigId: chosenSigId }
    );
    state.diagnostics.push(...diagnostics);
    return {
      sigId: chosenSigId,
      resolved,
    };
  }

  const scoredCandidates: ScoredCandidate[] = orderedCandidates.flatMap(
    (candidate): ScoredCandidate[] => {
      const evaluation = resolveCandidateWithoutLeakingDiagnostics(state, {
        ...query,
        sigId: candidate,
      });
      const score = buildCandidateScore(
        state,
        candidate,
        evaluation.resolved,
        query.receiverType,
        query.argTypes,
        query.argumentCount
      );

      return [
        {
          sigId: candidate,
          evaluation,
          score,
        },
      ];
    }
  );

  if (scoredCandidates.length === 0) {
    return {
      sigId: undefined,
      resolved: undefined,
    };
  }

  const compatibleReceiverCandidates = scoredCandidates.filter(
    (candidate) => candidate.score[0] >= 0
  );
  const effectiveCandidates =
    compatibleReceiverCandidates.length > 0
      ? compatibleReceiverCandidates
      : scoredCandidates;

  let bestCandidate = effectiveCandidates[0];
  if (!bestCandidate) {
    return {
      sigId: undefined,
      resolved: undefined,
    };
  }

  for (const candidate of effectiveCandidates) {
    if (candidate.sigId.id === bestCandidate.sigId.id) {
      continue;
    }

    if (compareCandidateScores(candidate.score, bestCandidate.score) > 0) {
      bestCandidate = candidate;
    }
  }

  state.diagnostics.push(...bestCandidate.evaluation.diagnostics);
  return {
    sigId: bestCandidate.sigId,
    resolved: bestCandidate.evaluation.resolved,
  };
};
