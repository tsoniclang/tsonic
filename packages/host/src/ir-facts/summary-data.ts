import type { BoundProducerId, DefId, NodeRef, OpenBoundaryId, OriginsId, ProjectionPathId, SigId, ValueContextId } from "../ids/contract.js";
import type { PassingMode } from "../ir-types/contract.js";
import type { SummaryCallback } from "../snapshot/contract.js";
import type { OpenBoundaryRef, RelationalArena } from "./arena-data.js";
import type { InitializationTable, SummaryPosition } from "./initialization-data.js";
import type { BoundProducerRef, RelationalSite, SummaryKey } from "./relations-data.js";

export type EscapeTarget =
  | { readonly kind: "return" | "throw" }
  | { readonly kind: "shared"; readonly definition: DefId; readonly path: ProjectionPathId | null }
  | { readonly kind: "parameter"; readonly index: number; readonly path: ProjectionPathId | null }
  | { readonly kind: "receiver"; readonly path: ProjectionPathId | null }
  | { readonly kind: "capture"; readonly index: number; readonly path: ProjectionPathId | null }
  | { readonly kind: "callback" | "suspension"; readonly at: RelationalSite }
  | { readonly kind: "external"; readonly boundary: OpenBoundaryId };

export type PointerBackingOperation =
  | { readonly family: "typed-location";
      readonly operation: "allocate" | "address-of" | "bind-pointer" | "project-pointer"; readonly at: NodeRef }
  | { readonly family: "raw-memory"; readonly operation: "reinterpret"; readonly at: NodeRef };

export type EffectPaths =
  | { readonly kind: "complete"; readonly paths: readonly ProjectionPathId[] }
  | { readonly kind: "open"; readonly paths: readonly ProjectionPathId[];
      readonly boundaries: readonly [OpenBoundaryId, ...OpenBoundaryId[]] };

export type ParameterSlot =
  | { readonly kind: "receiver" }
  | { readonly kind: "parameter"; readonly index: number };

export interface ParameterEffect {
  readonly slot: ParameterSlot;
  readonly reads: EffectPaths;
  readonly writes: EffectPaths;
}

export interface CaptureEffect {
  readonly index: number;
  readonly reads: EffectPaths;
  readonly writes: EffectPaths;
}

export interface SummaryWrite {
  readonly target: number;
  readonly value: OriginsId;
}

export interface SummaryCompletion {
  readonly concurrentWrites: readonly SummaryWrite[];
  readonly contentsOnReturn: readonly SummaryWrite[];
  readonly contentsOnUnwind: readonly SummaryWrite[];
  readonly returns: boolean;
  readonly unwinds: boolean;
  readonly initialization: InitializationTable;
}

export type CallbackExchange = { readonly subject: BoundProducerRef } & (
  | { readonly kind: "known"; readonly at: SummaryPosition; readonly signature: SigId; readonly provided: number;
      readonly context: ValueContextId; readonly result: OriginsId; readonly thrown: OriginsId;
      readonly handle: BoundProducerRef | null; readonly timing: "synchronous" | "deferred";
      readonly shared: readonly SummaryWrite[] }
  | { readonly kind: "unknown"; readonly boundary: OpenBoundaryRef;
      readonly signatures: readonly [SigId, ...SigId[]]; readonly constraint: SummaryCallback | null;
      readonly invocationOnly: boolean }
);

export interface SummaryResultCell {
  readonly value: OriginsId;
  readonly cell: number;
  readonly path: ProjectionPathId | null;
}

export interface SummaryRetention {
  readonly source: BoundProducerId;
  readonly at: SummaryPosition;
  readonly into: EscapeTarget;
}

export interface SummaryBacking {
  readonly at: SummaryPosition;
  readonly operation: PointerBackingOperation;
  readonly pointer: OriginsId;
  readonly cell: number;
  readonly use:
    | { readonly kind: "return" }
    | { readonly kind: "argument"; readonly callee: SummaryKey; readonly slot: ParameterSlot; readonly passing: PassingMode };
}

export interface SummaryRelations extends SummaryCompletion {
  readonly callbacks: readonly CallbackExchange[];
  readonly resultCells: readonly SummaryResultCell[];
  readonly backing: readonly SummaryBacking[];
}

export interface Summary extends SummaryRelations {
  readonly key: SummaryKey;
  readonly signature: SigId;
  readonly arena: RelationalArena;
  readonly parameters: readonly ParameterEffect[];
  readonly captures: readonly CaptureEffect[];
  readonly result: OriginsId;
  readonly thrown: OriginsId;
  readonly writes: readonly SummaryWrite[];
  readonly retention: readonly SummaryRetention[];
  readonly suspends: boolean;
  readonly bindingDependent: boolean;
}
