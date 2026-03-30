/**
 * Call Resolution Type IDs — Polymorphic-this substitution, TypeId attachment,
 * type node conversion, delegate conversion, and pure type helpers
 *
 * Contains:
 * - substitutePolymorphicThis: polymorphic this substitution
 * - attachParameterTypeIds, attachTypeParameterTypeIds, attachInterfaceMemberTypeIds,
 *   attachTypeIds: canonical TypeId attachment
 * - convertTypeNode: deterministic type syntax conversion
 * - delegateToFunctionType: delegate → IrFunctionType conversion
 * - mapEntriesEqual: pure map comparison helper
 * - containsMethodTypeParameter: recursive type parameter check
 * - normalizeCatalogTsName: catalog name normalization
 *
 * DAG position: depends on type-system-state and type-system-relations
 */

import type {
  IrType,
  IrFunctionType,
  IrParameter,
  IrInterfaceMember,
  IrTypeParameter,
} from "../types/index.js";
import {
  substituteIrType as irSubstitute,
  TypeSubstitutionMap as IrSubstitutionMap,
} from "../types/ir-substitution.js";
import type { TypeSystemState } from "./type-system-state.js";
import {
  resolveTypeIdByName,
  normalizeToNominal,
  resolveSourceReferenceFQName,
} from "./type-system-state.js";
import { typesEqual } from "./type-system-relations.js";

export const POLYMORPHIC_THIS_MARKER = "__tsonic_polymorphic_this";

export const substitutePolymorphicThis = (
  type: IrType | undefined,
  receiverType: IrType | undefined
): IrType | undefined => {
  return substitutePolymorphicThisImpl(
    type,
    receiverType,
    new Map<IrType, IrType>()
  );
};

