import type { Cause, Diagnostic, Result } from "../diag/contract.js";
import type { KeyData } from "../ids/contract.js";

export interface FactKey {
  readonly query: string;
  readonly key: KeyData;
  readonly encodedKey: string;
}

export interface CycleMember<Witness> {
  readonly fact: FactKey;
  readonly witness: Witness;
}

export interface ClosedCycle<Witness> {
  readonly members: readonly [CycleMember<Witness>, ...CycleMember<Witness>[]];
}

/** What the one classifier decides for one member of a closed cycle. The set is closed. */
export type CycleOutcome =
  | { readonly kind: "refused"; readonly diagnostic: Diagnostic }
  | { readonly kind: "error"; readonly cause: Cause };

/** One outcome per member, in the order of `cycle.members`. */
export type ClassifyCycle<Witness> = (cycle: ClosedCycle<Witness>) => readonly CycleOutcome[];

export interface Query<Inputs, Key extends KeyData, Value, Witness> {
  readonly name: string;
  readonly compute: (context: QueryContext<Inputs, Witness>, key: Key) => QueryComputation<Inputs, Value, Witness>;
  /**
   * The error value of this fact's type for the cause the one classifier gave `key` in a closed cycle. It builds a
   * value from the cause and from nothing else. It is not consulted for a member the classifier refused, and it has
   * no way to refuse or to change another member's outcome: the kernel builds every result from the classifier's outcomes.
   */
  readonly errorValue: (key: Key, cause: Cause) => Value;
}

export type QueryComputation<Inputs, Value, Witness> =
  | Result<Value>
  | QueryDependency<Inputs, Value, Witness>
  | QueryAbandonment;

export interface QueryAbandonment {
  readonly kind: "abandoned";
  readonly diagnostics: readonly [Diagnostic, ...Diagnostic[]];
  readonly earned: readonly Diagnostic[];
}

export interface QueryDependency<Inputs, Value, Witness> {
  readonly kind: "dependency";
  readonly schedule: (scheduler: QueryScheduler<Inputs, Value, Witness>) => void;
}

export interface QueryRequest<Witness> {
  readonly witness: Witness;
  /**
   * Everything the requesting computation has earned so far. It is kept if the computation is abandoned.
   * A completed result replaces what was kept for its fact, so the result of a computation must contain
   * every diagnostic it stated here; the kernel cannot check that.
   */
  readonly earned: readonly Diagnostic[];
}

export interface QueryScheduler<Inputs, Value, Witness> {
  readonly request: <Key extends KeyData, Dependency>(
    query: Query<Inputs, Key, Dependency, Witness>, key: Key, request: QueryRequest<Witness>,
    resume: (value: Dependency) => QueryComputation<Inputs, Value, Witness>,
  ) => void;
}

export interface QueryContext<Inputs, Witness> {
  readonly inputs: Inputs;
  readonly get: <Key extends KeyData, Dependency, Value>(
    query: Query<Inputs, Key, Dependency, Witness>, key: Key, request: QueryRequest<Witness>,
    resume: (value: Dependency) => QueryComputation<Inputs, Value, Witness>,
  ) => QueryDependency<Inputs, Value, Witness>;
}

export interface QueryStat {
  readonly name: string;
  readonly computed: number;
  readonly hits: number;
}

export type TraceEvent =
  | { readonly kind: "dependency"; readonly from: FactKey | null; readonly to: FactKey;
      readonly state: "cold" | "warm" | "active" }
  | { readonly kind: "start"; readonly fact: FactKey }
  | { readonly kind: "completion"; readonly fact: FactKey;
      readonly outcome: "ok" | "refused" | "abandoned" | "cycle-ok" | "cycle-refused" };

export interface QueryLimits {
  /**
   * The bound on the records one database retains. A request that does not fit ends its run as refused with one
   * resource-limit diagnostic. A database reports its bound once: the diagnostic names the first fact that met it,
   * and every later run that meets the bound, at whatever fact, is refused with that same diagnostic.
   */
  readonly maximumRecords: number;
}

export type RunResult<Value> =
  | { readonly kind: "completed"; readonly value: Value; readonly diagnostics: readonly Diagnostic[] }
  | { readonly kind: "refused"; readonly diagnostics: readonly [Diagnostic, ...Diagnostic[]] };

export interface Database<Inputs, Witness> {
  readonly inputs: Inputs;
  readonly run: <Key extends KeyData, Value>(query: Query<Inputs, Key, Value, Witness>, key: Key) => RunResult<Value>;
  readonly diagnostics: () => readonly Diagnostic[];
  readonly stats: () => readonly QueryStat[];
  readonly trace: () => readonly TraceEvent[];
}

export type TraceRecording = "recorded" | "off";

export type CreateDatabase = <Inputs, Witness>(
  inputs: Inputs, limits: QueryLimits, classifyCycle: ClassifyCycle<Witness>, trace: TraceRecording,
) => Database<Inputs, Witness>;
