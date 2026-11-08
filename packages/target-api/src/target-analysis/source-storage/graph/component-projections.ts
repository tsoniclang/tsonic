import type { SourceTypeEvidence } from "../../../public/source/contracts.js";
import type { SourceStorageProgram } from "../model/program.js";
import { sourceStorageComponentType, sourceStorageOriginalComponents } from "../model/components.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageProjection } from "../../../source-model/storage.js";

export function sourceStorageProjectComponents(
  origin: readonly SourceStorageProjection[],
  from: SourceTypeEvidence,
  to: SourceTypeEvidence,
  remaining: readonly SourceStorageProjection[],
  source: SourceStorageProgram,
  budget: SourceStorageBudget,
  collect: (projection: readonly SourceStorageProjection[]) => void,
): void {
  source.facts.descriptors.assertEvidence(from);
  source.facts.descriptors.assertEvidence(to);
  if (source.facts.descriptors.freeParameters(to).length !== 0 && from === to) {
    collect([...origin, ...remaining]);
    return;
  }
  let candidates: { readonly projection: readonly SourceStorageProjection[]; readonly from: SourceTypeEvidence; readonly to: SourceTypeEvidence }[] = [];
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
        const target = sourceStorageComponentType(candidate.to, component, source);
        if (target === undefined) continue;
        if (candidate.from.type.kind === "intrinsic" && candidate.from.type.intrinsic === "never") {
          if (!nextRows.add(1)) return;
          next.push({ projection: candidate.projection, from: candidate.from, to: target });
          continue;
        }
        for (const original of sourceStorageOriginalComponents(candidate.from, candidate.to, component, source)) {
          if (!budget.step()) return;
          const sourceType = sourceStorageComponentType(candidate.from, original, source);
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
