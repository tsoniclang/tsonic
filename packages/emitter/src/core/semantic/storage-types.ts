import { IrType, isAwaitableIrType, stableIrTypeKey } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import { getCanonicalRuntimeUnionMembers } from "./runtime-unions.js";
import {
  resolveTypeAlias,
  splitRuntimeNullishUnionMembers,
} from "./type-resolution.js";
import { rebuildUnionTypePreservingCarrierFamily } from "./runtime-union-family-preservation.js";
import { isBroadObjectSlotType } from "./js-value-types.js";

const OBJECT_STORAGE_TYPE: IrType = {
  kind: "referenceType",
  name: "object",
  resolvedClrType: "System.Object",
};

export const isObjectStorageType = (
  type: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!type) {
    return false;
  }

  const resolved = resolveTypeAlias(type, context);
  return (
    resolved.kind === "referenceType" &&
    (resolved.name === "object" ||
      resolved.resolvedClrType === "System.Object" ||
      resolved.resolvedClrType === "global::System.Object")
  );
};

export function shouldUseBroadObjectForUnionStorage(
  type: Extract<IrType, { kind: "unionType" }>,
  context: EmitterContext,
  activeArrayKeys: ReadonlySet<string> = new Set<string>()
): boolean {
  const split = splitRuntimeNullishUnionMembers(type);
  const nonNullishMembers = split?.nonNullishMembers ?? type.types;
  if (nonNullishMembers.length < 2) {
    return false;
  }

  const canonicalRuntimeMembers = getCanonicalRuntimeUnionMembers(
    rebuildUnionTypePreservingCarrierFamily(type, nonNullishMembers),
    context
  );
  const runtimeMembers =
    canonicalRuntimeMembers && canonicalRuntimeMembers.length > 1
      ? canonicalRuntimeMembers
      : nonNullishMembers;
  if (
    runtimeMembers.length < 2 ||
    runtimeMembers.some((member) => isAwaitableIrType(member))
  ) {
    return false;
  }

  const normalizedMembers: IrType[] = [];
  for (const member of runtimeMembers) {
    const normalizedMember =
      normalizeRuntimeStorageType(member, context, activeArrayKeys) ?? member;
    if (
      normalizedMembers.some(
        (candidate) =>
          stableIrTypeKey(candidate) === stableIrTypeKey(normalizedMember)
      )
    ) {
      continue;
    }
    normalizedMembers.push(normalizedMember);
  }

  return (
    normalizedMembers.length > 1 &&
    normalizedMembers.some((member) => isBroadObjectSlotType(member, context))
  );
}

const isInScopeTypeParameter = (
  name: string,
  context: EmitterContext
): boolean => context.typeParameters?.has(name) ?? false;

const isRuntimeNullishMember = (type: IrType): boolean =>
  type.kind === "primitiveType" &&
  (type.name === "null" || type.name === "undefined");

const getBareUnconstrainedTypeParameter = (
  type: IrType,
  context: EmitterContext
): string | undefined => {
  if (type.kind !== "typeParameterType") {
    return undefined;
  }

  const constraintKind =
    context.typeParamConstraints?.get(type.name) ?? "unconstrained";
  if (constraintKind !== "unconstrained") {
    return undefined;
  }

  if (isInScopeTypeParameter(type.name, context)) {
    return context.eraseNullableUnconstrainedTypeParameterStorage
      ? type.name
      : undefined;
  }

  return type.name;
};

