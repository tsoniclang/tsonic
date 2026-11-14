import type { Diagnostic, TextParseResult, Violation } from "../diag/contract.js";
import type {
  BlockId, BodyId, BoundProducerId, ComponentId, DefId, LayoutId, LibraryExportIdentity, LocalId, LocalRef, MemoryFieldId, NodeId, NodeRef,
  OpenBoundaryId, OriginsId, PlaceId, ProducerId, ProjectionPathId, SigId, SourceNodeRef, TyId, ValueContextId,
} from "../ids/contract.js";
import type { ArtifactBindings, BindingScope, BindingVector, BodyInstance, DeclaredExecution, Execution, MemberStorageSelection, NominalDefinition, PassingMode, SignatureRequest, TypeExpansionLimits, TypeInterner, TypeTable } from "../ir-types/contract.js";
import type { DeclarationTarget, HirBody, HirNode } from "../ir-hir/contract.js";
import type { MemberSelection, ResolvedCallee, TirBody } from "../ir-tir/contract.js";
import type { MirBody } from "../ir-mir/contract.js";
import type { CallbackInput, SummaryCallback } from "../snapshot/contract.js";

export interface AnalysisLimits {
  readonly maximumProjectionDepth: number;
  readonly maximumOriginAlternatives: number;
  readonly maximumRelationalRecordsPerBody: number;
  readonly maximumRelationalReferencesPerBody: number;
}

export type RelationalOwner =
  | { readonly kind: "body"; readonly execution: Execution }
  | { readonly kind: "summary"; readonly key: SummaryKey };

export type RelationalSite =
  | { readonly kind: "node"; readonly node: SourceNodeRef }
  | { readonly kind: "declared"; readonly identity: LibraryExportIdentity; readonly site: number };

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
  | { readonly kind: "field" | "method-value"; readonly member: MemberSelection }
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
  | { readonly kind: "shared"; readonly definition: DefId }
  | { readonly kind: "suspension-input"; readonly at: NodeRef; readonly channel: "sent" | "return" | "thrown" }
  | { readonly kind: "call-result"; readonly at: NodeRef;
      readonly callee: { readonly kind: "direct"; readonly definition: DefId } | { readonly kind: "indirect" } }
);

export interface CaptureLocation {
  readonly index: number;
  readonly location: BoundProducerId;
}

export interface ValueContext {
  readonly id: ValueContextId;
  readonly receiver: OriginsId | null;
  readonly arguments: readonly OriginsId[];
  readonly captures: readonly CaptureLocation[];
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
  readonly projections: readonly ProjectionPath[];
  readonly producers: readonly Producer[];
  readonly contexts: readonly ValueContext[];
  readonly boundProducers: readonly BoundProducer[];
  readonly origins: readonly Origins[];
  readonly boundaries: readonly OpenBoundary[];
}

export interface MirPoint {
  readonly block: BlockId;
  readonly statement: number | null;
}

// A store is an executed operation: identified and ordered by its position in the lowered body; its node is the source
// occurrence (S2-23, K-14). A store made on one outgoing edge of a terminator names that edge by its role (K-3370, K-3372):
// `continue` the next edge of call and invoke, `resume` the resume edge of await, yield and delegate, `return` the return
// edge of yield and delegate, `unwind` a handler unwind edge. Each terminator kind has at most one edge per role, so the
// point and the edge together name one position. `null` is a store at a statement or at the terminator itself.
export type StoreEdge = "continue" | "resume" | "return" | "unwind";

export interface StoreLiveness {
  readonly node: NodeId;
  readonly point: MirPoint;
  readonly edge: StoreEdge | null;
  readonly observed: boolean;
}

export interface LiveSegment {
  readonly block: BlockId;
  readonly first: number;
  readonly last: number;
}

export interface LocalLiveRange {
  readonly local: LocalId;
  readonly segments: readonly LiveSegment[];
}

// Per source binding of the body (a MIR local with a source): whether the body itself takes its address or captures it.
// No alias or identity fact: that is Origins' alone (COMPONENTS §10.2.1 Liveness).
export interface BindingStorageFact {
  readonly local: LocalId;
  readonly addressTaken: boolean;
  readonly captured: boolean;
}

export interface CaptureFact {
  readonly local: LocalRef;
  readonly reads: boolean;
  readonly writes: boolean;
}

