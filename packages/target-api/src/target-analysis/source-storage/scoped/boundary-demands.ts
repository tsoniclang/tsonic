import type { SourceStorageBudget, SourceStorageRows } from "../model/resource-budget.js";

export interface SourceStorageBoundaryDemand<Relation> {
  readonly relation: Relation;
  readonly children: Set<SourceStorageBoundaryDemand<Relation>>;
  boundary: boolean;
  terminal: boolean;
  coverage?: { readonly complete: boolean; readonly boundary: boolean };
}

export function sourceStorageBoundaryCoversDemand<Relation>(root: SourceStorageBoundaryDemand<Relation>,
  budget: SourceStorageBudget, rows: SourceStorageRows): boolean | undefined {
  const pending: { readonly demand: SourceStorageBoundaryDemand<Relation>; readonly complete: boolean }[] = [
    { demand: root, complete: false }];
  const active = new Set<SourceStorageBoundaryDemand<Relation>>();
  while (pending.length !== 0) {
    if (!budget.step()) return undefined;
    const { demand, complete } = pending.pop()!;
    if (demand.coverage !== undefined) continue;
    if (demand.boundary || demand.terminal) {
      demand.coverage = { complete: true, boundary: demand.boundary };
      continue;
    }
    if (complete) {
      active.delete(demand);
      let proved = demand.children.size !== 0;
      let boundary = false;
      for (const child of demand.children) {
        if (!budget.step()) return undefined;
        proved &&= child.coverage?.complete === true;
        boundary ||= child.coverage?.boundary === true;
      }
      demand.coverage = { complete: proved, boundary: proved && boundary };
      continue;
    }
    if (active.has(demand)) {
      demand.coverage = { complete: false, boundary: false };
      continue;
    }
    if (!rows.add(1 + demand.children.size)) return undefined;
    active.add(demand);
    pending.push({ demand, complete: true });
    for (const child of demand.children) pending.push({ demand: child, complete: false });
  }
  return root.coverage?.complete === true && root.coverage.boundary;
}
