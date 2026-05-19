import { IrType } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import {
  resolveLocalTypeInfo,
  resolveTypeAlias,
  splitRuntimeNullishUnionMembers,
  substituteTypeArgs,
} from "./type-resolution.js";
import {
  BROAD_OBJECT_TYPE,
  getRuntimeUnionReferenceMembers,
} from "./runtime-union-shared.js";
import { referenceTypesShareClrIdentity } from "./clr-type-identity.js";

const BROAD_OBJECT_REFERENCE_TYPE = BROAD_OBJECT_TYPE as Extract<
  IrType,
  { kind: "referenceType" }
>;

const isBroadObjectReferenceType = (type: IrType): boolean =>
  type.kind === "referenceType" &&
  type.name === BROAD_OBJECT_REFERENCE_TYPE.name &&
  referenceTypesShareClrIdentity(type, BROAD_OBJECT_REFERENCE_TYPE);

const toRecursiveFallbackType = (type: IrType): IrType => {
  if (type.kind === "arrayType") {
    return type;
  }

  if (type.kind === "unionType") {
    const split = splitRuntimeNullishUnionMembers(type);
    const nonNullish = split?.nonNullishMembers ?? type.types;
    if (nonNullish.length === 1 && nonNullish[0]?.kind === "arrayType") {
      return nonNullish[0];
    }
  }

  return BROAD_OBJECT_TYPE;
};

const recursiveRuntimeAliasReference = (
  type: IrType,
  aliasTarget: IrType,
  activeAliases: ReadonlySet<string>
): IrType | undefined => {
  if (
    type.kind === "referenceType" &&
    aliasTarget.kind === "unionType" &&
    aliasTarget.runtimeCarrierFamilyKey &&
    activeAliases.has(aliasTarget.runtimeCarrierFamilyKey)
  ) {
    return type;
  }

  return undefined;
};

export const expandRuntimeUnionMembers = (
  type: IrType,
  context: EmitterContext,
  activeAliases: ReadonlySet<string> = new Set<string>(),
  activeTypes: ReadonlySet<object> = new Set<object>(),
  preserveRuntimeCarrierAliasReferences = false
): readonly IrType[] => {
  if (activeTypes.has(type)) {
    return [toRecursiveFallbackType(type)];
  }

  const nextActiveTypes = new Set(activeTypes);
  nextActiveTypes.add(type);

  const split = splitRuntimeNullishUnionMembers(type);
  if (split) {
    const preserveSplitMemberAliases = split.nonNullishMembers.length > 1;
    return split.nonNullishMembers.flatMap((member) =>
      expandRuntimeUnionMembers(
        member,
        context,
        activeAliases,
        nextActiveTypes,
        preserveSplitMemberAliases
      )
    );
  }

  if (type.kind === "intersectionType") {
    const runtimeCarrier = type.types.find(
      (
        member
      ): member is
        | Extract<IrType, { kind: "unionType" }>
        | Extract<IrType, { kind: "referenceType" }> =>
        member.kind === "unionType" ||
        (member.kind === "referenceType" &&
          getRuntimeUnionReferenceMembers(member) !== undefined)
    );
    if (runtimeCarrier) {
      return expandRuntimeUnionMembers(
        runtimeCarrier,
        context,
        activeAliases,
        nextActiveTypes,
        preserveRuntimeCarrierAliasReferences
      );
    }
  }

  if (type.kind === "referenceType") {
    const resolvedCarrierAlias = resolveTypeAlias(type, context);
    if (
      resolvedCarrierAlias.kind === "unionType" &&
      resolvedCarrierAlias.runtimeCarrierFamilyKey
    ) {
      if (preserveRuntimeCarrierAliasReferences) {
        return [type];
      }

      if (
        activeAliases.has(resolvedCarrierAlias.runtimeCarrierFamilyKey) ||
        activeTypes.has(resolvedCarrierAlias)
      ) {
        return [
          recursiveRuntimeAliasReference(
            type,
            resolvedCarrierAlias,
            activeAliases
          ) ?? toRecursiveFallbackType(resolvedCarrierAlias),
        ];
      }
    }

    const runtimeMembers = getRuntimeUnionReferenceMembers(type);
    if (runtimeMembers) {
      return runtimeMembers.flatMap((member) =>
        expandRuntimeUnionMembers(
          member,
          context,
          activeAliases,
          nextActiveTypes,
          true
        )
      );
    }

    const localInfo = resolveLocalTypeInfo(type, context);
    if (localInfo?.info.kind === "typeAlias") {
      if (localInfo.info.type.kind === "objectType") {
        return [type];
      }

      const localName = type.name.includes(".")
        ? (type.name.split(".").pop() ?? type.name)
        : type.name;
      const aliasKey = `${localInfo.namespace}::${localName}`;
      const aliasTarget =
        type.typeArguments && type.typeArguments.length > 0
          ? substituteTypeArgs(
              localInfo.info.type,
              localInfo.info.typeParameters,
              type.typeArguments
            )
          : localInfo.info.type;

      const aliasCarrierKey =
        aliasTarget.kind === "unionType"
          ? aliasTarget.runtimeCarrierFamilyKey
          : undefined;
      if (
        activeAliases.has(aliasKey) ||
        (aliasCarrierKey !== undefined && activeAliases.has(aliasCarrierKey))
      ) {
        return [
          recursiveRuntimeAliasReference(type, aliasTarget, activeAliases) ??
            toRecursiveFallbackType(aliasTarget),
        ];
      }

      const nextActiveAliases = new Set(activeAliases);
      nextActiveAliases.add(aliasKey);
      if (aliasCarrierKey !== undefined) {
        nextActiveAliases.add(aliasCarrierKey);
      }
      return expandRuntimeUnionMembers(
        aliasTarget,
        context,
        nextActiveAliases,
        nextActiveTypes,
        false
      );
    }

    return [type];
  }

  if (type.kind === "unionType") {
    return type.types.flatMap((member) =>
      expandRuntimeUnionMembers(
        member,
        context,
        activeAliases,
        nextActiveTypes,
        true
      )
    );
  }

  if (type.kind === "arrayType") {
    const elementMembers = expandRuntimeUnionMembers(
      type.elementType,
      context,
      activeAliases,
      nextActiveTypes,
      true
    );
    const erasedElementType =
      elementMembers.length === 1
        ? (elementMembers[0] ?? BROAD_OBJECT_TYPE)
        : BROAD_OBJECT_TYPE;
    const needsStorageErasedElementMetadata =
      isBroadObjectReferenceType(erasedElementType);
    return [
      {
        ...type,
        elementType: erasedElementType,
        ...(needsStorageErasedElementMetadata
          ? { storageErasedElementType: type.elementType }
          : {}),
      },
    ];
  }

  return [type];
};

