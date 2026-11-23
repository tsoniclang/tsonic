import type { CallerRefusal, DataflowAccount } from "../dataflow/contract.js";
import type { BoundProducerId, OriginsId, ValueContextId } from "../ids/contract.js";
import type { Execution } from "../ir-types/contract.js";
import type {
  CallbackExchange, CaptureEffect, EscapeTarget, ParameterEffect, Summary, SummaryBacking, SummaryRetention, SummaryResultCell,
} from "./summary-data.js";
import type { LogicalCellRef } from "./cells-data.js";
import type { MirPoint, RelationalOwner, SummaryKey } from "./relations-data.js";
import type { OpenBoundaryRef, OriginsRef, RelationalArena } from "./arena-data.js";
import type { BoundInitializationCell, BoundInitializationEvent, BoundInitializationRow, InitializationEvent } from "./initialization-data.js";

export interface ValueEntryBinding {
  readonly formal: BoundProducerId;
  readonly actual: OriginsId;
}

export interface AppliedProducerValue {
  readonly at: { readonly execution: Execution; readonly point: MirPoint };
  readonly context: ValueContextId;
  readonly producer: { readonly owner: RelationalOwner; readonly producer: BoundProducerId };
}

export interface AppliedOriginsValue {
  readonly caller: readonly { readonly owner: RelationalOwner; readonly producer: BoundProducerId }[];
  readonly callee: readonly AppliedProducerValue[];
  readonly includesAbsence: boolean;
  readonly boundaries: readonly OpenBoundaryRef[];
}

export type AppliedSubject =
  | { readonly kind: "caller"; readonly value: OriginsRef }
  | { readonly kind: "callee"; readonly value: AppliedProducerValue };

export interface AppliedValues {
  readonly key: string;
  readonly origins: readonly AppliedOriginsValue[];
  readonly subjects: readonly AppliedSubject[];
}

export interface SummaryApplicationInput {
  readonly summary: Summary;
  readonly callee: SummaryKey;
  readonly at: { readonly execution: Execution; readonly point: MirPoint };
  readonly context: ValueContextId;
  readonly caller: RelationalArena;
  readonly entries: readonly ValueEntryBinding[];
  readonly cells: readonly BoundInitializationCell[];
  readonly events: readonly InitializationEvent[];
  readonly eventBindings: readonly BoundInitializationEvent[];
}

export interface SummaryApplicationLimits {
  readonly account: DataflowAccount;
  readonly maximumOriginAlternatives: number;
  readonly maximumConditionAlternatives: number;
  readonly originRefusal: CallerRefusal;
  readonly conditionRefusal: CallerRefusal;
}

export type AppliedCell =
  | { readonly kind: "written" }
  | { readonly kind: "located"; readonly targets: readonly [LogicalCellRef, ...LogicalCellRef[]]; readonly same: LogicalCellRef | null };

export interface AppliedWrite {
  readonly target: AppliedCell & { readonly kind: "located" };
  readonly value: AppliedOriginsValue;
}

export interface AppliedContext {
  readonly receiver: AppliedOriginsValue | null;
  readonly arguments: readonly ({ readonly kind: "provided"; readonly origins: AppliedOriginsValue } | { readonly kind: "omitted" })[];
  readonly captures: readonly ({ readonly index: number; readonly location: AppliedSubject;
    readonly cell: AppliedCell & { readonly kind: "located" } } |
    { readonly index: number; readonly origins: AppliedOriginsValue })[];
}

export type AppliedCallback = { readonly subject: AppliedSubject } & (
  | { readonly source: Extract<CallbackExchange, { readonly kind: "unknown" }>; readonly application: null }
  | { readonly source: Extract<CallbackExchange, { readonly kind: "known" }>; readonly application: {
    readonly context: AppliedContext;
    readonly result: AppliedOriginsValue;
    readonly thrown: AppliedOriginsValue;
    readonly handle: AppliedSubject | null;
    readonly shared: readonly AppliedWrite[];
  } }
);

export interface AppliedSummary {
  readonly source: Summary;
  readonly at: { readonly execution: Execution; readonly point: MirPoint };
  readonly context: ValueContextId;
  readonly cells: readonly AppliedCell[];
  readonly subjects: readonly AppliedSubject[];
  readonly events: readonly InitializationEvent[];
  readonly contexts: readonly AppliedContext[];
  readonly result: AppliedOriginsValue;
  readonly thrown: AppliedOriginsValue;
  readonly writes: readonly AppliedWrite[];
  readonly concurrentWrites: readonly AppliedWrite[];
  readonly contentsOnReturn: readonly AppliedWrite[];
  readonly contentsOnUnwind: readonly AppliedWrite[];
  readonly parameters: readonly { readonly source: ParameterEffect; readonly values: readonly AppliedSubject[] }[];
  readonly captures: readonly { readonly source: CaptureEffect; readonly values: readonly AppliedSubject[];
    readonly cells: readonly AppliedCell[] }[];
  readonly retention: readonly { readonly source: SummaryRetention; readonly value: AppliedSubject;
    readonly into: EscapeTarget }[];
  readonly callbacks: readonly AppliedCallback[];
  readonly initialization: readonly BoundInitializationRow[];
  readonly resultCells: readonly { readonly source: SummaryResultCell; readonly value: AppliedOriginsValue; readonly cell: AppliedCell }[];
  readonly backing: readonly { readonly source: SummaryBacking; readonly pointer: AppliedOriginsValue; readonly cell: AppliedCell }[];
}
