import { createTargetGraphComponentQuery } from "./graph-component-query.js";

export type TargetGraphComponentsSelection<TVertex> =
  | { readonly kind: "resolved"; readonly components: readonly (readonly TVertex[])[] }
  | { readonly kind: "unresolved"; readonly reason: string };

export function targetStronglyConnectedComponents<TVertex>(
  vertices: ReadonlySet<TVertex>,
  neighbours: (vertex: TVertex) => Iterable<TVertex>,
  maximumSteps: number | (() => boolean) = 4_194_304,
): TargetGraphComponentsSelection<TVertex> {
  if (typeof maximumSteps !== "function" && (!Number.isSafeInteger(maximumSteps) || maximumSteps <= 0)) {
    return Object.freeze({ kind: "unresolved", reason: "Graph component analysis requires a positive finite work budget." });
  }
  let steps = 0;
  const account = typeof maximumSteps === "function" ? maximumSteps : (): boolean => ++steps <= maximumSteps;
  const components: (readonly TVertex[])[] = [];
  const select = createTargetGraphComponentQuery<TVertex, undefined, readonly TVertex[]>(vertex => {
    const selected = new Set<TVertex>();
    for (const target of neighbours(vertex)) {
      if (!account()) return undefined;
      if (vertices.has(target)) selected.add(target);
    }
    return { data: undefined, neighbours: selected };
  }, members => {
    const component = Object.freeze(members.map(member => member.vertex));
    components.push(component);
    return component;
  }, {
    step: account,
    createRows: () => ({
      add(cost): boolean {
        for (let index = 0; index < cost; index += 1) if (!account()) return false;
        return true;
      },
      release(): void {},
    }),
  });
  for (const vertex of vertices) {
    if (select(vertex) === undefined) {
      return Object.freeze({ kind: "unresolved", reason: "Graph component analysis exceeds its finite work budget." });
    }
  }
  return Object.freeze({ kind: "resolved", components: Object.freeze(components) });
}
