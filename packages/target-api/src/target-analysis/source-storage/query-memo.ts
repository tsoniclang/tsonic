import type { SourceStorageBudget } from "./resource-budget.js";

export function createSourceStorageQueryMemo<Memo>(budget: SourceStorageBudget,
  create: (add: (cost: number) => boolean) => Memo) {
  let active: Memo | undefined;
  return <Value>(collect: (memo: Memo) => Value): Value => {
    if (active !== undefined) return collect(active);
    return budget.withRows(rows => {
      const memo = create(rows.add);
      active = memo;
      try { return collect(memo); }
      finally { active = undefined; }
    });
  };
}
