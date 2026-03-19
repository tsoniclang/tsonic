/**
 * Call Resolution Inference — Generic type argument inference and overload scoring
 *
 * Contains deterministic type argument inference from call-site arguments,
 * overload arity checking, signature scoring, and parameter type refinement
 * for concrete arguments.
 *
 * DAG position: depends on type-system-state, type-system-relations, call-resolution-utilities
 */

import type { IrType, IrReferenceType } from "../types/index.js";
import { unwrapAsyncWrapperType } from "../types/type-ops.js";
import type { TypeParameterInfo } from "./types.js";
import type { MethodSignatureEntry } from "./internal/universe/types.js";
import type { TypeSystemState } from "./type-system-state.js";
import { normalizeToNominal, isNullishPrimitive } from "./type-system-state.js";
import { isAssignableTo, typesEqual } from "./type-system-relations.js";
import {
  mapEntriesEqual,
  expandParameterTypesForArguments,
  delegateToFunctionType,
} from "./call-resolution-utilities.js";

// ─────────────────────────────────────────────────────────────────────────
// inferMethodTypeArgsFromArguments — Generic method type argument inference
// ─────────────────────────────────────────────────────────────────────────

/**
 * Deterministic type argument inference from call-site arguments.
 *
 * Walks parameter and argument shapes without ambiguity.
 */