export interface LivenessFacts {
  readonly stores: readonly StoreLiveness[];
  readonly locals: readonly LocalLiveRange[];
  readonly bindings: readonly BindingStorageFact[];
  readonly captures: readonly CaptureFact[];
}

export interface InitializationFact {
  readonly node: NodeId;
  readonly place: PlaceId;
  readonly assigned: boolean;
}

export interface InitializationFacts {
  readonly reads: readonly InitializationFact[];
}

export interface RefinementInvalidation {
  readonly kind: "write" | "call";
  readonly at: NodeRef;
}

export type RefinementReason =
  | { readonly kind: "invalidated"; readonly sites: readonly [RefinementInvalidation, ...RefinementInvalidation[]] }
  | { readonly kind: "guard-not-proven"; readonly detail: string };

export type RefinementFact = {
  readonly node: NodeId;
  readonly guards: readonly NodeId[];
} & (
  | { readonly kind: "proven" }
  | { readonly kind: "unproven"; readonly reason: RefinementReason }
);

export interface IntegerRange {
  readonly minimum: bigint;
  readonly maximum: bigint;
}

export interface IntegerFact {
  readonly node: NodeId;
  readonly range: IntegerRange | null;
  readonly nonnegative: boolean;
}

export interface CountedLoopFact {
  readonly statement: NodeId;
  readonly counterDeclaration: NodeId;
  readonly start: NodeId;
  readonly bound: NodeId;
  readonly body: NodeId;
  readonly direction: "ascending";
  readonly comparison: "exclusive-upper-bound";
  readonly step: 1;
}

export interface RefinementFacts {
  readonly refinements: readonly RefinementFact[];
  readonly integers: readonly IntegerFact[];
  readonly countedLoops: readonly CountedLoopFact[];
}

export interface ReadOriginsFact {
  readonly node: NodeId;
  readonly place: PlaceId;
  readonly origins: OriginsId;
}

export interface PointPlaceOrigins {
  readonly point: MirPoint;
  readonly place: PlaceId;
  readonly origins: OriginsId;
}

export interface SubjectOriginsFact {
  readonly node: NodeId;
  readonly role: "input" | "value" | "member" | "return" | "receiver";
  readonly path: ProjectionPathId | null;
  readonly origins: OriginsId;
}

export interface WrittenOrigins {
  readonly source: NodeRef | null;
  readonly origins: OriginsId;
  readonly reason: WrittenOriginsReason | null;
}

export interface WrittenOriginsReason {
  readonly kind: "value-source-unproven";
  readonly detail: string;
}

// A write and an escape are executed operations: identified and ordered by position, with the node as the source
// occurrence (S2-23).
export interface WriteFact {
  readonly point: MirPoint;
  readonly node: NodeId;
  readonly operation: "initialization" | "mutation";
  readonly destination: "binding" | "member" | "element" | "pointer";
  readonly targets: readonly BoundProducerId[];
  readonly owner: BoundProducerId | null;
  readonly values: readonly WrittenOrigins[];
  readonly boundaries: readonly OpenBoundaryId[];
}

export type EscapeTarget =
  | { readonly kind: "return" | "throw" }
  | { readonly kind: "shared"; readonly definition: DefId; readonly path: ProjectionPathId | null }
  | { readonly kind: "parameter"; readonly index: number; readonly path: ProjectionPathId | null }
  | { readonly kind: "receiver"; readonly path: ProjectionPathId | null }
  | { readonly kind: "capture"; readonly index: number; readonly path: ProjectionPathId | null }
  | { readonly kind: "callback" | "suspension"; readonly at: RelationalSite }
  | { readonly kind: "external"; readonly boundary: OpenBoundaryId };

export interface EscapeFact {
  readonly point: MirPoint;
  readonly node: NodeId;
  readonly producer: ProducerId;
  readonly target: EscapeTarget;
}

export interface ArgumentTransport {
  readonly authoredIndex: number | null;
  readonly parameter: DefId;
  readonly parameterIndex: number;
  readonly repeated: boolean;
  readonly passing: PassingMode;
  readonly actual: OriginsId;
  readonly formal: ProducerRef;
  readonly projection: ProjectionPathId | null;
}

export type SummaryKey =
  | { readonly kind: "body"; readonly execution: Execution }
  | { readonly kind: "declared"; readonly execution: DeclaredExecution };

export type SummaryIdentity = (key: SummaryKey) => string;

