import type { BoundProducerId, DefId, LocalRef, NodeRef, OpenBoundaryId, OriginsId, ProducerId, ProjectionPathId, ValueContextId } from "../ids/contract.js";
import type { BindingVector } from "../ir-types/contract.js";
import type { MemberSelection } from "../ir-tir/contract.js";
import type { LogicalCellRow } from "./cells-data.js";
import type { RelationalOwner, RelationalSite } from "./relations-data.js";

export interface ProducerRef {
  readonly owner: RelationalOwner;
  readonly producer: ProducerId;
}

export interface OriginsRef {
  readonly owner: RelationalOwner;
  readonly origins: OriginsId;
}

export interface OpenBoundaryRef {
  readonly owner: RelationalOwner;
  readonly boundary: OpenBoundaryId;
}

export type Projection =
  | { readonly kind: "field"; readonly member: MemberSelection }
  | { readonly kind: "method-value"; readonly member: MemberSelection }
  | { readonly kind: "element" }
  | { readonly kind: "index"; readonly constant: bigint }
  | { readonly kind: "deref" };

export interface ProjectionPath {
  readonly id: ProjectionPathId;
  readonly parent: ProjectionPathId | null;
  readonly projection: Projection;
}

export type Producer = { readonly id: ProducerId; readonly path: ProjectionPathId | null } & (
  | { readonly kind: "allocation"; readonly at: RelationalSite }
  | { readonly kind: "parameter"; readonly index: number }
  | { readonly kind: "receiver" }
  | { readonly kind: "capture"; readonly index: number }
  | { readonly kind: "local"; readonly local: LocalRef }
  | { readonly kind: "shared"; readonly definition: DefId }
  | { readonly kind: "cell-content"; readonly cell: number; readonly phase: "entry" | "uncontrolled" }
  | { readonly kind: "suspension-input"; readonly at: NodeRef; readonly channel: "sent" | "return" | "thrown" }
  | { readonly kind: "call-result"; readonly at: NodeRef;
      readonly callee: { readonly kind: "direct"; readonly definition: DefId } | { readonly kind: "indirect" } }
);

export interface CaptureLocation {
  readonly index: number;
  readonly location: BoundProducerId;
  readonly cell: number;
}

export interface CapturedValue {
  readonly index: number;
  readonly origins: OriginsId;
}

export type CaptureBinding = CaptureLocation | CapturedValue;

export type ValueArgument = { readonly kind: "provided"; readonly origins: OriginsId } | { readonly kind: "omitted" };

export interface ValueContext {
  readonly id: ValueContextId;
  readonly receiver: OriginsId | null;
  readonly arguments: readonly ValueArgument[];
  readonly captures: readonly CaptureBinding[];
}

export interface BoundProducer {
  readonly id: BoundProducerId;
  readonly producer: ProducerId;
  readonly bindings: BindingVector;
  readonly context: ValueContextId;
}

export type Origins = {
  readonly id: OriginsId;
  readonly producers: readonly BoundProducerId[];
  readonly includesAbsence: boolean;
} & (
  | { readonly kind: "complete" }
  | { readonly kind: "open"; readonly boundaries: readonly [OpenBoundaryId, ...OpenBoundaryId[]] }
);

export interface OpenBoundary {
  readonly id: OpenBoundaryId;
  readonly kind: "external-input" | "external-write" | "opaque-write" | "opaque-result"
    | "unclassified-exposure" | "opaque-invocation" | "unresolved-transport";
  readonly at: RelationalSite;
  readonly subject: ProducerId;
  readonly owner: ProducerId | null;
  readonly bindings: BindingVector;
  readonly context: ValueContextId;
  readonly detail: string;
}

export interface RelationalArena {
  readonly cells: readonly LogicalCellRow[];
  readonly projections: readonly ProjectionPath[];
  readonly producers: readonly Producer[];
  readonly contexts: readonly ValueContext[];
  readonly boundProducers: readonly BoundProducer[];
  readonly origins: readonly Origins[];
  readonly boundaries: readonly OpenBoundary[];
}
