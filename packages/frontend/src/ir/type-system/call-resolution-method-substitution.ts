import type { IrType } from "../types/index.js";
import { substituteIrType as irSubstitute } from "../types/ir-substitution.js";
import { isAssignableTo, typesEqual } from "./type-system-relations.js";
import {
  collectExpectedReturnCandidates,
  expandParameterTypesForInference,
  mapEntriesEqual,
} from "./call-resolution-utilities.js";
import { choosePreferredEquivalentInferenceType } from "./inference-type-preference.js";
import {
  emitDiagnostic,
  type CallQuery,
  type RawSignatureInfo,
  type ResolvedCall,
  type Site,
  type TypeSystemState,
} from "./type-system-state.js";
import { inferMethodTypeArgsFromArguments } from "./call-resolution-inference.js";

type WorkingPredicate = ResolvedCall["typePredicate"];

export type MethodTypeSubstitutionResult =
  | { readonly kind: "ok"; readonly substitution: ReadonlyMap<string, IrType> }
  | { readonly kind: "error" };

export const resolveMethodTypeSubstitution = (
  state: TypeSystemState,
  rawSig: RawSignatureInfo,
  query: Pick<
    CallQuery,
    "argTypes" | "explicitTypeArgs" | "expectedReturnType" | "receiverType"
  >,
  site: Site | undefined,
  workingParams: readonly (IrType | undefined)[],
  workingThisParam: IrType | undefined,
  workingReturn: IrType,
  _workingPredicate: WorkingPredicate
): MethodTypeSubstitutionResult => {
  const methodTypeParams = rawSig.typeParameters;
  const callSubst = new Map<string, IrType>();
  const typeRelations = {
    typesEqual,
    isAssignableTo: (source: IrType, target: IrType) =>
      isAssignableTo(state, source, target),
  } as const;
  const mergeSubstitutionType = (
    existing: IrType,
    next: IrType
  ): IrType | undefined =>
    choosePreferredEquivalentInferenceType(typeRelations, existing, next);

  if (query.explicitTypeArgs) {
    for (
      let index = 0;
      index < Math.min(query.explicitTypeArgs.length, methodTypeParams.length);
      index++
    ) {
      const parameter = methodTypeParams[index];
      const argument = query.explicitTypeArgs[index];
      if (parameter && argument) {
        callSubst.set(parameter.name, argument);
      }
    }
  }

  if (query.receiverType && workingThisParam) {
    const receiverParamForInference =
      callSubst.size > 0
        ? irSubstitute(workingThisParam, callSubst)
        : workingThisParam;

    const inferredFromReceiver = inferMethodTypeArgsFromArguments(
      state,
      methodTypeParams,
      [receiverParamForInference],
      [query.receiverType]
    );

    if (inferredFromReceiver) {
      for (const [name, inferredType] of inferredFromReceiver) {
        const existing = callSubst.get(name);
        if (existing) {
          const merged = mergeSubstitutionType(existing, inferredType);
          if (!merged) {
            emitDiagnostic(
              state,
              "TSN5202",
              `Conflicting type argument inference for '${name}' (receiver)`,
              site
            );
            return { kind: "error" };
          }
          callSubst.set(name, merged);
          continue;
        }
        callSubst.set(name, inferredType);
      }
    }
  }

  if (query.argTypes) {
    const paramsForInferenceBase =
      callSubst.size > 0
        ? workingParams.map((parameter) =>
            parameter ? irSubstitute(parameter, callSubst) : undefined
          )
        : workingParams;
    const paramsForInference = expandParameterTypesForInference(
      rawSig.parameterFlags,
      paramsForInferenceBase,
      query.argTypes.length
    );

    const inferred = inferMethodTypeArgsFromArguments(
      state,
      methodTypeParams,
      paramsForInference,
      query.argTypes
    );

    if (!inferred) {
      emitDiagnostic(
        state,
        "TSN5202",
        "Type arguments cannot be inferred deterministically from arguments",
        site
      );
      return { kind: "error" };
    }

    for (const [name, inferredType] of inferred) {
      const existing = callSubst.get(name);
      if (existing) {
        const merged = mergeSubstitutionType(existing, inferredType);
        if (!merged) {
          emitDiagnostic(
            state,
            "TSN5202",
            `Conflicting type argument inference for '${name}'`,
            site
          );
          return { kind: "error" };
        }
        callSubst.set(name, merged);
        continue;
      }
      callSubst.set(name, inferredType);
    }
  }

  if (query.expectedReturnType) {
    const expectedCandidates = collectExpectedReturnCandidates(
      state,
      query.expectedReturnType
    );
    let matched: Map<string, IrType> | undefined;

    for (const candidate of expectedCandidates) {
      const inferred = inferMethodTypeArgsFromArguments(
        state,
        methodTypeParams,
        [workingReturn],
        [candidate]
      );
      if (!inferred || inferred.size === 0) continue;

      let conflictsWithExisting = false;
      for (const [name, inferredType] of inferred) {
        const existing = callSubst.get(name);
        if (existing && !mergeSubstitutionType(existing, inferredType)) {
          conflictsWithExisting = true;
          break;
        }
      }
      if (conflictsWithExisting) continue;

      if (matched && !mapEntriesEqual(matched, inferred)) {
        matched = undefined;
        break;
      }
      matched = inferred;
    }

    if (matched) {
      for (const [name, inferredType] of matched) {
        const existing = callSubst.get(name);
        if (existing) {
          const merged = mergeSubstitutionType(existing, inferredType);
          if (!merged) {
            emitDiagnostic(
              state,
              "TSN5202",
              `Conflicting type argument inference for '${name}' (expected return context)`,
              site
            );
            return { kind: "error" };
          }
          callSubst.set(name, merged);
          continue;
        }
        callSubst.set(name, inferredType);
      }
    }
  }

  for (const typeParameter of methodTypeParams) {
    if (!callSubst.has(typeParameter.name) && typeParameter.defaultType) {
      callSubst.set(typeParameter.name, typeParameter.defaultType);
    }
  }

  return { kind: "ok", substitution: callSubst };
};