export const inferMethodTypeArgsFromArguments = (
  state: TypeSystemState,
  methodTypeParams: readonly TypeParameterInfo[],
  parameterTypes: readonly (IrType | undefined)[],
  argTypes: readonly (IrType | undefined)[]
): Map<string, IrType> | undefined => {
  if (methodTypeParams.length === 0) return new Map();

  const methodTypeParamNames = new Set(methodTypeParams.map((p) => p.name));
  const substitution = new Map<string, IrType>();

  const tryUnify = (
    parameterType: IrType,
    argumentType: IrType,
    currentSubstitution: Map<string, IrType>
  ): boolean => {
    // Method type parameter position: infer directly
    if (parameterType.kind === "typeParameterType") {
      if (!methodTypeParamNames.has(parameterType.name)) {
        // Not a method type parameter (could be outer generic) — ignore
        return true;
      }

      const existing = currentSubstitution.get(parameterType.name);
      if (existing) {
        // A self-mapping like `B -> B` can be produced when a lambda argument was typed
        // contextually from the unresolved expected signature. This provides no real
        // inference signal and must not block later concrete inference.
        if (
          existing.kind === "typeParameterType" &&
          existing.name === parameterType.name
        ) {
          currentSubstitution.set(parameterType.name, argumentType);
          return true;
        }

        return typesEqual(existing, argumentType);
      }

      currentSubstitution.set(parameterType.name, argumentType);
      return true;
    }

    // Poison/any provides no deterministic information
    if (
      argumentType.kind === "unknownType" ||
      argumentType.kind === "anyType"
    ) {
      return true;
    }

    // Intersection argument types: unify through each constituent.
    //
    // This is required for airplane-grade extension method typing where the receiver
    // often has the form `TShape & <extension markers> & <method table>`.
    // Generic inference must still be able to infer through the real CLR shape in the intersection.
    if (argumentType.kind === "intersectionType") {
      for (const part of argumentType.types) {
        if (!part) continue;
        if (!tryUnify(parameterType, part, currentSubstitution)) return false;
      }
      return true;
    }

    // Expression<TDelegate> wrapper: infer through the underlying delegate shape.
    // This is required for Queryable APIs that use Expression<Func<...>>.
    if (
      parameterType.kind === "referenceType" &&
      parameterType.name === "Expression_1" &&
      (parameterType.typeArguments?.length ?? 0) === 1
    ) {
      const inner = parameterType.typeArguments?.[0];
      return inner ? tryUnify(inner, argumentType, currentSubstitution) : true;
    }

    // PromiseLike<T> / Promise<T> parameter positions should infer through the
    // awaited inner result when the argument is an async wrapper.
    //
    // This is required for JS-surface APIs like:
    //   Promise.all<T>(values: readonly (T | PromiseLike<T>)[]): Promise<T[]>
    // where an argument element of type Promise<number> must infer T = number,
    // not T = Promise<number>.
    if (parameterType.kind === "referenceType") {
      const simpleName =
        parameterType.name.split(".").pop() ?? parameterType.name;
      if (
        (simpleName === "PromiseLike" || simpleName === "Promise") &&
        (parameterType.typeArguments?.length ?? 0) === 1
      ) {
        const awaitedArgument = unwrapAsyncWrapperType(argumentType);
        const awaitedParameter = parameterType.typeArguments?.[0];
        if (awaitedArgument && awaitedParameter) {
          return tryUnify(
            awaitedParameter,
            awaitedArgument,
            currentSubstitution
          );
        }
      }
    }

    // Delegate unification: allow deterministic inference through the delegate's
    // Invoke signature when a lambda (functionType) is passed to a CLR delegate
    // parameter (Func/Action/custom delegates).
    //
    // Without this, generic methods like:
    //   Select<TResult>(selector: Func<TSource, TResult>)
    // cannot infer TResult from a lambda argument, causing TSN5201/TSN5202.
    if (
      parameterType.kind === "referenceType" &&
      argumentType.kind === "functionType"
    ) {
      const delegateFn = delegateToFunctionType(state, parameterType);
      if (delegateFn)
        return tryUnify(delegateFn, argumentType, currentSubstitution);
    }
    if (
      parameterType.kind === "functionType" &&
      argumentType.kind === "referenceType"
    ) {
      const delegateFn = delegateToFunctionType(state, argumentType);
      if (delegateFn)
        return tryUnify(parameterType, delegateFn, currentSubstitution);
    }

    // Array<T> ↔ T[] unification
    if (
      parameterType.kind === "referenceType" &&
      parameterType.name === "Array" &&
      (parameterType.typeArguments?.length ?? 0) === 1 &&
      argumentType.kind === "arrayType"
    ) {
      const elementParam = parameterType.typeArguments?.[0];
      return elementParam
        ? tryUnify(elementParam, argumentType.elementType, currentSubstitution)
        : true;
    }

    // Union parameter type: allow deterministic inference through common nullish unions.
    // Example: constructor(value: T | null) with argument of type T.
    if (parameterType.kind === "unionType") {
      const nonNullish = parameterType.types.filter(
        (t) => t && !isNullishPrimitive(t)
      );
      const nullish = parameterType.types.filter(
        (t) => t && isNullishPrimitive(t)
      );

      const candidates = isNullishPrimitive(argumentType)
        ? nullish
        : nonNullish;

      const awaitedArgument = unwrapAsyncWrapperType(argumentType);
      if (awaitedArgument) {
        const snapshot = new Map(currentSubstitution);
        const awaitedMatches: Map<string, IrType>[] = [];

        for (const candidate of candidates) {
          if (!candidate || candidate.kind !== "referenceType") continue;
          const simpleName = candidate.name.split(".").pop() ?? candidate.name;
          if (simpleName !== "PromiseLike" && simpleName !== "Promise") {
            continue;
          }

          const awaitedParameter = candidate.typeArguments?.[0];
          if (!awaitedParameter) continue;

          const trial = new Map(snapshot);
          if (!tryUnify(awaitedParameter, awaitedArgument, trial)) continue;
          if (mapEntriesEqual(snapshot, trial)) continue;
          awaitedMatches.push(trial);
        }

        const firstAwaitedMatch = awaitedMatches[0];
        if (awaitedMatches.length === 1 && firstAwaitedMatch) {
          currentSubstitution.clear();
          for (const [key, value] of firstAwaitedMatch) {
            currentSubstitution.set(key, value);
          }
          return true;
        }

        if (
          firstAwaitedMatch &&
          awaitedMatches.length > 1 &&
          awaitedMatches.every((m) => mapEntriesEqual(firstAwaitedMatch, m))
        ) {
          currentSubstitution.clear();
          for (const [key, value] of firstAwaitedMatch) {
            currentSubstitution.set(key, value);
          }
          return true;
        }
      }

      if (candidates.length === 1) {
        const only = candidates[0];
        return only ? tryUnify(only, argumentType, currentSubstitution) : true;
      }

      const snapshot = new Map(currentSubstitution);
      const informativeMatches: Map<string, IrType>[] = [];

      for (const candidate of candidates) {
        if (!candidate) continue;
        const trial = new Map(snapshot);
        if (!tryUnify(candidate, argumentType, trial)) continue;
        if (mapEntriesEqual(snapshot, trial)) continue;
        informativeMatches.push(trial);
      }

      const firstInformativeMatch = informativeMatches[0];
      if (informativeMatches.length === 1 && firstInformativeMatch) {
        const only = firstInformativeMatch;
        currentSubstitution.clear();
        for (const [key, value] of only) {
          currentSubstitution.set(key, value);
        }
        return true;
      }

      if (
        firstInformativeMatch &&
        informativeMatches.length > 1 &&
        informativeMatches.every((m) =>
          mapEntriesEqual(firstInformativeMatch, m)
        )
      ) {
        currentSubstitution.clear();
        for (const [key, value] of firstInformativeMatch) {
          currentSubstitution.set(key, value);
        }
        return true;
      }

      // Conservative: ambiguous unions provide no deterministic signal.
      return true;
    }

    if (
      parameterType.kind === "arrayType" &&
      argumentType.kind === "referenceType" &&
      argumentType.name === "Array" &&
      (argumentType.typeArguments?.length ?? 0) === 1
    ) {
      const elementArg = argumentType.typeArguments?.[0];
      return elementArg
        ? tryUnify(parameterType.elementType, elementArg, currentSubstitution)
        : true;
    }

    // Same-kind structural unification
    if (parameterType.kind !== argumentType.kind) {
      // Type mismatch provides no deterministic inference signal.
      return true;
    }

    switch (parameterType.kind) {
      case "primitiveType":
        return true;

      case "literalType":
        return true;

      case "referenceType": {
        const argRef = argumentType as IrReferenceType;

        const sameNominal = (() => {
          if (parameterType.typeId && argRef.typeId) {
            return parameterType.typeId.stableId === argRef.typeId.stableId;
          }
          return parameterType.name === argRef.name;
        })();

        // Direct generic unification when the nominals match
        if (sameNominal) {
          const paramArgs = parameterType.typeArguments ?? [];
          const argArgs = argRef.typeArguments ?? [];
          if (paramArgs.length !== argArgs.length) return true;

          for (let i = 0; i < paramArgs.length; i++) {
            const pa = paramArgs[i];
            const aa = argArgs[i];
            if (!pa || !aa) continue;
            if (!tryUnify(pa, aa, currentSubstitution)) return false;
          }
          return true;
        }

        // Inheritance/interface unification: allow argumentType to flow through
        // its inheritance chain to the parameter type (e.g., List<T> → IEnumerable<T>).
        const paramNominal = normalizeToNominal(state, parameterType);
        const argNominal = normalizeToNominal(state, argRef);
        if (paramNominal && argNominal) {
          const inst = state.nominalEnv.getInstantiation(
            argNominal.typeId,
            argNominal.typeArgs,
            paramNominal.typeId
          );

          if (inst) {
            const targetTypeParams = state.unifiedCatalog.getTypeParameters(
              paramNominal.typeId
            );
            const instantiatedArgs = targetTypeParams.map((tp) =>
              inst.get(tp.name)
            );

            const paramArgs = parameterType.typeArguments ?? [];
            if (
              instantiatedArgs.every((t) => t !== undefined) &&
              paramArgs.length === instantiatedArgs.length
            ) {
              for (let i = 0; i < paramArgs.length; i++) {
                const pa = paramArgs[i];
                const aa = instantiatedArgs[i];
                if (!pa || !aa) continue;
                if (!tryUnify(pa, aa, currentSubstitution)) return false;
              }
            }
          }
        }

        return true;
      }

      case "arrayType":
        return tryUnify(
          parameterType.elementType,
          (argumentType as typeof parameterType).elementType,
          currentSubstitution
        );

      case "tupleType": {
        const argTuple = argumentType as typeof parameterType;
        if (
          parameterType.elementTypes.length !== argTuple.elementTypes.length
        ) {
          return true;
        }
        for (let i = 0; i < parameterType.elementTypes.length; i++) {
          const pe = parameterType.elementTypes[i];
          const ae = argTuple.elementTypes[i];
          if (!pe || !ae) continue;
          if (!tryUnify(pe, ae, currentSubstitution)) return false;
        }
        return true;
      }

      case "functionType": {
        const argFn = argumentType as typeof parameterType;
        if (parameterType.parameters.length !== argFn.parameters.length) {
          return true;
        }

        for (let i = 0; i < parameterType.parameters.length; i++) {
          const pp = parameterType.parameters[i];
          const ap = argFn.parameters[i];
          const pt = pp?.type;
          const at = ap?.type;
          if (pt && at) {
            if (!tryUnify(pt, at, currentSubstitution)) return false;
          }
        }

        return tryUnify(
          parameterType.returnType,
          argFn.returnType,
          currentSubstitution
        );
      }

      case "objectType":
      case "dictionaryType":
        // Conservative: only infer through these when shapes already match exactly.
        return true;

      case "voidType":
      case "neverType":
        return true;

      default:
        return true;
    }
  };

  const pairs = Math.min(parameterTypes.length, argTypes.length);
  for (let i = 0; i < pairs; i++) {
    const paramType = parameterTypes[i];
    const argType = argTypes[i];
    if (!paramType || !argType) continue;
    if (!tryUnify(paramType, argType, substitution)) return undefined;
  }

  return substitution;
};

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

    const functionLikeScore = scoreFunctionLikeCompatibility(pt, at);
    if (functionLikeScore !== 0) {
      score += functionLikeScore;
      continue;
    }

    score += scoreTypeCompatibility(pt, at);
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
