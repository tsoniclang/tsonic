/**
 * TypeSystem Call Resolution — Signature Extraction, Type ID Attachment, and Call Resolution
 *
 * Handles call resolution, signature extraction, type ID attachment, and structural member lookup.
 *
 * DAG position: depends on type-system-state and type-system-relations
 */

import type {
  IrType,
  IrFunctionType,
  IrParameter,
  IrInterfaceMember,
  IrReferenceType,
  IrTypeParameter,
} from "../types/index.js";
import * as ts from "typescript";
import {
  substituteIrType as irSubstitute,
  TypeSubstitutionMap as IrSubstitutionMap,
} from "../types/ir-substitution.js";
import { stableIrTypeKey, unwrapAsyncWrapperType } from "../types/type-ops.js";
import type { TypeParameterInfo, ParameterMode, SignatureId } from "./types.js";
import { unknownType, voidType } from "./types.js";
import type { MethodSignatureEntry } from "./internal/universe/types.js";
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
  isNullishPrimitive,
  addUndefinedToType,
  stripTsonicExtensionWrappers,
  poisonedCall,
} from "./type-system-state.js";
import { typesEqual } from "./type-system-relations.js";

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
  const parameterTypes: (IrType | undefined)[] = sigInfo.parameters.map(
    (p) => {
      const baseType = p.typeNode ? convertTypeNode(state, p.typeNode) : undefined;
      if (!baseType) return undefined;
      // Optional/defaulted parameters must accept explicit `undefined` at call sites.
      return p.isOptional ? addUndefinedToType(baseType) : baseType;
    }
  );

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
    defaultType: tp.defaultNode ? convertTypeNode(state, tp.defaultNode) : undefined,
  }));

  const isConstructor = sigInfo.declaringMemberName === "constructor";

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
    thisParameterType,
    returnType,
    parameterModes,
    typeParameters,
    parameterNames,
    typePredicate,
    declaringTypeTsName: sigInfo.declaringTypeTsName,
    declaringMemberName: sigInfo.declaringMemberName,
  };

  state.signatureRawCache.set(sigId.id, rawSig);
  return rawSig;
};

// ─────────────────────────────────────────────────────────────────────────
// Type ID attachment — Attach canonical TypeIds to IR types
// ─────────────────────────────────────────────────────────────────────────

/**
 * Attach canonical TypeIds to IR types where possible.
 *
 * This keeps nominal identity stable throughout the pipeline and enables
 * emit-time resolution without relying on string name matching.
 */
export const attachParameterTypeIds = (
  state: TypeSystemState,
  p: IrParameter
): IrParameter => ({
  ...p,
  type: p.type ? attachTypeIds(state, p.type) : undefined,
});

export const attachTypeParameterTypeIds = (
  state: TypeSystemState,
  tp: IrTypeParameter
): IrTypeParameter => ({
  ...tp,
  constraint: tp.constraint ? attachTypeIds(state, tp.constraint) : undefined,
  default: tp.default ? attachTypeIds(state, tp.default) : undefined,
  structuralMembers: tp.structuralMembers?.map((m) => attachInterfaceMemberTypeIds(state, m)),
});

export const attachInterfaceMemberTypeIds = (
  state: TypeSystemState,
  m: IrInterfaceMember
): IrInterfaceMember => {
  if (m.kind === "propertySignature") {
    return { ...m, type: attachTypeIds(state, m.type) };
  }

  return {
    ...m,
    typeParameters: m.typeParameters?.map((tp) => attachTypeParameterTypeIds(state, tp)),
    parameters: m.parameters.map((p) => attachParameterTypeIds(state, p)),
    returnType: m.returnType ? attachTypeIds(state, m.returnType) : undefined,
  };
};