const normalizeOutOfScopeTypeParameters = (
  type: IrType,
  context: EmitterContext,
  visited: WeakSet<object> = new WeakSet<object>()
): IrType => {
  if (typeof type === "object" && type !== null) {
    if (visited.has(type)) {
      return type;
    }
    visited.add(type);
  }

  if (type.kind === "referenceType") {
    const resolvedAlias = resolveTypeAlias(type, context, {
      preserveObjectTypeAliases: true,
    });
    if (
      resolvedAlias.kind === "unionType" &&
      resolvedAlias.runtimeCarrierFamilyKey
    ) {
      if (!type.typeArguments || type.typeArguments.length === 0) {
        return type;
      }

      const normalizedTypeArguments = type.typeArguments.map((typeArgument) =>
        normalizeOutOfScopeTypeParameters(typeArgument, context, visited)
      );
      return normalizedTypeArguments.every(
        (typeArgument, index) =>
          stableIrTypeKey(typeArgument) ===
          stableIrTypeKey(type.typeArguments?.[index] ?? typeArgument)
      )
        ? type
        : {
            ...type,
            typeArguments: normalizedTypeArguments,
          };
    }
  }

  const resolved = resolveTypeAlias(type, context, {
    preserveObjectTypeAliases: true,
  });

  switch (resolved.kind) {
    case "typeParameterType":
      return isInScopeTypeParameter(resolved.name, context)
        ? resolved
        : OBJECT_STORAGE_TYPE;

    case "arrayType": {
      const normalizedElementType = normalizeOutOfScopeTypeParameters(
        resolved.elementType,
        context,
        visited
      );
      return stableIrTypeKey(normalizedElementType) ===
        stableIrTypeKey(resolved.elementType)
        ? resolved
        : {
            ...resolved,
            elementType: normalizedElementType,
          };
    }

    case "dictionaryType": {
      const normalizedKeyType = normalizeOutOfScopeTypeParameters(
        resolved.keyType,
        context,
        visited
      );
      const normalizedValueType = normalizeOutOfScopeTypeParameters(
        resolved.valueType,
        context,
        visited
      );
      return stableIrTypeKey(normalizedKeyType) ===
        stableIrTypeKey(resolved.keyType) &&
        stableIrTypeKey(normalizedValueType) ===
          stableIrTypeKey(resolved.valueType)
        ? resolved
        : {
            ...resolved,
            keyType: normalizedKeyType,
            valueType: normalizedValueType,
          };
    }

    case "tupleType": {
      const normalizedElementTypes = resolved.elementTypes.map((elementType) =>
        normalizeOutOfScopeTypeParameters(elementType, context, visited)
      );
      return normalizedElementTypes.every(
        (elementType, index) =>
          stableIrTypeKey(elementType) ===
          stableIrTypeKey(resolved.elementTypes[index] ?? elementType)
      )
        ? resolved
        : {
            ...resolved,
            elementTypes: normalizedElementTypes,
          };
    }

    case "referenceType": {
      if (!resolved.typeArguments || resolved.typeArguments.length === 0) {
        return resolved;
      }

      const normalizedTypeArguments = resolved.typeArguments.map((typeArg) =>
        normalizeOutOfScopeTypeParameters(typeArg, context, visited)
      );
      return normalizedTypeArguments.every(
        (typeArg, index) =>
          stableIrTypeKey(typeArg) ===
          stableIrTypeKey(resolved.typeArguments?.[index] ?? typeArg)
      )
        ? resolved
        : {
            ...resolved,
            typeArguments: normalizedTypeArguments,
          };
    }

    case "unionType": {
      const normalizedMembers = resolved.types.map((member) =>
        normalizeOutOfScopeTypeParameters(member, context, visited)
      );
      return normalizedMembers.every(
        (member, index) =>
          stableIrTypeKey(member) ===
          stableIrTypeKey(resolved.types[index] ?? member)
      )
        ? resolved
        : {
            ...resolved,
            types: normalizedMembers,
          };
    }

    case "functionType": {
      const normalizedParameters = resolved.parameters.map((parameter) => {
        if (!parameter.type) {
          return parameter;
        }

        const normalizedParameterType = normalizeOutOfScopeTypeParameters(
          parameter.type,
          context,
          visited
        );
        return stableIrTypeKey(normalizedParameterType) ===
          stableIrTypeKey(parameter.type)
          ? parameter
          : {
              ...parameter,
              type: normalizedParameterType,
            };
      });
      const normalizedReturnType = normalizeOutOfScopeTypeParameters(
        resolved.returnType,
        context,
        visited
      );
      return normalizedParameters.every(
        (parameter, index) =>
          stableIrTypeKey(parameter.type ?? { kind: "voidType" }) ===
          stableIrTypeKey(
            resolved.parameters[index]?.type ?? { kind: "voidType" }
          )
      ) &&
        stableIrTypeKey(normalizedReturnType) ===
          stableIrTypeKey(resolved.returnType)
        ? resolved
        : {
            ...resolved,
            parameters: normalizedParameters,
            returnType: normalizedReturnType,
          };
    }

    case "intersectionType": {
      const normalizedMembers = resolved.types.map((member) =>
        normalizeOutOfScopeTypeParameters(member, context, visited)
      );
      return normalizedMembers.every(
        (member, index) =>
          stableIrTypeKey(member) ===
          stableIrTypeKey(resolved.types[index] ?? member)
      )
        ? resolved
        : {
            ...resolved,
            types: normalizedMembers,
          };
    }

    default:
      return resolved;
  }
};

