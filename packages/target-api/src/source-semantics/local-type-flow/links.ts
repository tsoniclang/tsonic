import type { SourceTypeFlowLink, SourceTypeFlowVariable } from "./types.js";

export function sourceTypeFlowLinkAdjacency(
  links: readonly SourceTypeFlowLink[],
): ReadonlyMap<SourceTypeFlowVariable, readonly SourceTypeFlowVariable[]> {
  const adjacency = new Map<SourceTypeFlowVariable, SourceTypeFlowVariable[]>();
  for (const { source, target } of links) {
    for (const [from, to] of [[source, target], [target, source]] as const) {
      let adjacent = adjacency.get(from);
      if (adjacent === undefined) adjacency.set(from, adjacent = []);
      adjacent.push(to);
    }
  }
  return adjacency;
}

export function sourceTypeFlowReachableVariables(
  seeds: readonly SourceTypeFlowVariable[],
  adjacency: ReadonlyMap<SourceTypeFlowVariable, readonly SourceTypeFlowVariable[]>,
): ReadonlySet<SourceTypeFlowVariable> {
  const reached = new Set<SourceTypeFlowVariable>();
  const pending = [...seeds];
  while (pending.length > 0) {
    const variable = pending.pop()!;
    if (reached.has(variable)) continue;
    reached.add(variable);
    pending.push(...adjacency.get(variable) ?? []);
  }
  return reached;
}
