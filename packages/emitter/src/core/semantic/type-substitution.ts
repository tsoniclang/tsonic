/**
 * Type argument substitution for type alias resolution.
 *
 * Provides recursive type-parameter substitution across all IR type forms
 * (reference, array, dictionary, union, tuple, intersection, function, object).
 * Used internally by resolveTypeAlias to expand parameterized type aliases.
 */

import type {
  IrType,
  IrArrayType,
  IrDictionaryType,
  IrFunctionType,
  IrIntersectionType,
  IrObjectType,
  IrReferenceType,
  IrTupleType,
  IrUnionType,
} from "@tsonic/frontend";

type Mutable<T> = {
  -readonly [K in keyof T]: T[K];
};

/**
 * Internal helper for type substitution
 */
const substituteType = (
  type: IrType,
  mapping: ReadonlyMap<string, IrType>,
  visited: Map<object, IrType> = new Map<object, IrType>()
): IrType => {
  const existing = visited.get(type);
  if (existing) {
    return existing;
  }

  switch (type.kind) {
    case "typeParameterType": {
      const substitution = mapping.get(type.name);
      return substitution ?? type;
    }

    case "referenceType": {
      if (!type.typeArguments && !type.structuralMembers) {
        return type;
      }

      const clone: Mutable<IrReferenceType> = { ...type };
      visited.set(type, clone);
      const substitutedTypeArguments = type.typeArguments?.map((arg) =>
        substituteType(arg, mapping, visited)
      );
      const substitutedStructuralMembers = type.structuralMembers?.map((m) => {
        if (m.kind === "propertySignature") {
          return { ...m, type: substituteType(m.type, mapping, visited) };
        }
        if (m.kind === "methodSignature") {
          return {
            ...m,
            returnType: m.returnType
              ? substituteType(m.returnType, mapping, visited)
              : undefined,
            parameters: m.parameters.map((p) =>
              p.type
                ? { ...p, type: substituteType(p.type, mapping, visited) }
                : p
            ),
          };
        }
        return m;
      });
      if (substitutedTypeArguments) {
        clone.typeArguments = substitutedTypeArguments;
      }
      if (substitutedStructuralMembers) {
        clone.structuralMembers = substitutedStructuralMembers;
      }
      return clone;
    }

    case "arrayType": {
      const clone: Mutable<IrArrayType> = {
        ...type,
        elementType: type.elementType,
      };
      visited.set(type, clone);
      clone.elementType = substituteType(type.elementType, mapping, visited);
      return clone;
    }

    case "dictionaryType": {
      const clone: Mutable<IrDictionaryType> = {
        ...type,
        keyType: type.keyType,
        valueType: type.valueType,
      };
      visited.set(type, clone);
      clone.keyType = substituteType(type.keyType, mapping, visited);
      clone.valueType = substituteType(type.valueType, mapping, visited);
      return clone;
    }

    case "unionType": {
      const clone: Mutable<IrUnionType> = {
        ...type,
        types: [],
      };
      visited.set(type, clone);
      const substitutedRuntimeCarrierTypeArguments =
        type.runtimeCarrierTypeArguments?.map((arg) =>
          substituteType(arg, mapping, visited)
        ) ??
        type.runtimeCarrierTypeParameters?.map((name) =>
          substituteType({ kind: "typeParameterType", name }, mapping, visited)
        );
      clone.types = type.types.map((t) => substituteType(t, mapping, visited));
      if (substitutedRuntimeCarrierTypeArguments) {
        clone.runtimeCarrierTypeArguments = substitutedRuntimeCarrierTypeArguments;
      }
      return clone;
    }

    case "tupleType": {
      const clone: Mutable<IrTupleType> = {
        ...type,
        elementTypes: [],
      };
      visited.set(type, clone);
      clone.elementTypes = type.elementTypes.map((t) =>
        substituteType(t, mapping, visited)
      );
      return clone;
    }

    case "intersectionType": {
      const clone: Mutable<IrIntersectionType> = {
        ...type,
        types: [],
      };
      visited.set(type, clone);
      clone.types = type.types.map((t) => substituteType(t, mapping, visited));
      return clone;
    }

    case "functionType": {
      const clone: Mutable<IrFunctionType> = {
        ...type,
        returnType: type.returnType,
        parameters: [],
      };
      visited.set(type, clone);
      clone.returnType = substituteType(type.returnType, mapping, visited);
      clone.parameters = type.parameters.map((p) =>
        p.type ? { ...p, type: substituteType(p.type, mapping, visited) } : p
      );
      return clone;
    }

    case "objectType": {
      const clone: Mutable<IrObjectType> = {
        ...type,
        members: [],
      };
      visited.set(type, clone);
      clone.members = type.members.map((m) => {
        if (m.kind === "propertySignature") {
          return { ...m, type: substituteType(m.type, mapping, visited) };
        }
        if (m.kind === "methodSignature") {
          return {
            ...m,
            returnType: m.returnType
              ? substituteType(m.returnType, mapping, visited)
              : undefined,
            parameters: m.parameters.map((p) =>
              p.type
                ? { ...p, type: substituteType(p.type, mapping, visited) }
                : p
            ),
          };
        }
        return m;
      });
      return clone as IrType;
    }

    case "primitiveType":
    case "literalType":
    case "anyType":
    case "unknownType":
    case "voidType":
    case "neverType":
      return type;

    default: {
      const exhaustive: never = type;
      void exhaustive;
      return type;
    }
  }
};

export const substituteTypeArgs = (
  type: IrType,
  typeParamNames: readonly string[],
  typeArgs: readonly IrType[]
): IrType => {
  // Build mapping from name to type
  const mapping = new Map<string, IrType>();
  for (let i = 0; i < typeParamNames.length && i < typeArgs.length; i++) {
    const name = typeParamNames[i];
    const arg = typeArgs[i];
    if (name !== undefined && arg !== undefined) {
      mapping.set(name, arg);
    }
  }

  return substituteType(type, mapping);
};
