import type { Diagnostic, Result } from "../diag/contract.js";
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

export type ClassifyCycle<Witness, Verdict> = (cycle: ClosedCycle<Witness>) => Verdict;

export interface Query<Inputs, Key extends KeyData, Value, Witness, Verdict> {
  readonly name: string;
  readonly compute: (context: QueryContext<Inputs, Witness, Verdict>, key: Key) => QueryComputation<Inputs, Value, Witness, Verdict>;
  /**
   * This fact's own result for the verdict the one classifier gave for a closed cycle that contains `key`.
   * It may depend on the verdict's entry for `key` and on nothing else: it classifies nothing, and its result
   * must not vary with the member requested first, with other members' results or with any state outside the verdict.
   */
  readonly cycleOutcome: (key: Key, verdict: Verdict) => Result<Value>;
}

export type QueryComputation<Inputs, Value, Witness, Verdict> =
  | Result<Value>
  | QueryDependency<Inputs, Value, Witness, Verdict>
  | QueryAbandonment;

export interface QueryAbandonment {
  readonly kind: "abandoned";
  readonly diagnostics: readonly [Diagnostic, ...Diagnostic[]];
  readonly earned: readonly Diagnostic[];
}

export interface QueryDependency<Inputs, Value, Witness, Verdict> {
  readonly kind: "dependency";
  readonly schedule: (scheduler: QueryScheduler<Inputs, Value, Witness, Verdict>) => void;
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

export interface QueryScheduler<Inputs, Value, Witness, Verdict> {
  readonly request: <Key extends KeyData, Dependency>(
    query: Query<Inputs, Key, Dependency, Witness, Verdict>, key: Key, request: QueryRequest<Witness>,
    resume: (value: Dependency) => QueryComputation<Inputs, Value, Witness, Verdict>,
  ) => void;
}

export interface QueryContext<Inputs, Witness, Verdict> {
  readonly inputs: Inputs;
  readonly get: <Key extends KeyData, Dependency, Value>(
    query: Query<Inputs, Key, Dependency, Witness, Verdict>, key: Key, request: QueryRequest<Witness>,
    resume: (value: Dependency) => QueryComputation<Inputs, Value, Witness, Verdict>,
  ) => QueryDependency<Inputs, Value, Witness, Verdict>;
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
  readonly maximumRecords: number;
}

export type RunResult<Value> =
  | { readonly kind: "completed"; readonly value: Value; readonly diagnostics: readonly Diagnostic[] }
  | { readonly kind: "refused"; readonly diagnostics: readonly [Diagnostic, ...Diagnostic[]] }
  | { readonly kind: "exhausted"; readonly maximumRecords: number; readonly at: FactKey };

export interface Database<Inputs, Witness, Verdict> {
  readonly inputs: Inputs;
  readonly run: <Key extends KeyData, Value>(query: Query<Inputs, Key, Value, Witness, Verdict>, key: Key) => RunResult<Value>;
  readonly diagnostics: () => readonly Diagnostic[];
  readonly stats: () => readonly QueryStat[];
  readonly trace: () => readonly TraceEvent[];
}

export type TraceRecording = "recorded" | "off";

export type CreateDatabase = <Inputs, Witness, Verdict>(
  inputs: Inputs, limits: QueryLimits, classifyCycle: ClassifyCycle<Witness, Verdict>, trace: TraceRecording,
) => Database<Inputs, Witness, Verdict>;
