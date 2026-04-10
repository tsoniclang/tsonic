/**
 * Call Resolution Unification — Generic type argument inference from call-site arguments.
 *
 * Contains inferMethodTypeArgsFromArguments with the full tryUnify engine
 * for deterministic type argument inference.
 *
 * DAG position: depends on type-system-state, type-system-relations, call-resolution-utilities
 */

import type { IrType, IrReferenceType } from "../types/index.js";
import { unwrapAsyncWrapperType } from "../types/type-ops.js";
import { stableIrTypeKey } from "../types/type-ops.js";
import { unknownType } from "./types.js";
import type { TypeParameterInfo } from "./types.js";
import type { TypeSystemState } from "./type-system-state.js";
import { normalizeToNominal, isNullishPrimitive } from "./type-system-state.js";
import { isAssignableTo, typesEqual } from "./type-system-relations.js";
import { getIterableShape } from "./iterable-type-shapes.js";
import {
  mapEntriesEqual,
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
  const activeStructuralPairs = new Set<string>();

  const areDeterministicallyEquivalentInferenceTypes = (
    left: IrType,
    right: IrType
  ): boolean =>
    typesEqual(left, right) ||
    (isAssignableTo(state, left, right) && isAssignableTo(state, right, left));

  const isBroadObjectInferenceType = (type: IrType): boolean =>
    type.kind === "referenceType" &&
    (type.name === "object" ||
      type.name === "JsValue" ||
      type.resolvedClrType === "System.Object" ||
      type.resolvedClrType === "global::System.Object" ||
      type.resolvedClrType === "Tsonic.Runtime.JsValue" ||
      type.resolvedClrType === "global::Tsonic.Runtime.JsValue");

  const tryMergeInferenceTypes = (
    existing: IrType,
    next: IrType
  ): IrType | undefined => {
    const existingIsBroadObject = isBroadObjectInferenceType(existing);
    const nextIsBroadObject = isBroadObjectInferenceType(next);

    if (existingIsBroadObject || nextIsBroadObject) {
      return { kind: "referenceType", name: "object" };
    }

    return undefined;
  };

  const isExplicitUnknownType = (type: IrType): boolean =>
    type.kind === "unknownType" && type.explicit === true;

  const getAsyncWrapperInnerType = (type: IrType): IrType | undefined => {
    if (type.kind !== "referenceType") {
      return undefined;
    }

    const simpleName = type.name.split(".").pop() ?? type.name;
    if (simpleName !== "PromiseLike" && simpleName !== "Promise") {
      return undefined;
    }

    return type.typeArguments?.[0];
  };

  const getDeterministicAsyncUnionTypeParameter = (
    parameterType: Extract<IrType, { kind: "unionType" }>
  ): string | undefined => {
    let typeParameterName: string | undefined;
    let sawBareTypeParameter = false;
    let sawAsyncWrapper = false;

    for (const candidate of parameterType.types) {
      if (!candidate || isNullishPrimitive(candidate)) {
        continue;
      }

      if (
        candidate.kind === "typeParameterType" &&
        methodTypeParamNames.has(candidate.name)
      ) {
        if (
          typeParameterName !== undefined &&
          typeParameterName !== candidate.name
        ) {
          return undefined;
        }
        typeParameterName = candidate.name;
        sawBareTypeParameter = true;
        continue;
      }

      const inner = getAsyncWrapperInnerType(candidate);
      if (
        inner?.kind === "typeParameterType" &&
        methodTypeParamNames.has(inner.name)
      ) {
        if (typeParameterName !== undefined && typeParameterName !== inner.name) {
          return undefined;
        }
        typeParameterName = inner.name;
        sawAsyncWrapper = true;
        continue;
      }

      return undefined;
    }

    return typeParameterName && sawBareTypeParameter && sawAsyncWrapper
      ? typeParameterName
      : undefined;
  };

  const getDeterministicAsyncUnionArgumentValue = (
    argumentType: IrType
  ): IrType | undefined => {
    const awaited = unwrapAsyncWrapperType(argumentType);
    if (awaited) {
      return awaited;
    }

    if (argumentType.kind !== "unionType") {
      return undefined;
    }

    let syncMember: IrType | undefined;
    let sawAsyncWrapper = false;

    for (const candidate of argumentType.types) {
      if (!candidate || isNullishPrimitive(candidate)) {
        continue;
      }

      const inner = getAsyncWrapperInnerType(candidate);
      if (inner) {
        sawAsyncWrapper = true;
        if (syncMember && !areDeterministicallyEquivalentInferenceTypes(syncMember, inner)) {
          return undefined;
        }
        syncMember = syncMember ?? inner;
        continue;
      }

      if (
        syncMember &&
        !areDeterministicallyEquivalentInferenceTypes(syncMember, candidate)
      ) {
        return undefined;
      }
      syncMember = syncMember ?? candidate;
    }

    return sawAsyncWrapper ? syncMember : undefined;
  };

  const tryUnify = (
    parameterType: IrType,
    argumentType: IrType,
    currentSubstitution: Map<string, IrType>
  ): boolean => {
    const tryUnifyStructuralReferenceMembers = (
      parameterRef: IrReferenceType,
      argumentRef: IrReferenceType
    ): boolean => {
      const parameterMembers = parameterRef.structuralMembers ?? [];
      const argumentMembers = argumentRef.structuralMembers ?? [];
      if (parameterMembers.length === 0 || argumentMembers.length === 0) {
        return true;
      }

      const pairKey = `${stableIrTypeKey(parameterRef)}=>${stableIrTypeKey(argumentRef)}`;
      if (activeStructuralPairs.has(pairKey)) {
        return true;
      }

      activeStructuralPairs.add(pairKey);
      try {
        for (const parameterMember of parameterMembers) {
          if (parameterMember.kind === "propertySignature") {
            const matches = argumentMembers.filter(
              (
                candidate
              ): candidate is Extract<
                typeof candidate,
                { readonly kind: "propertySignature" }
              > =>
                candidate.kind === "propertySignature" &&
                candidate.name === parameterMember.name
            );
            if (matches.length !== 1) {
              return true;
            }

            const match = matches[0];
            if (
              !match ||
              !tryUnify(
                parameterMember.type,
                match.type,
                currentSubstitution
              )
            ) {
              return false;
            }
            continue;
          }

          if (parameterMember.kind === "methodSignature") {
            const matches = argumentMembers.filter(
              (
                candidate
              ): candidate is Extract<
                typeof candidate,
                { readonly kind: "methodSignature" }
              > =>
                candidate.kind === "methodSignature" &&
                candidate.name === parameterMember.name &&
                candidate.parameters.length === parameterMember.parameters.length
            );
            if (matches.length !== 1) {
              return true;
            }

            const match = matches[0];
            if (!match || match.kind !== "methodSignature") {
              return true;
            }

            for (
              let parameterIndex = 0;
              parameterIndex < parameterMember.parameters.length;
              parameterIndex += 1
            ) {
              const parameterParameter =
                parameterMember.parameters[parameterIndex];
              const argumentParameter = match.parameters[parameterIndex];
              const parameterParameterType = parameterParameter?.type;
              const argumentParameterType = argumentParameter?.type;
              if (!parameterParameterType || !argumentParameterType) {
                continue;
              }
              if (
                !tryUnify(
                  parameterParameterType,
                  argumentParameterType,
                  currentSubstitution
                )
              ) {
                return false;
              }
            }

            if (
              !tryUnify(
                parameterMember.returnType ?? unknownType,
                match.returnType ?? unknownType,
                currentSubstitution
              )
            ) {
              return false;
            }
          }
        }

        return true;
      } finally {
        activeStructuralPairs.delete(pairKey);
      }
    };

    // Method type parameter position: infer directly
    if (parameterType.kind === "typeParameterType") {
      if (!methodTypeParamNames.has(parameterType.name)) {
        // Not a method type parameter (could be outer generic) — ignore
        return true;
      }

      // A lambda argument typed contextually from an unresolved expected signature
      // can carry the same method type parameter symbol back into inference
      // (e.g. parameter `TSource`, argument parameter also typed as `TSource`).
      // This is not real evidence about the concrete type argument and must not
      // either create or conflict with a substitution.
      if (
        argumentType.kind === "typeParameterType" &&
        argumentType.name === parameterType.name
      ) {
        return true;
      }

      const existing = currentSubstitution.get(parameterType.name);
      if (existing) {
        if (
          argumentType.kind === "anyType" ||
          (argumentType.kind === "unknownType" &&
            !isExplicitUnknownType(argumentType))
        ) {
          return true;
        }

        if (isExplicitUnknownType(argumentType)) {
          currentSubstitution.set(parameterType.name, argumentType);
          return true;
        }

        if (existing.kind === "anyType") {
          return true;
        }

        if (existing.kind === "unknownType") {
          return true;
        }

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

        const merged = tryMergeInferenceTypes(existing, argumentType);
        if (merged) {
          currentSubstitution.set(parameterType.name, merged);
          return true;
        }

        return areDeterministicallyEquivalentInferenceTypes(
          existing,
          argumentType
        );
      }

      // `any` / `unknown` do not provide deterministic inference evidence.
      //
      // This is critical for deferred lambdas:
      //   Select(items, x => x * 2)
      // Pass 1 models the lambda as `(unknown) => unknown` only to preserve arity.
      // That placeholder must not overwrite concrete inference already obtained
      // from other arguments like `items: IEnumerable<int>`.
      if (argumentType.kind === "anyType") {
        return true;
      }

      if (argumentType.kind === "unknownType") {
        if (isExplicitUnknownType(argumentType)) {
          currentSubstitution.set(parameterType.name, argumentType);
        }
        return true;
      }

      currentSubstitution.set(parameterType.name, argumentType);
      return true;
    }

    // Poison/any provides no deterministic information outside direct type-parameter inference.
    if (
      argumentType.kind === "unknownType" ||
      argumentType.kind === "anyType"
    ) {
      return true;
    }

    if (argumentType.kind === "unionType") {
      const nonNullishArgumentMembers = argumentType.types.filter(
        (candidate): candidate is IrType =>
          candidate !== undefined && !isNullishPrimitive(candidate)
      );
      const nullishArgumentMembers = argumentType.types.filter(
        (candidate) => candidate !== undefined && isNullishPrimitive(candidate)
      );

      if (
        nonNullishArgumentMembers.length === 1 &&
        nullishArgumentMembers.length + nonNullishArgumentMembers.length ===
          argumentType.types.length
      ) {
        const onlyNonNullishMember = nonNullishArgumentMembers[0];
        if (onlyNonNullishMember) {
          return tryUnify(
            parameterType,
            onlyNonNullishMember,
            currentSubstitution
          );
        }
      }
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
      const asyncUnionTypeParameter =
        getDeterministicAsyncUnionTypeParameter(parameterType);
      const asyncUnionArgumentValue =
        asyncUnionTypeParameter !== undefined
          ? getDeterministicAsyncUnionArgumentValue(argumentType)
          : undefined;
      if (asyncUnionTypeParameter && asyncUnionArgumentValue) {
        return tryUnify(
          { kind: "typeParameterType", name: asyncUnionTypeParameter },
          asyncUnionArgumentValue,
          currentSubstitution
        );
      }

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

    const parameterIterable = getIterableShape(state, parameterType);
    const argumentIterable = getIterableShape(state, argumentType);
    if (
      parameterIterable &&
      argumentIterable &&
      parameterIterable.mode === argumentIterable.mode
    ) {
      return tryUnify(
        parameterIterable.elementType,
        argumentIterable.elementType,
        currentSubstitution
      );
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

        return tryUnifyStructuralReferenceMembers(parameterType, argRef);
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
        const pairCount = Math.min(
          parameterType.parameters.length,
          argFn.parameters.length
        );
        for (let i = 0; i < pairCount; i++) {
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
