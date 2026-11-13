import type { Diagnostic, Result } from "../diag/contract.js";
import { orderDiagnostics, throwInvariant } from "../diag/index.js";
import type { KeyData } from "../ids/contract.js";
import type { FactKey, Query, QueryStat, TraceEvent } from "./contract.js";

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

function belongsTo<Inputs, Key extends KeyData, Value, Witness, Verdict>(
  memo: Memo<unknown>, query: Query<Inputs, Key, Value, Witness, Verdict>,
): memo is Memo<Value> {
  return memo.definition === query;
}

export function queryMemo<Inputs, Key extends KeyData, Value, Witness, Verdict>(
  table: MemoTable, query: Query<Inputs, Key, Value, Witness, Verdict>, encodedKey: string,
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
    owner: "query",
    query: { name: query.name, encodedKey },
    origin: null,
    message: `Query name ${JSON.stringify(query.name)} is already bound to another definition`,
  });
}

export function retainDiagnostics(diagnostics: readonly Diagnostic[]): readonly Diagnostic[] {
  return (diagnostics.slice());
}

export function retainResult<Value>(result: Result<Value>): Result<Value> {
  switch (result.kind) {
    case "ok":
      return ({ kind: "ok", value: result.value, diagnostics: retainDiagnostics(result.diagnostics) });
    case "refused": {
      const diagnostics: [Diagnostic, ...Diagnostic[]] = [result.diagnostics[0]];
      diagnostics.length = result.diagnostics.length;
      result.diagnostics.forEach((diagnostic, index) => { diagnostics[index] = diagnostic; });
      return ({ kind: "refused", diagnostics: (diagnostics) });
    }
  }
}

export function snapshotStatistics(memo: ReadonlyMap<string, Memo<unknown>>): readonly QueryStat[] {
  return ([...memo].map(([name, { counter }]) => ({
    name,
    computed: counter.computed,
    hits: counter.hits,
  })).sort((left, right) => Number(left.name > right.name) - Number(left.name < right.name)));
}

export function snapshotDiagnostics(
  published: readonly Diagnostic[], abandoned: ReadonlyMap<string, ReadonlyMap<string, readonly Diagnostic[]>>,
): readonly Diagnostic[] {
  const all = published.slice();
  abandoned.forEach(keys => { keys.forEach(earned => { earned.forEach(diagnostic => { all.push(diagnostic); }); }); });
  return (orderDiagnostics(all).slice());
}

export function snapshotTrace(trace: readonly TraceEvent[]): readonly TraceEvent[] {
  return (trace.slice());
}

export function leastFact(facts: readonly FactKey[]): number {
  let offset = 0;
  let least: FactKey | undefined;
  facts.forEach((fact, index) => {
    if (least === undefined || fact.query < least.query || (fact.query === least.query && fact.encodedKey < least.encodedKey)) {
      least = fact;
      offset = index;
    }
  });
  return offset;
}
