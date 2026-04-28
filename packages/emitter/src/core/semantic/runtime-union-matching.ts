import { IrType } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import {
  typesHaveDeterministicIdentityConflict,
  typesShareDirectClrIdentity,
} from "./clr-type-identity.js";
import {
  referenceTypesHaveNominalIdentity,
  referenceTypesShareNominalIdentity,
} from "./reference-type-identity.js";
import {
  resolveLocalTypeInfo,
  resolveTypeAlias,
  stripNullish,
  unionMemberMatchesTarget,
} from "./type-resolution.js";
import {
  getContextualTypeVisitKey,
  tryContextualTypeIdentityKey,
} from "./deterministic-type-keys.js";

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

  if (typesHaveDeterministicIdentityConflict(resolvedLeft, resolvedRight)) {
    return false;
  }

  if (referenceTypesHaveNominalIdentity(resolvedLeft, resolvedRight, context)) {
    return referenceTypesShareNominalIdentity(
      resolvedLeft,
      resolvedRight,
      context
    );
  }

  return false;
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
  const targetKey = tryContextualTypeIdentityKey(resolvedTarget, context);
  return members.flatMap((member, index) => {
    if (!member) {
      return [];
    }
    const resolvedMember = resolveTypeAlias(stripNullish(member), context);
    const memberKey = tryContextualTypeIdentityKey(resolvedMember, context);
    if (
      (memberKey !== undefined &&
        targetKey !== undefined &&
        memberKey === targetKey) ||
      typesShareDirectClrIdentity(resolvedMember, resolvedTarget)
    ) {
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

  const targetKey = getContextualTypeVisitKey(target, context);
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

export const runtimeUnionMemberCanAcceptValue = (
  member: IrType,
  candidate: IrType,
  context: EmitterContext
): boolean => {
  if (unionMemberMatchesTarget(member, candidate, context)) {
    return true;
  }

  const resolvedMember = resolveTypeAlias(stripNullish(member), context);
  const resolvedCandidate = resolveTypeAlias(stripNullish(candidate), context);
  if (
    resolvedMember.kind === "referenceType" &&
    resolvedCandidate.kind === "referenceType" &&
    referenceTypeCanContainInstanceofTarget(
      resolvedMember,
      resolvedCandidate,
      context
    )
  ) {
    return true;
  }

  return false;
};

export const findRuntimeUnionAssignableMemberIndices = (
  members: readonly IrType[],
  candidate: IrType,
  context: EmitterContext
): readonly number[] =>
  members.flatMap((member, index) =>
    member && runtimeUnionMemberCanAcceptValue(member, candidate, context)
      ? [index]
      : []
  );

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

    return runtimeUnionMemberCanAcceptValue(member, resolvedTarget, context)
      ? [index]
      : [];
  });
};
