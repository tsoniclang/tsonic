/**
 * Type-parameter detection and substitution into IR types.
 *
 * Extracted from structural-resolution.ts — contains containsTypeParameter
 * and substituteTypeArgs, both used independently by property-member-lookup
 * and type-resolution consumers.
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
 * Check if a type contains any type parameter.
 *
 * Uses IR kind "typeParameterType" only.
 *
 * @param type - The IR type to check
 * @returns true if the type contains a type parameter
 */
const containsTypeParameterImpl = (
  type: IrType,
  visited: WeakSet<object>
): boolean => {
  if (visited.has(type)) {
    return false;
  }
  visited.add(type);

  switch (type.kind) {
    case "typeParameterType":
      // New IR kind - always a type parameter
      return true;

    case "referenceType":
      // Recurse into type arguments
      if (type.typeArguments) {
        return type.typeArguments.some((arg) =>
          containsTypeParameterImpl(arg, visited)
        );
      }
      return false;

    case "arrayType":
      return containsTypeParameterImpl(type.elementType, visited);

    case "dictionaryType":
      return (
        containsTypeParameterImpl(type.keyType, visited) ||
        containsTypeParameterImpl(type.valueType, visited)
      );

    case "unionType":
    case "intersectionType":
      return type.types.some((t) => containsTypeParameterImpl(t, visited));

    case "tupleType":
      return type.elementTypes.some((t) =>
        containsTypeParameterImpl(t, visited)
      );

    case "functionType":
      if (containsTypeParameterImpl(type.returnType, visited)) {
        return true;
      }
      return type.parameters.some(
        (p) => p.type && containsTypeParameterImpl(p.type, visited)
      );

    case "objectType":
      return type.members.some((m) => {
        if (m.kind === "propertySignature") {
          return containsTypeParameterImpl(m.type, visited);
        }
        if (m.kind === "methodSignature") {
          if (
            m.returnType &&
            containsTypeParameterImpl(m.returnType, visited)
          ) {
            return true;
          }
          return m.parameters.some(
            (p) => p.type && containsTypeParameterImpl(p.type, visited)
          );
        }
        return false;
      });

    case "primitiveType":
    case "literalType":
    case "anyType":
    case "unknownType":
    case "voidType":
    case "neverType":
      return false;

    default: {
      // Exhaustive check - this will error if a new IR type kind is added
      const exhaustive: never = type;
      void exhaustive;
      return false;
    }
  }
};

export const containsTypeParameter = (type: IrType): boolean =>
  containsTypeParameterImpl(type, new WeakSet<object>());

/**
 * Substitute type arguments into a type.
 *
 * @param type - The type to substitute into
 * @param typeParamNames - List of type parameter names (in order)
 * @param typeArgs - List of type arguments (in order, parallel to typeParamNames)
 * @returns The type with type parameters substituted
 */
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
      // Recurse into type arguments
      if (type.typeArguments) {
        const clone: Mutable<IrReferenceType> = {
          ...type,
          typeArguments: [],
        };
        visited.set(type, clone);
        clone.typeArguments = type.typeArguments.map((arg) =>
          substituteType(arg, mapping, visited)
        );
        return clone;
      }
      return type;
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
      clone.types = type.types.map((t) => substituteType(t, mapping, visited));
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
