import type { Diagnostic, TextParseResult, Violation } from "../diag/contract.js";
import type {
  BlockId, BodyId, BoundProducerId, DefId, LayoutId, LibraryExportIdentity, LocalId, LocalRef, MemoryFieldId, NodeId, NodeRef,
  OpenBoundaryId, OriginsId, PlaceId, ProducerId, ProjectionPathId, SigId, SourceNodeRef, TyId, ValueContextId,
} from "../ids/contract.js";
import type { ArtifactBindings, BindingScope, BindingVector, BodyInstance, DeclarationRequest, Execution, MemberStorageSelection, NominalDefinition, PassingMode, SignatureRequest, TypeExpansionLimits, TypeInterner, TypeTable } from "../ir-types/contract.js";
import type { DeclarationTarget, HirBody, HirNode } from "../ir-hir/contract.js";
import type { MemberSelection, ResolvedCallee, TirBody } from "../ir-tir/contract.js";
import type { MirBody } from "../ir-mir/contract.js";
import type { CallbackInput } from "../snapshot/contract.js";
import type { CallerRefusal, DataflowAccount, DataflowResult, DataflowStop } from "../dataflow/contract.js";
import type { Condition, ConditionLimits } from "./conditions-data.js";
import type { MirPoint, RelationalOwner, StoreEdge, SummaryKey } from "./relations-data.js";
import type { EscapeTarget, PointerBackingOperation, Summary, SummaryWrite } from "./summary-data.js";
import type { AppliedSummary, SummaryApplicationInput, SummaryApplicationLimits } from "./application-data.js";
import type { DependencyInventory } from "./dependency-data.js";
import type { BoundInitializationRow, InitializationApplicationInput, StaticInitializationCell, StaticInitializationEffect, SummaryPosition } from "./initialization-data.js";
export type { AppliedCallback, AppliedCell, AppliedContext, AppliedOriginsValue, AppliedProducerValue, AppliedSubject,
  AppliedSummary, AppliedWrite, SummaryApplicationInput, SummaryApplicationLimits, ValueEntryBinding } from "./application-data.js";
export type { CallbackExchange, CaptureEffect, EffectPaths, EscapeTarget, ParameterEffect, ParameterSlot, PointerBackingOperation,
  Summary, SummaryAnswer, SummaryBacking, SummaryCompletion, SummaryRelations, SummaryResultCell, SummaryRetention, SummaryWrite } from "./summary-data.js";
import type { ProducerRef, RelationalArena } from "./arena-data.js";
export type { BoundProducer, CaptureLocation, OpenBoundary, OpenBoundaryRef, Origins, OriginsRef, Producer, ProducerRef, Projection, ProjectionPath, RelationalArena, ValueArgument, ValueContext } from "./arena-data.js";
export type { Condition, ConditionLimits } from "./conditions-data.js";
export type { BoundProducerRef, MirPoint, RelationalOwner, RelationalSite, StoreEdge, SummaryKey } from "./relations-data.js";
export type { CreatedSlot, DeclaredCellInventory, LogicalCell, LogicalCellLifetime, LogicalCellOccurrence, LogicalCellRef, LogicalCellRow,
  ModuleStaticCellRef, StableReference } from "./cells-data.js";
export type { InitializationEvent, InitializationPoint, InitializationRow, InitializationTable, InitializationWitness, SummaryPosition } from "./initialization-data.js";
export type { BoundInitializationCell, BoundInitializationEvent, BoundInitializationRow, InitializationApplication,
  InitializationApplicationInput, InitializationBinding, StaticInitializationCell, StaticInitializationEffect, UnmetStaticNeed } from "./initialization-data.js";
export type { DependencyComponent, DependencyInventory, ExecutionDependency, RequiredOperations } from "./dependency-data.js";

export type ConditionOr = (left: Condition, right: Condition, limits: ConditionLimits) => DataflowResult<Condition>;
export type ConditionAnd = (left: Condition, right: Condition, limits: ConditionLimits) => DataflowResult<Condition>;
export type ConditionEquals = (left: Condition, right: Condition, limits: ConditionLimits) => DataflowResult<boolean>;
export type ConditionSubstitute = (condition: Condition, events: readonly Condition[], limits: ConditionLimits) => DataflowResult<Condition>;
export type BindInitialization = (input: InitializationApplicationInput, limits: ConditionLimits) => DataflowResult<readonly BoundInitializationRow[]>;
export type StaticInitializationOf = (summary: Summary, writtenOnEntry: (identity: string) => boolean,
  limits: ConditionLimits) => DataflowResult<StaticInitializationEffect>;
