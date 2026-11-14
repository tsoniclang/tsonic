import type { Diagnostic, ErrorValue, InvariantFailure, UnitAnswerPosition, UnitDiagnostic, UnitErrorRead, UnitRef, UnitResult } from "../diag/contract.js";
import { diagnosticIdentityKey, orderDiagnostics, requirePresent, throwInvariant, unitPositionData } from "../diag/index.js";
import { encodeKey } from "../ids/index.js";
import type { FactKey, Query, QueryStat, TraceEvent } from "./contract.js";

export interface Counter {
  computed: number;
  hits: number;
}

interface Memo<Value> {
  readonly definition: object;
  readonly answers: Map<string, CompletedUnit<Value>>;
  readonly counter: Counter;
}

export interface CompletedUnit<Value> {
  readonly fact: FactKey;
  readonly result:
    | { readonly kind: "ok"; readonly value: Value; readonly diagnostics: readonly Diagnostic[];
        readonly positions: ReadonlyMap<string, CompletedPosition>; readonly emissions: ReadonlyMap<string, UnitDiagnostic> }
    | { readonly kind: "refused"; readonly diagnostics: readonly [Diagnostic, ...Diagnostic[]] };
}

interface CompletedPosition extends UnitAnswerPosition {
  readonly ordinal: number;
}

export type MemoTable = Map<string, Memo<unknown>>;

const compositionFailure: InvariantFailure = ({ owner: "query", query: null, origin: null,
  message: "A refused result must carry its refusing diagnostic." });

export interface Kept {
  readonly progress: number;
  readonly earned: readonly Diagnostic[];
}

function belongsTo<Inputs, Key, Value, Witness, ErrorData>(
  memo: Memo<unknown>, query: Query<Inputs, Key, Value, Witness, ErrorData>,
): memo is Memo<Value> {
  return memo.definition === query;
}

