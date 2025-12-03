/**
 * Type resolution helpers for generic null/default handling
 *
 * Provides:
 * - containsTypeParameter: Check if type contains any type parameter
 * - substituteTypeArgs: Substitute type arguments into a type
 * - getPropertyType: Look up property type from contextual type
 * - stripNullish: Remove null/undefined from union types
 * - isDefinitelyValueType: Check if type is a C# value type
 */

import type {
  IrType,
  IrInterfaceMember,
  IrClassMember,
} from "@tsonic/frontend";
import type { LocalTypeInfo, EmitterContext } from "../types.js";

/**
 * Check if a type contains any type parameter.
 *
 * Uses both:
 * 1. New IR kind "typeParameterType" (preferred)
 * 2. Legacy detection via typeParams set (compatibility during migration)
 *
 * @param type - The IR type to check
 * @param typeParams - Set of type parameter names in current scope
 * @returns true if the type contains a type parameter
 */
export const containsTypeParameter = (
  type: IrType,
  typeParams: ReadonlySet<string>
): boolean => {
  switch (type.kind) {
    case "typeParameterType":
      // New IR kind - always a type parameter
      return true;

    case "referenceType":
      // Legacy compatibility: check if name is in typeParams set
      if (typeParams.has(type.name)) {
        return true;
      }
      // Recurse into type arguments
      if (type.typeArguments) {
        return type.typeArguments.some((arg) =>
          containsTypeParameter(arg, typeParams)
        );
      }
      return false;

    case "arrayType":
      return containsTypeParameter(type.elementType, typeParams);

    case "dictionaryType":
      return (
        containsTypeParameter(type.keyType, typeParams) ||
        containsTypeParameter(type.valueType, typeParams)
      );

    case "unionType":
    case "intersectionType":
      return type.types.some((t) => containsTypeParameter(t, typeParams));

    case "functionType":
      if (containsTypeParameter(type.returnType, typeParams)) {
        return true;
      }
      return type.parameters.some(
        (p) => p.type && containsTypeParameter(p.type, typeParams)
      );

    case "objectType":
      return type.members.some((m) => {
        if (m.kind === "propertySignature") {
          return containsTypeParameter(m.type, typeParams);
        }
        if (m.kind === "methodSignature") {
          if (m.returnType && containsTypeParameter(m.returnType, typeParams)) {
            return true;
          }
          return m.parameters.some(
            (p) => p.type && containsTypeParameter(p.type, typeParams)
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
  mapping: ReadonlyMap<string, IrType>
): IrType => {
  switch (type.kind) {
    case "typeParameterType": {
      const substitution = mapping.get(type.name);
      return substitution ?? type;
    }

    case "referenceType": {
      // Check if this is a type parameter (legacy representation)
      const substitution = mapping.get(type.name);
      if (substitution && !type.typeArguments) {
        return substitution;
      }
      // Recurse into type arguments
      if (type.typeArguments) {
        return {
          ...type,
          typeArguments: type.typeArguments.map((arg) =>
            substituteType(arg, mapping)
          ),
        };
      }
      return type;
    }

    case "arrayType":
      return {
        ...type,
        elementType: substituteType(type.elementType, mapping),
      };

    case "dictionaryType":
      return {
        ...type,
        keyType: substituteType(type.keyType, mapping),
        valueType: substituteType(type.valueType, mapping),
      };

    case "unionType":
      return {
        ...type,
        types: type.types.map((t) => substituteType(t, mapping)),
      };

    case "intersectionType":
      return {
        ...type,
        types: type.types.map((t) => substituteType(t, mapping)),
      };

    case "functionType":
      return {
        ...type,
        returnType: substituteType(type.returnType, mapping),
        parameters: type.parameters.map((p) =>
          p.type ? { ...p, type: substituteType(p.type, mapping) } : p
        ),
      };

    case "objectType":
      return {
        ...type,
        members: type.members.map((m) => {
          if (m.kind === "propertySignature") {
            return { ...m, type: substituteType(m.type, mapping) };
          }
          if (m.kind === "methodSignature") {
            return {
              ...m,
              returnType: m.returnType
                ? substituteType(m.returnType, mapping)
                : undefined,
              parameters: m.parameters.map((p) =>
                p.type ? { ...p, type: substituteType(p.type, mapping) } : p
              ),
            };
          }
          return m;
        }),
      };

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

/**
 * Look up property type from a contextual type.
 *
 * This handles:
 * - Local types (class/interface/typeAlias) via localTypes map
 * - Type alias chasing (follows alias.type until reaching a concrete type)
 * - Interface extends resolution (searches base interfaces)
 * - Generic type argument substitution
 *
 * @param contextualType - The contextual type (e.g., Result<T>)
 * @param propertyName - The property name to look up
 * @param context - Emitter context with localTypes
 * @returns The property type after substitution, or undefined if not found
 */
export const getPropertyType = (
  contextualType: IrType | undefined,
  propertyName: string,
  context: EmitterContext
): IrType | undefined => {
  if (!contextualType || !context.localTypes) {
    return undefined;
  }

  return resolvePropertyType(
    contextualType,
    propertyName,
    context.localTypes,
    []
  );
};

/**
 * Internal helper for property type resolution with cycle detection
 */
const resolvePropertyType = (
  type: IrType,
  propertyName: string,
  localTypes: ReadonlyMap<string, LocalTypeInfo>,
  visitedTypes: readonly string[]
): IrType | undefined => {
  // Handle reference types (most common case)
  if (type.kind === "referenceType") {
    const typeInfo = localTypes.get(type.name);
    if (!typeInfo) {
      // External type - cannot resolve property type
      return undefined;
    }

    // Prevent cycles
    if (visitedTypes.includes(type.name)) {
      return undefined;
    }
    const newVisited = [...visitedTypes, type.name];

    // Chase type alias
    if (typeInfo.kind === "typeAlias") {
      const substituted = type.typeArguments
        ? substituteTypeArgs(
            typeInfo.type,
            typeInfo.typeParameters,
            type.typeArguments
          )
        : typeInfo.type;
      return resolvePropertyType(
        substituted,
        propertyName,
        localTypes,
        newVisited
      );
    }

    // Look up property in interface
    if (typeInfo.kind === "interface") {
      // Search own members first
      const prop = findPropertyInMembers(typeInfo.members, propertyName);
      if (prop) {
        return type.typeArguments
          ? substituteTypeArgs(
              prop,
              typeInfo.typeParameters,
              type.typeArguments
            )
          : prop;
      }

      // Search extended interfaces
      for (const base of typeInfo.extends) {
        const baseProp = resolvePropertyType(
          base,
          propertyName,
          localTypes,
          newVisited
        );
        if (baseProp) {
          return type.typeArguments
            ? substituteTypeArgs(
                baseProp,
                typeInfo.typeParameters,
                type.typeArguments
              )
            : baseProp;
        }
      }
      return undefined;
    }

    // Look up property in class
    if (typeInfo.kind === "class") {
      const prop = findPropertyInClassMembers(typeInfo.members, propertyName);
      if (prop) {
        return type.typeArguments
          ? substituteTypeArgs(
              prop,
              typeInfo.typeParameters,
              type.typeArguments
            )
          : prop;
      }
      return undefined;
    }

    return undefined;
  }

  // Handle object types directly
  if (type.kind === "objectType") {
    return findPropertyInMembers(type.members, propertyName);
  }

  return undefined;
};

/**
 * Find property type in interface members
 */
const findPropertyInMembers = (
  members: readonly IrInterfaceMember[],
  propertyName: string
): IrType | undefined => {
  for (const member of members) {
    if (member.kind === "propertySignature" && member.name === propertyName) {
      return member.type;
    }
  }
  return undefined;
};

/**
 * Find property type in class members
 */
const findPropertyInClassMembers = (
  members: readonly IrClassMember[],
  propertyName: string
): IrType | undefined => {
  for (const member of members) {
    if (member.kind === "propertyDeclaration" && member.name === propertyName) {
      return member.type;
    }
  }
  return undefined;
};

/**
 * Strip null and undefined from a union type.
 *
 * Used when we need the non-nullable base type, e.g., for object instantiation
 * where `new T? { ... }` is invalid C# but `new T { ... }` is valid.
 *
 * @param type - The type to strip nullish from
 * @returns The non-nullish base type, or the original type if not a nullable union
 */
export const stripNullish = (type: IrType): IrType => {
  if (type.kind !== "unionType") return type;

  const nonNullish = type.types.filter(
    (t) =>
      !(
        t.kind === "primitiveType" &&
        (t.name === "null" || t.name === "undefined")
      )
  );

  // Single non-nullish type: return it (e.g., T | null → T)
  if (nonNullish.length === 1 && nonNullish[0]) {
    return nonNullish[0];
  }

  // Multi-type union or no non-nullish types: return original
  return type;
};

/**
 * Known CLR struct types that are value types.
 */
const CLR_VALUE_TYPES = new Set([
  "global::System.DateTime",
  "global::System.DateOnly",
  "global::System.TimeOnly",
  "global::System.TimeSpan",
  "global::System.Guid",
  "global::System.Decimal",
  "System.DateTime",
  "System.DateOnly",
  "System.TimeOnly",
  "System.TimeSpan",
  "System.Guid",
  "System.Decimal",
]);

/**
 * Check if a type is definitely a C# value type.
 *
 * Value types require `default` instead of `null` in object initializers
 * because `null` cannot be assigned to non-nullable value types.
 *
 * @param type - The type to check (should be non-nullish, use stripNullish first)
 * @returns true if the type is a known value type
 */
export const isDefinitelyValueType = (type: IrType): boolean => {
  // Strip nullish first if caller forgot
  const base = stripNullish(type);

  // Primitive value types (number → double, boolean → bool)
  if (base.kind === "primitiveType") {
    return base.name === "number" || base.name === "boolean";
  }

  // Known CLR struct types
  if (base.kind === "referenceType") {
    const clr = base.resolvedClrType;
    if (clr && CLR_VALUE_TYPES.has(clr)) {
      return true;
    }
  }

  return false;
};
