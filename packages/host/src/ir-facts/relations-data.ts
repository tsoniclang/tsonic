import type { BlockId, BoundProducerId, LibraryExportIdentity, SourceNodeRef } from "../ids/contract.js";
import type { DeclaredExecution, Execution } from "../ir-types/contract.js";

export type SummaryKey =
  | { readonly kind: "body"; readonly execution: Execution }
  | { readonly kind: "declared"; readonly execution: DeclaredExecution };

export type RelationalOwner =
  | { readonly kind: "body"; readonly execution: Execution }
  | { readonly kind: "summary"; readonly key: SummaryKey };

export type RelationalSite =
  | { readonly kind: "node"; readonly node: SourceNodeRef }
  | { readonly kind: "declared"; readonly identity: LibraryExportIdentity; readonly site: number };

export interface BoundProducerRef {
  readonly owner: RelationalOwner;
  readonly producer: BoundProducerId;
}

export interface MirPoint {
  readonly block: BlockId;
  readonly statement: number | null;
}

export type StoreEdge = "continue" | "resume" | "return" | "unwind";