export interface InvocationAlternative {
  readonly resolution: ResolvedCallee;
  readonly context: ValueContextId;
  readonly arguments: readonly ArgumentTransport[];
  readonly result: OriginsId;
  readonly thrown: OriginsId;
  readonly summary: SummaryKey;
}

export interface InvocationFact {
  readonly node: NodeId;
  readonly kind: "call" | "construct" | "getter" | "setter" | "native-callback";
  readonly alternatives: readonly InvocationAlternative[];
  readonly boundaries: readonly OpenBoundaryId[];
}

export interface CallbackEntry {
  readonly node: NodeId;
  readonly argument: ArgumentTransport;
  readonly timing: "synchronous" | "deferred" | "unknown";
  readonly rejection: number | null;
  readonly inputs: readonly CallbackInput[];
}

export interface BoundActivation {
  readonly node: NodeId;
  readonly activation: BodyInstance;
  readonly context: ValueContextId;
  readonly caller: ValueContextId | null;
  readonly entry: ArgumentTransport | null;
}

export interface ValueFrontier {
  readonly node: NodeId;
  readonly kind: "boundary" | "origin";
  readonly subject: ProducerId;
  readonly context: ValueContextId;
}

export interface InstanceRegion {
  readonly owner: DefId;
  readonly node: NodeRef;
  readonly context: ValueContextId;
}

export interface ConstructionAlternative {
  readonly node: NodeId;
  readonly root: NodeRef;
  readonly allocation: NodeRef;
  readonly implementation: DefId | null;
  readonly body: BodyInstance | null;
  readonly regions: readonly InstanceRegion[];
}

// What each storage cell holds at each finite exit, in terms of what it held at entry; the normal and the unwinding exit
// are distinct (COMPONENTS §10.2 Origins; COMMON-DATA §8).
export interface ExitContents {
  readonly onReturn: readonly SummaryWrite[];
  readonly onUnwind: readonly SummaryWrite[];
}

export interface OriginFacts {
  readonly points: readonly PointPlaceOrigins[];
  readonly reads: readonly ReadOriginsFact[];
  readonly subjects: readonly SubjectOriginsFact[];
  readonly writes: readonly WriteFact[];
  readonly escapes: readonly EscapeFact[];
  readonly invocations: readonly InvocationFact[];
  readonly callbacks: readonly CallbackEntry[];
  readonly activations: readonly BoundActivation[];
  readonly frontiers: readonly ValueFrontier[];
  readonly constructions: readonly ConstructionAlternative[];
  readonly instanceRegions: readonly InstanceRegion[];
  readonly exitContents: ExitContents;
}

export interface OriginsResult {
  readonly instance: BodyInstance;
  readonly arena: RelationalArena;
  readonly origins: OriginFacts;
}

export interface RetentionFact {
  readonly source: ProducerId;
  readonly into: EscapeTarget;
}

export interface SuspensionValue {
  readonly place: PlaceId;
  readonly origins: OriginsId;
  readonly retention: readonly RetentionFact[];
  readonly continuations: readonly ("resume" | "return" | "unwind")[];
}

export interface SuspensionFact {
  readonly node: NodeId;
  readonly kind: "await" | "yield" | "delegate";
  readonly values: readonly SuspensionValue[];
}

export interface SuspensionFacts {
  readonly suspensions: readonly SuspensionFact[];
}

export type ErrorInvalidationReason =
  | { readonly kind: "incomplete-origins"; readonly affected: OriginsId }
  | { readonly kind: "inexact-accessor-footprint" }
  | { readonly kind: "open-constructor-domain"; readonly constructor: OriginsId }
  | { readonly kind: "opaque-invocation-footprint"; readonly affected: OriginsId };

export type ErrorInvalidationFact = {
  readonly at: NodeRef;
  readonly owner: OriginsId;
} & (
  | { readonly kind: "preserved" }
  | { readonly kind: "invalidated"; readonly cause: "suspension" }
  | { readonly kind: "invalidated"; readonly cause: "overlapping-write"; readonly affected: OriginsId }
  | { readonly kind: "unproven"; readonly reason: ErrorInvalidationReason; readonly detail: string }
);

export interface ErrorStorageFact {
  readonly node: NodeId;
  readonly origins: OriginsId;
  readonly writes: readonly NodeId[];
  readonly retention: readonly RetentionFact[];
  readonly invalidations: readonly ErrorInvalidationFact[];
}

