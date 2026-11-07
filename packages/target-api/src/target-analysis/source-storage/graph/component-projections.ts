import type { AstReader } from "@tsonic/tsts";
import type { SourceTypeDescriptor } from "../../../source-semantics/descriptor-model.js";
import type { SourceAnalysisProgram } from "../../analysis-program.js";
import { sourceStorageComponentType, sourceStorageIsNeverType, sourceStorageOriginalComponents, sourceStorageTypeHasTypeVariables, sourceStorageTypesEqual } from "../model/components.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageProjection } from "../model/subjects.js";

export function sourceStorageProjectComponents(
  origin: readonly SourceStorageProjection[],
  from: SourceTypeDescriptor,
  to: SourceTypeDescriptor,
  remaining: readonly SourceStorageProjection[],
  source: Pick<SourceAnalysisProgram, "ast" | "facts">,
  ast: AstReader,
  budget: SourceStorageBudget,
  collect: (projection: readonly SourceStorageProjection[]) => void,
): void {
  if (sourceStorageTypeHasTypeVariables(to, ast) && sourceStorageTypesEqual(from, to)) {
    collect([...origin, ...remaining]);
    return;
  }
  let candidates: { readonly projection: readonly SourceStorageProjection[]; readonly from: SourceTypeDescriptor;
    readonly to: SourceTypeDescriptor }[] = [];
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
        const target = sourceStorageComponentType(source, candidate.to, component);
        if (target === undefined) continue;
        if (sourceStorageIsNeverType(candidate.from)) {
          if (!nextRows.add(1)) return;
          next.push({ projection: candidate.projection, from: candidate.from, to: target });
          continue;
        }
        for (const original of sourceStorageOriginalComponents(source, candidate.from, candidate.to, component)) {
          if (!budget.step()) return;
          const sourceType = sourceStorageComponentType(source, candidate.from, original);
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
