import type { SourceStorageBudget, SourceStorageRows } from "../model/resource-budget.js";
import type { SourceStorageKeyValue } from "../graph/key-encoding.js";

export type SourceStorageKeyContinuation = Generator<SourceStorageKeyContinuation,
  SourceStorageKeyValue | undefined, SourceStorageKeyValue | undefined>;

export function completeSourceStorageKeyEncoding(budget: SourceStorageBudget,
  initial: SourceStorageKeyContinuation): SourceStorageKeyValue | undefined {
  const pending: { readonly continuation: SourceStorageKeyContinuation; readonly rows: SourceStorageRows }[] = [];
  const enter = (continuation: SourceStorageKeyContinuation): boolean => {
    const rows = budget.createRows();
    if (!rows.add(1)) { rows.release(); return false; }
    pending.push({ continuation, rows });
    return true;
  };
  let value: SourceStorageKeyValue | undefined;
  try {
    if (!enter(initial)) return undefined;
    while (pending.length !== 0) {
      const current = pending[pending.length - 1]!;
      const next = current.continuation.next(value);
      if (next.done) {
        value = next.value;
        current.rows.release();
        pending.pop();
      } else {
        value = undefined;
        if (!enter(next.value)) return undefined;
      }
    }
    return value;
  } finally {
    while (pending.length !== 0) {
      const current = pending.pop()!;
      try { current.continuation.return(undefined); } finally { current.rows.release(); }
    }
  }
}
