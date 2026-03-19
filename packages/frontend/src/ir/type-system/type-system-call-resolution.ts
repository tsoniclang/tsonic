/**
 * TypeSystem Call Resolution — Facade
 *
 * Re-exports all call resolution sub-modules and contains the main `resolveCall` entry point.
 *
 * Sub-modules:
 * - call-resolution-utilities: Pure type helpers, type ID attachment, parameter expansion
 * - call-resolution-signatures: Signature extraction, structural lookup, delegate conversion,
 *   receiver substitution, unified-catalog overload resolution
 * - call-resolution-inference: Generic type argument inference, overload scoring, parameter refinement
 *
 * DAG position: depends on type-system-state, type-system-relations, and sub-modules above
 */

import type { IrType } from "../types/index.js";
import {
  substituteIrType as irSubstitute,
  TypeSubstitutionMap as IrSubstitutionMap,
} from "../types/ir-substitution.js";
import type {
  TypeSystemState,
  CallQuery,
  ResolvedCall,
} from "./type-system-state.js";
import {
  emitDiagnostic,
  stripTsonicExtensionWrappers,
  poisonedCall,
} from "./type-system-state.js";
import { unknownType } from "./types.js";
import { typesEqual } from "./type-system-relations.js";
import {
  substitutePolymorphicThis,
  expandParameterTypesForArguments,
  expandParameterTypesForInference,
  buildResolvedRestParameter,
  collectExpectedReturnCandidates,
  containsMethodTypeParameter,
  mapEntriesEqual,
} from "./call-resolution-utilities.js";
import {
  getRawSignature,
  computeReceiverSubstitution,
  tryResolveCallFromUnifiedCatalog,
} from "./call-resolution-signatures.js";
import {
  inferMethodTypeArgsFromArguments,
  scoreSignatureMatch,
  refineResolvedParameterTypesForArguments,
} from "./call-resolution-inference.js";

// ─── Re-exports from sub-modules ─────────────────────────────────────────

export {
  substitutePolymorphicThis,
  attachParameterTypeIds,
  attachTypeParameterTypeIds,
  attachInterfaceMemberTypeIds,
  attachTypeIds,
  convertTypeNode,
  delegateToFunctionType,
  mapEntriesEqual,
  containsMethodTypeParameter,
  normalizeCatalogTsName,
  expandParameterTypesForInference,
  expandParameterTypesForArguments,
  buildResolvedRestParameter,
  collectExpectedReturnCandidates,
  collectNarrowingCandidates,
  POLYMORPHIC_THIS_MARKER,
} from "./call-resolution-utilities.js";

export {
  getRawSignature,
  lookupStructuralMember,
  computeReceiverSubstitution,
  tryResolveCallFromUnifiedCatalog,
} from "./call-resolution-signatures.js";

export {
  inferMethodTypeArgsFromArguments,
  isArityCompatible,
  scoreSignatureMatch,
  refineParameterTypeForConcreteArgument,
  refineResolvedParameterTypesForArguments,
} from "./call-resolution-inference.js";

// ─────────────────────────────────────────────────────────────────────────
// resolveCall — Main entry point for call resolution
// ─────────────────────────────────────────────────────────────────────────

