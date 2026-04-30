import type { IrType } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import { unwrapParameterModifierType } from "./parameter-modifier-types.js";
import { resolveTypeAlias, stripNullish } from "./type-resolution.js";
import { getContextualTypeVisitKey } from "./deterministic-type-keys.js";
import { getReferenceNominalIdentityKey } from "./reference-type-identity.js";

type ComparableNormalizeState = {
  readonly cache: WeakMap<object, IrType>;
  readonly active: WeakSet<object>;
  readonly keyCache: Map<string, IrType>;
  readonly activeKeys: Set<string>;
};

const createComparableNormalizeState = (): ComparableNormalizeState => ({
  cache: new WeakMap<object, IrType>(),
  active: new WeakSet<object>(),
  keyCache: new Map<string, IrType>(),
  activeKeys: new Set<string>(),
});

export const unwrapComparableType = (type: IrType): IrType =>
  stripNullish(unwrapParameterModifierType(type) ?? type);

const normalizeComparableMembers = (
  members: Extract<IrType, { kind: "objectType" }>["members"],
  context: EmitterContext,
  state: ComparableNormalizeState
): Extract<IrType, { kind: "objectType" }>["members"] =>
  members.map((member) => {
    if (member.kind === "propertySignature") {
      return {
        ...member,
        type: normalizeComparableType(member.type, context, state),
      };
    }

    return {
      ...member,
      parameters: member.parameters.map((parameter) =>
        parameter.type
          ? {
              ...parameter,
              type: normalizeComparableType(parameter.type, context, state),
            }
          : parameter
      ),
      returnType: member.returnType
        ? normalizeComparableType(member.returnType, context, state)
        : undefined,
    };
  });

const normalizeResolvedComparableType = (
  type: IrType,
  context: EmitterContext,
  state: ComparableNormalizeState
): IrType => {
  switch (type.kind) {
    case "referenceType": {
      if (type.structuralMembers && type.structuralMembers.length > 0) {
        return {
          kind: "objectType",
          members: normalizeComparableMembers(
            type.structuralMembers,
            context,
            state
          ),
        };
      }

      const typeArguments = type.typeArguments?.map((argument) =>
        normalizeComparableType(argument, context, state)
      );
      const typeArgumentsChanged =
        !!typeArguments &&
        typeArguments.some(
          (argument, index) => argument !== type.typeArguments?.[index]
        );
      return typeArgumentsChanged ? { ...type, typeArguments } : type;
    }

    case "unionType": {
      const types = type.types.map((member) =>
        normalizeComparableType(member, context, state)
      );
      return types.some((member, index) => member !== type.types[index])
        ? { ...type, types }
        : type;
    }

    case "intersectionType": {
      const types = type.types.map((member) =>
        normalizeComparableType(member, context, state)
      );
      return types.some((member, index) => member !== type.types[index])
        ? { ...type, types }
        : type;
    }

    case "arrayType": {
      const elementType = normalizeComparableType(
        type.elementType,
        context,
        state
      );
      return elementType !== type.elementType ? { ...type, elementType } : type;
    }

    case "dictionaryType": {
      const keyType = normalizeComparableType(type.keyType, context, state);
      const valueType = normalizeComparableType(type.valueType, context, state);
      return keyType !== type.keyType || valueType !== type.valueType
        ? { ...type, keyType, valueType }
        : type;
    }

    case "tupleType": {
      const elementTypes = type.elementTypes.map((element) =>
        normalizeComparableType(element, context, state)
      );
      return elementTypes.some(
        (element, index) => element !== type.elementTypes[index]
      )
        ? { ...type, elementTypes }
        : type;
    }

    case "functionType": {
      const parameters = type.parameters.map((parameter) =>
        parameter.type
          ? {
              ...parameter,
              type: normalizeComparableType(parameter.type, context, state),
            }
          : parameter
      );
      const returnType = normalizeComparableType(
        type.returnType,
        context,
        state
      );
      return returnType !== type.returnType ||
        parameters.some(
          (parameter, index) => parameter !== type.parameters[index]
        )
        ? { ...type, parameters, returnType }
        : type;
    }

    case "objectType": {
      const members = normalizeComparableMembers(type.members, context, state);
      return members.some((member, index) => member !== type.members[index])
        ? { ...type, members }
        : type;
    }

    default:
      return type;
  }
};

export const resolveComparableType = (
  type: IrType,
  context: EmitterContext
): IrType =>
  normalizeComparableType(
    unwrapComparableType(type),
    context,
    createComparableNormalizeState()
  );

const normalizeComparableType = (
  type: IrType,
  context: EmitterContext,
  state: ComparableNormalizeState
): IrType => {
  const comparable = unwrapComparableType(type);
  const comparableKey = getContextualTypeVisitKey(comparable, context);
  const keyCached = state.keyCache.get(comparableKey);
  if (keyCached) {
    return keyCached;
  }

  const cached = state.cache.get(comparable as object);
  if (cached) {
    return cached;
  }

  if (
    state.active.has(comparable as object) ||
    state.activeKeys.has(comparableKey)
  ) {
    return comparable;
  }

  state.active.add(comparable as object);
  state.activeKeys.add(comparableKey);
  try {
    const resolved = resolveTypeAlias(comparable, context);
    if (
      comparable.kind === "referenceType" &&
      resolved.kind === "unionType" &&
      resolved.runtimeCarrierFamilyKey &&
      getReferenceNominalIdentityKey(comparable, context)
    ) {
      const normalized = normalizeResolvedComparableType(
        comparable,
        context,
        state
      );
      state.cache.set(comparable as object, normalized);
      state.keyCache.set(comparableKey, normalized);
      return normalized;
    }
    const normalized = normalizeResolvedComparableType(resolved, context, state);
    state.cache.set(comparable as object, normalized);
    state.cache.set(resolved as object, normalized);
    state.keyCache.set(comparableKey, normalized);
    state.keyCache.set(getContextualTypeVisitKey(resolved, context), normalized);
    return normalized;
  } finally {
    state.active.delete(comparable as object);
    state.activeKeys.delete(comparableKey);
  }
};
