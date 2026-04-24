/**
 * IR Type Substitution -- Core Operations
 *
 * Provides containsTypeParameter, unify, and typesEqual.
 * These are the foundational type-analysis operations used by
 * both substitution and builder modules.
 */

import type { IrInterfaceMember, IrParameter } from "./helpers.js";
import type { IrType } from "./ir-types.js";
import { referenceTypeIdentity } from "./type-ops.js";

const compareTupleMetadataForUnify = (
  formal: Extract<IrType, { kind: "arrayType" }>,
  actual: Extract<IrType, { kind: "arrayType" }>
): boolean => {
  const formalPrefix = formal.tuplePrefixElementTypes ?? [];
  const actualPrefix = actual.tuplePrefixElementTypes ?? [];
  if (formalPrefix.length !== actualPrefix.length) return false;
  for (let i = 0; i < formalPrefix.length; i += 1) {
    const formalElement = formalPrefix[i];
    const actualElement = actualPrefix[i];
    if (
      !formalElement ||
      !actualElement ||
      !typesEqual(formalElement, actualElement)
    ) {
      return false;
    }
  }

  if (!formal.tupleRestElementType && !actual.tupleRestElementType) {
    return true;
  }

  return !!(
    formal.tupleRestElementType &&
    actual.tupleRestElementType &&
    typesEqual(formal.tupleRestElementType, actual.tupleRestElementType)
  );
};

const compareTupleMetadataForEquality = (
  left: Extract<IrType, { kind: "arrayType" }>,
  right: Extract<IrType, { kind: "arrayType" }>
): boolean => {
  const leftPrefix = left.tuplePrefixElementTypes ?? [];
  const rightPrefix = right.tuplePrefixElementTypes ?? [];
  if (leftPrefix.length !== rightPrefix.length) return false;
  for (let i = 0; i < leftPrefix.length; i += 1) {
    const leftElement = leftPrefix[i];
    const rightElement = rightPrefix[i];
    if (
      !leftElement ||
      !rightElement ||
      !typesEqual(leftElement, rightElement)
    ) {
      return false;
    }
  }

  if (!left.tupleRestElementType && !right.tupleRestElementType) {
    return true;
  }

  return !!(
    left.tupleRestElementType &&
    right.tupleRestElementType &&
    typesEqual(left.tupleRestElementType, right.tupleRestElementType)
  );
};

/**
 * Check if an IrType contains any type parameters (typeParameterType).
 *
 * Used to determine if a type needs substitution.
 * For example:
 * - `int` -> false (no type parameters)
 * - `T` -> true (is a type parameter)
 * - `List<T>` -> true (contains type parameter)
 * - `List<int>` -> false (fully instantiated)
 */
export const containsTypeParameter = (type: IrType): boolean => {
  switch (type.kind) {
    case "typeParameterType":
      return true;

    case "referenceType":
      return (
        type.typeArguments?.some((arg) => containsTypeParameter(arg)) ?? false
      );

    case "arrayType":
      return (
        containsTypeParameter(type.elementType) ||
        (type.tuplePrefixElementTypes?.some((elementType) =>
          containsTypeParameter(elementType)
        ) ??
          false) ||
        (type.tupleRestElementType
          ? containsTypeParameter(type.tupleRestElementType)
          : false)
      );

    case "tupleType":
      return type.elementTypes.some((el) => containsTypeParameter(el));

    case "functionType":
      return (
        containsTypeParameter(type.returnType) ||
        type.parameters.some((p) => p.type && containsTypeParameter(p.type))
      );

    case "unionType":
    case "intersectionType":
      return type.types.some((t) => containsTypeParameter(t));

    case "dictionaryType":
      return (
        containsTypeParameter(type.keyType) ||
        containsTypeParameter(type.valueType)
      );

    case "objectType":
      return type.members.some((m) => {
        if (m.kind === "propertySignature") {
          return containsTypeParameter(m.type);
        }
        if (m.kind === "methodSignature") {
          return (
            (m.returnType && containsTypeParameter(m.returnType)) ||
            m.parameters.some(
              (p: { type?: IrType }) => p.type && containsTypeParameter(p.type)
            )
          );
        }
        return false;
      });

    // Primitive types never contain type parameters
    case "primitiveType":
    case "literalType":
    case "anyType":
    case "unknownType":
    case "voidType":
    case "neverType":
      return false;
  }
};

/**
 * Type substitution map: type parameter name -> concrete IrType
 */
export type TypeSubstitutionMap = ReadonlyMap<string, IrType>;

/**
 * Result of substitution building - either success with map, or conflict error.
 * Conflicts occur when the same type parameter binds to different types.
 */
export type SubstitutionResult =
  | { readonly ok: true; readonly map: TypeSubstitutionMap }
  | {
      readonly ok: false;
      readonly conflict: {
        readonly param: string;
        readonly type1: IrType;
        readonly type2: IrType;
      };
    };

