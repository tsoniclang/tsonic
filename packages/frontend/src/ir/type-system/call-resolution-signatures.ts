/**
 * Call Resolution Signatures — Signature extraction, structural lookup,
 * receiver substitution, and unified-catalog overload resolution
 *
 * Contains getRawSignature for extracting raw signatures from HandleRegistry,
 * lookupStructuralMember for object type member lookup, computeReceiverSubstitution
 * for receiver type parameter binding, and tryResolveCallFromUnifiedCatalog for
 * assembly-origin overload resolution.
 *
 * DAG position: depends on type-system-state, type-system-relations,
 * call-resolution-utilities, call-resolution-inference
 */

import type { IrType, IrFunctionType } from "../types/index.js";
import * as ts from "typescript";
import { substituteIrType as irSubstitute } from "../types/ir-substitution.js";
import type { TypeParameterInfo, ParameterMode, SignatureId } from "./types.js";
import { unknownType, voidType } from "./types.js";
import type {
  TypeSystemState,
  CallQuery,
  ResolvedCall,
  RawSignatureInfo,
  TypePredicateResult,
  TypeSubstitutionMap,
  Site,
} from "./type-system-state.js";
import {
  emitDiagnostic,
  resolveTypeIdByName,
  normalizeToNominal,
  addUndefinedToType,
} from "./type-system-state.js";
import { typesEqual } from "./type-system-relations.js";
import {
  convertTypeNode,
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
// getRawSignature — Extract raw signature from HandleRegistry
// ─────────────────────────────────────────────────────────────────────────

/**
 * Get or compute raw signature info from SignatureId.
 * Caches the result for subsequent calls.
 */
export const getRawSignature = (
  state: TypeSystemState,
  sigId: SignatureId
): RawSignatureInfo | undefined => {
  const cached = state.signatureRawCache.get(sigId.id);
  if (cached) return cached;

  const sigInfo = state.handleRegistry.getSignature(sigId);
  if (!sigInfo) return undefined;

  // Convert parameter types from TypeNodes to IrTypes
  const parameterTypes: (IrType | undefined)[] = sigInfo.parameters.map((p) => {
    const baseType = p.typeNode
      ? convertTypeNode(state, p.typeNode)
      : undefined;
    if (!baseType) return undefined;
    // Optional/defaulted parameters must accept explicit `undefined` at call sites.
    return p.isOptional ? addUndefinedToType(baseType) : baseType;
  });

  // Convert a TypeScript `this:` parameter type (if present) to an IrType.
  const thisParameterType: IrType | undefined = (() => {
    const n = sigInfo.thisTypeNode as ts.TypeNode | undefined;
    return n ? convertTypeNode(state, n) : undefined;
  })();

  // Extract parameter modes
  const parameterModes: ParameterMode[] = sigInfo.parameters.map(
    (p) => p.mode ?? "value"
  );

  // Extract parameter names
  const parameterNames: string[] = sigInfo.parameters.map((p) => p.name);

  // Extract type parameters
  const typeParameters: TypeParameterInfo[] = (
    sigInfo.typeParameters ?? []
  ).map((tp) => ({
    name: tp.name,
    constraint: tp.constraintNode
      ? convertTypeNode(state, tp.constraintNode)
      : undefined,
    defaultType: tp.defaultNode
      ? convertTypeNode(state, tp.defaultNode)
      : undefined,
  }));

  const isConstructor = sigInfo.declaringMemberName === "constructor";
  const hasDeclaredReturnType =
    sigInfo.returnTypeNode !== undefined || isConstructor;

  // Convert return type
  const returnType: IrType = (() => {
    if (sigInfo.returnTypeNode)
      return convertTypeNode(state, sigInfo.returnTypeNode);

    // Class constructor declarations do not have return type annotations in TS syntax.
    // Deterministically synthesize the constructed instance type using the declaring
    // identity captured in Binding and the (class) type parameters captured for the
    // constructor signature.
    if (isConstructor && sigInfo.declaringTypeTsName) {
      const typeArguments = typeParameters.map(
        (tp) =>
          ({
            kind: "typeParameterType" as const,
            name: tp.name,
          }) satisfies IrType
      );

      return {
        kind: "referenceType",
        name: sigInfo.declaringTypeTsName,
        ...(typeArguments.length > 0 ? { typeArguments } : {}),
      };
    }

    return voidType;
  })();

  // Extract type predicate (already extracted in Binding at registration time)
  let typePredicate: TypePredicateResult | undefined;
  if (sigInfo.typePredicate) {
    const pred = sigInfo.typePredicate;
    const targetType = convertTypeNode(state, pred.targetTypeNode);
    if (pred.kind === "param") {
      typePredicate = {
        kind: "param",
        parameterIndex: pred.parameterIndex,
        targetType,
      };
    } else {
      typePredicate = {
        kind: "this",
        targetType,
      };
    }
  }

  const rawSig: RawSignatureInfo = {
    parameterTypes,
    parameterFlags: sigInfo.parameters.map((parameter) => ({
      isRest: parameter.isRest,
      isOptional: parameter.isOptional,
    })),
    thisParameterType,
    returnType,
    hasDeclaredReturnType,
    parameterModes,
    typeParameters,
    parameterNames,
    typePredicate,
    declaringTypeTsName: sigInfo.declaringTypeTsName,
    declaringTypeParameterNames: sigInfo.declaringTypeParameterNames,
    declaringMemberName: sigInfo.declaringMemberName,
  };

  state.signatureRawCache.set(sigId.id, rawSig);
  return rawSig;
};

// ─────────────────────────────────────────────────────────────────────────
// lookupStructuralMember — Structural (object) type member lookup
// ─────────────────────────────────────────────────────────────────────────

/**
 * Look up a member on a structural (object) type.
 */
export const lookupStructuralMember = (
  state: TypeSystemState,
  type: IrType,
  memberName: string,
  site?: Site
): IrType => {
  const addUndefinedToTypeLocal = (t: IrType): IrType => {
    const undefinedType: IrType = {
      kind: "primitiveType",
      name: "undefined",
    };
    if (t.kind === "unionType") {
      const hasUndefined = t.types.some(
        (x) => x.kind === "primitiveType" && x.name === "undefined"
      );
      return hasUndefined ? t : { ...t, types: [...t.types, undefinedType] };
    }
    return { kind: "unionType", types: [t, undefinedType] };
  };

  if (type.kind === "objectType") {
    const member = type.members.find((m) => m.name === memberName);
    if (member) {
      if (member.kind === "propertySignature") {
        return member.isOptional
          ? addUndefinedToTypeLocal(member.type)
          : member.type;
      }
      // Method signature - return function type using the same parameters
      if (member.kind === "methodSignature") {
        const funcType: IrFunctionType = {
          kind: "functionType",
          parameters: member.parameters,
          returnType: member.returnType ?? voidType,
        };
        return funcType;
      }
    }
  }
  if (
    type.kind === "referenceType" &&
    type.structuralMembers &&
    type.structuralMembers.length > 0
  ) {
    const member = type.structuralMembers.find((m) => m.name === memberName);
    if (member) {
      if (member.kind === "propertySignature") {
        return member.isOptional
          ? addUndefinedToTypeLocal(member.type)
          : member.type;
      }
      if (member.kind === "methodSignature") {
        const funcType: IrFunctionType = {
          kind: "functionType",
          parameters: member.parameters,
          returnType: member.returnType ?? voidType,
        };
        return funcType;
      }
    }
  }
  if (site) {
    emitDiagnostic(
      state,
      "TSN5203",
      `Member '${memberName}' not found on structural type`,
      site
    );
  }
  return unknownType;
};

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
  // If the call receiver is `T[]` and the declaring type is a 1-arity generic
  // wrapper (for example, JS runtime facade wrappers around CLR arrays), map the
  // declaring type parameter to the receiver element type by position.
  //
  // This is deterministic and only applies when nominal instantiation is absent.
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
    signature: import("./internal/universe/types.js").MethodSignatureEntry
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
