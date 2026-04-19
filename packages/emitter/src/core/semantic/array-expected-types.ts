import type { IrType } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import { rebuildUnionTypePreservingCarrierFamily } from "./runtime-union-family-preservation.js";
import {
  getArrayLikeElementType,
  resolveTypeAlias,
  splitRuntimeNullishUnionMembers,
  stripNullish,
} from "./type-resolution.js";
import { stableIrTypeKey } from "@tsonic/frontend";

export const resolveArrayLiteralContextType = (
  expectedType: IrType | undefined,
  context: EmitterContext
): IrType | undefined => {
  if (!expectedType) return undefined;

  const strippedExpected = stripNullish(expectedType);
  const resolvedExpected = resolveTypeAlias(strippedExpected, context);
  if (resolvedExpected.kind !== "unionType") {
    return strippedExpected;
  }

  const collectArrayLiteralContextCandidates = (
    type: IrType,
    visited: Set<string> = new Set<string>()
  ): readonly IrType[] => {
    const stripped = stripNullish(type);
    const visitKey = stableIrTypeKey(stripped);
    if (visited.has(visitKey)) {
      return [];
    }
    visited.add(visitKey);

    if (getArrayLikeElementType(stripped, context) !== undefined) {
      return [stripped];
    }

    const resolved = resolveTypeAlias(stripped, context);
    if (resolved.kind === "tupleType") {
      return [stripped];
    }

    if (resolved.kind !== "unionType") {
      return [];
    }

    return resolved.types.flatMap((member) =>
      collectArrayLiteralContextCandidates(member, visited)
    );
  };

  const arrayLikeMembers = resolvedExpected.types.flatMap((member) =>
    collectArrayLiteralContextCandidates(member)
  );

  const uniqueArrayLikeMembers = Array.from(
    new Map(
      arrayLikeMembers.map(
        (member) => [stableIrTypeKey(member), member] as const
      )
    ).values()
  );

  if (uniqueArrayLikeMembers.length === 1) {
    return uniqueArrayLikeMembers[0];
  }

  const concreteArrayMembers = uniqueArrayLikeMembers.filter(
    (member): member is Extract<IrType, { kind: "arrayType" }> =>
      resolveTypeAlias(stripNullish(member), context).kind === "arrayType"
  );

  if (concreteArrayMembers.length === 1) {
    return concreteArrayMembers[0];
  }

  return strippedExpected;
};

export const normalizeRecursiveArrayExpectedType = (
  type: IrType | undefined,
  context: EmitterContext
): IrType | undefined => {
  if (!type) {
    return undefined;
  }

  const split = splitRuntimeNullishUnionMembers(type);
  if (
    type.kind === "unionType" &&
    split?.hasRuntimeNullish &&
    split.nonNullishMembers.length === 1
  ) {
    const [member] = split.nonNullishMembers;
    const normalizedMember = normalizeRecursiveArrayExpectedType(
      member,
      context
    );
    if (!normalizedMember) {
      return type;
    }

    return rebuildUnionTypePreservingCarrierFamily(type, [
      ...type.types.filter(
        (candidate: IrType) =>
          candidate.kind === "primitiveType" &&
          (candidate.name === "null" || candidate.name === "undefined")
      ),
      normalizedMember,
    ]);
  }

  return type;
};
