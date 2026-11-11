import type { Diagnostic, Result } from "../diag/contract.js";
import { throwInvariant } from "../diag/index.js";
import type { KeyData } from "../ids/contract.js";
import { encodeKey } from "../ids/index.js";
import type { ActiveKey, Database, Query, QueryLimits, RunResult } from "./contract.js";
import type { MemoTable } from "./memo.js";
import { queryMemo, retainResult, snapshotChain, snapshotDiagnostics, snapshotStatistics } from "./memo.js";

interface Refusal {
  readonly kind: "refused";
  readonly diagnostics: readonly [Diagnostic, ...Diagnostic[]];
}

interface DepthExceeded {
  readonly kind: "depth-exceeded";
  readonly chain: readonly ActiveKey[];
}

type Stop = Refusal | DepthExceeded;
type Execution<Value> = Result<Value> | DepthExceeded;

interface EngineSignal {
  readonly error: Error;
  readonly outcome: Stop;
}

interface Boundary {
  signal: EngineSignal | null;
}

export function createQueryDatabase<Inputs>(inputs: Inputs, limits: QueryLimits): Database<Inputs> {
  const maximumDepth = limits.maxActiveDepth;
  if (!Number.isInteger(maximumDepth) || maximumDepth < 0) {
    throw new TypeError("query: maxActiveDepth must be a finite nonnegative integer");
  }
  const memo: MemoTable = new Map();
  const active: ActiveKey[] = [];
  const activeKeys = new Map<string, Set<string>>();
  const boundaries: Boundary[] = [];
  const diagnostics: Diagnostic[] = [];
  let recoveryMarker: object = {};

  function completed<Value>(result: Result<Value>): Result<Value> {
    const retained = retainResult(result);
    retained.diagnostics.forEach(diagnostic => { diagnostics.push(diagnostic); });
    return retained;
  }

  function execute<Key extends KeyData, Value>(query: Query<Inputs, Key, Value>, key: Key): Execution<Value> {
    const encodedKey = encodeKey(key);
    const entry = queryMemo(memo, query, encodedKey);
    const cached = entry.results.get(encodedKey);
    if (cached !== undefined) {
      entry.counter.hits += 1;
      return cached;
    }
    const attempted: ActiveKey = Object.freeze({ query: query.name, encodedKey });
    const keys = activeKeys.get(query.name);
    if (keys !== undefined && keys.has(encodedKey)) {
      const chain = snapshotChain(active, attempted);
      if (query.cycle === "invariant") {
        return throwInvariant({ pass: "pipeline", query: { name: query.name, encodedKey }, origin: null,
          message: `Query cycle ${JSON.stringify(chain)}` });
      }
      const recover = query.cycle.recover;
      recoveryMarker = {};
      return completed(recover(key, chain));
    }
    if (active.length >= maximumDepth) {
      return Object.freeze({ kind: "depth-exceeded", chain: snapshotChain(active, attempted) });
    }
    const entered = keys ?? new Set<string>();
    activeKeys.set(query.name, entered);
    entered.add(encodedKey);
    active.push(attempted);
    entry.counter.computed += 1;
    const finality = recoveryMarker;
    try {
      const compute = query.compute;
      const result = completed(compute(database, key));
      if (finality === recoveryMarker) entry.results.set(encodedKey, result);
      return result;
    } finally {
      active.pop();
      entered.delete(encodedKey);
      if (entered.size === 0) activeKeys.delete(query.name);
    }
  }

  function get<Key extends KeyData, Value>(query: Query<Inputs, Key, Value>, key: Key): Value {
    const boundary = active.length === 0 ? undefined : boundaries.at(-1);
    if (boundary === undefined) throw new TypeError("query: get requires an active computation; use run");
    const result = execute(query, key);
    if (result.kind === "ok") return result.value;
    const error = new Error("query: abandoned computation");
    boundary.signal = { error, outcome: result };
    throw error;
  }

  function run<Key extends KeyData, Value>(query: Query<Inputs, Key, Value>, key: Key): RunResult<Value> {
    const boundary: Boundary = { signal: null };
    boundaries.push(boundary);
    try {
      const result = execute(query, key);
      switch (result.kind) {
        case "ok":
          return Object.freeze({ kind: "completed", value: result.value, diagnostics: result.diagnostics });
        case "refused":
        case "depth-exceeded":
          return result;
      }
    } catch (error) {
      const signal = boundary.signal;
      if (signal !== null && error === signal.error) return signal.outcome;
      throw error;
    } finally {
      boundaries.pop();
    }
  }

  const database: Database<Inputs> = Object.freeze({
    inputs,
    get,
    run,
    diagnostics: () => snapshotDiagnostics(diagnostics),
    stats: () => snapshotStatistics(memo),
  });
  return database;
}
