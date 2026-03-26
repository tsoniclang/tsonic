/**
 * Receiver substitution and unified-catalog overload resolution.
 *
 * Contains computeReceiverSubstitution for receiver type parameter binding
 * and tryResolveCallFromUnifiedCatalog for assembly-origin overload resolution.
 *
 * DAG position: depends on type-system-state, type-system-relations,
 * call-resolution-utilities, call-resolution-inference
 */

import type { IrType } from "../types/index.js";
import { substituteIrType as irSubstitute } from "../types/ir-substitution.js";
import type { MethodSignatureEntry } from "./internal/universe/types.js";
import type { TypeParameterInfo } from "./types.js";
import type {
  TypeSystemState,
  CallQuery,
  ResolvedCall,
  TypeSubstitutionMap,
} from "./type-system-state.js";
import {
  resolveTypeIdByName,
  normalizeToNominal,
} from "./type-system-state.js";
import { typesEqual } from "./type-system-relations.js";
import {
  normalizeCatalogTsName,
  containsMethodTypeParameter,
  expandParameterTypesForInference,
  buildResolvedRestParameter,
} from "./call-resolution-utilities.js";
import {
  inferMethodTypeArgsFromArguments,
  isArityCompatible,
  scoreSignatureMatch,
} from "./call-resolution-inference.js";

// ─────────────────────────────────────────────────────────────────────────
// computeReceiverSubstitution — Receiver type → substitution map
// ─────────────────────────────────────────────────────────────────────────

/**
 * Compute receiver substitution for a method call.
 *
 * Given a receiver type (e.g., Array<string>) and a declaring type's TS name,
 * computes the substitution map for class type parameters.
 *
 * Phase 6: Uses TypeId-based NominalEnv.getInstantiation().
 */
