import type { IrType } from "../types.js";
import { normalizedUnionType } from "../types/type-ops.js";

type NarrowingCandidateCollector = {
  collectNarrowingCandidates(type: IrType): readonly IrType[];
};

const isArrayLikeCandidate = (type: IrType): boolean =>
  type.kind === "arrayType" || type.kind === "tupleType";

const UNKNOWN_ARRAY_TYPE: IrType = {
  kind: "arrayType",
  elementType: { kind: "unknownType" },
};

export const narrowTypeByArrayShape = (
  collector: NarrowingCandidateCollector,
  currentType: IrType | undefined,
  wantArray: boolean
): IrType | undefined => {
  if (!currentType) return undefined;

  if (wantArray) {
    if (currentType.kind === "unknownType" || currentType.kind === "anyType") {
      return UNKNOWN_ARRAY_TYPE;
    }

    if (currentType.kind === "referenceType" && currentType.name === "object") {
      return UNKNOWN_ARRAY_TYPE;
    }
  }

  const expanded = collector.collectNarrowingCandidates(currentType);
  const candidates = expanded.length > 0 ? expanded : [currentType];
  const kept = candidates.filter((member): member is IrType => {
    if (!member) return false;
    return wantArray
      ? isArrayLikeCandidate(member)
      : !isArrayLikeCandidate(member);
  });

  if (kept.length === 0) return undefined;
  if (kept.length === 1) return kept[0];
  return normalizedUnionType(kept);
};
