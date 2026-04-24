import type { IrType } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import { unwrapParameterModifierType } from "./parameter-modifier-types.js";
import { resolveTypeAlias, stripNullish } from "./type-resolution.js";

export const unwrapComparableType = (type: IrType): IrType =>
  stripNullish(unwrapParameterModifierType(type) ?? type);

const normalizeComparableMembers = (
  members: Extract<IrType, { kind: "objectType" }>["members"],
  context: EmitterContext,
  cache: WeakMap<object, IrType>,
  active: WeakSet<object>
): Extract<IrType, { kind: "objectType" }>["members"] =>
  members.map((member) => {
    if (member.kind === "propertySignature") {
      return {
        ...member,
        type: normalizeComparableType(member.type, context, cache, active),
      };
    }

    return {
      ...member,
      parameters: member.parameters.map((parameter) =>
        parameter.type
          ? {
              ...parameter,
              type: normalizeComparableType(
                parameter.type,
                context,
                cache,
                active
              ),
            }
          : parameter
      ),
      returnType: member.returnType
        ? normalizeComparableType(member.returnType, context, cache, active)
        : undefined,
    };
  });

const normalizeResolvedComparableType = (
  type: IrType,
  context: EmitterContext,
  cache: WeakMap<object, IrType>,
  active: WeakSet<object>
): IrType => {
  switch (type.kind) {
    case "referenceType": {
      if (type.structuralMembers && type.structuralMembers.length > 0) {
        return {
          kind: "objectType",
          members: normalizeComparableMembers(
            type.structuralMembers,
            context,
            cache,
            active
          ),
        };
      }

      const typeArguments = type.typeArguments?.map((argument) =>
        normalizeComparableType(argument, context, cache, active)
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
        normalizeComparableType(member, context, cache, active)
      );
      return types.some((member, index) => member !== type.types[index])
        ? { ...type, types }
        : type;
    }

    case "intersectionType": {
      const types = type.types.map((member) =>
        normalizeComparableType(member, context, cache, active)
      );
      return types.some((member, index) => member !== type.types[index])
        ? { ...type, types }
        : type;
    }

    case "arrayType": {
      const elementType = normalizeComparableType(
        type.elementType,
        context,
        cache,
        active
      );
      return elementType !== type.elementType ? { ...type, elementType } : type;
    }

    case "dictionaryType": {
      const keyType = normalizeComparableType(type.keyType, context, cache, active);
      const valueType = normalizeComparableType(
        type.valueType,
        context,
        cache,
        active
      );
      return keyType !== type.keyType || valueType !== type.valueType
        ? { ...type, keyType, valueType }
        : type;
    }

    case "tupleType": {
      const elementTypes = type.elementTypes.map((element) =>
        normalizeComparableType(element, context, cache, active)
      );
      return elementTypes.some((element, index) => element !== type.elementTypes[index])
        ? { ...type, elementTypes }
        : type;
    }

    case "functionType": {
      const parameters = type.parameters.map((parameter) =>
        parameter.type
          ? {
              ...parameter,
              type: normalizeComparableType(
                parameter.type,
                context,
                cache,
                active
              ),
            }
          : parameter
      );
      const returnType = normalizeComparableType(
        type.returnType,
        context,
        cache,
        active
      );
      return returnType !== type.returnType ||
        parameters.some((parameter, index) => parameter !== type.parameters[index])
        ? { ...type, parameters, returnType }
        : type;
    }

    case "objectType": {
      const members = normalizeComparableMembers(type.members, context, cache, active);
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
    new WeakMap<object, IrType>(),
    new WeakSet<object>()
  );

const normalizeComparableType = (
  type: IrType,
  context: EmitterContext,
  cache: WeakMap<object, IrType>,
  active: WeakSet<object>
): IrType => {
  const comparable = unwrapComparableType(type);
  const cached = cache.get(comparable as object);
  if (cached) {
    return cached;
  }
  if (active.has(comparable as object)) {
    return comparable;
  }

  active.add(comparable as object);
  const resolved = resolveTypeAlias(comparable, context);
  const normalized = normalizeResolvedComparableType(
    resolved,
    context,
    cache,
    active
  );
  cache.set(comparable as object, normalized);
  cache.set(resolved as object, normalized);
  active.delete(comparable as object);
  return normalized;
};
