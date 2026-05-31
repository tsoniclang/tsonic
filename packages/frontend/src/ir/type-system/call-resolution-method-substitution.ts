import type { IrType } from "../types/index.js";
import { substituteIrType as irSubstitute } from "../types/ir-substitution.js";
import { isAssignableTo, typesEqual } from "./type-system-relations.js";
import {
  containsMethodTypeParameter,
  collectExpectedReturnCandidates,
  expandParameterTypesForInference,
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
  const containsMethodTypeParameterInInputSurface = (
    type: IrType | undefined,
    unresolved: ReadonlySet<string>,
    seen: WeakSet<object> = new WeakSet<object>()
  ): boolean => {
    if (!type) {
      return false;
    }

    if (seen.has(type)) {
      return false;
    }
    seen.add(type);

    switch (type.kind) {
      case "typeParameterType":
        return unresolved.has(type.name);
      case "referenceType":
        return (
          (type.typeArguments ?? []).some((typeArgument) =>
            containsMethodTypeParameterInInputSurface(
              typeArgument,
              unresolved,
              seen
            )
          ) ||
          (type.structuralMembers ?? []).some((member) =>
            member.kind === "propertySignature"
              ? containsMethodTypeParameterInInputSurface(
                  member.type,
                  unresolved,
                  seen
                )
              : member.parameters.some((parameter) =>
                  containsMethodTypeParameterInInputSurface(
                    parameter.type,
                    unresolved,
                    seen
                  )
                )
          )
        );
      case "arrayType":
        return containsMethodTypeParameterInInputSurface(
          type.elementType,
          unresolved,
          seen
        );
      case "tupleType":
        return type.elementTypes.some((typeArgument) =>
          containsMethodTypeParameterInInputSurface(
            typeArgument,
            unresolved,
            seen
          )
        );
      case "dictionaryType":
        return (
          containsMethodTypeParameterInInputSurface(
            type.keyType,
            unresolved,
            seen
          ) ||
          containsMethodTypeParameterInInputSurface(
            type.valueType,
            unresolved,
            seen
          )
        );
      case "functionType":
        return type.parameters.some((parameter) =>
          containsMethodTypeParameterInInputSurface(
            parameter.type,
            unresolved,
            seen
          )
        );
      case "objectType":
        return type.members.some((member) =>
          member.kind === "propertySignature"
            ? containsMethodTypeParameterInInputSurface(
                member.type,
                unresolved,
                seen
              )
            : member.parameters.some((parameter) =>
                containsMethodTypeParameterInInputSurface(
                  parameter.type,
                  unresolved,
                  seen
                )
              )
        );
      case "unionType":
      case "intersectionType":
        return type.types.some((typeArgument) =>
          containsMethodTypeParameterInInputSurface(
            typeArgument,
            unresolved,
            seen
          )
        );
      default:
        return false;
    }
  };
  const typeRelations = {
    typesEqual,
    isAssignableTo: (source: IrType, target: IrType) =>
      isAssignableTo(state, source, target),
  } as const;
  const parameterSurfaceTypeParameterNames = new Set(
    methodTypeParams
      .map((typeParameter) => typeParameter.name)
      .filter((name) => {
        const names = new Set([name]);
        return (
          (workingThisParam
            ? containsMethodTypeParameter(workingThisParam, names)
            : false) ||
          workingParams.some((parameterType) =>
            parameterType
              ? containsMethodTypeParameterInInputSurface(parameterType, names)
              : false
          )
        );
      })
  );
  const mergeSubstitutionType = (
    existing: IrType,
    next: IrType
  ): IrType | undefined =>
    choosePreferredEquivalentInferenceType(typeRelations, existing, next);
  const allowExpectedReturnInferenceForParameterSurface =
    rawSig.declaringMemberName === "constructor" || query.argTypes === undefined;
  const selectExpectedReturnSubstitution = ():
    | Map<string, IrType>
    | undefined => {
    if (!query.expectedReturnType) {
      return undefined;
    }

    const expectedCandidates = collectExpectedReturnCandidates(
      state,
      query.expectedReturnType
    );
    const mergeInferenceMap = (
      base: ReadonlyMap<string, IrType>,
      next: ReadonlyMap<string, IrType>
    ): Map<string, IrType> | undefined => {
      const merged = new Map(base);
      for (const [name, inferredType] of next) {
        const existing = merged.get(name);
        if (!existing) {
          merged.set(name, inferredType);
          continue;
        }

        const mergedType = mergeSubstitutionType(existing, inferredType);
        if (!mergedType) {
          return undefined;
        }
        merged.set(name, mergedType);
      }
      return merged;
    };

    const groups: Map<string, IrType>[] = [];

    for (const candidate of expectedCandidates) {
      const inferred = inferMethodTypeArgsFromArguments(
        state,
        methodTypeParams,
        [workingReturn],
        [candidate]
      );
      if (!inferred || inferred.size === 0) continue;

      const unresolvedInferred = new Map<string, IrType>();
      for (const [name, inferredType] of inferred) {
        if (
          !callSubst.has(name) &&
          (allowExpectedReturnInferenceForParameterSurface ||
            !parameterSurfaceTypeParameterNames.has(name))
        ) {
          unresolvedInferred.set(name, inferredType);
        }
      }
      if (unresolvedInferred.size === 0) continue;

      let mergedIntoGroup = false;
      for (let index = 0; index < groups.length; index += 1) {
        const group = groups[index];
        if (!group) continue;
        const merged = mergeInferenceMap(group, unresolvedInferred);
        if (!merged) continue;
        groups[index] = merged;
        mergedIntoGroup = true;
        break;
      }

      if (!mergedIntoGroup) {
        groups.push(unresolvedInferred);
      }
    }

    if (groups.length !== 1) {
      return undefined;
    }
    return groups[0];
  };
  const mergeSubstitution = (
    inferred: ReadonlyMap<string, IrType>,
    contextLabel: string
  ): MethodTypeSubstitutionResult | undefined => {
    for (const [name, inferredType] of inferred) {
      const existing = callSubst.get(name);
      if (existing) {
        const merged = mergeSubstitutionType(existing, inferredType);
        if (!merged) {
          emitDiagnostic(
            state,
            "TSN5202",
            `Conflicting type argument inference for '${name}'${contextLabel}`,
            site
          );
          return { kind: "error" };
        }
        callSubst.set(name, merged);
        continue;
      }
      callSubst.set(name, inferredType);
    }

    return undefined;
  };

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

  if (rawSig.declaringMemberName === "constructor") {
    const matched = selectExpectedReturnSubstitution();
    if (matched) {
      const mergeError = mergeSubstitution(
        matched,
        " (expected constructor return context)"
      );
      if (mergeError) return mergeError;
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
      const mergeError = mergeSubstitution(new Map([[name, inferredType]]), "");
      if (mergeError) return mergeError;
    }
  }

  const matched = selectExpectedReturnSubstitution();
  if (matched) {
    const mergeError = mergeSubstitution(matched, " (expected return context)");
    if (mergeError) return mergeError;
  }

  for (const typeParameter of methodTypeParams) {
    if (!callSubst.has(typeParameter.name) && typeParameter.defaultType) {
      callSubst.set(typeParameter.name, typeParameter.defaultType);
    }
  }

  return { kind: "ok", substitution: callSubst };
};