export const normalizeRuntimeStorageType = (
  type: IrType | undefined,
  context: EmitterContext,
  activeArrayKeys: ReadonlySet<string> = new Set<string>()
): IrType | undefined => {
  if (!type) {
    return undefined;
  }

  if (type.kind === "referenceType") {
    const resolvedAlias = resolveTypeAlias(type, context, {
      preserveObjectTypeAliases: true,
    });
    if (
      resolvedAlias.kind === "unionType" &&
      resolvedAlias.runtimeCarrierFamilyKey
    ) {
      if (!type.typeArguments || type.typeArguments.length === 0) {
        return type;
      }

      const normalizedTypeArguments = type.typeArguments.map((typeArgument) =>
        normalizeOutOfScopeTypeParameters(typeArgument, context)
      );
      return normalizedTypeArguments.every(
        (typeArgument, index) =>
          stableIrTypeKey(typeArgument) ===
          stableIrTypeKey(type.typeArguments?.[index] ?? typeArgument)
      )
        ? type
        : {
            ...type,
            typeArguments: normalizedTypeArguments,
          };
    }
  }

  const resolved = normalizeOutOfScopeTypeParameters(type, context);

  if (
    resolved.kind === "unknownType" ||
    resolved.kind === "anyType" ||
    resolved.kind === "objectType" ||
    (resolved.kind === "referenceType" && resolved.name === "object")
  ) {
    return OBJECT_STORAGE_TYPE;
  }

  if (resolved.kind === "literalType") {
    switch (typeof resolved.value) {
      case "string":
        return { kind: "primitiveType", name: "string" };
      case "number":
        return { kind: "primitiveType", name: "number" };
      case "boolean":
        return { kind: "primitiveType", name: "boolean" };
      default:
        return resolved;
    }
  }

  if (resolved.kind === "arrayType") {
    const arrayKey = stableIrTypeKey(resolved);
    if (activeArrayKeys.has(arrayKey)) {
      return resolved;
    }

    const nextActive = new Set(activeArrayKeys);
    nextActive.add(arrayKey);
    const normalizedElementType =
      normalizeRuntimeStorageType(resolved.elementType, context, nextActive) ??
      resolved.elementType;

    return stableIrTypeKey(normalizedElementType) ===
      stableIrTypeKey(resolved.elementType)
      ? resolved
      : {
          ...resolved,
          elementType: normalizedElementType,
        };
  }

  if (resolved.kind === "unionType") {
    if (
      shouldUseBroadObjectForUnionStorage(resolved, context, activeArrayKeys)
    ) {
      const split = splitRuntimeNullishUnionMembers(resolved);
      const nullishMembers = resolved.types.filter(isRuntimeNullishMember);
      return split?.hasRuntimeNullish
        ? rebuildUnionTypePreservingCarrierFamily(resolved, [
            OBJECT_STORAGE_TYPE,
            ...nullishMembers,
          ])
        : OBJECT_STORAGE_TYPE;
    }

    const topLevelSplit = splitRuntimeNullishUnionMembers(resolved);
    const topLevelNonNullishMembers =
      topLevelSplit?.nonNullishMembers ?? resolved.types;
    const canonicalRuntimeMembers =
      topLevelNonNullishMembers.length > 1
        ? getCanonicalRuntimeUnionMembers(
            rebuildUnionTypePreservingCarrierFamily(
              resolved,
              topLevelNonNullishMembers
            ),
            context
          )
        : undefined;

    if (canonicalRuntimeMembers && canonicalRuntimeMembers.length > 1) {
      const normalizedCanonicalMembers: IrType[] = [];
      for (const member of canonicalRuntimeMembers) {
        const normalizedMember =
          normalizeRuntimeStorageType(member, context, activeArrayKeys) ??
          member;
        if (
          normalizedCanonicalMembers.some(
            (candidate) =>
              stableIrTypeKey(candidate) === stableIrTypeKey(normalizedMember)
          )
        ) {
          continue;
        }
        normalizedCanonicalMembers.push(normalizedMember);
      }

      if (!topLevelSplit?.hasRuntimeNullish) {
        return rebuildUnionTypePreservingCarrierFamily(
          resolved,
          normalizedCanonicalMembers
        );
      }

      const directNullishMembers = resolved.types.filter(
        isRuntimeNullishMember
      );
      return rebuildUnionTypePreservingCarrierFamily(resolved, [
        ...normalizedCanonicalMembers,
        ...directNullishMembers,
      ]);
    }

    const split = splitRuntimeNullishUnionMembers(resolved);
    if (split) {
      const normalizedNonNullishMembers = split.nonNullishMembers.map(
        (member) =>
          normalizeRuntimeStorageType(member, context, activeArrayKeys) ??
          member
      );
      const dedupedNormalizedNonNullishMembers: IrType[] = [];

      for (const member of normalizedNonNullishMembers) {
        if (
          dedupedNormalizedNonNullishMembers.some(
            (candidate) =>
              stableIrTypeKey(candidate) === stableIrTypeKey(member)
          )
        ) {
          continue;
        }
        dedupedNormalizedNonNullishMembers.push(member);
      }

      if (dedupedNormalizedNonNullishMembers.length === 1) {
        const [normalizedSingleMember] = dedupedNormalizedNonNullishMembers;
        const [originalSingleMember] = split.nonNullishMembers;
        if (!normalizedSingleMember) {
          return resolved;
        }

        const nullishMembers = resolved.types.filter(isRuntimeNullishMember);
        if (
          originalSingleMember &&
          getBareUnconstrainedTypeParameter(originalSingleMember, context)
        ) {
          return nullishMembers.length === 0
            ? OBJECT_STORAGE_TYPE
            : {
                kind: "unionType",
                types: [OBJECT_STORAGE_TYPE, ...nullishMembers],
              };
        }
        return nullishMembers.length === 0
          ? normalizedSingleMember
          : rebuildUnionTypePreservingCarrierFamily(resolved, [
              normalizedSingleMember,
              ...nullishMembers,
            ]);
      }
    }

    if (!split || split.nonNullishMembers.length !== 1) {
      return resolved;
    }

    const nonNullishMember = split.nonNullishMembers[0];
    if (!nonNullishMember) {
      return resolved;
    }
    if (getBareUnconstrainedTypeParameter(nonNullishMember, context)) {
      return {
        kind: "unionType",
        types: resolved.types.map((member) =>
          isRuntimeNullishMember(member) ? member : OBJECT_STORAGE_TYPE
        ),
      };
    }
    const normalizedNonNullishMember =
      normalizeRuntimeStorageType(nonNullishMember, context, activeArrayKeys) ??
      nonNullishMember;

    if (
      stableIrTypeKey(normalizedNonNullishMember) ===
      stableIrTypeKey(nonNullishMember)
    ) {
      return resolved;
    }

    return rebuildUnionTypePreservingCarrierFamily(
      resolved,
      resolved.types.map((member) =>
        isRuntimeNullishMember(member) ? member : normalizedNonNullishMember
      )
    );
  }

  return resolved;
};