export function queryMemo<Inputs, Key, Value, Witness, ErrorData>(
  table: MemoTable, query: Query<Inputs, Key, Value, Witness, ErrorData>, encodedKey: string,
): Memo<Value> {
  const existing = table.get(query.name);
  if (existing === undefined) {
    const created: Memo<Value> = {
      definition: query,
      answers: new Map(),
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

export function retainResult<Value>(result: UnitResult<Value>): UnitResult<Value> {
  switch (result.kind) {
    case "ok":
      return ({ kind: "ok", value: result.value, diagnostics: retainDiagnostics(result.diagnostics), positions: result.positions, emissions: result.emissions });
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
export function composeResult<Value>(chunks: Chunks, result: UnitResult<Value>): UnitResult<Value> {
  if (chunks.length === 0) return retainResult(result);
  const all = joinChunks(chunks);
  result.diagnostics.forEach(diagnostic => { all.push(diagnostic); });
  if (result.kind === "ok") return ({ kind: "ok", value: result.value, diagnostics: all, positions: result.positions, emissions: result.emissions });
  return ({ kind: "refused", diagnostics: [requirePresent(all[0], compositionFailure), ...all.slice(1)] });
}

export function completedUnit<Value>(fact: FactKey, result: UnitResult<Value>): CompletedUnit<Value> {
  if (result.kind === "refused") return { fact, result };
  const positions = new Map<string, CompletedPosition>();
  if (result.positions.length === 0) unitFailure(fact, "A semantic unit must declare its actual answer positions.");
  for (const entry of result.positions) {
    const key = encodeKey(unitPositionData(entry.position));
    if (positions.has(key)) unitFailure(fact, "A semantic unit declared one answer position twice.");
    if (entry.error !== null && entry.error.causes.length === 0) unitFailure(fact, "An error value must retain a nonempty cause vector.");
    positions.set(key, { position: entry.position, error: entry.error, ordinal: positions.size });
  }
  const diagnostics = new Set(result.diagnostics);
  const emissions = new Map<string, UnitDiagnostic>();
  for (const emission of result.emissions) {
    if (!diagnostics.has(emission.diagnostic)) unitFailure(fact, "An emission must retain its actually earned diagnostic object.");
    const identity = emission.identity;
    if (identity.kind === "host") {
      if (identity.unit.request.query !== fact.query || encodeKey(identity.unit.request.key) !== fact.encodedKey
        || !positions.has(encodeKey(unitPositionData(identity.unit.position))))
        unitFailure(fact, "A host emission must name its actual originating request and declared position.");
      if (emission.diagnostic.code.kind !== "host" || emission.diagnostic.code.name !== identity.code)
        unitFailure(fact, "A host emission must retain its detector's actual diagnostic identity.");
    }
    const key = diagnosticIdentityKey(identity);
    if (emissions.has(key)) unitFailure(fact, "A semantic unit must not originate one diagnostic identity twice.");
    emissions.set(key, emission);
  }
  return { fact, result: { kind: "ok", value: result.value, diagnostics: result.diagnostics, positions, emissions } };
}

function unitFailure(fact: FactKey, message: string): never {
  return throwInvariant({ owner: "query", query: { name: fact.query, encodedKey: fact.encodedKey }, origin: null, message });
}

function findUnit(table: MemoTable, unit: UnitRef): CompletedUnit<unknown> | undefined {
  return table.get(unit.request.query)?.answers.get(encodeKey(unit.request.key));
}

export function readUnitError(table: MemoTable, unit: UnitRef): UnitErrorRead {
  const answer = findUnit(table, unit);
  if (answer === undefined) return { kind: "uncomputed" };
  const result = answer.result;
  if (result.kind === "refused") return result;
  const position = result.positions.get(encodeKey(unitPositionData(unit.position)));
  return position === undefined ? { kind: "invalid-position" } : { kind: "completed", error: position.error };
}

export function validateUnits(table: MemoTable, answers: readonly CompletedUnit<unknown>[]): void {
  const pending = new Map<string, Map<string, CompletedUnit<unknown>>>();
  for (const answer of answers) {
    let keys = pending.get(answer.fact.query);
    if (keys === undefined) { keys = new Map(); pending.set(answer.fact.query, keys); }
    keys.set(answer.fact.encodedKey, answer);
  }
  const visited = new Map<CompletedPosition, "active" | "complete">();
  const roots: { readonly answer: CompletedUnit<unknown>; readonly entry: CompletedPosition }[] = [];
  for (const answer of answers) {
    if (answer.result.kind === "ok") {
      for (const entry of answer.result.positions.values()) roots.push({ answer, entry });
    }
  }
  const stack: { readonly answer: CompletedUnit<unknown>; readonly entry: CompletedPosition; readonly error: ErrorValue; next: number }[] = [];
  for (const root of roots) {
    if (root.entry.error === null || visited.get(root.entry) === "complete") continue;
    visited.set(root.entry, "active");
    stack.push({ ...root, error: root.entry.error, next: 0 });
    for (let frame = stack.at(-1); frame !== undefined; frame = stack.at(-1)) {
      const error = frame.error;
      if (frame.next === error.causes.length) {
        visited.set(frame.entry, "complete"); stack.pop(); continue;
      }
      const cause = requirePresent(error.causes[frame.next], completionError);
      frame.next += 1;
      let unit: UnitRef;
      let code: string | undefined;
      if (cause.kind === "unit") unit = cause.unit;
      else {
        if (cause.diagnostic.kind === "checker") continue;
        unit = cause.diagnostic.unit;
        code = cause.diagnostic.code;
      }
      const encodedKey = encodeKey(unit.request.key);
      const target = pending.get(unit.request.query)?.get(encodedKey) ?? findUnit(table, unit);
      if (target === undefined || target.result.kind !== "ok") unitFailure(frame.answer.fact, "An error cause must name a completed semantic unit.");
      const entry = target.result.positions.get(encodeKey(unitPositionData(unit.position)));
      if (entry === undefined || entry.error === null) unitFailure(frame.answer.fact, "An error cause must name an actual error-valued answer position.");
      if (code !== undefined) {
        if (target !== frame.answer || cause.kind !== "diagnostic" || !target.result.emissions.has(diagnosticIdentityKey(cause.diagnostic)))
          unitFailure(frame.answer.fact, "A host diagnostic cause must be earned by its actual originating semantic unit.");
        continue;
      }
      if (target === frame.answer && entry.ordinal >= frame.entry.ordinal)
        unitFailure(frame.answer.fact, "A same-unit absorbed cause must name an earlier grounded answer position.");
      if (pending.get(unit.request.query)?.get(encodedKey) === undefined) continue;
      if (visited.get(entry) === "active") unitFailure(frame.answer.fact, "Unit error causes must have finite diagnostic grounding.");
      if (visited.get(entry) === "complete") continue;
      visited.set(entry, "active"); stack.push({ answer: target, entry, error: entry.error, next: 0 });
    }
  }
}

const completionError: InvariantFailure = { owner: "query", query: null, origin: null,
  message: "An error-valued answer position must retain each cause in its declared vector." };

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