/**
 * Unify a formal type (with type parameters) against an actual type (instantiated).
 *
 * Returns a substitution map if unification succeeds, undefined if it fails.
 *
 * Examples:
 * - unify(T, int) -> { "T" -> int }
 * - unify(List<T>, List<int>) -> { "T" -> int }
 * - unify(Map<K, V>, Map<string, int>) -> { "K" -> string, "V" -> int }
 * - unify(int, string) -> undefined (no type parameters to match)
 *
 * The unification is one-way: we're matching the formal type's shape against
 * the actual type and extracting bindings for type parameters found in formal.
 */
export const unify = (
  formal: IrType,
  actual: IrType
): TypeSubstitutionMap | undefined => {
  const bindings = new Map<string, IrType>();

  const unifyRecursive = (f: IrType, a: IrType): boolean => {
    // If formal is a type parameter, bind it to actual
    if (f.kind === "typeParameterType") {
      const existing = bindings.get(f.name);
      if (existing) {
        // Already bound - check consistency
        return typesEqual(existing, a);
      }
      bindings.set(f.name, a);
      return true;
    }

    // If kinds don't match, unification fails
    if (f.kind !== a.kind) {
      return false;
    }

    // Match by kind
    switch (f.kind) {
      case "primitiveType":
        return a.kind === "primitiveType" && f.name === a.name;

      case "referenceType": {
        if (a.kind !== "referenceType") return false;
        const formalIdentity = referenceTypeIdentity(f);
        const actualIdentity = referenceTypeIdentity(a);
        if (
          formalIdentity === undefined ||
          actualIdentity === undefined ||
          formalIdentity !== actualIdentity
        )
          return false;

        const fArgs = f.typeArguments ?? [];
        const aArgs = a.typeArguments ?? [];
        if (fArgs.length !== aArgs.length) return false;

        for (let i = 0; i < fArgs.length; i++) {
          const fArg = fArgs[i];
          const aArg = aArgs[i];
          if (!fArg || !aArg) return false;
          if (!unifyRecursive(fArg, aArg)) return false;
        }
        return true;
      }

      case "arrayType":
        return (
          a.kind === "arrayType" &&
          unifyRecursive(f.elementType, a.elementType) &&
          compareTupleMetadataForUnify(f, a)
        );

      case "tupleType": {
        if (a.kind !== "tupleType") return false;
        if (f.elementTypes.length !== a.elementTypes.length) return false;
        for (let i = 0; i < f.elementTypes.length; i++) {
          const fEl = f.elementTypes[i];
          const aEl = a.elementTypes[i];
          if (!fEl || !aEl) return false;
          if (!unifyRecursive(fEl, aEl)) return false;
        }
        return true;
      }

      case "unionType":
      case "intersectionType": {
        // DETERMINISTIC TYPING: Cannot infer type parameters through unions/intersections.
        // This makes inference non-deterministic (TS-like complexity).
        // If formal contains type parameters in a union/intersection, fail inference.
        if (containsTypeParameter(f)) {
          return false; // Caller should emit TSN5202
        }
        // If no type parameters in formal, just check equality
        if (a.kind !== f.kind) return false;
        if (f.types.length !== a.types.length) return false;
        for (let i = 0; i < f.types.length; i++) {
          const fType = f.types[i];
          const aType = a.types[i];
          if (!fType || !aType) return false;
          if (!unifyRecursive(fType, aType)) return false;
        }
        return true;
      }

      case "dictionaryType":
        return (
          a.kind === "dictionaryType" &&
          unifyRecursive(f.keyType, a.keyType) &&
          unifyRecursive(f.valueType, a.valueType)
        );

      case "functionType": {
        if (a.kind !== "functionType") return false;
        if (f.parameters.length !== a.parameters.length) return false;
        for (let i = 0; i < f.parameters.length; i++) {
          const fParam = f.parameters[i];
          const aParam = a.parameters[i];
          if (!fParam || !aParam) return false;
          if (fParam.type && aParam.type) {
            if (!unifyRecursive(fParam.type, aParam.type)) return false;
          }
        }
        return unifyRecursive(f.returnType, a.returnType);
      }

      // Literal types, any, unknown, void, never - just check equality
      case "literalType":
        return a.kind === "literalType" && f.value === a.value;

      case "anyType":
      case "unknownType":
      case "voidType":
      case "neverType":
        return true; // Kind already matched

      case "objectType":
        // Object types are structural - for now, don't try to unify
        // This is a conservative approach; could be enhanced if needed
        return false;
    }
  };

  const success = unifyRecursive(formal, actual);
  return success && bindings.size > 0 ? bindings : undefined;
};

/**
 * Check if two IrTypes are structurally equal.
 */
const parametersEqual = (left: IrParameter, right: IrParameter): boolean => {
  if (
    left.isOptional !== right.isOptional ||
    left.isRest !== right.isRest ||
    left.passing !== right.passing
  ) {
    return false;
  }

  if (!left.type || !right.type) {
    return left.type === right.type;
  }

  return typesEqual(left.type, right.type);
};