export const computeReceiverSubstitution = (
  state: TypeSystemState,
  receiverType: IrType,
  declaringTypeTsName: string,
  _declaringMemberName: string,
  declaringTypeParameterNames?: readonly string[]
): TypeSubstitutionMap | undefined => {
  const normalized = normalizeToNominal(state, receiverType);
  const trySyntacticReferenceFallback = (): TypeSubstitutionMap | undefined => {
    if (
      receiverType.kind !== "referenceType" ||
      !receiverType.typeArguments ||
      receiverType.typeArguments.length === 0 ||
      !declaringTypeParameterNames ||
      declaringTypeParameterNames.length !== receiverType.typeArguments.length
    ) {
      return undefined;
    }

    const normalizeTypeName = (name: string): string =>
      name
        .replace(/\$instance$/, "")
        .replace(/^__(.+)\$views$/, "$1")
        .replace(/_\d+$/, "")
        .replace(/`\d+$/, "");

    if (
      normalizeTypeName(receiverType.name) !==
      normalizeTypeName(declaringTypeTsName)
    ) {
      return undefined;
    }

    const receiverTypeArguments = receiverType.typeArguments;
    if (!receiverTypeArguments) {
      return undefined;
    }

    const entries: [string, IrType][] = [];
    for (const [index, name] of declaringTypeParameterNames.entries()) {
      const arg = receiverTypeArguments[index];
      if (!arg) {
        return undefined;
      }
      entries.push([name, arg]);
    }

    return new Map(entries);
  };

  if (!normalized) {
    return trySyntacticReferenceFallback();
  }

  const arityHint =
    normalized.typeArgs.length > 0 ? normalized.typeArgs.length : undefined;
  const declaringTypeId =
    resolveTypeIdByName(state, declaringTypeTsName, arityHint) ??
    resolveTypeIdByName(state, declaringTypeTsName);
  if (!declaringTypeId) {
    return trySyntacticReferenceFallback();
  }

  const nominalInstantiation = state.nominalEnv.getInstantiation(
    normalized.typeId,
    normalized.typeArgs,
    declaringTypeId
  );
  if (nominalInstantiation) return nominalInstantiation;

  // Structural fallback for array-backed receiver surfaces:
  if (receiverType.kind === "arrayType") {
    const declaringTypeParams =
      state.unifiedCatalog.getTypeParameters(declaringTypeId);
    if (declaringTypeParams.length === 1) {
      const only = declaringTypeParams[0];
      if (!only) return undefined;
      const fallback = new Map<string, IrType>();
      fallback.set(only.name, receiverType.elementType);
      return fallback;
    }
  }

  const referenceFallback = trySyntacticReferenceFallback();
  if (referenceFallback) return referenceFallback;

  return undefined;
};

// ─────────────────────────────────────────────────────────────────────────
// tryResolveCallFromUnifiedCatalog — Assembly-origin overload resolution
// ─────────────────────────────────────────────────────────────────────────

export const tryResolveCallFromUnifiedCatalog = (
  state: TypeSystemState,
  declaringTypeTsName: string,
  declaringMemberName: string,
  query: CallQuery
): ResolvedCall | undefined => {
  const { argumentCount, receiverType, explicitTypeArgs, argTypes } = query;

  if (!argTypes) return undefined;
  if (argTypes.length < argumentCount) return undefined;
  for (let i = 0; i < argumentCount; i++) {
    if (!argTypes[i]) return undefined;
  }

  const catalogTypeName = normalizeCatalogTsName(declaringTypeTsName);
  const declaringTypeId = resolveTypeIdByName(state, catalogTypeName);
  if (!declaringTypeId) return undefined;

  const entry = state.unifiedCatalog.getByTypeId(declaringTypeId);
  if (!entry || entry.origin !== "assembly") return undefined;

  const member = state.unifiedCatalog.getMember(
    declaringTypeId,
    declaringMemberName
  );
  const candidates = member?.signatures;
  if (!candidates || candidates.length === 0) return undefined;

  type Candidate = {
    readonly resolved: ResolvedCall;
    readonly score: number;
    readonly hasRestParameter: boolean;
    readonly typeParamCount: number;
    readonly parameterCount: number;
    readonly stableId: string;
  };

  const resolveCandidate = (
    signature: MethodSignatureEntry
  ): ResolvedCall | undefined => {
    if (!isArityCompatible(signature, argumentCount)) return undefined;
    if (
      explicitTypeArgs &&
      explicitTypeArgs.length > signature.typeParameters.length
    ) {
      return undefined;
    }

    let workingParams = signature.parameters.map((p) => p.type);
    let workingReturn = signature.returnType;

    // Receiver substitution (class type params) for instance calls.
    if (receiverType) {
      const receiverSubst = computeReceiverSubstitution(
        state,
        receiverType,
        catalogTypeName,
        declaringMemberName,
        state.unifiedCatalog
          .getTypeParameters(declaringTypeId)
          .map((param) => param.name)
      );
      if (receiverSubst && receiverSubst.size > 0) {
        workingParams = workingParams.map((p) =>
          irSubstitute(p, receiverSubst)
        );
        workingReturn = irSubstitute(workingReturn, receiverSubst);
      }
    }

    // Method type parameter substitution.
    const methodTypeParams: TypeParameterInfo[] = signature.typeParameters.map(
      (tp) => ({
        name: tp.name,
        constraint: tp.constraint,
        defaultType: tp.defaultType,
      })
    );

    if (methodTypeParams.length > 0) {
      const callSubst = new Map<string, IrType>();

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

      const paramsForInferenceBase =
        callSubst.size > 0
          ? workingParams.map((p) => irSubstitute(p, callSubst))
          : workingParams;
      const paramsForInference = expandParameterTypesForInference(
        signature.parameters,
        paramsForInferenceBase,
        argTypes.length
      );

      const inferred = inferMethodTypeArgsFromArguments(
        state,
        methodTypeParams,
        paramsForInference,
        argTypes
      );
      if (!inferred) return undefined;

      for (const [name, inferredType] of inferred) {
        const existing = callSubst.get(name);
        if (existing) {
          if (!typesEqual(existing, inferredType)) return undefined;
          continue;
        }
        callSubst.set(name, inferredType);
      }

      for (const tp of methodTypeParams) {
        if (!callSubst.has(tp.name) && tp.defaultType) {
          callSubst.set(tp.name, tp.defaultType);
        }
      }

      if (callSubst.size > 0) {
        workingParams = workingParams.map((p) => irSubstitute(p, callSubst));
        workingReturn = irSubstitute(workingReturn, callSubst);
      }

      const unresolved = new Set(
        methodTypeParams
          .map((tp) => tp.name)
          .filter((name) => !callSubst.has(name))
      );
      if (
        unresolved.size > 0 &&
        containsMethodTypeParameter(workingReturn, unresolved)
      ) {
        return undefined;
      }
    }

    return {
      surfaceParameterTypes: workingParams,
      parameterTypes: workingParams,
      restParameter: buildResolvedRestParameter(
        signature.parameters.map((parameter) => ({
          isRest: parameter.isRest,
        })),
        workingParams
      ),
      surfaceRestParameter: buildResolvedRestParameter(
        signature.parameters.map((parameter) => ({
          isRest: parameter.isRest,
        })),
        workingParams
      ),
      parameterModes: signature.parameters.map((p) => p.mode),
      returnType: workingReturn,
      hasDeclaredReturnType: true,
      typePredicate: undefined,
      selectionMeta: {
        hasRestParameter: signature.parameters.some(
          (parameter) => parameter.isRest
        ),
        typeParamCount: signature.typeParameters.length,
        parameterCount: signature.parameters.length,
        stableId: signature.stableId,
      },
      diagnostics: [],
    };
  };

  let best: Candidate | undefined;

  for (const sig of candidates) {
    const resolved = resolveCandidate(sig);
    if (!resolved) continue;
    if (resolved.returnType.kind === "unknownType") continue;

    const candidate: Candidate = {
      resolved,
      score: scoreSignatureMatch(
        state,
        resolved.parameterTypes,
        argTypes,
        argumentCount
      ),
      hasRestParameter: sig.parameters.some((parameter) => parameter.isRest),
      typeParamCount: sig.typeParameters.length,
      parameterCount: sig.parameters.length,
      stableId: sig.stableId,
    };

    if (!best) {
      best = candidate;
      continue;
    }

    const better =
      candidate.score > best.score ||
      (candidate.score === best.score &&
        candidate.hasRestParameter !== best.hasRestParameter &&
        !candidate.hasRestParameter) ||
      (candidate.score === best.score &&
        candidate.hasRestParameter === best.hasRestParameter &&
        candidate.typeParamCount < best.typeParamCount) ||
      (candidate.score === best.score &&
        candidate.hasRestParameter === best.hasRestParameter &&
        candidate.typeParamCount === best.typeParamCount &&
        candidate.parameterCount < best.parameterCount) ||
      (candidate.score === best.score &&
        candidate.hasRestParameter === best.hasRestParameter &&
        candidate.typeParamCount === best.typeParamCount &&
        candidate.parameterCount === best.parameterCount &&
        candidate.stableId < best.stableId);

    if (better) best = candidate;
  }

  return best?.resolved;
};
