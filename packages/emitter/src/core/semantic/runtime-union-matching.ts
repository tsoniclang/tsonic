import { IrType, stableIrTypeKey } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import {
  resolveLocalTypeInfo,
  resolveTypeAlias,
  stripNullish,
  unionMemberMatchesTarget,
} from "./type-resolution.js";

const referenceTypesHaveExactRuntimeIdentity = (
  left: Extract<IrType, { kind: "referenceType" }>,
  right: Extract<IrType, { kind: "referenceType" }>,
  context: EmitterContext
): boolean => {
  const resolvedLeft = resolveTypeAlias(stripNullish(left), context);
  const resolvedRight = resolveTypeAlias(stripNullish(right), context);

  if (
    resolvedLeft.kind !== "referenceType" ||
    resolvedRight.kind !== "referenceType"
  ) {
    return false;
  }

  const leftStableId = resolvedLeft.typeId?.stableId;
  const rightStableId = resolvedRight.typeId?.stableId;
  if (leftStableId && rightStableId && leftStableId === rightStableId) {
    return true;
  }

  const leftClrName =
    resolvedLeft.resolvedClrType ?? resolvedLeft.typeId?.clrName;
  const rightClrName =
    resolvedRight.resolvedClrType ?? resolvedRight.typeId?.clrName;
  if (leftClrName && rightClrName && leftClrName === rightClrName) {
    return true;
  }

  return resolvedLeft.name === resolvedRight.name;
};

export const findRuntimeUnionMemberIndex = (
  members: readonly IrType[],
  target: IrType,
  context: EmitterContext
): number | undefined => {
  for (let index = 0; index < members.length; index += 1) {
    const member = members[index];
    if (member && unionMemberMatchesTarget(member, target, context)) {
      return index;
    }
  }
  return undefined;
};

export const findRuntimeUnionMemberIndices = (
  members: readonly IrType[],
  target: IrType,
  context: EmitterContext
): readonly number[] =>
  members.flatMap((member, index) =>
    member && unionMemberMatchesTarget(member, target, context) ? [index] : []
  );

export const findExactRuntimeUnionMemberIndices = (
  members: readonly IrType[],
  target: IrType,
  context: EmitterContext
): readonly number[] => {
  const resolvedTarget = resolveTypeAlias(stripNullish(target), context);
  const targetKey = stableIrTypeKey(resolvedTarget);
  return members.flatMap((member, index) => {
    if (!member) {
      return [];
    }
    const resolvedMember = resolveTypeAlias(stripNullish(member), context);
    const memberKey = stableIrTypeKey(resolvedMember);
    if (memberKey === targetKey) {
      return [index];
    }

    if (
      resolvedMember.kind === "referenceType" &&
      resolvedTarget.kind === "referenceType" &&
      referenceTypesHaveExactRuntimeIdentity(
        resolvedMember,
        resolvedTarget,
        context
      )
    ) {
      return [index];
    }

    return [];
  });
};

const referenceTypeCanContainInstanceofTarget = (
  member: Extract<IrType, { kind: "referenceType" }>,
  target: Extract<IrType, { kind: "referenceType" }>,
  context: EmitterContext,
  seen: ReadonlySet<string> = new Set<string>()
): boolean => {
  if (unionMemberMatchesTarget(member, target, context)) {
    return true;
  }

  const targetKey = stableIrTypeKey(target);
  if (seen.has(targetKey)) {
    return false;
  }

  const nextSeen = new Set(seen);
  nextSeen.add(targetKey);

  const info = resolveLocalTypeInfo(target, context)?.info;
  if (!info) {
    return false;
  }

  if (info.kind === "class") {
    if (info.superClass) {
      const resolvedSuper = resolveTypeAlias(info.superClass, context);
      if (
        resolvedSuper.kind === "referenceType" &&
        referenceTypeCanContainInstanceofTarget(
          member,
          resolvedSuper,
          context,
          nextSeen
        )
      ) {
        return true;
      }
    }

    for (const implemented of info.implements) {
      const resolvedImplemented = resolveTypeAlias(implemented, context);
      if (
        resolvedImplemented.kind === "referenceType" &&
        referenceTypeCanContainInstanceofTarget(
          member,
          resolvedImplemented,
          context,
          nextSeen
        )
      ) {
        return true;
      }
    }
  }

  if (info.kind === "interface") {
    for (const extended of info.extends) {
      const resolvedExtended = resolveTypeAlias(extended, context);
      if (
        resolvedExtended.kind === "referenceType" &&
        referenceTypeCanContainInstanceofTarget(
          member,
          resolvedExtended,
          context,
          nextSeen
        )
      ) {
        return true;
      }
    }
  }

  return false;
};

export const findRuntimeUnionInstanceofMemberIndices = (
  members: readonly IrType[],
  target: IrType,
  context: EmitterContext
): readonly number[] => {
  const resolvedTarget = resolveTypeAlias(stripNullish(target), context);

  return members.flatMap((member, index) => {
    if (!member) {
      return [];
    }

    if (unionMemberMatchesTarget(member, resolvedTarget, context)) {
      return [index];
    }

    const resolvedMember = resolveTypeAlias(stripNullish(member), context);
    if (
      resolvedMember.kind === "referenceType" &&
      resolvedTarget.kind === "referenceType" &&
      referenceTypeCanContainInstanceofTarget(
        resolvedMember,
        resolvedTarget,
        context
      )
    ) {
      return [index];
    }

    return [];
  });
};