export const resolveCall = (
  state: TypeSystemState,
  query: CallQuery
): ResolvedCall => {
  const {
    sigId,
    argumentCount,
    receiverType,
    explicitTypeArgs,
    argTypes,
    expectedReturnType,
    site,
  } = query;

  // Extension method scopes are modeled as TS-only wrapper types (e.g. __TsonicExt_Ef<T>).
  // They must erase to their underlying CLR shapes for deterministic call inference.
  const effectiveReceiverType = receiverType
    ? stripTsonicExtensionWrappers(receiverType)
    : undefined;

  // 1. Load raw signature (cached)
  const rawSig = getRawSignature(state, sigId);
  if (!rawSig) {
    // BINDING CONTRACT VIOLATION (Alice's spec): If Binding returned a
    // SignatureId, HandleRegistry.getSignature(sigId) MUST succeed.
    // This indicates a bug in Binding, not a normal runtime condition.
    //
    // However, we cannot throw during normal compilation as it would
    // crash the compiler. Instead, emit diagnostic and return poisoned
    // result with correct arity.
    emitDiagnostic(
      state,
      "TSN5203",
      `Cannot resolve signature (Binding contract violation: ID ${sigId.id} not in HandleRegistry)`,
      site
    );
    return poisonedCall(argumentCount, state.diagnostics.slice());
  }

  // 2. Start with raw types
  let workingParams = [...rawSig.parameterTypes];
  let workingThisParam = rawSig.thisParameterType;
  let workingReturn = rawSig.returnType;
  let workingPredicate = rawSig.typePredicate;

  const collectTypeParameterNames = (
    type: IrType | undefined,
    acc: Set<string>
  ): void => {
    if (!type) return;

    switch (type.kind) {
      case "typeParameterType":
        acc.add(type.name);
        return;
      case "arrayType":
        collectTypeParameterNames(type.elementType, acc);
        return;
      case "tupleType":
        for (const e of type.elementTypes) {
          collectTypeParameterNames(e, acc);
        }
        return;
      case "dictionaryType":
        collectTypeParameterNames(type.keyType, acc);
        collectTypeParameterNames(type.valueType, acc);
        return;
      case "referenceType":
        for (const t of type.typeArguments ?? []) {
          collectTypeParameterNames(t, acc);
        }
        for (const m of type.structuralMembers ?? []) {
          if (m.kind === "propertySignature") {
            collectTypeParameterNames(m.type, acc);
          } else {
            for (const p of m.parameters) {
              collectTypeParameterNames(p.type, acc);
            }
            collectTypeParameterNames(m.returnType, acc);
          }
        }
        return;
      case "unionType":
      case "intersectionType":
        for (const t of type.types) {
          collectTypeParameterNames(t, acc);
        }
        return;
      case "functionType":
        for (const p of type.parameters) {
          collectTypeParameterNames(p.type, acc);
        }
        collectTypeParameterNames(type.returnType, acc);
        return;
      default:
        return;
    }
  };

  const collectReceiverGenericNames = (): Set<string> => {
    const names = new Set<string>();
    for (const p of workingParams) {
      collectTypeParameterNames(p, names);
    }
    collectTypeParameterNames(workingThisParam, names);
    collectTypeParameterNames(workingReturn, names);
    if (workingPredicate) {
      collectTypeParameterNames(workingPredicate.targetType, names);
    }
    for (const methodTp of rawSig.typeParameters) {
      names.delete(methodTp.name);
    }
    return names;
  };

  // 3. Compute receiver substitution (class type params)
  if (
    effectiveReceiverType &&
    rawSig.declaringTypeTsName &&
    rawSig.declaringMemberName
  ) {
    let receiverSubst = computeReceiverSubstitution(
      state,
      effectiveReceiverType,
      rawSig.declaringTypeTsName,
      rawSig.declaringMemberName,
      rawSig.declaringTypeParameterNames
    );

    // Array receiver fallback:
    // Some surfaces model JS-style array methods on generic wrapper declarations
    // where nominal inheritance metadata may not connect `T[]` to the wrapper's
    // type parameter. If nominal substitution is unavailable, and exactly one
    // non-method type parameter remains in the signature, bind it to the array
    // element type deterministically.
    if (
      (!receiverSubst || receiverSubst.size === 0) &&
      effectiveReceiverType.kind === "arrayType"
    ) {
      const receiverGenericNames = collectReceiverGenericNames();
      if (receiverGenericNames.size === 1) {
        const [only] = receiverGenericNames;
        if (only) {
          receiverSubst = new Map<string, IrType>([
            [only, effectiveReceiverType.elementType],
          ]);
        }
      }
    }

    if (receiverSubst && receiverSubst.size > 0) {
      workingParams = workingParams.map((p) =>
        p ? irSubstitute(p, receiverSubst) : undefined
      );
      if (workingThisParam) {
        workingThisParam = irSubstitute(workingThisParam, receiverSubst);
      }
      workingReturn = irSubstitute(workingReturn, receiverSubst);
      if (workingPredicate) {
        workingPredicate =
          workingPredicate.kind === "param"
            ? {
                ...workingPredicate,
                targetType: irSubstitute(
                  workingPredicate.targetType,
                  receiverSubst
                ),
              }
            : {
                ...workingPredicate,
                targetType: irSubstitute(
                  workingPredicate.targetType,
                  receiverSubst
                ),
              };
      }
    }
  }

  if (effectiveReceiverType) {
    workingParams = workingParams.map((p) =>
      p ? (substitutePolymorphicThis(p, effectiveReceiverType) ?? p) : undefined
    );
    if (workingThisParam) {
      workingThisParam =
        substitutePolymorphicThis(workingThisParam, effectiveReceiverType) ??
        workingThisParam;
    }
    workingReturn =
      substitutePolymorphicThis(workingReturn, effectiveReceiverType) ??
      workingReturn;
    if (workingPredicate) {
      workingPredicate =
        workingPredicate.kind === "param"
          ? {
              ...workingPredicate,
              targetType:
                substitutePolymorphicThis(
                  workingPredicate.targetType,
                  effectiveReceiverType
                ) ?? workingPredicate.targetType,
            }
          : {
              ...workingPredicate,
              targetType:
                substitutePolymorphicThis(
                  workingPredicate.targetType,
                  effectiveReceiverType
                ) ?? workingPredicate.targetType,
            };
    }
  }

  // 4. Compute call substitution (method type params)
  const methodTypeParams = rawSig.typeParameters;
  if (methodTypeParams.length > 0) {
    const callSubst = new Map<string, IrType>();

    // Source 1: Explicit type args from call syntax
    if (explicitTypeArgs) {
      for (
        let i = 0;
        i < Math.min(explicitTypeArgs.length, methodTypeParams.length);
        i++
      ) {
        const param = methodTypeParams[i];
        const arg = explicitTypeArgs[i];
        if (param && arg) {
          callSubst.set(param.name, arg);
        }
      }
    }

    // Source 2: Deterministic argument-driven unification
    // 2a) Receiver-driven unification via TS `this:` parameter
    //
    // Method-table extension typing represents the receiver as an explicit `this:` parameter
    // in the `.d.ts` signature. Generic methods like:
    //   ToArrayAsync<T>(this: IQueryable<T>, ...): Task<T[]>
    // must infer T from the receiver even when there are ZERO call arguments.
    //
    // This is airplane-grade determinism: we anchor inference to the selected TS signature's
    // `this:` type and the IR receiver type (not TS structural tricks).
    if (effectiveReceiverType && workingThisParam) {
      const receiverParamForInference =
        callSubst.size > 0
          ? irSubstitute(workingThisParam, callSubst)
          : workingThisParam;

      const inferredFromReceiver = inferMethodTypeArgsFromArguments(
        state,
        methodTypeParams,
        [receiverParamForInference],
        [effectiveReceiverType]
      );

      if (inferredFromReceiver) {
        for (const [name, inferredType] of inferredFromReceiver) {
          const existing = callSubst.get(name);
          if (existing) {
            if (!typesEqual(existing, inferredType)) {
              emitDiagnostic(
                state,
                "TSN5202",
                `Conflicting type argument inference for '${name}' (receiver)`,
                site
              );
              return poisonedCall(argumentCount, state.diagnostics.slice());
            }
            continue;
          }
          callSubst.set(name, inferredType);
        }
      }
    }

    // 2b) Argument-driven unification (run even when argTypes is empty).
    if (argTypes) {
      const paramsForInferenceBase =
        callSubst.size > 0
          ? workingParams.map((p) =>
              p ? irSubstitute(p, callSubst) : undefined
            )
          : workingParams;
      const paramsForInference = expandParameterTypesForInference(
        rawSig.parameterFlags,
        paramsForInferenceBase,
        argTypes.length
      );

      const inferred = inferMethodTypeArgsFromArguments(
        state,
        methodTypeParams,
        paramsForInference,
        argTypes
      );

      if (!inferred) {
        emitDiagnostic(
          state,
          "TSN5202",
          "Type arguments cannot be inferred deterministically from arguments",
          site
        );
        return poisonedCall(argumentCount, state.diagnostics.slice());
      }

      for (const [name, inferredType] of inferred) {
        const existing = callSubst.get(name);
        if (existing) {
          if (!typesEqual(existing, inferredType)) {
            emitDiagnostic(
              state,
              "TSN5202",
              `Conflicting type argument inference for '${name}'`,
              site
            );
            return poisonedCall(argumentCount, state.diagnostics.slice());
          }
          continue;
        }
        callSubst.set(name, inferredType);
      }
    }

    // Source 3: Contextual expected return type from the call site.
    // This handles generic APIs where method type parameters appear only in
    // the return position (or where argument inference is intentionally weak).
    if (expectedReturnType) {
      const returnForInference =
        callSubst.size > 0
          ? irSubstitute(workingReturn, callSubst)
          : workingReturn;
      const expectedCandidates = collectExpectedReturnCandidates(
        state,
        expectedReturnType
      );
      let matched: Map<string, IrType> | undefined;

      for (const candidate of expectedCandidates) {
        const inferred = inferMethodTypeArgsFromArguments(
          state,
          methodTypeParams,
          [returnForInference],
          [candidate]
        );
        if (!inferred || inferred.size === 0) continue;

        let conflictsWithExisting = false;
        for (const [name, inferredType] of inferred) {
          const existing = callSubst.get(name);
          if (existing && !typesEqual(existing, inferredType)) {
            conflictsWithExisting = true;
            break;
          }
        }
        if (conflictsWithExisting) continue;

        if (matched && !mapEntriesEqual(matched, inferred)) {
          // Ambiguous contextual-return inference: ignore this source and
          // rely on explicit/argument/default inference only.
          matched = undefined;
          break;
        }
        matched = inferred;
      }

      if (matched) {
        for (const [name, inferredType] of matched) {
          const existing = callSubst.get(name);
          if (existing) {
            if (!typesEqual(existing, inferredType)) {
              emitDiagnostic(
                state,
                "TSN5202",
                `Conflicting type argument inference for '${name}' (expected return context)`,
                site
              );
              return poisonedCall(argumentCount, state.diagnostics.slice());
            }
            continue;
          }
          callSubst.set(name, inferredType);
        }
      }
    }

    // Source 4: Default type parameters
    for (const tp of methodTypeParams) {
      if (!callSubst.has(tp.name) && tp.defaultType) {
        callSubst.set(tp.name, tp.defaultType);
      }
    }

    // Apply call substitution
    if (callSubst.size > 0) {
      workingParams = workingParams.map((p) =>
        p ? irSubstitute(p, callSubst) : undefined
      );
      workingReturn = irSubstitute(workingReturn, callSubst);
      if (workingPredicate) {
        workingPredicate =
          workingPredicate.kind === "param"
            ? {
                ...workingPredicate,
                targetType: irSubstitute(
                  workingPredicate.targetType,
                  callSubst as IrSubstitutionMap
                ),
              }
            : {
                ...workingPredicate,
                targetType: irSubstitute(
                  workingPredicate.targetType,
                  callSubst as IrSubstitutionMap
                ),
              };
      }
    }

    // Check for unresolved method type parameters (after explicit/arg/default inference)
    const unresolved = new Set(
      methodTypeParams
        .map((tp) => tp.name)
        .filter((name) => !callSubst.has(name))
    );
    if (
      unresolved.size > 0 &&
      containsMethodTypeParameter(workingReturn, unresolved)
    ) {
      const fallback =
        argTypes && rawSig.declaringTypeTsName && rawSig.declaringMemberName
          ? tryResolveCallFromUnifiedCatalog(
              state,
              rawSig.declaringTypeTsName,
              rawSig.declaringMemberName,
              query
            )
          : undefined;

      if (fallback) {
        return fallback;
      }

      emitDiagnostic(
        state,
        "TSN5202",
        "Return type contains unresolved type parameters - explicit type arguments required",
        site
      );
      workingReturn = unknownType;
    }
  }

  const resolved: ResolvedCall = {
    restParameter: buildResolvedRestParameter(
      rawSig.parameterFlags,
      workingParams
    ),
    surfaceRestParameter: buildResolvedRestParameter(
      rawSig.parameterFlags,
      workingParams
    ),
    surfaceParameterTypes: expandParameterTypesForArguments(
      rawSig.parameterFlags,
      workingParams,
      argumentCount
    ),
    parameterTypes: refineResolvedParameterTypesForArguments(
      state,
      rawSig.parameterFlags,
      workingParams,
      argTypes,
      argumentCount
    ),
    parameterModes: rawSig.parameterModes,
    returnType: workingReturn,
    hasDeclaredReturnType: rawSig.hasDeclaredReturnType,
    typePredicate: workingPredicate,
    selectionMeta: {
      hasRestParameter: rawSig.parameterFlags.some(
        (parameter) => parameter.isRest
      ),
      typeParamCount: rawSig.typeParameters.length,
      parameterCount: rawSig.parameterTypes.length,
      stableId: String(sigId.id),
    },
    diagnostics: [],
  };

  // CLR overload correction (airplane-grade determinism):
  //
  // TypeScript cannot always select the correct overload for CLR APIs because some
  // Tsonic surface types intentionally erase to TS primitives (e.g., `char` is `string`
  // in @tsonic/core for TSC compatibility). This can cause TS to resolve calls like
  // Console.writeLine("Hello") to a `char` overload, which is semantically invalid.
  //
  // When we have full argument types, and the call targets an assembly-origin type,
  // prefer the best matching overload from the UnifiedTypeCatalog if it scores higher
  // than the TS-selected signature.

  if (
    !resolved.typePredicate &&
    argTypes &&
    rawSig.declaringTypeTsName &&
    rawSig.declaringMemberName
  ) {
    const hasAllArgTypes =
      argTypes.length >= argumentCount &&
      Array.from({ length: argumentCount }, (_, i) => argTypes[i]).every(
        (t) => t !== undefined
      );

    if (hasAllArgTypes) {
      const catalogResolved = tryResolveCallFromUnifiedCatalog(
        state,
        rawSig.declaringTypeTsName,
        rawSig.declaringMemberName,
        query
      );

      if (catalogResolved) {
        const currentScore = scoreSignatureMatch(
          state,
          resolved.parameterTypes,
          argTypes,
          argumentCount
        );
        const catalogScore = scoreSignatureMatch(
          state,
          catalogResolved.parameterTypes,
          argTypes,
          argumentCount
        );

        const currentMeta = resolved.selectionMeta;
        const catalogMeta = catalogResolved.selectionMeta;
        const catalogWinsTie =
          currentMeta !== undefined &&
          catalogMeta !== undefined &&
          ((catalogMeta.hasRestParameter !== currentMeta.hasRestParameter &&
            !catalogMeta.hasRestParameter) ||
            (catalogMeta.hasRestParameter === currentMeta.hasRestParameter &&
              catalogMeta.typeParamCount < currentMeta.typeParamCount) ||
            (catalogMeta.hasRestParameter === currentMeta.hasRestParameter &&
              catalogMeta.typeParamCount === currentMeta.typeParamCount &&
              catalogMeta.parameterCount < currentMeta.parameterCount) ||
            (catalogMeta.hasRestParameter === currentMeta.hasRestParameter &&
              catalogMeta.typeParamCount === currentMeta.typeParamCount &&
              catalogMeta.parameterCount === currentMeta.parameterCount &&
              catalogMeta.stableId < currentMeta.stableId));

        if (
          catalogScore > currentScore ||
          (catalogScore === currentScore && catalogWinsTie)
        ) {
          return catalogResolved;
        }
      }
    }
  }

  return resolved;
};