export interface ErrorStorageFacts {
  readonly errors: readonly ErrorStorageFact[];
}

export type PointerBackingOperation =
  | { readonly family: "typed-location";
      readonly operation: "allocate" | "address-of" | "bind-pointer" | "project-pointer"; readonly at: NodeRef }
  | { readonly family: "raw-memory"; readonly operation: "reinterpret"; readonly at: NodeRef };

export interface PointerBackingProducer {
  readonly producer: BoundProducerId;
  readonly operation: PointerBackingOperation;
}

export interface PointerBackingFact {
  readonly node: NodeId;
  readonly returned: boolean;
  readonly origins: OriginsId;
  readonly producers: readonly PointerBackingProducer[];
}

export interface PointerBackingFacts {
  readonly pointers: readonly PointerBackingFact[];
}

export interface MetadataKey {
  readonly definition: DefId;
  readonly bindings: ArtifactBindings;
}

export interface MetadataLayoutRef {
  readonly metadata: MetadataKey;
  readonly layout: LayoutId;
}

export interface MetadataFieldRef {
  readonly metadata: MetadataKey;
  readonly field: MemoryFieldId;
}

export type MemoryLayout = {
  readonly id: LayoutId;
  readonly occurrence: SourceNodeRef;
  readonly source: TyId;
  readonly dataLayout: DefId;
  readonly byteSize: bigint;
  readonly byteAlignment: bigint;
  readonly stride: bigint;
} & (
  | { readonly kind: "value"; readonly fields: readonly MemoryFieldId[] }
  | { readonly kind: "array"; readonly length: bigint; readonly runtimeBase: "number" | "bigint";
      readonly element: LayoutId }
);

export interface MemoryField {
  readonly id: MemoryFieldId;
  readonly occurrence: SourceNodeRef;
  readonly owner: TyId;
  readonly selector: SourceNodeRef;
  readonly selection: SourceNodeRef;
  readonly member: MemberStorageSelection;
  readonly value: TyId;
  readonly layout: LayoutId;
  readonly byteOffset: bigint;
  readonly byteAlignment: bigint;
}

export type MetadataRecord = { readonly key: MetadataKey } & (
  | { readonly kind: "data-layout"; readonly occurrence: SourceNodeRef; readonly fingerprint: string;
      readonly byteOrder: "little" | "big"; readonly addressWidth: 32 | 64 }
  | { readonly kind: "memory-layout"; readonly root: LayoutId;
      readonly layouts: readonly MemoryLayout[]; readonly fields: readonly MemoryField[] }
  | { readonly kind: "memory-field"; readonly root: MemoryFieldId;
      readonly layouts: readonly MemoryLayout[]; readonly fields: readonly MemoryField[] }
);

export interface ObservationFact {
  readonly node: NodeId;
  readonly operation: "size" | "alignment" | "stride" | "field-offset";
  readonly operand: NodeRef;
  readonly layout: MetadataLayoutRef;
  readonly field: MetadataFieldRef | null;
  readonly result: TyId;
  readonly value: bigint;
  readonly bindings: BindingVector;
}

export interface BodyObservations {
  readonly instance: BodyInstance;
  readonly rows: readonly ObservationFact[];
}

export interface RawLocationFact {
  readonly node: NodeId;
  readonly operation: "to-raw" | "reinterpret";
  readonly pointee: TyId;
  readonly layout: MetadataLayoutRef;
  readonly context: ValueContextId;
  readonly bindings: BindingVector;
}

export interface MemoryFieldBindingFact {
  readonly node: NodeId;
  readonly result: TyId;
  readonly owner: TyId;
  readonly fieldExpression: NodeRef;
  readonly field: MetadataFieldRef;
  readonly pointer: NodeRef;
  readonly pointee: TyId;
  readonly context: ValueContextId;
  readonly bindings: BindingVector;
}

export interface BoundRecordField {
  readonly expression: NodeRef;
  readonly binding: NodeId;
}

export interface MemoryRecordBindingFact {
  readonly node: NodeId;
  readonly result: TyId;
  readonly layoutExpression: NodeRef;
  readonly layout: MetadataLayoutRef;
  readonly context: ValueContextId;
  readonly bindings: BindingVector;
  readonly fields: readonly BoundRecordField[];
}

export type MemoryBindingInventoryEntry =
  | { readonly kind: "bound"; readonly node: NodeId; readonly record: NodeId }
  | { readonly kind: "error"; readonly node: NodeId };

