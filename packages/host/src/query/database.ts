import type { Diagnostic, InvariantFailure, UnitRef, UnitResult } from "../diag/contract.js";
import { requirePresent, resourceLimitDiagnostic, throwInvariant } from "../diag/index.js";
import { encodeKey } from "../ids/index.js";
import type { ClassifyCycle, CycleAnswerCapability, CycleMember, CycleOutcome, Database, FactKey, Query, QueryComputation, QueryContext, QueryDependency, QueryLimits, QueryRequest, QueryScheduler, RunResult, TraceEvent, TraceRecording } from "./contract.js";
import type { Chunks, CompletedUnit, Kept, MemoTable } from "./memo.js";
import { completedUnit, composeResult, leastFact, queryMemo, readUnitError, retainDiagnostics, snapshotDiagnostics, snapshotStatistics, snapshotTrace, validateUnits } from "./memo.js";

interface Settlement {
  readonly units: number;
  readonly prepare: () => CompletedUnit<unknown>;
  readonly commit: () => void;
  readonly deliver: () => void;
}

interface Frame<Witness, ErrorData> {
  readonly fact: FactKey;
  readonly answerPolicy: CycleAnswerCapability;
  readonly keys: Set<string>;
  readonly advance: () => void;
  readonly settle: (outcome: CycleOutcome<ErrorData>) => Settlement;
  pending: { readonly witness: Witness } | undefined;
  /** The chunks this attempt has stated, in order; an empty chunk is not kept. */
  readonly chunks: Chunks;
  earned: readonly Diagnostic[];
  refusing: readonly Diagnostic[];
  steps: number;
}

interface Stop {
  readonly kind: "refused";
  readonly diagnostics: readonly [Diagnostic, ...Diagnostic[]];
}

interface Boundary {
  stop: Stop | null;
}

const completionFailure: InvariantFailure = ({ owner: "query", query: null, origin: null,
  message: "A completed query must publish its actual result." });
const pendingFailure: InvariantFailure = ({ owner: "query", query: null, origin: null,
  message: "A suspended computation must hold the request it is waiting for." });

function completionRecords(chunks: Chunks, result: UnitResult<unknown>): number {
  let diagnostics = result.diagnostics.length;
  for (const chunk of chunks) diagnostics += chunk.length;
  return 2 * diagnostics + (result.kind === "ok" ? result.positions.length + result.emissions.length : 0);
}

function chunkRecords(chunks: readonly (readonly Diagnostic[])[]): number {
  let records = chunks.length;
  for (const chunk of chunks) records += chunk.length;
  return records;
}

