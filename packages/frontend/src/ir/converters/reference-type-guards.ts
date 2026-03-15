import type { IrType } from "../types.js";
import { normalizedUnionType } from "../types/type-ops.js";

type AssignabilityCollector = {
  collectNarrowingCandidates(type: IrType): readonly IrType[];
  isAssignableTo(source: IrType, target: IrType): boolean;
};

export const narrowTypeByAssignableTarget = (
  collector: AssignabilityCollector,
  currentType: IrType | undefined,
  targetType: IrType,
  wantAssignable: boolean
): IrType | undefined => {
  if (!currentType || currentType.kind === "unknownType") {
    return wantAssignable ? targetType : undefined;
  }

  if (currentType.kind === "unionType") {
    const directMembers = currentType.types.filter(
      (member): member is IrType => !!member
    );
    const directKept = directMembers.filter((member) => {
      const isMatch = collector.isAssignableTo(member, targetType);
      return wantAssignable ? isMatch : !isMatch;
    });

    if (directKept.length !== directMembers.length) {
      if (directKept.length === 0) {
        return undefined;
      }
      if (directKept.length === 1) {
        return directKept[0];
      }
      return normalizedUnionType(directKept);
    }
  }

  const expanded = collector.collectNarrowingCandidates(currentType);
  const candidates = expanded.length > 0 ? expanded : [currentType];
  const kept = candidates.filter((member): member is IrType => {
    if (!member) return false;
    const isMatch = collector.isAssignableTo(member, targetType);
    return wantAssignable ? isMatch : !isMatch;
  });

  if (kept.length === 0) {
    return wantAssignable ? undefined : currentType;
  }
  if (kept.length === 1) return kept[0];
  return normalizedUnionType(kept);
};