export type ClosedArrayReason =
  | { readonly kind: "not-local-element-access"; readonly at: NodeRef }
  | { readonly kind: "open-origin-domain"; readonly origins: OriginsId }
  | { readonly kind: "nonlocal-or-projected-origin"; readonly at: NodeRef }
  | { readonly kind: "sparse-or-spread-literal"; readonly at: NodeRef }
  | { readonly kind: "callable-boundary"; readonly at: NodeRef }
  | { readonly kind: "alias-declaration-missing"; readonly at: NodeRef }
  | { readonly kind: "different-origin-domain"; readonly at: NodeRef }
  | { readonly kind: "binding-not-plain"; readonly at: NodeRef }
  | { readonly kind: "initialization-not-block-local"; readonly at: NodeRef }
  | { readonly kind: "unproven-capture"; readonly at: NodeRef }
  | { readonly kind: "assignment-result-exposed"; readonly at: NodeRef }
  | { readonly kind: "unproven-use"; readonly at: NodeRef }
  | { readonly kind: "no-local-allocation"; readonly at: NodeRef };

export type ClosedArrayFact = { readonly node: NodeId } & (
  | { readonly kind: "unproven"; readonly reason: ClosedArrayReason }
  | { readonly kind: "closed"; readonly declarations: readonly DeclarationTarget[];
      readonly references: readonly NodeRef[]; readonly literals: readonly NodeRef[];
      readonly elements: readonly MemberSelection[] }
);

export interface BodyFacts {
  readonly execution: Execution;
  readonly arena: RelationalArena;
  readonly liveness: LivenessFacts;
  readonly initialization: InitializationFacts;
  readonly refinements: RefinementFacts;
  readonly origins: OriginFacts;
  readonly suspension: SuspensionFacts;
  readonly errorStorage: ErrorStorageFacts;
  readonly pointerBacking: PointerBackingFacts;
  readonly rawLocations: readonly RawLocationFact[];
  readonly fieldBindings: readonly MemoryFieldBindingFact[];
  readonly recordBindings: readonly MemoryRecordBindingFact[];
  readonly memoryBindings: readonly MemoryBindingInventoryEntry[];
  readonly selectedMemoryDeclarations: readonly DefId[];
  readonly closedArrays: readonly ClosedArrayFact[];
}

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
  readonly target: ProducerId;
  readonly value: OriginsId;
}

export interface Summary {
  readonly key: SummaryKey;
  readonly signature: SigId;
  readonly arena: RelationalArena;
  readonly parameters: readonly ParameterEffect[];
  readonly captures: readonly CaptureEffect[];
  readonly result: OriginsId;
  readonly thrown: OriginsId;
  readonly writes: readonly SummaryWrite[];
  readonly retention: readonly RetentionFact[];
  readonly callbacks: readonly SummaryCallback[];
  readonly invocationOnlyParameters: readonly number[];
  readonly suspends: boolean;
  readonly bindingDependent: boolean;
}

export interface CallEdge {
  readonly caller: DefId;
  readonly at: NodeRef;
  readonly kind: "direct" | "indirect" | "getter" | "setter" | "constructor" | "initializer" | "callback";
  readonly callee: { readonly kind: "definition"; readonly definition: DefId }
    | { readonly kind: "open"; readonly boundary: OpenBoundaryRef };
  readonly bindings: ArtifactBindings;
}

export interface CallComponent {
  readonly id: ComponentId;
  readonly definitions: readonly DefId[];
  readonly dependencies: readonly ComponentId[];
}

export interface CallGraph {
  readonly definitions: readonly DefId[];
  readonly edges: readonly CallEdge[];
  readonly components: readonly CallComponent[];
}