export type StaticInitializationCellOf = (summary: Summary, position: number, account: DataflowAccount) => DataflowResult<StaticInitializationCell | null>;
export type StaticDeclarationKey = (declaration: DeclarationRequest, account: DataflowAccount) => DataflowResult<string>;
export type AdmitSummaryIdentity = (key: SummaryKey, account: DataflowAccount) => DataflowStop | null;
export type AdmitArtifactIdentity = (bindings: ArtifactBindings, account: DataflowAccount) => DataflowStop | null;
export type AdmitBindingIdentity = (bindings: BindingVector, account: DataflowAccount) => DataflowStop | null;
export type AdmitSelectionIdentity = (selection: MemberSelection, account: DataflowAccount) => DataflowStop | null;
export type ArgumentTransportKey = (transport: ArgumentTransport | null, account: DataflowAccount) => DataflowResult<string>;
export type CompareBoundActivations = (left: BoundActivation, leftInstance: string, leftTransport: string,
  right: BoundActivation, rightInstance: string, rightTransport: string) => number;
export type CompareConstructionAlternatives = (left: ConstructionAlternative, leftBody: string, right: ConstructionAlternative, rightBody: string) => number;

export interface AnalysisLimits {
  readonly maximumProjectionDepth: number;
  readonly maximumOriginAlternatives: number;
  readonly maximumConditionAlternatives: number;
  readonly maximumRelationalRecordsPerBody: number;
  readonly maximumRelationalReferencesPerBody: number;
}


// A store is an executed operation: identified and ordered by its position in the lowered body; its node is the source
// occurrence (S2-23, K-14). A store made on one outgoing edge of a terminator names that edge by its role (K-3370, K-3372):
// `continue` the next edge of call and invoke, `resume` the resume edge of await, yield and delegate, `return` the return
// edge of yield and delegate, `unwind` a handler unwind edge. Each terminator kind has at most one edge per role, so the
// point and the edge together name one position. `null` is a store at a statement or at the terminator itself.
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


export interface EscapeFact {
  readonly point: MirPoint;
  readonly node: NodeId;
  readonly producer: ProducerId;
  readonly target: EscapeTarget;
}

export type ArgumentTransport = {
  readonly parameter: DefId;
  readonly parameterIndex: number;
  readonly formal: ProducerRef;
} & ({ readonly kind: "omitted" } | {
  readonly kind: "provided";
  readonly authoredIndex: number;
  readonly repeated: boolean;
  readonly passing: PassingMode;
  readonly actual: OriginsId;
  readonly projection: ProjectionPathId | null;
});

export type SummaryIdentity = (key: SummaryKey) => string;
export type SummaryPositionKey = (at: SummaryPosition) => string;
export type EscapeTargetKey = (target: EscapeTarget, account: DataflowAccount) => DataflowResult<string>;

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
  readonly point: MirPoint;
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
  readonly point: MirPoint;
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


export type FactsRule =
  | "cell-id-dense" | "cell-occurrence-resolves" | "cell-role-resolves"
  | "execution-entry-exact"
  | "body-instance-exact" | "cross-owner-qualified" | "type-resolves" | "signature-resolves" | "bindings-complete"
  | "relational-site-resolves" | "declared-site-ordinal"
  | "producer-id-dense" | "context-id-dense" | "bound-producer-id-dense" | "origins-id-dense" | "boundary-id-dense"
  | "projection-id-dense" | "projection-parent-precedes" | "projection-unique" | "producer-unique" | "producer-resolves"
  | "local-producer-location-only"
  | "context-resolves" | "bound-producer-resolves" | "origins-resolves" | "boundary-resolves"
  | "origin-alternatives-order" | "origin-alternatives-correlated" | "origins-unique"
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
  | "initialization-order" | "initialization-conditions-canonical" | "initialization-rows-exact"
  | "initialization-cells-resolve" | "initialization-subjects-exact" | "initialization-witness";

export type MetadataRule =
  | "definition-resolves" | "bindings-complete" | "cross-owner-qualified" | "type-resolves" | "occurrence-resolves"
  | "layout-id-dense" | "field-id-dense" | "root-resolves" | "layout-element-precedes" | "layout-fields-resolve"
  | "layout-size-exact" | "layout-alignment-valid" | "layout-stride-exact" | "field-offset-exact"
  | "field-alignment-valid" | "selected-declarations-order" | "member-correspondence-exact"
  | "data-layout-reference-resolves" | "array-extent-exact" | "layout-geometry-consistent";

export type DependencyRule =
  | "operation-unique" | "execution-resolves" | "bindings-complete" | "call-site-resolves" | "cross-owner-qualified"
  | "dependency-resolves" | "dependency-unique" | "component-membership-exact" | "component-dependencies-exact"
  | "component-kind-exact" | "component-rows-exact" | "component-acyclic";

export type FactsSite =
  | { readonly kind: "cell"; readonly owner: RelationalOwner; readonly cell: number }
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
  | { readonly kind: "component"; readonly component: number };

export type FactsBindingTarget =
  | { readonly kind: "body"; readonly execution: Execution }
  | { readonly kind: "observations"; readonly instance: BodyInstance }
  | { readonly kind: "summary"; readonly summary: SummaryKey }
  | { readonly kind: "metadata"; readonly metadata: MetadataKey };

