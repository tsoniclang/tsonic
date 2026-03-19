/**
 * Call Resolution Resolve — Main resolveCall entry point.
 *
 * Contains the resolveCall function that orchestrates signature loading,
 * receiver substitution, method type parameter inference, and CLR overload correction.
 *
 * DAG position: depends on type-system-state, type-system-relations,
 * call-resolution-utilities, call-resolution-signatures, call-resolution-inference
 */

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
import {
  expandParameterTypesForArguments,
  buildResolvedRestParameter,
  containsMethodTypeParameter,
} from "./call-resolution-utilities.js";
import {
  getRawSignature,
  tryResolveCallFromUnifiedCatalog,
} from "./call-resolution-signatures.js";
import {
  scoreSignatureMatch,
  refineResolvedParameterTypesForArguments,
} from "./call-resolution-inference.js";
import { applyReceiverSubstitution } from "./call-resolution-receiver-substitution.js";
import { resolveMethodTypeSubstitution } from "./call-resolution-method-substitution.js";

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

  ({
    workingParams,
    workingThisParam,
    workingReturn,
    workingPredicate,
  } = applyReceiverSubstitution(state, rawSig, effectiveReceiverType, {
    workingParams,
    workingThisParam,
    workingReturn,
    workingPredicate,
  }));

  // 4. Compute call substitution (method type params)
  const methodTypeParams = rawSig.typeParameters;
  if (methodTypeParams.length > 0) {
    const substitution = resolveMethodTypeSubstitution(
      state,
      rawSig,
      {
        argTypes,
        explicitTypeArgs,
        expectedReturnType,
        receiverType: effectiveReceiverType,
      },
      site,
      workingParams,
      workingThisParam,
      workingReturn,
      workingPredicate
    );
    if (substitution.kind === "error") {
      return poisonedCall(argumentCount, state.diagnostics.slice());
    }
    const callSubst = substitution.substitution;

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
