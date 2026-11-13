import type { Diagnostic, InvariantFailure, Result } from "../diag/contract.js";
import { requirePresent, resourceLimitDiagnostic } from "../diag/index.js";
import type { KeyData } from "../ids/contract.js";
import { encodeKey } from "../ids/index.js";
import type { ClassifyCycle, CycleMember, CycleOutcome, Database, FactKey, Query, QueryComputation, QueryContext, QueryDependency, QueryLimits, QueryRequest, QueryScheduler, RunResult, TraceEvent, TraceRecording } from "./contract.js";
import type { Kept, MemoTable } from "./memo.js";
import { joinDiagnostics, leastFact, queryMemo, retainDiagnostics, retainRefusal, retainResult, snapshotDiagnostics, snapshotStatistics, snapshotTrace } from "./memo.js";

interface Settlement {
  readonly commit: () => void;
  readonly deliver: () => void;
}

interface Frame<Witness> {
  readonly fact: FactKey;
  readonly keys: Set<string>;
  readonly advance: () => void;
  readonly settle: (outcome: CycleOutcome) => Settlement;
  pending: { readonly witness: Witness } | undefined;
  earned: readonly Diagnostic[];
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

export function createQueryDatabase<Inputs, Witness>(
  inputs: Inputs, limits: QueryLimits, classifyCycle: ClassifyCycle<Witness>, recording: TraceRecording,
): Database<Inputs, Witness> {
  const maximumRecords = limits.maximumRecords;
  if (!Number.isInteger(maximumRecords) || maximumRecords < 0) {
    throw new TypeError("query: maximumRecords must be a finite nonnegative integer");
  }
  const memo: MemoTable = new Map();
  const frames: Frame<Witness>[] = [];
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
    if (records + units > maximumRecords) {
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
    if (kept !== undefined && kept.delete(fact.encodedKey)) records -= 1;
  }

  function leave(frame: Frame<Witness>): void {
    frames.pop();
    frame.keys.delete(frame.fact.encodedKey);
    if (frame.keys.size === 0) activeKeys.delete(frame.fact.query);
  }

  function abandon(frame: Frame<Witness>): void {
    const earned = frame.earned;
    leave(frame);
    const kept = abandoned.get(frame.fact.query) ?? new Map<string, Kept>();
    const previous = kept.get(frame.fact.encodedKey);
    if (previous !== undefined && previous.progress > frame.steps) records -= 1;
    else {
      if (previous !== undefined) {
        kept.delete(frame.fact.encodedKey);
        records -= 1;
      }
      if (earned.length === 0) records -= 1;
      else {
        abandoned.set(frame.fact.query, kept);
        kept.set(frame.fact.encodedKey, { progress: frame.steps, earned: retainDiagnostics(earned) });
      }
    }
    if (recorded) trace.push({ kind: "completion", fact: frame.fact, outcome: "abandoned" });
  }

  function discard(frame: Frame<Witness>): void {
    leave(frame);
    records -= 1 + eventUnit;
  }

  function activeFrame(name: string, encodedKey: string): number {
    let head = frames.length - 1;
    for (let frame = requirePresent(frames[head], completionFailure);
      frame.fact.query !== name || frame.fact.encodedKey !== encodedKey;
      frame = requirePresent(frames[head], completionFailure)) head -= 1;
    return head;
  }

  function closeCycle(head: number): void {
    const segment = frames.slice(head);
    const offset = leastFact(segment.map(frame => frame.fact));
    const ordered = [...segment.slice(offset), ...segment.slice(0, offset)];
    const member = (frame: Frame<Witness>): CycleMember<Witness> =>
      ({ fact: frame.fact, witness: requirePresent(frame.pending, pendingFailure).witness });
    const outcomes = classifyCycle({ members: [
      member(requirePresent(ordered[0], completionFailure)), ...ordered.slice(1).map(member)] });
    if (outcomes.length !== ordered.length) {
      throw new TypeError("query: the classifier must return one outcome for each member of the closed cycle");
    }
    const settlements = ordered.map((frame, index) => frame.settle(requirePresent(outcomes[index], completionFailure)));
    settlements.forEach(settlement => { settlement.commit(); });
    for (let count = segment.length; count > 0; count -= 1) leave(requirePresent(frames.at(-1), completionFailure));
    requirePresent(settlements[(segment.length - offset) % segment.length], completionFailure).deliver();
  }

  function enter<Key extends KeyData, Value>(query: Query<Inputs, Key, Value, Witness>, key: Key,
    accept: (value: Value, diagnostics: readonly Diagnostic[]) => void, boundary: Boundary, from: FactKey | null): void {
    const encodedKey = encodeKey(key);
    const entry = queryMemo(memo, query, encodedKey);
    const deliver = (result: Result<Value>): void => {
      if (result.kind === "refused") boundary.stop = result;
      else accept(result.value, result.diagnostics);
    };
    const cached = entry.results.get(encodedKey);
    if (cached !== undefined) {
      if (recorded) {
        const to = requirePresent(entry.facts.get(encodedKey), completionFailure);
        if (!admit(1, to, boundary)) return;
        trace.push({ kind: "dependency", from, to, state: "warm" });
      }
      entry.counter.hits += 1;
      deliver(cached);
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
      closeCycle(head);
      return;
    }
    const fact: FactKey = ({ query: query.name, key, encodedKey });
    if (!admit(1 + 3 * eventUnit, fact, boundary)) return;
    if (recorded) trace.push({ kind: "dependency", from, to: fact, state: "cold" }, { kind: "start", fact });
    const entered = keys ?? new Set<string>();
    activeKeys.set(query.name, entered);
    entered.add(encodedKey);
    const compute = query.compute;
    let next: () => QueryComputation<Inputs, Value, Witness> = () => {
      entry.counter.computed += 1;
      return compute(context, key);
    };
    const complete = (result: Result<Value>, outcome: "ok" | "refused" | "cycle-ok" | "cycle-refused"): void => {
      publish(result.diagnostics);
      entry.results.set(encodedKey, result);
      if (recorded) entry.facts.set(encodedKey, fact);
      forget(fact);
      if (recorded) trace.push({ kind: "completion", fact, outcome });
    };
    const frame: Frame<Witness> = {
      fact,
      keys: entered,
      pending: undefined,
      earned: [],
      steps: 0,
      settle: outcome => {
        const errorValue = query.errorValue;
        const result: Result<Value> = outcome.kind === "refused"
          ? { kind: "refused", diagnostics: [outcome.diagnostic] }
          : { kind: "ok", value: errorValue(key, outcome.cause), diagnostics: [] };
        return ({
          commit: () => {
            publish(frame.earned);
            complete(result, result.kind === "ok" ? "cycle-ok" : "cycle-refused");
          },
          deliver: () => { deliver(result); },
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
              enter(dependency, dependencyKey, value => { next = () => resume(value); }, boundary, fact);
            } });
          } finally { open = false; }
          if (!requested) throw new TypeError("query: a dependency step must schedule exactly one request");
        } else if (step.kind === "abandoned") {
          const diagnostics = retainRefusal(step.diagnostics);
          frame.earned = joinDiagnostics(step.earned, diagnostics);
          boundary.stop = ({ kind: "refused", diagnostics });
        } else {
          const result = retainResult(step);
          complete(result, result.kind);
          leave(frame);
          deliver(result);
        }
      },
    };
    frames.push(frame);
  }

  const context: QueryContext<Inputs, Witness> = ({
    inputs,
    get: <Key extends KeyData, Dependency, Value>(query: Query<Inputs, Key, Dependency, Witness>, key: Key,
      request: QueryRequest<Witness>,
      resume: (value: Dependency) => QueryComputation<Inputs, Value, Witness>): QueryDependency<Inputs, Value, Witness> =>
      ({ kind: "dependency", schedule: (scheduler: QueryScheduler<Inputs, Value, Witness>) => {
        scheduler.request(query, key, request, resume);
      } }),
  });

  function run<Key extends KeyData, Value>(query: Query<Inputs, Key, Value, Witness>, key: Key): RunResult<Value> {
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

  return ({ inputs, run, diagnostics: () => snapshotDiagnostics(published, abandoned), stats: () => snapshotStatistics(memo),
    trace: () => snapshotTrace(trace) });
}
