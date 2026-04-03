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

export const expandRuntimeUnionMembers = (
  type: IrType,
  context: EmitterContext,
  activeAliases: ReadonlySet<string> = new Set<string>(),
  activeTypes: ReadonlySet<object> = new Set<object>()
): readonly IrType[] => {
  if (activeTypes.has(type)) {
    return [toRecursiveFallbackType(type)];
  }

  const nextActiveTypes = new Set(activeTypes);
  nextActiveTypes.add(type);

  const split = splitRuntimeNullishUnionMembers(type);
  if (split) {
    return split.nonNullishMembers.flatMap((member) =>
      expandRuntimeUnionMembers(member, context, activeAliases, nextActiveTypes)
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
        nextActiveTypes
      );
    }
  }

  if (type.kind === "referenceType") {
    const runtimeMembers = getRuntimeUnionReferenceMembers(type);
    if (runtimeMembers) {
      return runtimeMembers.flatMap((member) =>
        expandRuntimeUnionMembers(
          member,
          context,
          activeAliases,
          nextActiveTypes
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

      if (activeAliases.has(aliasKey)) {
        return [toRecursiveFallbackType(aliasTarget)];
      }

      const nextActiveAliases = new Set(activeAliases);
      nextActiveAliases.add(aliasKey);
      return expandRuntimeUnionMembers(
        aliasTarget,
        context,
        nextActiveAliases,
        nextActiveTypes
      );
    }

    return [type];
  }

  if (type.kind === "unionType") {
    return type.types.flatMap((member) =>
      expandRuntimeUnionMembers(member, context, activeAliases, nextActiveTypes)
    );
  }

  if (type.kind === "arrayType") {
    const elementMembers = expandRuntimeUnionMembers(
      type.elementType,
      context,
      activeAliases,
      nextActiveTypes
    );
    if (elementMembers.length !== 1) {
      return [
        {
          kind: "arrayType",
          elementType: BROAD_OBJECT_TYPE,
          origin: type.origin,
        },
      ];
    }

    return [
      {
        ...type,
        elementType: elementMembers[0] ?? BROAD_OBJECT_TYPE,
      },
    ];
  }

  return [type];
};

export const collectRuntimeUnionRawMembers = (
  type: IrType,
  context: EmitterContext,
  activeAliases: ReadonlySet<string> = new Set<string>(),
  activeTypes: ReadonlySet<object> = new Set<object>()
): readonly IrType[] => {
  if (activeTypes.has(type)) {
    return [type];
  }

  const nextActiveTypes = new Set(activeTypes);
  nextActiveTypes.add(type);

  const split = splitRuntimeNullishUnionMembers(type);
  if (split) {
    return split.nonNullishMembers.flatMap((member) =>
      collectRuntimeUnionRawMembers(
        member,
        context,
        activeAliases,
        nextActiveTypes
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
        nextActiveTypes
      );
    }
  }

  if (type.kind === "referenceType") {
    const runtimeMembers = getRuntimeUnionReferenceMembers(type);
    if (runtimeMembers) {
      return runtimeMembers.flatMap((member) =>
        collectRuntimeUnionRawMembers(
          member,
          context,
          activeAliases,
          nextActiveTypes
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

      if (activeAliases.has(aliasKey)) {
        return [type];
      }

      const nextActiveAliases = new Set(activeAliases);
      nextActiveAliases.add(aliasKey);
      return collectRuntimeUnionRawMembers(
        aliasTarget,
        context,
        nextActiveAliases,
        nextActiveTypes
      );
    }

    const resolved = resolveTypeAlias(type, context);
    if (resolved !== type) {
      return collectRuntimeUnionRawMembers(
        resolved,
        context,
        activeAliases,
        nextActiveTypes
      );
    }
  }

  if (type.kind === "unionType") {
    return type.types.flatMap((member) =>
      collectRuntimeUnionRawMembers(
        member,
        context,
        activeAliases,
        nextActiveTypes
      )
    );
  }

  return [type];
};

export const isRuntimeUnionElementFamily = (
  type: IrType,
  context: EmitterContext,
  activeAliases: ReadonlySet<string> = new Set<string>(),
  activeTypes: ReadonlySet<object> = new Set<object>()
): boolean => {
  if (activeTypes.has(type)) {
    return true;
  }

  const nextActiveTypes = new Set(activeTypes);
  nextActiveTypes.add(type);

  const split = splitRuntimeNullishUnionMembers(type);
  if (split) {
    if (split.nonNullishMembers.length > 1) {
      return true;
    }
    const onlyMember = split.nonNullishMembers[0];
    return onlyMember
      ? isRuntimeUnionElementFamily(
          onlyMember,
          context,
          activeAliases,
          nextActiveTypes
        )
      : false;
  }

  if (type.kind === "unionType") {
    return true;
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
    return runtimeCarrier
      ? isRuntimeUnionElementFamily(
          runtimeCarrier,
          context,
          activeAliases,
          nextActiveTypes
        )
      : false;
  }

  if (type.kind === "arrayType") {
    return isRuntimeUnionElementFamily(
      type.elementType,
      context,
      activeAliases,
      nextActiveTypes
    );
  }

  if (type.kind === "referenceType") {
    if (getRuntimeUnionReferenceMembers(type)) {
      return true;
    }

    const localInfo = resolveLocalTypeInfo(type, context);
    if (localInfo?.info.kind === "typeAlias") {
      if (localInfo.info.type.kind === "objectType") {
        return false;
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

      if (activeAliases.has(aliasKey)) {
        return true;
      }

      const nextActiveAliases = new Set(activeAliases);
      nextActiveAliases.add(aliasKey);
      return isRuntimeUnionElementFamily(
        aliasTarget,
        context,
        nextActiveAliases,
        nextActiveTypes
      );
    }

    const resolved = resolveTypeAlias(type, context);
    if (resolved !== type) {
      return isRuntimeUnionElementFamily(
        resolved,
        context,
        activeAliases,
        nextActiveTypes
      );
    }
  }

  return false;
};

export const hasRuntimeUnionArrayMemberWithRuntimeUnionElements = (
  type: IrType,
  context: EmitterContext
): boolean => {
  return collectRuntimeUnionRawMembers(type, context).some((member) => {
    const resolvedMember = resolveTypeAlias(member, context);
    return (
      resolvedMember.kind === "arrayType" &&
      isRuntimeUnionElementFamily(resolvedMember.elementType, context)
    );
  });
};

export const shouldEraseRecursiveRuntimeUnionArrayElement = (
  type: IrType,
  context: EmitterContext
): boolean => {
  return hasRuntimeUnionArrayMemberWithRuntimeUnionElements(type, context);
};
