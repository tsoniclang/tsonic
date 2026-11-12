import type { Diagnostic, Result } from "../diag/contract.js";
import type { KeyData } from "../ids/contract.js";

export interface ActiveKey {
  readonly query: string;
  readonly encodedKey: string;
}

export interface Query<Inputs, Key extends KeyData, Value> {
  readonly name: string;
  readonly compute: (context: QueryContext<Inputs>, key: Key) => QueryComputation<Inputs, Value>;
  readonly cycle:
    | "invariant"
    | { readonly recover: (key: Key, chain: readonly ActiveKey[]) => Result<Value> };
}

export type QueryComputation<Inputs, Value> = Result<Value> | QueryDependency<Inputs, Value>;

export interface QueryDependency<Inputs, Value> {
  readonly kind: "dependency";
  readonly schedule: (scheduler: QueryScheduler<Inputs, Value>) => void;
}

export interface QueryScheduler<Inputs, Value> {
  readonly request: <Key extends KeyData, Dependency>(
    query: Query<Inputs, Key, Dependency>, key: Key,
    resume: (value: Dependency) => QueryComputation<Inputs, Value>,
  ) => void;
}

export interface QueryContext<Inputs> {
  readonly inputs: Inputs;
  readonly get: <Key extends KeyData, Dependency, Value>(
    query: Query<Inputs, Key, Dependency>, key: Key,
    resume: (value: Dependency) => QueryComputation<Inputs, Value>,
  ) => QueryDependency<Inputs, Value>;
  readonly diagnostics: () => readonly Diagnostic[];
  readonly stats: () => readonly QueryStat[];
}

export interface QueryStat {
  readonly name: string;
  readonly computed: number;
  readonly hits: number;
}

export interface QueryLimits {
  readonly maxActiveDepth: number;
}

export type RunResult<Value> =
  | { readonly kind: "completed"; readonly value: Value; readonly diagnostics: readonly Diagnostic[] }
  | { readonly kind: "refused"; readonly diagnostics: readonly [Diagnostic, ...Diagnostic[]] }
  | { readonly kind: "depth-exceeded"; readonly chain: readonly ActiveKey[] };

export interface Database<Inputs> {
  readonly inputs: Inputs;
  readonly run: <Key extends KeyData, Value>(query: Query<Inputs, Key, Value>, key: Key) => RunResult<Value>;
  readonly diagnostics: () => readonly Diagnostic[];
  readonly stats: () => readonly QueryStat[];
}

export type CreateDatabase = <Inputs>(inputs: Inputs, limits: QueryLimits) => Database<Inputs>;
