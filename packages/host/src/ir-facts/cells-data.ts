import type { LibraryExportIdentity, LocalId, LocalRef, ProjectionPathId } from "../ids/contract.js";
import type { DeclarationRequest, MemberStorageSelection } from "../ir-types/contract.js";
import type { DeclaredExecution, Execution } from "../ir-types/contract.js";
import type { MirPoint, RelationalOwner, RelationalSite } from "./relations-data.js";

export type StableReference =
  | { readonly kind: "local"; readonly local: LocalId }
  | { readonly kind: "parameter"; readonly index: number }
  | { readonly kind: "receiver" }
  | { readonly kind: "capture"; readonly index: number }
  | { readonly kind: "static"; readonly declaration: DeclarationRequest };

export type CreatedSlot =
  | { readonly kind: "local"; readonly local: LocalRef }
  | { readonly kind: "capture"; readonly path: ProjectionPathId; readonly index: number }
  | { readonly kind: "field"; readonly member: MemberStorageSelection }
  | { readonly kind: "entity" };

export type LogicalCell =
  | { readonly kind: "local"; readonly local: LocalId }
  | { readonly kind: "parameter"; readonly index: number }
  | { readonly kind: "capture"; readonly index: number }
  | { readonly kind: "static"; readonly declaration: DeclarationRequest }
  | { readonly kind: "created"; readonly anchor: StableReference | { readonly kind: "result" }; readonly slot: CreatedSlot }
  | { readonly kind: "detached" };

export interface LogicalCellRef {
  readonly owner: RelationalOwner;
  readonly cell: number;
}

export type LogicalCellOccurrence =
  | { readonly kind: "entry"; readonly execution: Execution; readonly local: LocalId }
  | { readonly kind: "statement"; readonly execution: Execution; readonly point: MirPoint }
  | { readonly kind: "declared"; readonly at: RelationalSite };

export interface LogicalCellLifetime {
  readonly kind: "live" | "dead";
  readonly execution: Execution;
  readonly point: MirPoint;
  readonly local: LocalId;
}

export interface LogicalCellRow {
  readonly id: number;
  readonly role: LogicalCell;
  readonly occurrence: LogicalCellOccurrence;
  readonly lifetimes: readonly LogicalCellLifetime[];
}

export interface DeclaredCellInventory {
  readonly execution: DeclaredExecution;
  readonly origin: LibraryExportIdentity;
  readonly cells: readonly LogicalCellRow[];
  readonly producers: readonly { readonly producer: number; readonly cell: number }[];
  readonly captures: readonly { readonly index: number; readonly cell: number }[];
}