export const attachTypeIds = (state: TypeSystemState, type: IrType): IrType => {
  switch (type.kind) {
    case "referenceType": {
      const typeId =
        type.typeId ??
        resolveTypeIdByName(
          state,
          type.resolvedClrType ?? type.name,
          type.typeArguments?.length
        );

      return {
        ...type,
        ...(type.typeArguments
          ? { typeArguments: type.typeArguments.map((t) => attachTypeIds(state, t)) }
          : {}),
        ...(type.structuralMembers
          ? {
              structuralMembers: type.structuralMembers.map(
                (m) => attachInterfaceMemberTypeIds(state, m)
              ),
            }
          : {}),
        ...(typeId ? { typeId } : {}),
      };
    }

    case "arrayType":
      return { ...type, elementType: attachTypeIds(state, type.elementType) };

    case "tupleType":
      return {
        ...type,
        elementTypes: type.elementTypes.map((t) => attachTypeIds(state, t)),
      };

    case "functionType":
      return {
        ...type,
        parameters: type.parameters.map((p) => attachParameterTypeIds(state, p)),
        returnType: attachTypeIds(state, type.returnType),
      };

    case "objectType":
      return {
        ...type,
        members: type.members.map((m) => attachInterfaceMemberTypeIds(state, m)),
      };

    case "dictionaryType":
      return {
        ...type,
        keyType: attachTypeIds(state, type.keyType),
        valueType: attachTypeIds(state, type.valueType),
      };

    case "unionType":
    case "intersectionType":
      return { ...type, types: type.types.map((t) => attachTypeIds(state, t)) };

    default:
      return type;
  }
};

// ─────────────────────────────────────────────────────────────────────────
// convertTypeNode — Deterministic type syntax conversion
// ─────────────────────────────────────────────────────────────────────────

/**
 * Deterministic type syntax conversion with canonical TypeId attachment.
 *
 * The underlying converter is syntax-only; this wrapper re-attaches the
 * nominal identity from the UnifiedUniverse so downstream passes (including
 * the emitter) can resolve CLR types without re-driving a parallel lookup.
 */
export const convertTypeNode = (state: TypeSystemState, node: unknown): IrType => {
  return attachTypeIds(state, state.convertTypeNodeRaw(node));
};

// ─────────────────────────────────────────────────────────────────────────
// delegateToFunctionType — Delegate → IrFunctionType conversion
// ─────────────────────────────────────────────────────────────────────────

/**
 * Convert a nominal CLR delegate type to an IrFunctionType by reading its Invoke signature.
 *
 * This is used for deterministic lambda typing when the expected type is a delegate
 * (e.g., custom delegates from CLR metadata).
 */
