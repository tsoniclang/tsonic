import type { Cause, Diagnostic, UnitDiagnostic, UnitErrorRead, UnitRef, UnitResult, UnitValue } from "../diag/contract.js";
import type { KeyData } from "../ids/contract.js";

export interface FactKey {
  readonly query: string;
  readonly key: KeyData;
  readonly encodedKey: string;
}

export interface CycleMember<Witness> {
  readonly fact: FactKey;
  readonly witness: Witness;
  readonly answerPolicy: CycleAnswerCapability;
}

export interface ClosedCycle<Witness> {
  readonly members: readonly [CycleMember<Witness>, ...CycleMember<Witness>[]];
}

/** What the one classifier decides for one member of a closed cycle. The set is closed. */
export type CycleOutcome<ErrorData> =
  | { readonly kind: "refused"; readonly diagnostic: Diagnostic }
  | { readonly kind: "error"; readonly cause: Cause; readonly data: ErrorData; readonly diagnostics: readonly Diagnostic[];
      readonly emissions: readonly UnitDiagnostic[] };

/** One outcome per member, in the order of `cycle.members`. */
export type ClassifyCycle<Witness, ErrorData> = (cycle: ClosedCycle<Witness>) => readonly CycleOutcome<ErrorData>[];

export type CycleAnswerCapability = "typed-error" | "refusal-only";

export type CycleAnswerPolicy<Key, Value, ErrorData> =
  | { readonly kind: "typed-error"; readonly construct: (key: Key, cause: Cause, data: ErrorData) => UnitValue<Value> }
  | { readonly kind: "refusal-only" };

export interface Query<Inputs, Key, Value, Witness, ErrorData> {
  readonly name: string;
  readonly keyData: (key: Key) => KeyData;
  /**
   * A computation states each diagnostic it earns once: with its next request, with its abandonment, or, when it
   * was earned after the last request, in its final result. Its final result therefore carries only what was earned
   * after its last request; the kernel keeps the earlier chunks and builds the complete result of the fact from them.
   * The kernel does not check that a computation states no diagnostic twice.
   */
  readonly compute: (context: QueryContext<Inputs, Witness, ErrorData>, key: Key) => QueryComputation<Inputs, Value, Witness, ErrorData>;
  /**
   * The registered capability to construct this fact's typed error from the classified cause, or refusal only when
   * its value has no error arm. The classifier receives this policy's kind with the cycle member. A constructor is
   * never consulted for a refused member; an error outcome for a refusal-only member is a classifier-contract defect.
   */
  readonly answerPolicy: CycleAnswerPolicy<Key, Value, ErrorData>;
}

export type QueryComputation<Inputs, Value, Witness, ErrorData> =
  | UnitResult<Value>
  | QueryDependency<Inputs, Value, Witness, ErrorData>
  | QueryAbandonment;

export interface QueryAbandonment {
  readonly kind: "abandoned";
  readonly diagnostics: readonly [Diagnostic, ...Diagnostic[]];
  /** What the computation earned since its last request. */
  readonly earned: readonly Diagnostic[];
}

export interface QueryDependency<Inputs, Value, Witness, ErrorData> {
  readonly kind: "dependency";
  readonly schedule: (scheduler: QueryScheduler<Inputs, Value, Witness, ErrorData>) => void;
}

export interface QueryRequest<Witness> {
  readonly witness: Witness;
  /**
   * What the requesting computation earned since its previous request (since its start, for the first request).
   * The kernel takes the list as it is and keeps it with the earlier chunks of the same attempt: all of them are
   * kept once if the attempt is abandoned, and all of them precede the final result's own diagnostics when it
   * completes. The requester does not change the list after the request.
   */
  readonly earned: readonly Diagnostic[];
}

export interface QueryScheduler<Inputs, Value, Witness, ErrorData> {
  readonly request: <Key, Dependency>(
    query: Query<Inputs, Key, Dependency, Witness, ErrorData>, key: Key, request: QueryRequest<Witness>,
    resume: (value: Dependency) => QueryComputation<Inputs, Value, Witness, ErrorData>,
  ) => void;
}

export interface QueryContext<Inputs, Witness, ErrorData> {
  readonly inputs: Inputs;
  readonly fact: FactKey;
  readonly errorOf: (unit: UnitRef) => UnitErrorRead;
  readonly get: <Key, Dependency, Value>(
    query: Query<Inputs, Key, Dependency, Witness, ErrorData>, key: Key, request: QueryRequest<Witness>,
    resume: (value: Dependency) => QueryComputation<Inputs, Value, Witness, ErrorData>,
  ) => QueryDependency<Inputs, Value, Witness, ErrorData>;
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

export interface Database<Inputs, Witness, ErrorData> {
  readonly inputs: Inputs;
  readonly run: <Key, Value>(query: Query<Inputs, Key, Value, Witness, ErrorData>, key: Key) => RunResult<Value>;
  readonly errorOf: (unit: UnitRef) => UnitErrorRead;
  readonly diagnostics: () => readonly Diagnostic[];
  readonly stats: () => readonly QueryStat[];
  readonly trace: () => readonly TraceEvent[];
}

export type TraceRecording = "recorded" | "off";

export type CreateDatabase = <Inputs, Witness, ErrorData>(
  inputs: Inputs, limits: QueryLimits, classifyCycle: ClassifyCycle<Witness, ErrorData>, trace: TraceRecording,
) => Database<Inputs, Witness, ErrorData>;