export type FactsRule =
  | "execution-entry-exact"
  | "body-instance-exact" | "cross-owner-qualified" | "type-resolves" | "signature-resolves" | "bindings-complete"
  | "relational-site-resolves" | "declared-site-ordinal"
  | "producer-id-dense" | "context-id-dense" | "bound-producer-id-dense" | "origins-id-dense" | "boundary-id-dense"
  | "projection-id-dense" | "projection-parent-precedes" | "projection-unique" | "producer-unique" | "producer-resolves"
  | "context-resolves" | "bound-producer-resolves" | "origins-resolves" | "boundary-resolves"
  | "origin-alternatives-order" | "origin-alternatives-correlated"
  | "capture-locations-exact" | "context-arguments-total" | "node-resolves" | "place-resolves"
  | "mir-point-resolves" | "stores-order" | "locals-order" | "captures-order" | "initialization-order"
  | "live-segments-order" | "live-segments-bounds" | "points-order" | "point-refs-resolve"
  | "refinements-order" | "reads-order" | "subjects-order" | "writes-order" | "escapes-order"
  | "integer-facts-order" | "integer-facts-domain-exact" | "integer-range-valid" | "integer-proofs-consistent"
  | "counted-loops-order" | "counted-loop-endpoints-resolve" | "counted-loop-conditions-exact"
  | "invocations-order" | "callbacks-order" | "activations-order" | "frontiers-order" | "constructions-order"
  | "regions-order" | "suspensions-order" | "errors-order" | "error-invalidations-order"
  | "error-invalidation-origins-resolve" | "error-invalidation-outcome-exact" | "pointers-order" | "observations-order"
  | "raw-locations-order" | "field-bindings-order" | "record-bindings-order" | "memory-bindings-order"
  | "selected-declarations-order" | "closed-arrays-order" | "closed-array-declarations-order" | "argument-transports-total" | "argument-transports-authored-order"
  | "invocation-contexts-correlated" | "summary-reference-exact" | "suspension-continuations-exact" | "suspension-input-site"
  | "pointer-backing-family-exact" | "observation-exact-value" | "observation-field-exact" | "metadata-reference-resolves"
  | "memory-binding-error-diagnostic" | "analysis-limits-respected";

export type SummaryRule =
  | "summary-entry-exact"
  | "definition-resolves" | "signature-resolves" | "bindings-complete" | "cross-owner-qualified"
  | "relational-site-resolves" | "declared-site-ordinal"
  | "parameters-total" | "parameters-order" | "captures-total" | "captures-order"
  | "result-origins-resolves" | "thrown-origins-resolves" | "write-origins-resolves" | "retention-source-resolves"
  | "known-negative-distinct" | "summary-finite" | "summary-binding-dependence" | "writes-order" | "retention-order"
  | "callbacks-order" | "callback-parameter-resolves" | "callback-input-resolves"
  | "invocation-only-parameters-order" | "invocation-only-parameter-resolves";

export type MetadataRule =
  | "definition-resolves" | "bindings-complete" | "cross-owner-qualified" | "type-resolves" | "occurrence-resolves"
  | "layout-id-dense" | "field-id-dense" | "root-resolves" | "layout-element-precedes" | "layout-fields-resolve"
  | "layout-size-exact" | "layout-alignment-valid" | "layout-stride-exact" | "field-offset-exact"
  | "field-alignment-valid" | "selected-declarations-order" | "member-correspondence-exact"
  | "data-layout-reference-resolves" | "array-extent-exact" | "layout-geometry-consistent";

export type CallGraphRule =
  | "definitions-order" | "edges-order" | "components-order" | "definition-resolves" | "call-site-resolves"
  | "cross-owner-qualified" | "component-identity" | "component-membership-exact" | "component-dependencies-exact"
  | "component-members-order" | "component-dependencies-order" | "component-acyclic";

export type FactsSite =
  | { readonly kind: "body"; readonly instance: BodyInstance }
  | { readonly kind: "execution"; readonly execution: Execution }
  | { readonly kind: "definition"; readonly definition: DefId }
  | { readonly kind: "node"; readonly at: SourceNodeRef }
  | { readonly kind: "declared-site"; readonly owner: RelationalOwner;
      readonly identity: LibraryExportIdentity; readonly site: number }
  | { readonly kind: "local"; readonly local: LocalRef }
  | { readonly kind: "projection"; readonly owner: RelationalOwner; readonly projection: ProjectionPathId }
  | { readonly kind: "producer"; readonly owner: RelationalOwner; readonly producer: ProducerId }
  | { readonly kind: "context"; readonly owner: RelationalOwner; readonly context: ValueContextId }
  | { readonly kind: "bound-producer"; readonly owner: RelationalOwner; readonly producer: BoundProducerId }
  | { readonly kind: "origins"; readonly owner: RelationalOwner; readonly origins: OriginsId }
  | { readonly kind: "boundary"; readonly owner: RelationalOwner; readonly boundary: OpenBoundaryId }
  | { readonly kind: "summary"; readonly summary: SummaryKey }
  | { readonly kind: "metadata"; readonly metadata: MetadataKey }
  | { readonly kind: "component"; readonly component: ComponentId };