export const delegateToFunctionType = (
  state: TypeSystemState,
  type: IrType
): IrFunctionType | undefined => {
  // Expression<TDelegate> wrapper: treat as its underlying delegate type for
  // deterministic lambda contextual typing.
  //
  // This models C#'s implicit lambda conversion to Expression<Func<...>>:
  // the TypeScript surface uses Expression<TDelegate>, but lambdas should be
  // typed against the delegate shape.
  if (
    type.kind === "referenceType" &&
    type.name === "Expression_1" &&
    (type.typeArguments?.length ?? 0) === 1
  ) {
    const inner = type.typeArguments?.[0];
    if (!inner) return undefined;
    if (inner.kind === "functionType") return inner;
    return delegateToFunctionType(state, inner);
  }

  const normalized = normalizeToNominal(state, type);
  if (!normalized) return undefined;

  const entry = state.unifiedCatalog.getByTypeId(normalized.typeId);
  if (!entry || entry.kind !== "delegate") return undefined;

  const invokeMember =
    state.unifiedCatalog.getMember(normalized.typeId, "Invoke") ??
    state.unifiedCatalog.getMember(normalized.typeId, "invoke");
  const invokeSig = invokeMember?.signatures?.[0];
  if (!invokeSig) return undefined;

  const typeParams = state.unifiedCatalog.getTypeParameters(normalized.typeId);
  const subst = new Map<string, IrType>();
  for (
    let i = 0;
    i < Math.min(typeParams.length, normalized.typeArgs.length);
    i++
  ) {
    const tp = typeParams[i];
    const arg = normalized.typeArgs[i];
    if (tp && arg) subst.set(tp.name, arg);
  }

  const substitute = (t: IrType): IrType =>
    subst.size > 0 ? irSubstitute(t, subst as IrSubstitutionMap) : t;

  const parameters = invokeSig.parameters.map((p) => {
    const paramType = substitute(p.type);
    return {
      kind: "parameter" as const,
      pattern: {
        kind: "identifierPattern" as const,
        name: p.name,
        ...(paramType ? { type: paramType } : {}),
      },
      type: paramType,
      initializer: undefined,
      isOptional: p.isOptional,
      isRest: p.isRest,
      passing: p.mode,
    };
  });

  return {
    kind: "functionType",
    parameters,
    returnType: substitute(invokeSig.returnType),
  };
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
  emitDiagnostic(
    state,
    "TSN5203",
    `Member '${memberName}' not found on structural type`,
    site
  );
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
  _declaringMemberName: string
): TypeSubstitutionMap | undefined => {
  const normalized = normalizeToNominal(state, receiverType);
  if (!normalized) return undefined;

  const declaringTypeId = resolveTypeIdByName(state, declaringTypeTsName);
  if (!declaringTypeId) return undefined;

  return state.nominalEnv.getInstantiation(
    normalized.typeId,
    normalized.typeArgs,
    declaringTypeId
  );
};

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

  const tryUnify = (parameterType: IrType, argumentType: IrType): boolean => {
    // Method type parameter position: infer directly
    if (parameterType.kind === "typeParameterType") {
      if (!methodTypeParamNames.has(parameterType.name)) {
        // Not a method type parameter (could be outer generic) — ignore
        return true;
      }

      const existing = substitution.get(parameterType.name);
      if (existing) {
        // A self-mapping like `B -> B` can be produced when a lambda argument was typed
        // contextually from the unresolved expected signature. This provides no real
        // inference signal and must not block later concrete inference.
        if (
          existing.kind === "typeParameterType" &&
          existing.name === parameterType.name
        ) {
          substitution.set(parameterType.name, argumentType);
          return true;
        }

        return typesEqual(existing, argumentType);
      }

      substitution.set(parameterType.name, argumentType);
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
        if (!tryUnify(parameterType, part)) return false;
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
      return inner ? tryUnify(inner, argumentType) : true;
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
      if (delegateFn) return tryUnify(delegateFn, argumentType);
    }
    if (
      parameterType.kind === "functionType" &&
      argumentType.kind === "referenceType"
    ) {
      const delegateFn = delegateToFunctionType(state, argumentType);
      if (delegateFn) return tryUnify(parameterType, delegateFn);
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
        ? tryUnify(elementParam, argumentType.elementType)
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
      if (candidates.length === 1) {
        const only = candidates[0];
        return only ? tryUnify(only, argumentType) : true;
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
        ? tryUnify(parameterType.elementType, elementArg)
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
            if (!tryUnify(pa, aa)) return false;
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
                if (!tryUnify(pa, aa)) return false;
              }
            }
          }
        }

        return true;
      }

      case "arrayType":
        return tryUnify(
          parameterType.elementType,
          (argumentType as typeof parameterType).elementType
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
          if (!tryUnify(pe, ae)) return false;
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
            if (!tryUnify(pt, at)) return false;
          }
        }

        return tryUnify(parameterType.returnType, argFn.returnType);
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
    if (!tryUnify(paramType, argType)) return undefined;
  }

  return substitution;
};

// ─────────────────────────────────────────────────────────────────────────
// mapEntriesEqual — Pure helper for map comparison
// ─────────────────────────────────────────────────────────────────────────

export const mapEntriesEqual = (
  left: ReadonlyMap<string, IrType>,
  right: ReadonlyMap<string, IrType>
): boolean => {
  if (left.size !== right.size) return false;
  for (const [key, leftValue] of left) {
    const rightValue = right.get(key);
    if (!rightValue || !typesEqual(leftValue, rightValue)) return false;
  }
  return true;
};

