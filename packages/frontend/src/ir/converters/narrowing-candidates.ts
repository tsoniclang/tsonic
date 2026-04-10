import type { IrType } from "../types.js";

type NarrowingCandidateCollector = {
  collectNarrowingCandidates(type: IrType): readonly IrType[];
};

export const collectNarrowingCandidateLeaves = (
  collector: NarrowingCandidateCollector,
  type: IrType
): readonly IrType[] => {
  const expanded = collector.collectNarrowingCandidates(type);
  return expanded.length > 0 ? expanded : [type];
};