export type FactsBindingTarget =
  | { readonly kind: "body"; readonly instance: BodyInstance }
  | { readonly kind: "observations"; readonly instance: BodyInstance }
  | { readonly kind: "summary"; readonly summary: SummaryKey }
  | { readonly kind: "metadata"; readonly metadata: MetadataKey };

export interface FactsVerificationContext {
  readonly limits: AnalysisLimits;
  readonly tirBody: (instance: BodyInstance) => TirBody;
  readonly bodyOwner: (body: BodyId) => DefId | null;
  readonly types: TypeTable;
  readonly signatureIdOf: (request: SignatureRequest) => SigId | null;
  readonly declarationSourceOf: (definition: DefId) => SourceNodeRef | null;
  readonly diagnostics: readonly Diagnostic[];
  readonly bindingScopeOf: (definition: DefId) => BindingScope | null;
  readonly bindingScopesOf: (target: FactsBindingTarget) => readonly BindingScope[] | null;
  readonly nominalOf: (definition: DefId) => NominalDefinition | null;
  readonly bindingDependentOf: (definition: DefId) => boolean | null;
  readonly captureCount: (key: SummaryKey) => number | null;
  readonly callbackSignaturesOf: (key: SummaryKey, parameter: number) => readonly SigId[] | null;
  readonly arenaOf: (owner: RelationalOwner) => RelationalArena | null;
  readonly definitionExists: (definition: DefId) => boolean;
  readonly libraryExportExists: (identity: LibraryExportIdentity) => boolean;
  readonly declaredSiteCount: (identity: LibraryExportIdentity) => number | null;
  readonly nodeExists: (node: SourceNodeRef) => boolean;
  readonly localExists: (local: LocalRef) => boolean;
  readonly metadataOf: (key: MetadataKey) => MetadataRecord | null;
}

export type PrintFacts = (facts: BodyFacts) => string;
export type PrintObservations = (observations: BodyObservations) => string;
export type ParseObservations = (text: string) => TextParseResult<BodyObservations>;
export interface ObservationsVerificationInput {
  readonly source: HirBody;
  readonly bodyOf: (body: BodyId) => HirBody | null;
  readonly nodeOf: (node: SourceNodeRef) => HirNode | null;
  readonly facts: FactsVerificationContext;
  readonly types: TypeInterner;
  readonly typeExpansion: TypeExpansionLimits;
}
export type ObservationsVerification =
  | { readonly kind: "complete"; readonly violations: readonly Violation<FactsRule, FactsSite>[] }
  | { readonly kind: "resource-limit"; readonly dimension: "depth" | "visits" | "union-members" | "intersection-members";
      readonly maximum: number };
export type VerifyObservations = (observations: BodyObservations,
  input: ObservationsVerificationInput) => ObservationsVerification;
export type ParseFacts = (text: string) => TextParseResult<BodyFacts>;
export type VerifyFacts = (facts: BodyFacts, mir: MirBody,
  context: FactsVerificationContext) => readonly Violation<FactsRule, FactsSite>[];
// The liveness family of one execution on its own, by the same rules verifyFacts applies to it (verifyFacts calls this).
export type VerifyLiveness = (liveness: LivenessFacts, instance: BodyInstance, mir: MirBody,
  context: FactsVerificationContext) => readonly Violation<FactsRule, FactsSite>[];
export type PrintSummary = (summary: Summary) => string;
export type ParseSummary = (text: string) => TextParseResult<Summary>;
export type VerifySummary = (summary: Summary,
  context: FactsVerificationContext) => readonly Violation<SummaryRule, FactsSite>[];
export type PrintMetadata = (metadata: MetadataRecord) => string;
export type ParseMetadata = (text: string) => TextParseResult<MetadataRecord>;
export type VerifyMetadata = (metadata: MetadataRecord,
  context: FactsVerificationContext) => readonly Violation<MetadataRule, FactsSite>[];
export type VerifyCallGraph = (graph: CallGraph,
  context: FactsVerificationContext) => readonly Violation<CallGraphRule, FactsSite>[];
export type PrintCallGraph = (graph: CallGraph) => string;
export type ParseCallGraph = (text: string) => TextParseResult<CallGraph>;
