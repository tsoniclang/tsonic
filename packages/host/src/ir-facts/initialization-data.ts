import type { SourceNodeRef } from "../ids/contract.js";
import type { DeclarationRequest, DeclaredExecution, Execution } from "../ir-types/contract.js";
import type { BoundProducerRef, MirPoint, RelationalOwner, StoreEdge, SummaryKey } from "./relations-data.js";
import type { Condition } from "./conditions-data.js";
import type { RelationalArena } from "./arena-data.js";

export type SummaryPosition =
  | { readonly kind: "body"; readonly execution: Execution; readonly point: MirPoint; readonly edge: StoreEdge | null }
  | { readonly kind: "declared"; readonly execution: DeclaredExecution; readonly source: SourceNodeRef };

export interface InitializationEvent {
  readonly kind: "callback" | "handle";
  readonly subject: BoundProducerRef;
  readonly exit: "return" | "unwind";
}

export interface InitializationWitness {
  readonly read: SourceNodeRef;
  readonly via: readonly { readonly key: SummaryKey; readonly row: number }[];
}

export type InitializationPoint =
  | { readonly kind: "need"; readonly at: SummaryPosition; readonly cell: number; readonly witness: InitializationWitness }
  | { readonly kind: "before"; readonly at: SummaryPosition; readonly subject: BoundProducerRef }
  | { readonly kind: "return" | "unwind" }
  | { readonly kind: "completed"; readonly handle: BoundProducerRef; readonly exit: "return" | "unwind" };

export interface InitializationRow {
  readonly point: number;
  readonly cell: number | null;
  readonly condition: number;
}

export interface InitializationTable {
  readonly cells: readonly number[];
  readonly events: readonly InitializationEvent[];
  readonly conditions: readonly Condition[];
  readonly points: readonly InitializationPoint[];
  readonly rows: readonly InitializationRow[];
}

export type BoundInitializationCell =
  | { readonly kind: "cell" | "fresh"; readonly index: number }
  | { readonly kind: "written" }
  | { readonly kind: "unproven"; readonly indices: readonly [number, ...number[]] };

export type BoundInitializationEvent =
  | { readonly kind: "event"; readonly index: number }
  | { readonly kind: "never" }
  | { readonly kind: "tables"; readonly applied: readonly [AppliedInitializationTable, ...AppliedInitializationTable[]] };

export interface InitializationBinding {
  readonly cells: readonly BoundInitializationCell[];
  readonly events: readonly BoundInitializationEvent[];
}

export interface InitializationApplication {
  readonly owner: RelationalOwner;
  readonly arena: RelationalArena;
  readonly table: InitializationTable;
  readonly binding: InitializationBinding;
}

export interface InitializationApplicationInput {
  readonly application: InitializationApplication;
  readonly caller: RelationalArena;
  readonly events: readonly InitializationEvent[];
}

export interface AppliedInitializationTable {
  readonly application: InitializationApplication;
  readonly point: number;
}

export interface BoundInitializationRow {
  readonly point: InitializationPoint;
  readonly cell: BoundInitializationCell | null;
  readonly condition: Condition;
}

export interface UnmetStaticNeed {
  readonly declaration: DeclarationRequest;
  readonly at: SummaryPosition;
  readonly witness: InitializationWitness;
}

export interface StaticInitializationCell {
  readonly declaration: DeclarationRequest;
  readonly source: SourceNodeRef;
  readonly key: string;
}

export type StaticInitializationEffect =
  | { readonly kind: "unbound" }
  | { readonly kind: "bound"; readonly writes: readonly string[]; readonly unmet: readonly UnmetStaticNeed[] };