const interfaceMembersEqual = (
  left: IrInterfaceMember,
  right: IrInterfaceMember
): boolean => {
  if (
    left.kind !== right.kind ||
    left.name !== right.name
  ) {
    return false;
  }

  if (left.kind === "propertySignature") {
    return (
      right.kind === "propertySignature" &&
      left.isOptional === right.isOptional &&
      left.isReadonly === right.isReadonly &&
      typesEqual(left.type, right.type)
    );
  }

  if (right.kind !== "methodSignature") {
    return false;
  }

  if (
    (left.typeParameters?.length ?? 0) !==
      (right.typeParameters?.length ?? 0) ||
    left.parameters.length !== right.parameters.length
  ) {
    return false;
  }

  for (let index = 0; index < left.parameters.length; index += 1) {
    const leftParameter = left.parameters[index];
    const rightParameter = right.parameters[index];
    if (
      !leftParameter ||
      !rightParameter ||
      !parametersEqual(leftParameter, rightParameter)
    ) {
      return false;
    }
  }

  if (!left.returnType || !right.returnType) {
    return left.returnType === right.returnType;
  }

  return typesEqual(left.returnType, right.returnType);
};

const structuralReferenceMembersEqual = (
  left: readonly IrInterfaceMember[] | undefined,
  right: readonly IrInterfaceMember[] | undefined
): boolean => {
  if (!left || !right || left.length !== right.length) {
    return false;
  }

  const sortMembers = (
    members: readonly IrInterfaceMember[]
  ): readonly IrInterfaceMember[] =>
    [...members].sort((a, b) =>
      `${a.kind}:${a.name}`.localeCompare(`${b.kind}:${b.name}`)
    );

  const leftMembers = sortMembers(left);
  const rightMembers = sortMembers(right);
  for (let index = 0; index < leftMembers.length; index += 1) {
    const leftMember = leftMembers[index];
    const rightMember = rightMembers[index];
    if (
      !leftMember ||
      !rightMember ||
      !interfaceMembersEqual(leftMember, rightMember)
    ) {
      return false;
    }
  }

  return true;
};

export const typesEqual = (a: IrType, b: IrType): boolean => {
  if (a.kind !== b.kind) return false;

  switch (a.kind) {
    case "primitiveType":
      return b.kind === "primitiveType" && a.name === b.name;

    case "typeParameterType":
      return b.kind === "typeParameterType" && a.name === b.name;

    case "referenceType": {
      if (b.kind !== "referenceType") return false;
      const leftIdentity = referenceTypeIdentity(a);
      const rightIdentity = referenceTypeIdentity(b);
      if (leftIdentity === undefined || rightIdentity === undefined) {
        return structuralReferenceMembersEqual(
          a.structuralMembers,
          b.structuralMembers
        );
      }
      if (leftIdentity !== rightIdentity) {
        return false;
      }

      const aArgs = a.typeArguments ?? [];
      const bArgs = b.typeArguments ?? [];
      if (aArgs.length !== bArgs.length) return false;
      for (let i = 0; i < aArgs.length; i++) {
        const aArg = aArgs[i];
        const bArg = bArgs[i];
        if (!aArg || !bArg || !typesEqual(aArg, bArg)) return false;
      }
      return true;
    }

    case "arrayType":
      return (
        b.kind === "arrayType" &&
        typesEqual(a.elementType, b.elementType) &&
        compareTupleMetadataForEquality(a, b)
      );

    case "tupleType": {
      if (b.kind !== "tupleType") return false;
      if (a.elementTypes.length !== b.elementTypes.length) return false;
      for (let i = 0; i < a.elementTypes.length; i++) {
        const aEl = a.elementTypes[i];
        const bEl = b.elementTypes[i];
        if (!aEl || !bEl || !typesEqual(aEl, bEl)) return false;
      }
      return true;
    }

    case "unionType":
    case "intersectionType": {
      if (b.kind !== a.kind) return false;
      if (a.types.length !== b.types.length) return false;
      for (let i = 0; i < a.types.length; i++) {
        const aType = a.types[i];
        const bType = b.types[i];
        if (!aType || !bType || !typesEqual(aType, bType)) return false;
      }
      return true;
    }

    case "literalType":
      return b.kind === "literalType" && a.value === b.value;

    case "dictionaryType":
      return (
        b.kind === "dictionaryType" &&
        typesEqual(a.keyType, b.keyType) &&
        typesEqual(a.valueType, b.valueType)
      );

    case "functionType": {
      if (b.kind !== "functionType") return false;
      if (a.parameters.length !== b.parameters.length) return false;
      for (let i = 0; i < a.parameters.length; i++) {
        const aParam = a.parameters[i];
        const bParam = b.parameters[i];
        if (!aParam || !bParam) return false;
        if (aParam.type && bParam.type && !typesEqual(aParam.type, bParam.type))
          return false;
      }
      return typesEqual(a.returnType, b.returnType);
    }

    case "objectType":
      // Structural comparison for object types - simplified
      return false;

    case "anyType":
    case "unknownType":
    case "voidType":
    case "neverType":
      return true;
  }
};
