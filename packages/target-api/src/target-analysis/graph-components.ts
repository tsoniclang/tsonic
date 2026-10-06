export type TargetGraphComponentsSelection<TVertex> =
  | { readonly kind: "resolved"; readonly components: readonly (readonly TVertex[])[] }
  | { readonly kind: "unresolved"; readonly reason: string };

export function targetStronglyConnectedComponents<TVertex>(
  vertices: ReadonlySet<TVertex>,
  neighbours: (vertex: TVertex) => Iterable<TVertex>,
  maximumSteps = 4_194_304,
): TargetGraphComponentsSelection<TVertex> {
  if (!Number.isSafeInteger(maximumSteps) || maximumSteps <= 0) {
    return Object.freeze({ kind: "unresolved", reason: "Graph component analysis requires a positive finite work budget." });
  }
  const indexes = new Map<TVertex, number>();
  const lowLinks = new Map<TVertex, number>();
  const members: TVertex[] = [];
  const active = new Set<TVertex>();
  const components: (readonly TVertex[])[] = [];
  const pending: { readonly vertex: TVertex; readonly neighbours: Iterator<TVertex> }[] = [];
  let steps = 0;
  const account = (): boolean => ++steps <= maximumSteps;
  const enter = (vertex: TVertex): void => {
    indexes.set(vertex, indexes.size);
    lowLinks.set(vertex, indexes.get(vertex)!);
    members.push(vertex);
    active.add(vertex);
    pending.push({ vertex, neighbours: neighbours(vertex)[Symbol.iterator]() });
  };
  for (const root of vertices) {
    if (!account()) return exhausted();
    if (indexes.has(root)) continue;
    enter(root);
    while (pending.length > 0) {
      if (!account()) return exhausted();
      const frame = pending[pending.length - 1]!;
      const next = frame.neighbours.next();
      if (!next.done) {
        const target = next.value;
        if (!vertices.has(target)) continue;
        const index = indexes.get(target);
        if (index === undefined) enter(target);
        else if (active.has(target)) lowLinks.set(frame.vertex, Math.min(lowLinks.get(frame.vertex)!, index));
        continue;
      }
      pending.pop();
      const parent = pending[pending.length - 1];
      if (parent !== undefined) lowLinks.set(parent.vertex,
        Math.min(lowLinks.get(parent.vertex)!, lowLinks.get(frame.vertex)!));
      if (lowLinks.get(frame.vertex) !== indexes.get(frame.vertex)) continue;
      const component: TVertex[] = [];
      while (members.length > 0) {
        if (!account()) return exhausted();
        const member = members.pop()!;
        active.delete(member);
        component.push(member);
        if (indexes.get(member) === indexes.get(frame.vertex)) break;
      }
      components.push(Object.freeze(component));
    }
  }
  return Object.freeze({ kind: "resolved", components: Object.freeze(components) });

  function exhausted(): Extract<TargetGraphComponentsSelection<TVertex>, { readonly kind: "unresolved" }> {
    return Object.freeze({ kind: "unresolved", reason: "Graph component analysis exceeds its finite work budget." });
  }
}
