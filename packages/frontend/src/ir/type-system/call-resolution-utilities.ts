/**
 * Call Resolution Utilities — Pure type helpers, type ID attachment, and parameter expansion
 *
 * Contains polymorphic-this substitution, canonical TypeId attachment, type node conversion,
 * parameter expansion for rest/optional parameters, type candidate expansion, and small
 * pure utility functions used across call resolution.
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
import {
  substituteIrType as irSubstitute,
  TypeSubstitutionMap as IrSubstitutionMap,
} from "../types/ir-substitution.js";
import { stableIrTypeKey, unwrapAsyncWrapperType } from "../types/type-ops.js";
import type { TypeSystemState } from "./type-system-state.js";
import {
  resolveTypeIdByName,
  normalizeToNominal,
} from "./type-system-state.js";
import { typesEqual } from "./type-system-relations.js";

export const POLYMORPHIC_THIS_MARKER = "__tsonic_polymorphic_this";

export const substitutePolymorphicThis = (
  type: IrType | undefined,
  receiverType: IrType | undefined
): IrType | undefined => {
  if (!type || !receiverType) return type;

  switch (type.kind) {
    case "typeParameterType":
      return type.name === POLYMORPHIC_THIS_MARKER ? receiverType : type;
    case "arrayType": {
      const elementType = substitutePolymorphicThis(
        type.elementType,
        receiverType
      );
      if (!elementType) return type;
      return {
        ...type,
        elementType,
      };
    }
    case "tupleType":
      return {
        ...type,
        elementTypes: type.elementTypes.map(
          (element) =>
            substitutePolymorphicThis(element, receiverType) ?? element
        ),
      };
    case "dictionaryType":
      return {
        ...type,
        keyType:
          substitutePolymorphicThis(type.keyType, receiverType) ?? type.keyType,
        valueType:
          substitutePolymorphicThis(type.valueType, receiverType) ??
          type.valueType,
      };
    case "referenceType":
      return {
        ...type,
        ...(type.typeArguments
          ? {
              typeArguments: type.typeArguments.map(
                (arg) => substitutePolymorphicThis(arg, receiverType) ?? arg
              ),
            }
          : {}),
        ...(type.structuralMembers
          ? {
              structuralMembers: type.structuralMembers.map((member) =>
                member.kind === "propertySignature"
                  ? {
                      ...member,
                      type:
                        substitutePolymorphicThis(member.type, receiverType) ??
                        member.type,
                    }
                  : {
                      ...member,
                      parameters: member.parameters.map((parameter) => ({
                        ...parameter,
                        type:
                          substitutePolymorphicThis(
                            parameter.type,
                            receiverType
                          ) ?? parameter.type,
                      })),
                      returnType: member.returnType
                        ? (substitutePolymorphicThis(
                            member.returnType,
                            receiverType
                          ) ?? member.returnType)
                        : undefined,
                    }
              ),
            }
          : {}),
      };
    case "unionType":
    case "intersectionType":
      return {
        ...type,
        types: type.types.map(
          (member) => substitutePolymorphicThis(member, receiverType) ?? member
        ),
      };
    case "functionType":
      return {
        ...type,
        parameters: type.parameters.map((parameter) => ({
          ...parameter,
          type:
            substitutePolymorphicThis(parameter.type, receiverType) ??
            parameter.type,
        })),
        returnType:
          substitutePolymorphicThis(type.returnType, receiverType) ??
          type.returnType,
      };
    default:
      return type;
  }
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
  structuralMembers: tp.structuralMembers?.map((m) =>
    attachInterfaceMemberTypeIds(state, m)
  ),
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
    typeParameters: m.typeParameters?.map((tp) =>
      attachTypeParameterTypeIds(state, tp)
    ),
    parameters: m.parameters.map((p) => attachParameterTypeIds(state, p)),
    returnType: m.returnType ? attachTypeIds(state, m.returnType) : undefined,
  };
};

export const attachTypeIds = (state: TypeSystemState, type: IrType): IrType => {
  switch (type.kind) {
    case "referenceType": {
      const sourceFqName =
        !type.resolvedClrType && !type.name.includes(".")
          ? state.typeRegistry.getFQName(type.name)
          : undefined;
      const typeId =
        type.typeId ??
        resolveTypeIdByName(
          state,
          type.resolvedClrType ?? type.name,
          type.typeArguments?.length
        ) ??
        (sourceFqName
          ? resolveTypeIdByName(state, sourceFqName, type.typeArguments?.length)
          : undefined);

      return {
        ...type,
        ...(type.typeArguments
          ? {
              typeArguments: type.typeArguments.map((t) =>
                attachTypeIds(state, t)
              ),
            }
          : {}),
        ...(type.structuralMembers
          ? {
              structuralMembers: type.structuralMembers.map((m) =>
                attachInterfaceMemberTypeIds(state, m)
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
        parameters: type.parameters.map((p) =>
          attachParameterTypeIds(state, p)
        ),
        returnType: attachTypeIds(state, type.returnType),
      };

    case "objectType":
      return {
        ...type,
        members: type.members.map((m) =>
          attachInterfaceMemberTypeIds(state, m)
        ),
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
export const convertTypeNode = (
  state: TypeSystemState,
  node: unknown
): IrType => {
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
      paramsContain || containsMethodTypeParameter(type.returnType, unresolved)
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
// Parameter expansion helpers — Rest/optional parameter type expansion
// ─────────────────────────────────────────────────────────────────────────

export const expandParameterTypesForInference = (
  parameters: readonly { readonly isRest: boolean }[],
  parameterTypes: readonly (IrType | undefined)[],
  argumentCount: number
): readonly (IrType | undefined)[] => {
  const restIndex = parameters.findIndex((parameter) => parameter.isRest);
  if (restIndex < 0) {
    return parameterTypes;
  }

  const restParam = parameters[restIndex];
  const restType = parameterTypes[restIndex];
  if (!restParam || !restType) {
    return parameterTypes;
  }

  const expanded = parameterTypes.slice(0, restIndex);
  const restElementType =
    restType.kind === "arrayType" ? restType.elementType : restType;

  while (expanded.length < argumentCount) {
    expanded.push(restElementType);
  }

  return expanded;
};

const getExpandedRestArgumentType = (
  restType: IrType,
  relativeArgumentIndex: number
): IrType => {
  if (restType.kind === "arrayType") {
    return restType.elementType;
  }

  if (restType.kind === "tupleType") {
    const direct = restType.elementTypes[relativeArgumentIndex];
    if (direct) {
      return direct;
    }
    const fallback = restType.elementTypes[restType.elementTypes.length - 1];
    return fallback ?? restType;
  }

  if (
    restType.kind === "referenceType" &&
    (restType.name === "Array" ||
      restType.name === "ReadonlyArray" ||
      restType.name === "JSArray" ||
      restType.name === "JSArray_1")
  ) {
    const onlyTypeArgument = restType.typeArguments?.[0];
    if (onlyTypeArgument) {
      return onlyTypeArgument;
    }
  }

  return restType;
};

export const expandParameterTypesForArguments = (
  parameters: readonly { readonly isRest: boolean }[],
  parameterTypes: readonly (IrType | undefined)[],
  argumentCount: number
): readonly (IrType | undefined)[] => {
  if (parameterTypes.length === 0) {
    return parameterTypes;
  }

  const restIndex = parameters.findIndex((parameter) => parameter.isRest);
  if (restIndex < 0) {
    return parameterTypes;
  }

  const expanded: (IrType | undefined)[] = [];
  for (
    let argumentIndex = 0;
    argumentIndex < argumentCount;
    argumentIndex += 1
  ) {
    if (argumentIndex < restIndex) {
      expanded.push(parameterTypes[argumentIndex]);
      continue;
    }

    const restType = parameterTypes[restIndex];
    if (!restType) {
      expanded.push(undefined);
      continue;
    }

    expanded.push(
      getExpandedRestArgumentType(restType, argumentIndex - restIndex)
    );
  }

  return expanded;
};

export const buildResolvedRestParameter = (
  parameterFlags: readonly { readonly isRest: boolean }[],
  parameterTypes: readonly (IrType | undefined)[]
):
  | {
      readonly index: number;
      readonly arrayType: IrType | undefined;
      readonly elementType: IrType | undefined;
    }
  | undefined => {
  const index = parameterFlags.findIndex((parameter) => parameter.isRest);
  if (index < 0) {
    return undefined;
  }

  const arrayType = parameterTypes[index];
  if (!arrayType) {
    return {
      index,
      arrayType: undefined,
      elementType: undefined,
    };
  }

  const elementType =
    arrayType.kind === "arrayType"
      ? arrayType.elementType
      : arrayType.kind === "referenceType" &&
          (arrayType.name === "Array" ||
            arrayType.name === "ReadonlyArray" ||
            arrayType.name === "JSArray") &&
          arrayType.typeArguments?.length === 1
        ? arrayType.typeArguments[0]
        : undefined;

  return {
    index,
    arrayType,
    elementType,
  };
};

// ─────────────────────────────────────────────────────────────────────────
// collectExpectedReturnCandidates — Return type candidate expansion
// ─────────────────────────────────────────────────────────────────────────

export const collectExpectedReturnCandidates = (
  state: TypeSystemState,
  type: IrType
): readonly IrType[] => {
  return collectExpandedTypeCandidates(state, type, {
    includeOriginal: true,
    unwrapAsyncWrappers: true,
    flattenToLeaves: false,
  });
};

export const collectNarrowingCandidates = (
  state: TypeSystemState,
  type: IrType
): readonly IrType[] => {
  return collectExpandedTypeCandidates(state, type, {
    includeOriginal: false,
    unwrapAsyncWrappers: false,
    flattenToLeaves: true,
  });
};

const collectExpandedTypeCandidates = (
  state: TypeSystemState,
  type: IrType,
  options: {
    readonly includeOriginal: boolean;
    readonly unwrapAsyncWrappers: boolean;
    readonly flattenToLeaves: boolean;
  }
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

    if (current.kind === "unionType") {
      for (const member of current.types) enqueue(member);
      if (!options.flattenToLeaves) {
        out.push(current);
      }
      continue;
    }

    let expandedAlias: IrType | undefined;
    if (current.kind === "referenceType") {
      expandedAlias = expandReferenceAlias(state, current);
      if (expandedAlias) {
        enqueue(expandedAlias);
      }

      if (options.unwrapAsyncWrappers) {
        enqueue(unwrapAsyncWrapperType(current));
      }
    }

    if (options.includeOriginal || !expandedAlias) {
      out.push(current);
    }
  }

  return out;
};

const expandReferenceAlias = (
  state: TypeSystemState,
  type: IrReferenceType
): IrType | undefined => {
  const typeId =
    type.typeId ??
    resolveTypeIdByName(
      state,
      type.resolvedClrType ?? type.name,
      type.typeArguments?.length ?? 0
    );
  if (!typeId) return undefined;

  const entry = state.unifiedCatalog.getByTypeId(typeId);
  if (!entry?.aliasedType) return undefined;

  const aliasSubst = new Map<string, IrType>();
  const aliasTypeParams = entry.typeParameters;
  const aliasTypeArgs = type.typeArguments ?? [];
  for (
    let i = 0;
    i < Math.min(aliasTypeParams.length, aliasTypeArgs.length);
    i++
  ) {
    const tp = aliasTypeParams[i];
    const ta = aliasTypeArgs[i];
    if (tp && ta) aliasSubst.set(tp.name, ta);
  }

  return aliasSubst.size > 0
    ? irSubstitute(entry.aliasedType, aliasSubst as IrSubstitutionMap)
    : entry.aliasedType;
};
