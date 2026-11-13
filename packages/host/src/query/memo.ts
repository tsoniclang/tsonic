import type { Diagnostic, InvariantFailure, Result } from "../diag/contract.js";
import { orderDiagnostics, requirePresent, throwInvariant } from "../diag/index.js";
import type { KeyData } from "../ids/contract.js";
import type { FactKey, Query, QueryStat, TraceEvent } from "./contract.js";

export interface Counter {
  computed: number;
  hits: number;
}

interface Memo<Value> {
  readonly definition: object;
  readonly results: Map<string, Result<Value>>;
  readonly facts: Map<string, FactKey>;
  readonly counter: Counter;
}

export type MemoTable = Map<string, Memo<unknown>>;

const compositionFailure: InvariantFailure = ({ owner: "query", query: null, origin: null,
  message: "A refused result must carry its refusing diagnostic." });

export interface Kept {
  readonly progress: number;
  readonly earned: readonly Diagnostic[];
}

function belongsTo<Inputs, Key extends KeyData, Value, Witness>(
  memo: Memo<unknown>, query: Query<Inputs, Key, Value, Witness>,
): memo is Memo<Value> {
  return memo.definition === query;
}

export function queryMemo<Inputs, Key extends KeyData, Value, Witness>(
  table: MemoTable, query: Query<Inputs, Key, Value, Witness>, encodedKey: string,
): Memo<Value> {
  const existing = table.get(query.name);
  if (existing === undefined) {
    const created: Memo<Value> = {
      definition: query,
      results: new Map(),
      facts: new Map(),
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
    case "refused":
      return ({ kind: "refused", diagnostics: retainRefusal(result.diagnostics) });
  }
}

export function retainRefusal(supplied: readonly [Diagnostic, ...Diagnostic[]]): readonly [Diagnostic, ...Diagnostic[]] {
  const diagnostics: [Diagnostic, ...Diagnostic[]] = [supplied[0]];
  diagnostics.length = supplied.length;
  supplied.forEach((diagnostic, index) => { diagnostics[index] = diagnostic; });
  return diagnostics;
}

export type Chunks = (readonly Diagnostic[])[];

export function joinChunks(chunks: Chunks): Diagnostic[] {
  const all: Diagnostic[] = [];
  chunks.forEach(chunk => { chunk.forEach(diagnostic => { all.push(diagnostic); }); });
  return all;
}

/** The complete result of a fact: the chunks its computation stated, in order, then what its final result carries. */
export function composeResult<Value>(chunks: Chunks, result: Result<Value>): Result<Value> {
  if (chunks.length === 0) return retainResult(result);
  const all = joinChunks(chunks);
  result.diagnostics.forEach(diagnostic => { all.push(diagnostic); });
  if (result.kind === "ok") return ({ kind: "ok", value: result.value, diagnostics: all });
  return ({ kind: "refused", diagnostics: [requirePresent(all[0], compositionFailure), ...all.slice(1)] });
}

export function snapshotStatistics(memo: ReadonlyMap<string, Memo<unknown>>): readonly QueryStat[] {
  return ([...memo].map(([name, { counter }]) => ({
    name,
    computed: counter.computed,
    hits: counter.hits,
  })).sort((left, right) => Number(left.name > right.name) - Number(left.name < right.name)));
}

export function snapshotDiagnostics(
  published: readonly Diagnostic[], abandoned: ReadonlyMap<string, ReadonlyMap<string, Kept>>,
): readonly Diagnostic[] {
  const all = published.slice();
  abandoned.forEach(keys => { keys.forEach(kept => { kept.earned.forEach(diagnostic => { all.push(diagnostic); }); }); });
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
