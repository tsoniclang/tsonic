import type { Node } from "@tsonic/tsts";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageReduction, SourceStorageTerm } from "../graph/scoped-model.js";

export interface SourceStorageChildContext {
  readonly contributes?: boolean;
  readonly independentCallee?: Node;
  readonly correlated?: boolean;
  readonly dependencies?: readonly SourceStorageTerm[];
}

export interface SourceStorageChildReduction {
  readonly kind: "child-reduction";
  readonly child: SourceStorageTerm;
  readonly replace: (child: SourceStorageTerm) => SourceStorageTerm;
  readonly context: SourceStorageChildContext;
}

export type SourceStoragePendingReduction = SourceStorageReduction | SourceStorageChildReduction;

export function sourceStorageChildDependencies(selected: SourceStorageReduction | undefined,
  dependencies: readonly SourceStorageTerm[] | undefined): SourceStorageReduction | undefined {
  return dependencies === undefined || selected?.kind !== "replace" ? selected
    : { ...selected, dependencies: [...selected.dependencies ?? [], ...dependencies] };
}

export function completeSourceStorageChildReduction(budget: SourceStorageBudget,
  initial: SourceStoragePendingReduction | undefined,
  reduce: (term: SourceStorageTerm, correlated: boolean) => SourceStoragePendingReduction | undefined): SourceStorageReduction | undefined {
  return budget.withRows(rows => {
    const pending: SourceStorageChildReduction[] = [];
    let selected = initial;
    while (selected?.kind === "child-reduction") {
      if (!rows.add(1)) return undefined;
      pending.push(selected);
      selected = reduce(selected.child, selected.context.correlated ?? true);
    }
    if (selected?.kind === "project" && pending.length !== 0) {
      const projection = selected;
      return { kind: "project", inputs: projection.inputs, select: value => {
        let terms = projection.select(value);
        for (let index = pending.length - 1; terms !== undefined && index >= 0; index -= 1) {
          const frame = pending[index]!;
          terms = terms.map(child => child.kind === "empty" ? child : frame.replace(child));
        }
        return terms;
      } };
    }
    for (let index = pending.length - 1; index >= 0 && selected?.kind === "replace"; index -= 1) {
      const { child, replace, context } = pending[index]!;
      selected = sourceStorageChildDependencies({ kind: "replace",
        terms: selected.terms.map(child => child.kind === "empty" ? child : replace(child)), dependencies: selected.dependencies,
        witnesses: [...(selected.witnesses ?? []).map(witness => context.contributes !== false ? witness
          : { ...witness, contributes: false, observesValue: false }),
          ...child.kind === "reference" || child.kind === "leaf"
            ? [{ subject: child.subject, bindings: child.scope, contributes: context.contributes !== false,
              observesValue: context.contributes !== false }] : []] }, context.dependencies);
    }
    return selected;
  });
}
