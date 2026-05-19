import { isAwaitableIrType, type IrType } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import {
  collectRuntimeUnionRawMembers,
  expandRuntimeUnionMembers,
} from "./runtime-union-expansion.js";
import { areIrTypesEquivalent } from "./type-equivalence.js";
import { getRuntimeUnionMemberSortKey } from "./runtime-union-ordering.js";
import {
  resolveTypeAlias,
  splitRuntimeNullishUnionMembers,
} from "./type-resolution.js";
import { matchesSemanticExpectedType } from "./expected-type-matching.js";
import { isBroadObjectSlotType } from "./broad-object-types.js";
import { tryContextualTypeIdentityKey } from "./deterministic-type-keys.js";
import type { RuntimeUnionFrame } from "./runtime-union-shared.js";

export const buildRuntimeUnionFrame = (
  type: IrType,
  context: EmitterContext
): RuntimeUnionFrame | undefined => {
  const frameSourceType =
    type.kind === "referenceType" ? resolveTypeAlias(type, context) : type;
  const members = getCanonicalRuntimeUnionMembers(frameSourceType, context);
  if (!members) {
    return undefined;
  }
  if (
    frameSourceType.kind === "unionType" &&
    shouldEraseRuntimeUnionToBroadObjectStorage(
      frameSourceType,
      members,
      context
    )
  ) {
    return undefined;
  }

  return {
    members,
    runtimeUnionArity: members.length,
  };
};

const shouldEraseRuntimeUnionToBroadObjectStorage = (
  sourceType: Extract<IrType, { kind: "unionType" }>,
  runtimeMembers: readonly IrType[],
  context: EmitterContext
): boolean => {
  const split = splitRuntimeNullishUnionMembers(sourceType);
  const nonNullishMembers = split?.nonNullishMembers ?? sourceType.types;
  if (nonNullishMembers.length === 1) {
    return isBroadObjectSlotType(nonNullishMembers[0], context);
  }

  if (runtimeMembers.some((member) => isAwaitableIrType(member))) {
    return false;
  }

  return (
    runtimeMembers.length > 1 &&
    runtimeMembers.some((member) => isBroadObjectSlotType(member, context))
  );
};

export const getCanonicalRuntimeUnionMembers = (
  type: IrType,
  context: EmitterContext
): readonly IrType[] | undefined => {
  const canonicalSourceType =
    type.kind === "referenceType" ? resolveTypeAlias(type, context) : type;
  const hasCarrierSlotLayout =
    canonicalSourceType.kind === "unionType" &&
    canonicalSourceType.runtimeUnionLayout === "carrierSlotOrder";
  const activeAliases =
    canonicalSourceType.kind === "unionType" &&
    canonicalSourceType.runtimeCarrierFamilyKey
      ? new Set<string>([canonicalSourceType.runtimeCarrierFamilyKey])
      : new Set<string>();
  const semanticMembers = hasCarrierSlotLayout
    ? collectRuntimeUnionRawMembers(canonicalSourceType, context, activeAliases)
    : expandRuntimeUnionMembers(canonicalSourceType, context, activeAliases);
  if (semanticMembers.length < 2) {
    return undefined;
  }

  if (hasCarrierSlotLayout) {
    return semanticMembers;
  }

  const mergeEquivalentRuntimeUnionMembers = (
    existing: IrType,
    candidate: IrType
  ): IrType => {
    if (existing.kind !== "arrayType" || candidate.kind !== "arrayType") {
      return candidate;
    }

    const existingSemanticElementType =
      existing.storageErasedElementType ?? existing.elementType;
    const candidateSemanticElementType =
      candidate.storageErasedElementType ?? candidate.elementType;
    const getSemanticArrayOwnerBreadth = (elementType: IrType): number => {
      const resolved = resolveTypeAlias(elementType, context);
      return resolved.kind === "unionType" ? resolved.types.length : 1;
    };

    const candidateAcceptsExisting = matchesSemanticExpectedType(
      existingSemanticElementType,
      candidateSemanticElementType,
      context
    );
    const existingAcceptsCandidate = matchesSemanticExpectedType(
      candidateSemanticElementType,
      existingSemanticElementType,
      context
    );
    const candidateBreadth = getSemanticArrayOwnerBreadth(
      candidateSemanticElementType
    );
    const existingBreadth = getSemanticArrayOwnerBreadth(
      existingSemanticElementType
    );

    const preferredBase =
      candidateAcceptsExisting && !existingAcceptsCandidate
        ? candidate
        : existingAcceptsCandidate && !candidateAcceptsExisting
          ? existing
          : candidateBreadth !== existingBreadth
            ? candidateBreadth > existingBreadth
              ? candidate
              : existing
            : candidate.storageErasedElementType &&
                !existing.storageErasedElementType
              ? candidate
              : existing.storageErasedElementType &&
                  !candidate.storageErasedElementType
                ? existing
                : (() => {
                    const candidateKey = tryContextualTypeIdentityKey(
                      candidateSemanticElementType,
                      context
                    );
                    const existingKey = tryContextualTypeIdentityKey(
                      existingSemanticElementType,
                      context
                    );
                    return candidateKey &&
                      existingKey &&
                      candidateKey.localeCompare(existingKey) < 0
                      ? existing
                      : candidate;
                  })();

    const preferredSemanticElementType =
      preferredBase === candidate
        ? candidateSemanticElementType
        : existingSemanticElementType;

    return preferredBase.storageErasedElementType ===
      preferredSemanticElementType
      ? preferredBase
      : {
          ...preferredBase,
          storageErasedElementType: preferredSemanticElementType,
        };
  };

  const deduped: IrType[] = [];
  for (const member of semanticMembers) {
    const existingIndex = deduped.findIndex((existing) =>
      areIrTypesEquivalent(existing, member, context)
    );
    if (existingIndex < 0) {
      deduped.push(member);
      continue;
    }

    const existing = deduped[existingIndex];
    if (existing) {
      deduped[existingIndex] = mergeEquivalentRuntimeUnionMembers(
        existing,
        member
      );
    }
  }

  return deduped
    .map((member, index) => ({ member, index }))
    .sort((left, right) => {
      const leftKey = getRuntimeUnionMemberSortKey(left.member, context);
      const rightKey = getRuntimeUnionMemberSortKey(right.member, context);
      if (leftKey !== rightKey) {
        return leftKey.localeCompare(rightKey);
      }
      const leftStableKey = tryContextualTypeIdentityKey(left.member, context);
      const rightStableKey = tryContextualTypeIdentityKey(
        right.member,
        context
      );
      if (leftStableKey && rightStableKey && leftStableKey !== rightStableKey) {
        return leftStableKey.localeCompare(rightStableKey);
      }
      return left.index - right.index;
    })
    .map(({ member }) => member);
};
