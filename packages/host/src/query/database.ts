import type { Diagnostic, InvariantFailure, Result } from "../diag/contract.js";
import { requirePresent } from "../diag/index.js";
import type { KeyData } from "../ids/contract.js";
import { encodeKey } from "../ids/index.js";
import type { ClassifyCycle, CycleMember, Database, FactKey, Query, QueryComputation, QueryContext, QueryDependency, QueryLimits, QueryRequest, QueryScheduler, RunResult, TraceEvent } from "./contract.js";
import type { MemoTable } from "./memo.js";
import { leastFact, queryMemo, retainDiagnostics, retainResult, snapshotDiagnostics, snapshotStatistics, snapshotTrace } from "./memo.js";

interface Settlement {
  readonly commit: () => void;
  readonly deliver: () => void;
}

interface Frame<Witness, Verdict> {
  readonly fact: FactKey;
  readonly keys: Set<string>;
  readonly advance: () => void;
  readonly settle: (verdict: Verdict) => Settlement;
  pending: QueryRequest<Witness> | undefined;
}

type Stop =
  | { readonly kind: "refused"; readonly diagnostics: readonly [Diagnostic, ...Diagnostic[]] }
  | { readonly kind: "exhausted"; readonly maximumRecords: number; readonly at: FactKey };

interface Boundary {
  stop: Stop | null;
}

const completionFailure: InvariantFailure = ({ owner: "query", query: null, origin: null,
  message: "A completed query must publish its actual result." });
const pendingFailure: InvariantFailure = ({ owner: "query", query: null, origin: null,
  message: "A suspended computation must hold the request it is waiting for." });