export interface BindingVerificationContext {
  readonly types: TypeTable;
  readonly bindingScopeOf: (definition: DefId) => BindingScope | null;
  readonly sourceBindingScopesOf: (target: FactsBindingTarget) => readonly BindingScope[] | null;
  readonly nominalOf: (definition: DefId) => NominalDefinition | null;
  readonly nodeExists: (node: SourceNodeRef) => boolean;
  readonly localExists: (local: LocalRef) => boolean;
}

export interface MetadataVerificationContext extends BindingVerificationContext {
  readonly definitionExists: (definition: DefId) => boolean;
  readonly metadataOf: (key: MetadataKey) => MetadataRecord | null;
}

export interface ObservationVerificationContext extends BindingVerificationContext {
  readonly bodyOwner: (body: BodyId) => DefId | null;
  readonly metadataOf: (key: MetadataKey) => MetadataRecord | null;
}

export interface FactsVerificationContext extends MetadataVerificationContext, ObservationVerificationContext {
  readonly limits: AnalysisLimits;
  readonly tirBody: (instance: BodyInstance) => TirBody;
  readonly mirBody: (instance: BodyInstance) => MirBody | null;
  readonly signatureIdOf: (request: SignatureRequest) => SigId | null;
  readonly declarationSourceOf: (definition: DefId) => SourceNodeRef | null;
  readonly diagnostics: readonly Diagnostic[];
  readonly bindingDependentOf: (definition: DefId) => boolean | null;
  readonly captureCount: (key: SummaryKey) => number | null;
  readonly callbackSignaturesOf: (key: SummaryKey, subject: BoundProducerId) => readonly SigId[] | null;
  readonly arenaOf: (owner: RelationalOwner) => RelationalArena | null;
  readonly summaryOf: (key: SummaryKey) => Summary | null;
  readonly libraryExportExists: (identity: LibraryExportIdentity) => boolean;
  readonly declaredSiteCount: (identity: LibraryExportIdentity) => number | null;
}

export type FactsVerification<Rule extends string> =
  | { readonly kind: "complete"; readonly violations: readonly Violation<Rule, FactsSite>[] }
  | DataflowStop;

export interface SummaryVerificationResources {
  readonly account: DataflowAccount;
  readonly conditionRefusal: CallerRefusal;
}

export type PrintFacts = (facts: BodyFacts) => string;
export type PrintObservations = (observations: BodyObservations) => string;
export type ParseObservations = (text: string) => TextParseResult<BodyObservations>;
export interface ObservationsVerificationInput {
  readonly source: HirBody;
  readonly bodyOf: (body: BodyId) => HirBody | null;
  readonly nodeOf: (node: SourceNodeRef) => HirNode | null;
  readonly facts: ObservationVerificationContext;
  readonly account: DataflowAccount;
  readonly types: TypeInterner;
  readonly typeExpansion: TypeExpansionLimits;
}
export type ObservationsVerification =
  | FactsVerification<FactsRule>
  | { readonly kind: "resource-limit"; readonly dimension: "depth" | "visits" | "union-members" | "intersection-members";
      readonly maximum: number };
export type VerifyObservations = (observations: BodyObservations,
  input: ObservationsVerificationInput) => ObservationsVerification;
export type ParseFacts = (text: string) => TextParseResult<BodyFacts>;
export type VerifyFacts = (facts: BodyFacts, mir: MirBody,
  context: FactsVerificationContext, account: DataflowAccount) => FactsVerification<FactsRule>;
// The liveness family of one execution on its own, by the same rules verifyFacts applies to it (verifyFacts calls this).
export type VerifyLiveness = (liveness: LivenessFacts, instance: BodyInstance, mir: MirBody,
  context: FactsVerificationContext, account: DataflowAccount) => FactsVerification<FactsRule>;
export type PrintSummary = (summary: Summary) => string;
export type ApplySummary = (input: SummaryApplicationInput, limits: SummaryApplicationLimits) => DataflowResult<AppliedSummary>;
export type SummaryEquals = (left: Summary, right: Summary, account: DataflowAccount) => DataflowResult<boolean>;
export type ParseSummary = (text: string) => TextParseResult<Summary>;
export type VerifySummary = (summary: Summary,
  context: FactsVerificationContext, resources: SummaryVerificationResources) => FactsVerification<SummaryRule>;
export type PrintMetadata = (metadata: MetadataRecord) => string;
export type ParseMetadata = (text: string) => TextParseResult<MetadataRecord>;
export type VerifyMetadata = (metadata: MetadataRecord,
  context: MetadataVerificationContext, account: DataflowAccount) => FactsVerification<MetadataRule>;
export type VerifyDependencyInventory = (inventory: DependencyInventory,
  context: FactsVerificationContext, account: DataflowAccount) => FactsVerification<DependencyRule>;
export type PrintDependencyInventory = (inventory: DependencyInventory) => string;
export type ParseDependencyInventory = (text: string) => TextParseResult<DependencyInventory>;