// ─────────────────────────────────────────────────────────────────────────
// collectExpectedReturnCandidates — Return type candidate expansion
// ─────────────────────────────────────────────────────────────────────────

export const collectExpectedReturnCandidates = (
  state: TypeSystemState,
  type: IrType
): readonly IrType[] => {
  const queue: IrType[] = [type];
  const out: IrType[] = [];
  const seen = new Set<string>();
  const enqueue = (candidate: IrType | undefined): void => {
    if (!candidate) return;
    const key = stableIrTypeKey(candidate);
    if (seen.has(key)) return;
    seen.add(key);
    queue.push(candidate);
  };

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    out.push(current);

    if (current.kind === "unionType") {
      for (const member of current.types) enqueue(member);
      continue;
    }

    if (current.kind === "referenceType" && current.typeArguments) {
      const typeId =
        current.typeId ??
        resolveTypeIdByName(
          state,
          current.resolvedClrType ?? current.name,
          current.typeArguments.length
        );
      if (typeId) {
        const entry = state.unifiedCatalog.getByTypeId(typeId);
        if (entry?.aliasedType) {
          const aliasSubst = new Map<string, IrType>();
          const aliasTypeParams = entry.typeParameters;
          const aliasTypeArgs = current.typeArguments;
          for (
            let i = 0;
            i < Math.min(aliasTypeParams.length, aliasTypeArgs.length);
            i++
          ) {
            const tp = aliasTypeParams[i];
            const ta = aliasTypeArgs[i];
            if (tp && ta) aliasSubst.set(tp.name, ta);
          }
          const expanded =
            aliasSubst.size > 0
              ? irSubstitute(
                  entry.aliasedType,
                  aliasSubst as IrSubstitutionMap
                )
              : entry.aliasedType;
          enqueue(expanded);
        }
      }
      enqueue(unwrapAsyncWrapperType(current));
    }
  }

  return out;
};

// ─────────────────────────────────────────────────────────────────────────
// containsMethodTypeParameter — Pure recursive type parameter check
// ─────────────────────────────────────────────────────────────────────────

export const containsMethodTypeParameter = (
  type: IrType,
  unresolved: ReadonlySet<string>
): boolean => {
  if (type.kind === "typeParameterType") return unresolved.has(type.name);
  if (type.kind === "referenceType") {
    return (type.typeArguments ?? []).some((t) =>
      t ? containsMethodTypeParameter(t, unresolved) : false
    );
  }
  if (type.kind === "arrayType") {
    return containsMethodTypeParameter(type.elementType, unresolved);
  }
  if (type.kind === "tupleType") {
    return type.elementTypes.some((t) =>
      t ? containsMethodTypeParameter(t, unresolved) : false
    );
  }
  if (type.kind === "functionType") {
    const paramsContain = type.parameters.some((p) =>
      p.type ? containsMethodTypeParameter(p.type, unresolved) : false
    );
    return (
      paramsContain ||
      containsMethodTypeParameter(type.returnType, unresolved)
    );
  }
  if (type.kind === "unionType" || type.kind === "intersectionType") {
    return type.types.some((t) =>
      t ? containsMethodTypeParameter(t, unresolved) : false
    );
  }
  if (type.kind === "objectType") {
    return type.members.some((m) => {
      if (m.kind === "propertySignature") {
        return containsMethodTypeParameter(m.type, unresolved);
      }
      if (m.kind === "methodSignature") {
        const paramsContain = m.parameters.some((p) =>
          p.type ? containsMethodTypeParameter(p.type, unresolved) : false
        );
        return (
          paramsContain ||
          (m.returnType
            ? containsMethodTypeParameter(m.returnType, unresolved)
            : false)
        );
      }
      return false;
    });
  }
  return false;
};

// ─────────────────────────────────────────────────────────────────────────
// normalizeCatalogTsName — Pure catalog name normalization
// ─────────────────────────────────────────────────────────────────────────