export const collectRuntimeUnionRawMembers = (
  type: IrType,
  context: EmitterContext,
  activeAliases: ReadonlySet<string> = new Set<string>(),
  activeTypes: ReadonlySet<object> = new Set<object>(),
  preserveRuntimeCarrierAliasReferences = false
): readonly IrType[] => {
  if (activeTypes.has(type)) {
    return [type];
  }

  const nextActiveTypes = new Set(activeTypes);
  nextActiveTypes.add(type);

  const split = splitRuntimeNullishUnionMembers(type);
  if (split) {
    const preserveSplitMemberAliases = split.nonNullishMembers.length > 1;
    return split.nonNullishMembers.flatMap((member) =>
      collectRuntimeUnionRawMembers(
        member,
        context,
        activeAliases,
        nextActiveTypes,
        preserveSplitMemberAliases
      )
    );
  }

  if (type.kind === "intersectionType") {
    const runtimeCarrier = type.types.find(
      (
        member
      ): member is
        | Extract<IrType, { kind: "unionType" }>
        | Extract<IrType, { kind: "referenceType" }> =>
        member.kind === "unionType" ||
        (member.kind === "referenceType" &&
          getRuntimeUnionReferenceMembers(member) !== undefined)
    );
    if (runtimeCarrier) {
      return collectRuntimeUnionRawMembers(
        runtimeCarrier,
        context,
        activeAliases,
        nextActiveTypes,
        preserveRuntimeCarrierAliasReferences
      );
    }
  }

  if (type.kind === "referenceType") {
    const resolvedCarrierAlias = resolveTypeAlias(type, context);
    if (
      resolvedCarrierAlias.kind === "unionType" &&
      resolvedCarrierAlias.runtimeCarrierFamilyKey
    ) {
      if (
        activeAliases.has(resolvedCarrierAlias.runtimeCarrierFamilyKey) ||
        activeTypes.has(resolvedCarrierAlias)
      ) {
        return [type];
      }

      if (preserveRuntimeCarrierAliasReferences) {
        return [type];
      }
    }

    const runtimeMembers = getRuntimeUnionReferenceMembers(type);
    if (runtimeMembers) {
      return runtimeMembers.flatMap((member) =>
        collectRuntimeUnionRawMembers(
          member,
          context,
          activeAliases,
          nextActiveTypes,
          true
        )
      );
    }

    const localInfo = resolveLocalTypeInfo(type, context);
    if (localInfo?.info.kind === "typeAlias") {
      if (localInfo.info.type.kind === "objectType") {
        return [type];
      }

      const localName = type.name.includes(".")
        ? (type.name.split(".").pop() ?? type.name)
        : type.name;
      const aliasKey = `${localInfo.namespace}::${localName}`;
      const aliasTarget =
        type.typeArguments && type.typeArguments.length > 0
          ? substituteTypeArgs(
              localInfo.info.type,
              localInfo.info.typeParameters,
              type.typeArguments
            )
          : localInfo.info.type;

      const aliasCarrierKey =
        aliasTarget.kind === "unionType"
          ? aliasTarget.runtimeCarrierFamilyKey
          : undefined;
      if (
        activeAliases.has(aliasKey) ||
        (aliasCarrierKey !== undefined && activeAliases.has(aliasCarrierKey))
      ) {
        return [type];
      }

      const nextActiveAliases = new Set(activeAliases);
      nextActiveAliases.add(aliasKey);
      if (aliasCarrierKey !== undefined) {
        nextActiveAliases.add(aliasCarrierKey);
      }
      return collectRuntimeUnionRawMembers(
        aliasTarget,
        context,
        nextActiveAliases,
        nextActiveTypes,
        false
      );
    }

    const resolved = resolveTypeAlias(type, context);
    if (resolved !== type) {
      return collectRuntimeUnionRawMembers(
        resolved,
        context,
        activeAliases,
        nextActiveTypes,
        preserveRuntimeCarrierAliasReferences
      );
    }
  }

  if (type.kind === "unionType") {
    return type.types.flatMap((member) =>
      collectRuntimeUnionRawMembers(
        member,
        context,
        activeAliases,
        nextActiveTypes,
        true
      )
    );
  }

  return [type];
};
