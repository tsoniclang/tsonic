import type { Type } from "@tsonic/tsts";
import type { SourceFileSemantics } from "../../../source-semantics/index.js";
import { sourceStorageComponentType, sourceStorageOriginalComponents } from "../model/components.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageProjection } from "../model/subjects.js";

export function sourceStorageProjectComponents(
  origin: readonly SourceStorageProjection[],
  from: Type,
  to: Type,
  remaining: readonly SourceStorageProjection[],
  semantics: SourceFileSemantics,
  budget: SourceStorageBudget,
  collect: (projection: readonly SourceStorageProjection[]) => void,
): void {
  if (semantics.types.couldContainTypeVariables(to) && semantics.types.isIdentical(from, to)) {
    collect([...origin, ...remaining]);
    return;
  }
  let candidates: { readonly projection: readonly SourceStorageProjection[]; readonly from: Type; readonly to: Type }[] = [];
  let frontierRows = budget.createRows();
  let nextRows: ReturnType<SourceStorageBudget["createRows"]> | undefined;
  try {
    if (!frontierRows.add(1)) return;
    candidates.push({ projection: origin, from, to });
    for (const component of remaining) {
      const next: typeof candidates = [];
      nextRows = budget.createRows();
      for (const candidate of candidates) {
        if (!budget.step()) return;
        const target = sourceStorageComponentType(candidate.to, component, semantics);
        if (target === undefined) continue;
        for (const original of sourceStorageOriginalComponents(candidate.from, candidate.to, component, semantics)) {
          if (!budget.step()) return;
          const sourceType = sourceStorageComponentType(candidate.from, original, semantics);
          if (sourceType === undefined) continue;
          if (!nextRows.add(1)) return;
          next.push({ projection: [...candidate.projection, original], from: sourceType, to: target });
        }
      }
      frontierRows.release();
      frontierRows = nextRows;
      nextRows = undefined;
      candidates = next;
      if (candidates.length === 0) return;
    }
    for (const candidate of candidates) {
      if (!budget.step()) return;
      collect(candidate.projection);
    }
  } finally {
    frontierRows.release();
    nextRows?.release();
  }
}
