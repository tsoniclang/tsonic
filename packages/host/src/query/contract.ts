import type { Diagnostic, Result } from "../diag/contract.js";
import type { KeyData } from "../ids/contract.js";

export interface ActiveKey {
  readonly query: string;
  readonly encodedKey: string;
}

export interface Query<Inputs, Key extends KeyData, Value> {
  readonly name: string;
  readonly compute: (database: Database<Inputs>, key: Key) => Result<Value>;
  readonly cycle:
    | "invariant"
    | { readonly recover: (key: Key, chain: readonly ActiveKey[]) => Result<Value> };
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
  readonly get: <Key extends KeyData, Value>(query: Query<Inputs, Key, Value>, key: Key) => Value;
  readonly run: <Key extends KeyData, Value>(query: Query<Inputs, Key, Value>, key: Key) => RunResult<Value>;
  readonly diagnostics: () => readonly Diagnostic[];
  readonly stats: () => readonly QueryStat[];
}

export type CreateDatabase = <Inputs>(inputs: Inputs, limits: QueryLimits) => Database<Inputs>;
