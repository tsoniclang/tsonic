import type { Diagnostic, Result } from "../diag/contract.js";
import { requirePresent, throwInvariant } from "../diag/index.js";
import type { KeyData } from "../ids/contract.js";
import { encodeKey } from "../ids/index.js";
import type { ActiveKey, Database, Query, QueryComputation, QueryContext, QueryDependency, QueryLimits, QueryScheduler, RunResult } from "./contract.js";
import type { MemoTable } from "./memo.js";
import { queryMemo, retainResult, snapshotChain, snapshotDiagnostics, snapshotStatistics } from "./memo.js";

interface Frame {
  readonly identity: ActiveKey;
  readonly keys: Set<string>;
  readonly advance: () => void;
}

type Stop =
  | { readonly kind: "refused"; readonly diagnostics: readonly [Diagnostic, ...Diagnostic[]] }
  | { readonly kind: "depth-exceeded"; readonly chain: readonly ActiveKey[] };

interface Boundary {
  stop: Stop | null;
}

const completionFailure = Object.freeze({ owner: "query", query: null, origin: null,
  message: "A completed query must publish its actual result." });

export function createQueryDatabase<Inputs>(inputs: Inputs, limits: QueryLimits): Database<Inputs> {
  const maximumDepth = limits.maxActiveDepth;
  if (!Number.isInteger(maximumDepth) || maximumDepth < 0) {
    throw new TypeError("query: maxActiveDepth must be a finite nonnegative integer");
  }
  const memo: MemoTable = new Map();
  const frames: Frame[] = [];
  const active: ActiveKey[] = [];
  const activeKeys = new Map<string, Set<string>>();
  const diagnostics: Diagnostic[] = [];
  let running = false;
  let recoveryMarker: object | null = null;

  function completed<Value>(result: Result<Value>): Result<Value> {
    const retained = retainResult(result);
    retained.diagnostics.forEach(diagnostic => { diagnostics.push(diagnostic); });
    return retained;
  }

  function leave(frame: Frame): void {
    frames.pop();
    active.pop();
    frame.keys.delete(frame.identity.encodedKey);
    if (frame.keys.size === 0) activeKeys.delete(frame.identity.query);
  }

  function enter<Key extends KeyData, Value>(query: Query<Inputs, Key, Value>, key: Key,
    accept: (value: Value, diagnostics: readonly Diagnostic[]) => void, boundary: Boundary): void {
    const encodedKey = encodeKey(key);
    const entry = queryMemo(memo, query, encodedKey);
    const deliver = (result: Result<Value>): void => {
      if (result.kind === "refused") boundary.stop = result;
      else accept(result.value, result.diagnostics);
    };
    const cached = entry.results.get(encodedKey);
    if (cached !== undefined) {
      entry.counter.hits += 1;
      deliver(cached);
      return;
    }
    const attempted: ActiveKey = Object.freeze({ query: query.name, encodedKey });
    const keys = activeKeys.get(query.name);
    if (keys !== undefined && keys.has(encodedKey)) {
      const chain = snapshotChain(active, attempted);
      if (query.cycle === "invariant") {
        return throwInvariant({ owner: "query", query: { name: query.name, encodedKey }, origin: null,
          message: `Query cycle ${JSON.stringify(chain)}` });
      }
      const recover = query.cycle.recover;
      recoveryMarker = {};
      deliver(completed(recover(key, chain)));
      return;
    }
    if (active.length >= maximumDepth) {
      boundary.stop = Object.freeze({ kind: "depth-exceeded", chain: snapshotChain(active, attempted) });
      return;
    }
    const entered = keys ?? new Set<string>();
    activeKeys.set(query.name, entered);
    entered.add(encodedKey);
    active.push(attempted);
    const finality = recoveryMarker;
    const compute = query.compute;
    let next: () => QueryComputation<Inputs, Value> = () => {
      entry.counter.computed += 1;
      return compute(context, key);
    };
    const frame: Frame = {
      identity: attempted,
      keys: entered,
      advance: () => {
        const step = next();
        if (step.kind === "dependency") {
          let requested = false;
          let open = true;
          const schedule = step.schedule;
          try {
            schedule({ request: (dependency, dependencyKey, resume) => {
              if (!open) throw new TypeError("query: dependency scheduling must be synchronous");
              if (requested) throw new TypeError("query: a dependency step must schedule exactly one request");
              requested = true;
              enter(dependency, dependencyKey, value => { next = () => resume(value); }, boundary);
            } });
          } finally { open = false; }
          if (!requested) throw new TypeError("query: a dependency step must schedule exactly one request");
        } else {
          const result = completed(step);
          if (finality === recoveryMarker) entry.results.set(encodedKey, result);
          leave(frame);
          deliver(result);
        }
      },
    };
    frames.push(frame);
  }

  const context: QueryContext<Inputs> = Object.freeze({
    inputs,
    get: <Key extends KeyData, Dependency, Value>(query: Query<Inputs, Key, Dependency>, key: Key,
      resume: (value: Dependency) => QueryComputation<Inputs, Value>): QueryDependency<Inputs, Value> =>
      Object.freeze({ kind: "dependency", schedule: (scheduler: QueryScheduler<Inputs, Value>) => { scheduler.request(query, key, resume); } }),
    diagnostics: () => snapshotDiagnostics(diagnostics),
    stats: () => snapshotStatistics(memo),
  });

  function run<Key extends KeyData, Value>(query: Query<Inputs, Key, Value>, key: Key): RunResult<Value> {
    if (running) throw new TypeError("query: run cannot be nested; request dependencies through context.get");
    running = true;
    const boundary: Boundary = { stop: null };
    const result: { value: RunResult<Value> | undefined } = { value: undefined };
    try {
      enter(query, key, (value, diagnostics) => {
        result.value = Object.freeze({ kind: "completed", value, diagnostics });
      }, boundary);
      for (let frame = frames.at(-1); frame !== undefined && boundary.stop === null; frame = frames.at(-1)) frame.advance();
      if (boundary.stop !== null) return boundary.stop;
      return requirePresent(result.value, completionFailure);
    } finally {
      for (let frame = frames.at(-1); frame !== undefined; frame = frames.at(-1)) leave(frame);
      running = false;
    }
  }

  return Object.freeze({ inputs, run, diagnostics: context.diagnostics, stats: context.stats });
}
