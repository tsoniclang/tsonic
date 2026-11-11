import type { Diagnostic, Result } from "../diag/contract.js";
import { orderDiagnostics, throwInvariant } from "../diag/index.js";
import type { KeyData } from "../ids/contract.js";
import type { ActiveKey, Query, QueryStat } from "./contract.js";

export interface Counter {
  computed: number;
  hits: number;
}

interface Memo<Value> {
  readonly definition: object;
  readonly results: Map<string, Result<Value>>;
  readonly counter: Counter;
}

export type MemoTable = Map<string, Memo<unknown>>;

function belongsTo<Inputs, Key extends KeyData, Value>(
  memo: Memo<unknown>, query: Query<Inputs, Key, Value>,
): memo is Memo<Value> {
  return memo.definition === query;
}

export function queryMemo<Inputs, Key extends KeyData, Value>(
  table: MemoTable, query: Query<Inputs, Key, Value>, encodedKey: string,
): Memo<Value> {
  const existing = table.get(query.name);
  if (existing === undefined) {
    const created: Memo<Value> = {
      definition: query,
      results: new Map(),
      counter: { computed: 0, hits: 0 },
    };
    table.set(query.name, created);
    return created;
  }
  if (belongsTo(existing, query)) return existing;
  return throwInvariant({
    pass: "pipeline",
    query: { name: query.name, encodedKey },
    origin: null,
    message: `Query name ${JSON.stringify(query.name)} is already bound to another definition`,
  });
}

export function retainResult<Value>(result: Result<Value>): Result<Value> {
  switch (result.kind) {
    case "ok":
      return Object.freeze({ kind: "ok", value: result.value, diagnostics: Object.freeze([...result.diagnostics]) });
    case "refused": {
      const diagnostics: readonly [Diagnostic, ...Diagnostic[]] = [result.diagnostics[0], ...result.diagnostics.slice(1)];
      return Object.freeze({ kind: "refused", diagnostics: Object.freeze(diagnostics) });
    }
  }
}

export function snapshotStatistics(counters: ReadonlyMap<string, Counter>): readonly QueryStat[] {
  return Object.freeze([...counters].map(([name, counter]) => Object.freeze({
    name,
    computed: counter.computed,
    hits: counter.hits,
  })).sort((left, right) => left.name < right.name ? -1 : 1));
}

export function snapshotDiagnostics(diagnostics: readonly Diagnostic[]): readonly Diagnostic[] {
  return Object.freeze([...orderDiagnostics(diagnostics)]);
}

export function snapshotChain(active: readonly ActiveKey[], attempted: ActiveKey): readonly ActiveKey[] {
  return Object.freeze([...active, attempted]);
}
