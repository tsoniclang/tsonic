import type { IrType } from "../../../types/index.js";
import { stableIrTypeKeyIfDeterministic } from "../../../types/type-ops.js";
import type { HeritageEdge } from "./types.js";

const heritageKindRank = (kind: HeritageEdge["kind"]): number =>
  kind === "extends" ? 0 : 1;

const fallbackReferenceTypeKey = (
  type: Extract<IrType, { kind: "referenceType" }>
): string => {
  if (type.structuralMembers && type.structuralMembers.length > 0) {
    throw new Error(
      `Cannot build heritage edge key for structural identity-less reference type '${type.name}'`
    );
  }

  const args = (type.typeArguments ?? [])
    .map((typeArgument) => heritageTypeArgumentKey(typeArgument))
    .join(",");
  return `unresolved-ref:${type.name}/${type.typeArguments?.length ?? 0}<${args}>`;
};

const heritageTypeArgumentKey = (type: IrType): string => {
  const stableKey = stableIrTypeKeyIfDeterministic(type);
  if (stableKey) return stableKey;

  if (type.kind === "referenceType") {
    return fallbackReferenceTypeKey(type);
  }

  throw new Error(
    `Cannot build deterministic heritage edge key for type kind '${type.kind}'`
  );
};

export const heritageEdgeKey = (edge: HeritageEdge): string => {
  const typeArgumentKey = edge.typeArguments
    .map((typeArgument) => heritageTypeArgumentKey(typeArgument))
    .join(",");
  return `${edge.kind}|${edge.targetStableId}|${typeArgumentKey}`;
};

export const compareHeritageEdges = (
  left: HeritageEdge,
  right: HeritageEdge
): number => {
  const leftRank = heritageKindRank(left.kind);
  const rightRank = heritageKindRank(right.kind);
  if (leftRank !== rightRank) return leftRank - rightRank;

  const target = left.targetStableId.localeCompare(right.targetStableId);
  if (target !== 0) return target;

  return heritageEdgeKey(left).localeCompare(heritageEdgeKey(right));
};