export function createQueryDatabase<Inputs, Witness, Verdict>(
  inputs: Inputs, limits: QueryLimits, classifyCycle: ClassifyCycle<Witness, Verdict>,
): Database<Inputs, Witness, Verdict> {
  const maximumRecords = limits.maximumRecords;
  if (!Number.isInteger(maximumRecords) || maximumRecords < 0) {
    throw new TypeError("query: maximumRecords must be a finite nonnegative integer");
  }
  const memo: MemoTable = new Map();
  const frames: Frame<Witness, Verdict>[] = [];
  const activeKeys = new Map<string, Set<string>>();
  const published: Diagnostic[] = [];
  const abandoned = new Map<string, Map<string, readonly Diagnostic[]>>();
  const trace: TraceEvent[] = [];
  let records = 0;
  let running = false;

  function admit(units: number, at: FactKey, boundary: Boundary): boolean {
    if (records + units > maximumRecords) {
      boundary.stop = ({ kind: "exhausted", maximumRecords, at });
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

  function leave(frame: Frame<Witness, Verdict>): void {
    frames.pop();
    frame.keys.delete(frame.fact.encodedKey);
    if (frame.keys.size === 0) activeKeys.delete(frame.fact.query);
  }

  function abandon(frame: Frame<Witness, Verdict>): void {
    const earned = requirePresent(frame.pending, pendingFailure).earned;
    leave(frame);
    forget(frame.fact);
    if (earned.length === 0) records -= 1;
    else {
      const kept = abandoned.get(frame.fact.query) ?? new Map<string, readonly Diagnostic[]>();
      abandoned.set(frame.fact.query, kept);
      kept.set(frame.fact.encodedKey, earned);
    }
    trace.push({ kind: "completion", fact: frame.fact, outcome: "abandoned" });
  }

  function discard(frame: Frame<Witness, Verdict>): void {
    leave(frame);
    records -= 2;
  }

  function closeCycle(fact: FactKey): void {
    let head = frames.length - 1;
    for (let frame = requirePresent(frames[head], completionFailure);
      frame.fact.query !== fact.query || frame.fact.encodedKey !== fact.encodedKey;
      frame = requirePresent(frames[head], completionFailure)) head -= 1;
    const segment = frames.slice(head);
    const offset = leastFact(segment.map(frame => frame.fact));
    const ordered = [...segment.slice(offset), ...segment.slice(0, offset)];
    const member = (frame: Frame<Witness, Verdict>): CycleMember<Witness> =>
      ({ fact: frame.fact, witness: requirePresent(frame.pending, pendingFailure).witness });
    const verdict = classifyCycle({ members: [
      member(requirePresent(ordered[0], completionFailure)), ...ordered.slice(1).map(member)] });
    const settlements = ordered.map(frame => frame.settle(verdict));
    settlements.forEach(settlement => { settlement.commit(); });
    for (let count = segment.length; count > 0; count -= 1) leave(requirePresent(frames.at(-1), completionFailure));
    requirePresent(settlements[(segment.length - offset) % segment.length], completionFailure).deliver();
  }

  function enter<Key extends KeyData, Value>(query: Query<Inputs, Key, Value, Witness, Verdict>, key: Key,
    accept: (value: Value, diagnostics: readonly Diagnostic[]) => void, boundary: Boundary, from: FactKey | null): void {
    const encodedKey = encodeKey(key);
    const entry = queryMemo(memo, query, encodedKey);
    const fact: FactKey = ({ query: query.name, key, encodedKey });
    const deliver = (result: Result<Value>): void => {
      if (result.kind === "refused") boundary.stop = result;
      else accept(result.value, result.diagnostics);
    };
    const cached = entry.results.get(encodedKey);
    if (cached !== undefined) {
      if (!admit(1, fact, boundary)) return;
      trace.push({ kind: "dependency", from, to: fact, state: "warm" });
      entry.counter.hits += 1;
      deliver(cached);
      return;
    }
    const keys = activeKeys.get(query.name);
    if (keys !== undefined && keys.has(encodedKey)) {
      if (!admit(1, fact, boundary)) return;
      trace.push({ kind: "dependency", from, to: fact, state: "active" });
      closeCycle(fact);
      return;
    }
    if (!admit(4, fact, boundary)) return;
    trace.push({ kind: "dependency", from, to: fact, state: "cold" }, { kind: "start", fact });
    const entered = keys ?? new Set<string>();
    activeKeys.set(query.name, entered);
    entered.add(encodedKey);
    const compute = query.compute;
    let next: () => QueryComputation<Inputs, Value, Witness, Verdict> = () => {
      entry.counter.computed += 1;
      return compute(context, key);
    };
    const complete = (result: Result<Value>, outcome: "ok" | "refused" | "cycle-ok" | "cycle-refused"): void => {
      publish(result.diagnostics);
      entry.results.set(encodedKey, result);
      forget(fact);
      trace.push({ kind: "completion", fact, outcome });
    };
    const frame: Frame<Witness, Verdict> = {
      fact,
      keys: entered,
      pending: undefined,
      settle: verdict => {
        const cycleOutcome = query.cycleOutcome;
        const result = retainResult(cycleOutcome(key, verdict));
        return ({
          commit: () => {
            publish(requirePresent(frame.pending, pendingFailure).earned);
            complete(result, result.kind === "ok" ? "cycle-ok" : "cycle-refused");
          },
          deliver: () => { deliver(result); },
        });
      },
      advance: () => {
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
              frame.pending = ({ witness: request.witness, earned: retainDiagnostics(request.earned) });
              enter(dependency, dependencyKey, value => { next = () => resume(value); }, boundary, fact);
            } });
          } finally { open = false; }
          if (!requested) throw new TypeError("query: a dependency step must schedule exactly one request");
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

  const context: QueryContext<Inputs, Witness, Verdict> = ({
    inputs,
    get: <Key extends KeyData, Dependency, Value>(query: Query<Inputs, Key, Dependency, Witness, Verdict>, key: Key,
      request: QueryRequest<Witness>,
      resume: (value: Dependency) => QueryComputation<Inputs, Value, Witness, Verdict>): QueryDependency<Inputs, Value, Witness, Verdict> =>
      ({ kind: "dependency", schedule: (scheduler: QueryScheduler<Inputs, Value, Witness, Verdict>) => {
        scheduler.request(query, key, request, resume);
      } }),
    diagnostics: () => snapshotDiagnostics(published, abandoned),
    stats: () => snapshotStatistics(memo),
  });

  function run<Key extends KeyData, Value>(query: Query<Inputs, Key, Value, Witness, Verdict>, key: Key): RunResult<Value> {
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

  return ({ inputs, run, diagnostics: context.diagnostics, stats: context.stats, trace: () => snapshotTrace(trace) });
}