const substitutePolymorphicThisImpl = (
  type: IrType | undefined,
  receiverType: IrType | undefined,
  seen: Map<IrType, IrType>
): IrType | undefined => {
  if (!type || !receiverType) return type;

  if (type.kind !== "typeParameterType") {
    const cached = seen.get(type);
    if (cached) {
      return cached;
    }
  }

  switch (type.kind) {
    case "typeParameterType":
      return type.name === POLYMORPHIC_THIS_MARKER ? receiverType : type;
    case "arrayType": {
      const substituted = {
        ...type,
        elementType: type.elementType,
      };
      seen.set(type, substituted);
      const elementType = substitutePolymorphicThisImpl(
        type.elementType,
        receiverType,
        seen
      );
      if (!elementType) return type;
      substituted.elementType = elementType;
      return substituted;
    }
    case "tupleType": {
      const substituted = {
        ...type,
        elementTypes: type.elementTypes,
      };
      seen.set(type, substituted);
      substituted.elementTypes = type.elementTypes.map(
        (element) =>
          substitutePolymorphicThisImpl(element, receiverType, seen) ?? element
      );
      return substituted;
    }
    case "dictionaryType": {
      const substituted = {
        ...type,
        keyType: type.keyType,
        valueType: type.valueType,
      };
      seen.set(type, substituted);
      substituted.keyType =
        substitutePolymorphicThisImpl(type.keyType, receiverType, seen) ??
        type.keyType;
      substituted.valueType =
        substitutePolymorphicThisImpl(type.valueType, receiverType, seen) ??
        type.valueType;
      return substituted;
    }
    case "referenceType": {
      const substituted = {
        ...type,
        ...(type.typeArguments
          ? { typeArguments: type.typeArguments }
          : {}),
        ...(type.structuralMembers
          ? { structuralMembers: type.structuralMembers }
          : {}),
      };
      seen.set(type, substituted);
      if (type.typeArguments) {
        substituted.typeArguments = type.typeArguments.map(
          (element) =>
            substitutePolymorphicThisImpl(element, receiverType, seen) ??
            element
        );
      }
      if (type.structuralMembers) {
        substituted.structuralMembers = type.structuralMembers.map((member) =>
          member.kind === "propertySignature"
            ? {
                ...member,
                type:
                  substitutePolymorphicThisImpl(
                    member.type,
                    receiverType,
                    seen
                  ) ?? member.type,
              }
            : {
                ...member,
                parameters: member.parameters.map((parameter) => ({
                  ...parameter,
                  type:
                    substitutePolymorphicThisImpl(
                      parameter.type,
                      receiverType,
                      seen
                    ) ?? parameter.type,
                })),
                returnType: member.returnType
                  ? (substitutePolymorphicThisImpl(
                      member.returnType,
                      receiverType,
                      seen
                    ) ?? member.returnType)
                  : undefined,
              }
        );
      }
      return substituted;
    }
    case "unionType":
    case "intersectionType": {
      const substituted = {
        ...type,
        types: type.types,
      };
      seen.set(type, substituted);
      substituted.types = type.types.map(
        (member) =>
          substitutePolymorphicThisImpl(member, receiverType, seen) ?? member
      );
      return substituted;
    }
    case "functionType": {
      const substituted = {
        ...type,
        parameters: type.parameters,
        returnType: type.returnType,
      };
      seen.set(type, substituted);
      substituted.parameters = type.parameters.map((parameter) => ({
        ...parameter,
        type:
          substitutePolymorphicThisImpl(parameter.type, receiverType, seen) ??
          parameter.type,
      }));
      substituted.returnType =
        substitutePolymorphicThisImpl(type.returnType, receiverType, seen) ??
        type.returnType;
      return substituted;
    }
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
type AttachTypeIdsCache = Map<IrType, IrType>;

const attachParameterTypeIdsImpl = (
  state: TypeSystemState,
  p: IrParameter,
  cache: AttachTypeIdsCache
): IrParameter => ({
  ...p,
  type: p.type ? attachTypeIdsImpl(state, p.type, cache) : undefined,
});

const attachTypeParameterTypeIdsImpl = (
  state: TypeSystemState,
  tp: IrTypeParameter,
  cache: AttachTypeIdsCache
): IrTypeParameter => ({
  ...tp,
  constraint: tp.constraint
    ? attachTypeIdsImpl(state, tp.constraint, cache)
    : undefined,
  default: tp.default ? attachTypeIdsImpl(state, tp.default, cache) : undefined,
  structuralMembers: tp.structuralMembers?.map((m) =>
    attachInterfaceMemberTypeIdsImpl(state, m, cache)
  ),
});

const attachInterfaceMemberTypeIdsImpl = (
  state: TypeSystemState,
  m: IrInterfaceMember,
  cache: AttachTypeIdsCache
): IrInterfaceMember => {
  if (m.kind === "propertySignature") {
    return { ...m, type: attachTypeIdsImpl(state, m.type, cache) };
  }

  return {
    ...m,
    typeParameters: m.typeParameters?.map((tp) =>
      attachTypeParameterTypeIdsImpl(state, tp, cache)
    ),
    parameters: m.parameters.map((p) =>
      attachParameterTypeIdsImpl(state, p, cache)
    ),
    returnType: m.returnType
      ? attachTypeIdsImpl(state, m.returnType, cache)
      : undefined,
  };
};

const attachTypeIdsImpl = (
  state: TypeSystemState,
  type: IrType,
  cache: AttachTypeIdsCache
): IrType => {
  const cached = cache.get(type);
  if (cached) {
    return cached;
  }

  switch (type.kind) {
    case "referenceType": {
      const sourceFqName = resolveSourceReferenceFQName(state, type);
      const typeId =
        (sourceFqName
          ? resolveTypeIdByName(state, sourceFqName, type.typeArguments?.length)
          : undefined) ??
        (type.resolvedClrType
          ? resolveTypeIdByName(
              state,
              type.resolvedClrType,
              type.typeArguments?.length
            )
          : undefined) ??
        type.typeId ??
        (!sourceFqName
          ? resolveTypeIdByName(state, type.name, type.typeArguments?.length)
          : undefined);

      const attached = {
        ...type,
        ...(typeId ? { typeId } : {}),
      };
      cache.set(type, attached);

      if (type.typeArguments) {
        attached.typeArguments = type.typeArguments.map((t) =>
          attachTypeIdsImpl(state, t, cache)
        );
      }

      if (type.structuralMembers) {
        attached.structuralMembers = type.structuralMembers.map((m) =>
          attachInterfaceMemberTypeIdsImpl(state, m, cache)
        );
      }

      return attached;
    }

    case "arrayType": {
      const attached = { ...type, elementType: type.elementType };
      cache.set(type, attached);
      attached.elementType = attachTypeIdsImpl(state, type.elementType, cache);
      return attached;
    }

    case "tupleType": {
      const attached = {
        ...type,
        elementTypes: type.elementTypes,
      };
      cache.set(type, attached);
      attached.elementTypes = type.elementTypes.map((t) =>
        attachTypeIdsImpl(state, t, cache)
      );
      return attached;
    }

    case "functionType": {
      const attached = {
        ...type,
        parameters: type.parameters,
        returnType: type.returnType,
      };
      cache.set(type, attached);
      attached.parameters = type.parameters.map((p) =>
        attachParameterTypeIdsImpl(state, p, cache)
      );
      attached.returnType = attachTypeIdsImpl(state, type.returnType, cache);
      return attached;
    }

    case "objectType": {
      const attached = {
        ...type,
        members: type.members,
      };
      cache.set(type, attached);
      attached.members = type.members.map((m) =>
        attachInterfaceMemberTypeIdsImpl(state, m, cache)
      );
      return attached;
    }

    case "dictionaryType": {
      const attached = {
        ...type,
        keyType: type.keyType,
        valueType: type.valueType,
      };
      cache.set(type, attached);
      attached.keyType = attachTypeIdsImpl(state, type.keyType, cache);
      attached.valueType = attachTypeIdsImpl(state, type.valueType, cache);
      return attached;
    }

    case "unionType":
    case "intersectionType": {
      const attached = {
        ...type,
        types: type.types,
      };
      cache.set(type, attached);
      attached.types = type.types.map((t) => attachTypeIdsImpl(state, t, cache));
      return attached;
    }

    default:
      return type;
  }
};

export const attachParameterTypeIds = (
  state: TypeSystemState,
  p: IrParameter
): IrParameter => attachParameterTypeIdsImpl(state, p, new Map<IrType, IrType>());

export const attachTypeParameterTypeIds = (
  state: TypeSystemState,
  tp: IrTypeParameter
): IrTypeParameter =>
  attachTypeParameterTypeIdsImpl(state, tp, new Map<IrType, IrType>());

export const attachInterfaceMemberTypeIds = (
  state: TypeSystemState,
  m: IrInterfaceMember
): IrInterfaceMember =>
  attachInterfaceMemberTypeIdsImpl(state, m, new Map<IrType, IrType>());

export const attachTypeIds = (state: TypeSystemState, type: IrType): IrType =>
  attachTypeIdsImpl(state, type, new Map<IrType, IrType>());

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