export function createQueryDatabase<Inputs, Witness, ErrorData>(
  inputs: Inputs, limits: QueryLimits, classifyCycle: ClassifyCycle<Witness, ErrorData>, recording: TraceRecording,
): Database<Inputs, Witness, ErrorData> {
  const maximumRecords = limits.maximumRecords;
  if (!Number.isSafeInteger(maximumRecords) || maximumRecords < 0 || Object.is(maximumRecords, -0)) {
    throw new TypeError("query: maximumRecords must be a nonnegative safe integer");
  }
  const memo: MemoTable = new Map();
  const frames: Frame<Witness, ErrorData>[] = [];
  const activeKeys = new Map<string, Set<string>>();
  const published: Diagnostic[] = [];
  const abandoned = new Map<string, Map<string, Kept>>();
  const trace: TraceEvent[] = [];
  const recorded = recording === "recorded";
  const eventUnit = recorded ? 1 : 0;
  let records = 0;
  let running = false;
  let exhaustion: Stop | undefined;

  function admit(units: number, at: FactKey, boundary: Boundary): boolean {
    if (units > maximumRecords - records) {
      if (exhaustion === undefined) {
        const diagnostic = resourceLimitDiagnostic({ owner: "query", limit: "query.maximumRecords", maximum: maximumRecords,
          site: { kind: "none" }, unit: { request: { query: at.query, key: at.key }, position: { kind: "result" } } });
        published.push(diagnostic);
        exhaustion = ({ kind: "refused", diagnostics: [diagnostic] });
      }
      boundary.stop = exhaustion;
      return false;
    }
    records += units;
    return true;
  }

  function publish(diagnostics: readonly Diagnostic[]): void {
    diagnostics.forEach(diagnostic => { published.push(diagnostic); });
  }

  function forget(fact: FactKey): void {
    const kept = abandoned.get(fact.query);
    if (kept === undefined) return;
    const previous = kept.get(fact.encodedKey);
    if (previous !== undefined) {
      kept.delete(fact.encodedKey);
      records -= 1 + chunkRecords(previous.chunks);
    }
  }

  function leave(frame: Frame<Witness, ErrorData>): void {
    frames.pop();
    frame.keys.delete(frame.fact.encodedKey);
    if (frame.keys.size === 0) activeKeys.delete(frame.fact.query);
  }

  function abandon(frame: Frame<Witness, ErrorData>): void {
    leave(frame);
    const kept = abandoned.get(frame.fact.query) ?? new Map<string, Kept>();
    const previous = kept.get(frame.fact.encodedKey);
    if (previous !== undefined && previous.progress > frame.steps) records -= 1 + chunkRecords(frame.chunks);
    else {
      if (previous !== undefined) {
        kept.delete(frame.fact.encodedKey);
        records -= 1 + chunkRecords(previous.chunks);
      }
      if (frame.chunks.length === 0 && frame.earned.length === 0 && frame.refusing.length === 0) records -= 1;
      else {
        abandoned.set(frame.fact.query, kept);
        kept.set(frame.fact.encodedKey, { progress: frame.steps, chunks: frame.chunks, earned: frame.earned, refusing: frame.refusing });
      }
    }
    if (recorded) trace.push({ kind: "completion", fact: frame.fact, outcome: "abandoned" });
  }

  function discard(frame: Frame<Witness, ErrorData>): void {
    leave(frame);
    records -= 1 + eventUnit + chunkRecords(frame.chunks);
  }

  function activeFrame(name: string, encodedKey: string): number {
    let head = frames.length - 1;
    for (let frame = requirePresent(frames[head], completionFailure);
      frame.fact.query !== name || frame.fact.encodedKey !== encodedKey;
      frame = requirePresent(frames[head], completionFailure)) head -= 1;
    return head;
  }

  function closeCycle(head: number, boundary: Boundary): void {
    const segment = frames.slice(head);
    const offset = leastFact(segment.map(frame => frame.fact));
    const ordered = [...segment.slice(offset), ...segment.slice(0, offset)];
    const member = (frame: Frame<Witness, ErrorData>): CycleMember<Witness> =>
      ({ fact: frame.fact, witness: requirePresent(frame.pending, pendingFailure).witness, answerPolicy: frame.answerPolicy });
    const outcomes = classifyCycle({ members: [
      member(requirePresent(ordered[0], completionFailure)), ...ordered.slice(1).map(member)] });
    if (outcomes.length !== ordered.length) {
      throw new TypeError("query: the classifier must return one outcome for each member of the closed cycle");
    }
    const settlements = ordered.map((frame, index) => frame.settle(requirePresent(outcomes[index], completionFailure)));
    const units = settlements.reduce((total, settlement) => total + settlement.units, 0);
    if (!admit(units, requirePresent(ordered[0], completionFailure).fact, boundary)) return;
    try {
      validateUnits(memo, settlements.map(settlement => settlement.prepare()));
    } catch (error) { records -= units; throw error; }
    settlements.forEach(settlement => { settlement.commit(); });
    for (let count = segment.length; count > 0; count -= 1) leave(requirePresent(frames.at(-1), completionFailure));
    requirePresent(settlements[(segment.length - offset) % segment.length], completionFailure).deliver();
  }

  function enter<Key, Value>(query: Query<Inputs, Key, Value, Witness, ErrorData>, key: Key,
    accept: (value: Value, diagnostics: readonly Diagnostic[]) => void, boundary: Boundary, from: FactKey | null): void {
    const data = query.keyData(key);
    const encodedKey = encodeKey(data);
    const fact: FactKey = ({ query: query.name, key: data, encodedKey });
    const entry = queryMemo(memo, query, encodedKey, () => admit(1, fact, boundary));
    if (entry === undefined) return;
    const deliver = (result: CompletedUnit<Value>["result"]): void => {
      if (result.kind === "refused") boundary.stop = result;
      else accept(result.value, result.diagnostics);
    };
    const cached = entry.answers.get(encodedKey);
    if (cached !== undefined) {
      if (recorded) {
        const to = cached.fact;
        if (!admit(1, to, boundary)) return;
        trace.push({ kind: "dependency", from, to, state: "warm" });
      }
      entry.counter.hits += 1;
      deliver(cached.result);
      return;
    }
    const keys = activeKeys.get(query.name);
    if (keys !== undefined && keys.has(encodedKey)) {
      const head = activeFrame(query.name, encodedKey);
      if (recorded) {
        const to = requirePresent(frames[head], completionFailure).fact;
        if (!admit(1, to, boundary)) return;
        trace.push({ kind: "dependency", from, to, state: "active" });
      }
      closeCycle(head, boundary);
      return;
    }
    if (!admit(1 + 3 * eventUnit, fact, boundary)) return;
    if (recorded) trace.push({ kind: "dependency", from, to: fact, state: "cold" }, { kind: "start", fact });
    const entered = keys ?? new Set<string>();
    activeKeys.set(query.name, entered);
    entered.add(encodedKey);
    const compute = query.compute;
    let next: () => QueryComputation<Inputs, Value, Witness, ErrorData> = () => {
      entry.counter.computed += 1;
      return compute({ inputs, fact, get, errorOf }, key);
    };
    const complete = (answer: CompletedUnit<Value>, outcome: "ok" | "refused" | "cycle-ok" | "cycle-refused"): void => {
      const result = answer.result;
      publish(result.diagnostics);
      entry.answers.set(encodedKey, answer);
      records -= chunkRecords(frame.chunks);
      forget(fact);
      if (recorded) trace.push({ kind: "completion", fact, outcome });
    };
    const frame: Frame<Witness, ErrorData> = {
      fact,
      answerPolicy: query.answerPolicy.kind,
      keys: entered,
      pending: undefined,
      chunks: [],
      earned: [],
      refusing: [],
      steps: 0,
      settle: outcome => {
        let classified: UnitResult<Value>;
        if (outcome.kind === "refused") classified = { kind: "refused", diagnostics: [outcome.diagnostic] };
        else {
          const policy = query.answerPolicy;
          if (policy.kind === "refusal-only") return throwInvariant({ owner: "query",
            query: { name: fact.query, encodedKey: fact.encodedKey }, origin: null,
            message: "The cycle classifier cannot return an error outcome for a refusal-only query." });
          const constructed = policy.construct(key, outcome.cause, outcome.data);
          if (!constructed.positions.some(position => position.error?.causes.includes(outcome.cause)))
            return throwInvariant({ owner: "query", query: { name: fact.query, encodedKey }, origin: null,
              message: "A typed-error constructor must retain the actual classified cause at an answer position." });
          classified = { kind: "ok", value: constructed.value, positions: constructed.positions, diagnostics: outcome.diagnostics, emissions: outcome.emissions };
        }
        frame.earned = classified.diagnostics;
        let answer: CompletedUnit<Value> | undefined;
        return ({
          units: completionRecords(frame.chunks, classified),
          prepare: () => { answer = completedUnit(fact, composeResult<Value>(frame.chunks, classified)); return answer; },
          commit: () => { complete(requirePresent(answer, completionFailure), classified.kind === "ok" ? "cycle-ok" : "cycle-refused"); },
          deliver: () => { deliver(requirePresent(answer, completionFailure).result); },
        });
      },
      advance: () => {
        frame.steps += 1;
        const step = next();
        if (step.kind === "dependency") {
          let requested = false;
          let open = true;
          const schedule = step.schedule;
          try {
            schedule({ request: (dependency, dependencyKey, request, resume) => {
              if (!open) throw new TypeError("query: dependency scheduling must be synchronous");
              if (requested) throw new TypeError("query: a dependency step must schedule exactly one request");
              requested = true;
              frame.pending = ({ witness: request.witness });
              frame.earned = request.earned;
              if (request.earned.length !== 0) {
                const units = 1 + request.earned.length;
                if (!admit(units, fact, boundary)) return;
                try { frame.chunks.push(retainDiagnostics(request.earned)); }
                catch (error) { records -= units; throw error; }
                frame.earned = [];
              }
              enter(dependency, dependencyKey, value => { next = () => resume(value); }, boundary, fact);
            } });
          } finally { open = false; }
          if (!requested) throw new TypeError("query: a dependency step must schedule exactly one request");
        } else if (step.kind === "abandoned") {
          frame.earned = step.earned;
          frame.refusing = step.diagnostics;
          boundary.stop = ({ kind: "refused", diagnostics: step.diagnostics });
        } else {
          frame.earned = step.diagnostics;
          const units = completionRecords(frame.chunks, step);
          if (!admit(units, fact, boundary)) return;
          let answer: CompletedUnit<Value>;
          try { answer = completedUnit(fact, composeResult(frame.chunks, step)); validateUnits(memo, [answer]); }
          catch (error) { records -= units; throw error; }
          complete(answer, answer.result.kind);
          leave(frame);
          deliver(answer.result);
        }
      },
    };
    frames.push(frame);
  }

  function errorOf(unit: UnitRef) { return readUnitError(memo, unit); }

  const get: QueryContext<Inputs, Witness, ErrorData>["get"] = <Key, Dependency, Value>(query: Query<Inputs, Key, Dependency, Witness, ErrorData>, key: Key,
      request: QueryRequest<Witness>,
      resume: (value: Dependency) => QueryComputation<Inputs, Value, Witness, ErrorData>): QueryDependency<Inputs, Value, Witness, ErrorData> =>
      ({ kind: "dependency", schedule: (scheduler: QueryScheduler<Inputs, Value, Witness, ErrorData>) => {
        scheduler.request(query, key, request, resume);
      } });

  function run<Key, Value>(query: Query<Inputs, Key, Value, Witness, ErrorData>, key: Key): RunResult<Value> {
    if (running) throw new TypeError("query: run cannot be nested; request dependencies through context.get");
    running = true;
    const boundary: Boundary = { stop: null };
    const result: { value: RunResult<Value> | undefined } = { value: undefined };
    try {
      enter(query, key, (value, diagnostics) => {
        result.value = ({ kind: "completed", value, diagnostics });
      }, boundary, null);
      for (let frame = frames.at(-1); frame !== undefined && boundary.stop === null; frame = frames.at(-1)) frame.advance();
      const stop = boundary.stop;
      if (stop !== null) {
        for (let frame = frames.at(-1); frame !== undefined; frame = frames.at(-1)) abandon(frame);
        return stop;
      }
      return requirePresent(result.value, completionFailure);
    } finally {
      for (let frame = frames.at(-1); frame !== undefined; frame = frames.at(-1)) discard(frame);
      running = false;
    }
  }

  return ({ inputs, run, errorOf, diagnostics: () => snapshotDiagnostics(published, abandoned), stats: () => snapshotStatistics(memo),
    trace: () => snapshotTrace(trace) });
}