export const normalizeCatalogTsName = (name: string): string => {
  if (name.endsWith("$instance")) return name.slice(0, -"$instance".length);
  if (name.startsWith("__") && name.endsWith("$views")) {
    return name.slice("__".length, -"$views".length);
  }
  return name;
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
  let score = 0;
  const pairs = Math.min(
    argumentCount,
    parameterTypes.length,
    argTypes.length
  );
  for (let i = 0; i < pairs; i++) {
    const pt = parameterTypes[i];
    const at = argTypes[i];
    if (!pt || !at) continue;

    if (typesEqual(pt, at)) {
      score += 3;
      continue;
    }

    const pNom = normalizeToNominal(state, pt);
    const aNom = normalizeToNominal(state, at);
    if (!pNom || !aNom) continue;

    if (pNom.typeId.stableId === aNom.typeId.stableId) {
      score += 2;
      continue;
    }

    const inst = state.nominalEnv.getInstantiation(
      aNom.typeId,
      aNom.typeArgs,
      pNom.typeId
    );
    if (inst) score += 1;
  }

  return score;
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
    readonly typeParamCount: number;
    readonly parameterCount: number;
    readonly stableId: string;
  };

  const resolveCandidate = (
    signature: MethodSignatureEntry
  ): ResolvedCall | undefined => {
    if (!isArityCompatible(signature, argumentCount)) return undefined;

    let workingParams = signature.parameters.map((p) => p.type);
    let workingReturn = signature.returnType;

    // Receiver substitution (class type params) for instance calls.
    if (receiverType) {
      const receiverSubst = computeReceiverSubstitution(
        state,
        receiverType,
        catalogTypeName,
        declaringMemberName
      );
      if (receiverSubst && receiverSubst.size > 0) {
        workingParams = workingParams.map((p) =>
          irSubstitute(p, receiverSubst)
        );
        workingReturn = irSubstitute(workingReturn, receiverSubst);
      }
    }

    // Method type parameter substitution.
    const methodTypeParams: TypeParameterInfo[] =
      signature.typeParameters.map((tp) => ({
        name: tp.name,
        constraint: tp.constraint,
        defaultType: tp.defaultType,
      }));

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

      const paramsForInference =
        callSubst.size > 0
          ? workingParams.map((p) => irSubstitute(p, callSubst))
          : workingParams;

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
      parameterTypes: workingParams,
      parameterModes: signature.parameters.map((p) => p.mode),
      returnType: workingReturn,
      typePredicate: undefined,
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
        candidate.typeParamCount < best.typeParamCount) ||
      (candidate.score === best.score &&
        candidate.typeParamCount === best.typeParamCount &&
        candidate.parameterCount < best.parameterCount) ||
      (candidate.score === best.score &&
        candidate.typeParamCount === best.typeParamCount &&
        candidate.parameterCount === best.parameterCount &&
        candidate.stableId < best.stableId);

    if (better) best = candidate;
  }

  return best?.resolved;
};

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

  // 3. Compute receiver substitution (class type params)
  if (
    effectiveReceiverType &&
    rawSig.declaringTypeTsName &&
    rawSig.declaringMemberName
  ) {
    const receiverSubst = computeReceiverSubstitution(
      state,
      effectiveReceiverType,
      rawSig.declaringTypeTsName,
      rawSig.declaringMemberName
    );
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
      const paramsForInference =
        callSubst.size > 0
          ? workingParams.map((p) =>
              p ? irSubstitute(p, callSubst) : undefined
            )
          : workingParams;

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
      const expectedCandidates =
        collectExpectedReturnCandidates(state, expectedReturnType);
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
    parameterTypes: workingParams,
    parameterModes: rawSig.parameterModes,
    returnType: workingReturn,
    typePredicate: workingPredicate,
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

        if (catalogScore > currentScore) {
          return catalogResolved;
        }
      }
    }
  }

  return resolved;
};
