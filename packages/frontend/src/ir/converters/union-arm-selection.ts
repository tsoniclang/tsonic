import type { IrType, IrUnionArmSelection } from "../types.js";
import { typesEqual } from "../type-system/type-system-relations.js";

export type UnionArmSelectionInput =
  | {
      readonly kind: "semanticProjection";
      readonly sourceType: IrType | undefined;
      readonly targetUnion: IrType | undefined;
    }
  | {
      readonly kind: "runtimeSubsetProjection";
      readonly sourceType: IrType | undefined;
      readonly targetUnion: IrType | undefined;
    };

const exactArmCandidates = (
  sourceType: IrType | undefined,
  targetUnion: IrType | undefined
): readonly number[] | undefined => {
  if (!sourceType || !targetUnion || targetUnion.kind !== "unionType") {
    return undefined;
  }

  const matches: number[] = [];
  targetUnion.types.forEach((candidate, index) => {
    if (typesEqual(sourceType, candidate)) {
      matches.push(index);
    }
  });
  return matches;
};

export const selectUnionArm = (
  input: UnionArmSelectionInput
): IrUnionArmSelection => {
  const matches = exactArmCandidates(input.sourceType, input.targetUnion);
  if (!matches) {
    return {
      kind: "unsupported",
      reason: `${input.kind} requires a concrete source type and target union`,
    };
  }

  if (matches.length === 1) {
    return { kind: "exact", armIndex: matches[0] ?? 0 };
  }

  if (matches.length > 1) {
    return {
      kind: "ambiguous",
      candidates: matches,
      reason: "Multiple union arms have the same semantic shape.",
    };
  }

  return {
    kind: "noMatch",
    reason: "No union arm has the requested semantic shape.",
  };
};
