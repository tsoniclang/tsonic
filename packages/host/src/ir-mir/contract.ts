import type { TextParseResult, Violation } from "../diag/contract.js";
import type {
  BlockId,
  BodyId,
  ConstId,
  DefId,
  LocalId,
  LocalRef,
  NodeRef,
  Origin,
  PlaceId,
  TyId,
} from "../ids/contract.js";
import type {
  ArtifactBindings, BodyInstance, ConstantReference, LiteralValue, PlacePassingMode, TypeTable,
} from "../ir-types/contract.js";
import type { InferenceDeclaration } from "../ir-infer/contract.js";
import type { MemberSelection, ResolvedCallee, TirBody, TypedOperation } from "../ir-tir/contract.js";

export interface MirSite {
  readonly origin: Origin;
  readonly tir: NodeRef;
}

export type MirLocalRole =
  | { readonly kind: "receiver" }
  | { readonly kind: "parameter"; readonly index: number }
  | { readonly kind: "capture"; readonly index: number }
  | { readonly kind: "user" | "temporary" | "return" | "exception" | "completion" };

export interface MirLocal {
  readonly id: LocalId;
  readonly storage: TyId;
  readonly role: MirLocalRole;
  readonly source: LocalRef | null;
  readonly origin: Origin;
}

export interface MirConstant {
  readonly id: ConstId;
  readonly type: TyId;
  readonly value: MirConstantValue;
}

export type MirConstantValue =
  | { readonly kind: "literal"; readonly value: LiteralValue }
  | { readonly kind: "definition"; readonly definition: DefId; readonly bindings: ArtifactBindings }
  | { readonly kind: "metadata"; readonly definition: DefId; readonly bindings: ArtifactBindings }
  | { readonly kind: "observation"; readonly at: NodeRef }
  | { readonly kind: "constant"; readonly reference: ConstantReference };

export type MirOperand =
  | { readonly kind: "place"; readonly place: PlaceId }
  | { readonly kind: "constant"; readonly constant: ConstId };

export type MirProjection =
  | { readonly kind: "field"; readonly member: MemberSelection }
  | { readonly kind: "index"; readonly operand: MirOperand }
  | { readonly kind: "element"; readonly index: number }
  | { readonly kind: "deref" }
  | { readonly kind: "capture"; readonly index: number }
  | { readonly kind: "refined" };

// A checked place and where it may be used (graph law 3).
//
// A `checked` base is a view of its parent that may be used only where its check is known to have succeeded. A use
// is any occurrence, in a statement or a terminator, of the place or of a place based on it. Success of the check
// makes the place available; it says nothing about whether its contents are initialised.
//
// The check is a terminator. Availability begins at the block the check continues to (`next`) and is established by
// reading forwards along a chain of blocks:
//   - A block passes what is available at its end to the block its terminator continues to (the target of `goto`;
//     the `next` of `check`, `call` and `invoke`; the `resume` of `await`, `yield` and `delegate`) when that block
//     has exactly one incoming edge and is not an entry. Every other block starts with nothing available: a block
//     with several incoming edges (a merge, a loop head), a target of `switch`, a handler, the return target of a
//     suspension, an entry.
//   - A checked place is stable when it is the `refined` view of a local's own cell, that cell is written once (never,
//     for a local present on entry) and the local is not handed out (no address taken, no hand-over by place in a
//     writing mode, no capture). Every other checked place is mutable. The second stable kind, the bounds of an
//     element whose access decision states a fixed extent, is added with that field; until then an `index` view is mutable.
//   - Mutable availability ends at a `call`, `invoke`, `await`, `yield` or `delegate`; at a value written into a
//     place that is not a local's own cell, or into the cell of a local that is handed out; and at a value written into
//     the cell of, or a storage marker of, a local that an available place is rooted at or indexed by.
//   - Stable availability ends only at a value written into the cell of, or a storage marker of, its local.
//   - The destination of a terminator is used after the terminator's own effect.
// A second check of the same place makes it available again. All checked places of one node have one parent and one
// index: a later check re-resolves the place the first check resolved, through the same saved receiver and index.
export type MirPlaceBase =
  | { readonly kind: "local"; readonly local: LocalId }
  | { readonly kind: "static"; readonly definition: DefId }
  | { readonly kind: "place"; readonly place: PlaceId; readonly projection: MirProjection; readonly tir: NodeRef }
  | { readonly kind: "checked"; readonly place: PlaceId; readonly projection: MirProjection; readonly tir: NodeRef };

export interface MirPlace {
  readonly id: PlaceId;
  readonly base: MirPlaceBase;
  readonly storage: TyId;
  readonly origin: Origin;
}

export interface MirAggregateField {
  readonly member: MemberSelection;
  readonly value: MirOperand;
}

export type MirAggregate =
  | { readonly kind: "array" | "tuple" | "fixed-array"; readonly elements: readonly MirOperand[] }
  | { readonly kind: "object" | "record"; readonly fields: readonly MirAggregateField[] };

export interface MirClosureCapture {
  readonly local: LocalRef;
  readonly place: PlaceId;
}

export type MirRvalue =
  | { readonly kind: "use"; readonly operand: MirOperand }
  | { readonly kind: "unary"; readonly operation: TypedOperation; readonly operand: MirOperand }
  | { readonly kind: "binary"; readonly operation: TypedOperation; readonly left: MirOperand; readonly right: MirOperand }
  | { readonly kind: "convert"; readonly operation: TypedOperation; readonly operand: MirOperand; readonly to: TyId }
  | { readonly kind: "aggregate"; readonly type: TyId; readonly aggregate: MirAggregate }
  | { readonly kind: "address-of"; readonly place: PlaceId; readonly type: TyId }
  | { readonly kind: "closure"; readonly instance: BodyInstance; readonly captures: readonly MirClosureCapture[] };

export interface MirStepRef {
  readonly protocol: number;
  readonly step: number;
}

export type MirStatement = MirSite & (
  | { readonly kind: "assign"; readonly place: PlaceId; readonly value: MirRvalue; readonly step: MirStepRef | null }
  | { readonly kind: "storage-live"; readonly local: LocalId }
  | { readonly kind: "storage-dead"; readonly local: LocalId }
);

export type MirUnwind =
  | { readonly kind: "handler"; readonly exception: PlaceId; readonly target: BlockId }
  | { readonly kind: "escape" }
  | { readonly kind: "abort" }
  | { readonly kind: "none" };

export interface MirSuspensionReturn {
  readonly destination: PlaceId;
  readonly target: BlockId;
}

export interface MirSwitchTarget {
  readonly constant: ConstId;
  readonly target: BlockId;
}

export type MirCallArgument =
  | { readonly kind: "value"; readonly passing: "by-value" | "move"; readonly operand: MirOperand }
  | { readonly kind: "place"; readonly passing: PlacePassingMode; readonly place: PlaceId }
  | { readonly kind: "omitted" };

export type MirCallee =
  | { readonly kind: "direct"; readonly resolution: ResolvedCallee }
  | { readonly kind: "indirect"; readonly operand: MirOperand; readonly resolution: ResolvedCallee }
  | { readonly kind: "body"; readonly instance: BodyInstance; readonly captures: readonly MirClosureCapture[] };

// Execution events and the record that stands for each (graph law 5). An event belongs to its actual subject, edge
// or protocol step, and has one representation:
//   creation of a handle             the `call` that creates it. The handle is the value delivered to the destination
//                                    of that call: two executions of one creating call create two handles.
//   activation of an execution       the entry of the activated body in its own graph (`MirBody.entries`), entered
//                                    once for each handle. The creating call names the body instance it connects to
//                                    and, through its callee decision, the selected mode: at creation the call enters
//                                    that entry; otherwise the first drive of the handle does. A later drive or a
//                                    resumption does not enter it again, and no record of the caller stands for the
//                                    activation.
//   suspension                       `await`, `yield`, `delegate`
//   resumption                       the `resume` edge of that terminator
//   exit by return                   `return`
//   exit by unwind                   a failure arm `escape`
//   exit by the consumer finishing   the `return` edge of `yield` or `delegate`
//   completion of a handle           for an iteration, the completion branch: the `switch` that names the `done` step;
//                                    for an awaited handle, the resume or unwind edge of its `await`. An await of one
//                                    handle states nothing about another.
// No occurrence has two records: effects by law 9, steps and the one completion branch of a step by law 6, entries by law 7.
export type MirTerminator = MirSite & (
  | { readonly kind: "goto"; readonly target: BlockId }
  | { readonly kind: "switch"; readonly operand: MirOperand;
      readonly targets: readonly MirSwitchTarget[]; readonly otherwise: BlockId; readonly step: MirStepRef | null }
  | { readonly kind: "check"; readonly place: PlaceId; readonly next: BlockId; readonly unwind: MirUnwind }
  | { readonly kind: "call"; readonly callee: MirCallee; readonly receiver: MirOperand | null;
      readonly arguments: readonly MirCallArgument[]; readonly destination: PlaceId | null;
      readonly next: BlockId; readonly unwind: MirUnwind; readonly step: MirStepRef | null }
  | { readonly kind: "invoke"; readonly operation: TypedOperation; readonly operands: readonly MirOperand[];
      readonly destination: PlaceId | null; readonly next: BlockId; readonly unwind: MirUnwind; readonly step: MirStepRef | null }
  | { readonly kind: "await"; readonly operand: MirOperand; readonly destination: PlaceId;
      readonly resume: BlockId; readonly unwind: MirUnwind; readonly step: MirStepRef | null }
  | { readonly kind: "yield"; readonly operand: MirOperand | null; readonly destination: PlaceId;
      readonly resume: BlockId; readonly return: MirSuspensionReturn; readonly unwind: MirUnwind; readonly step: MirStepRef | null }
  | { readonly kind: "delegate"; readonly iterator: MirOperand; readonly destination: PlaceId;
      readonly resume: BlockId; readonly return: MirSuspensionReturn; readonly unwind: MirUnwind; readonly step: MirStepRef | null }
  | { readonly kind: "throw"; readonly operand: MirOperand; readonly unwind: MirUnwind }
  | { readonly kind: "return"; readonly value: MirOperand | null }
  | { readonly kind: "unreachable" }
);

export interface MirBlock extends MirSite {
  readonly id: BlockId;
  readonly statements: readonly MirStatement[];
  readonly terminator: MirTerminator;
}

export interface MirEntry {
  readonly provided: number;
  readonly block: BlockId;
}

export interface MirBody {
  readonly body: BodyId;
  readonly bindings: ArtifactBindings;
  readonly entries: readonly MirEntry[];
  readonly locals: readonly MirLocal[];
  readonly constants: readonly MirConstant[];
  readonly places: readonly MirPlace[];
  readonly blocks: readonly MirBlock[];
  readonly result: TyId;
}

export type MirRule =
  | "body-owner"
  | "cross-owner-qualified"
  | "local-id-dense"
  | "constant-id-dense"
  | "constant-unique"
  | "place-id-dense"
  | "block-id-dense"
  | "entry-block-zero"
  | "type-resolves"
  | "type-closed"
  | "bindings-complete"
  | "origin-valid"
  | "tir-node-resolves"
  | "place-root-resolves"
  | "place-parent-precedes"
  | "definition-resolves"
  | "projection-valid"
  | "projection-type"
  | "operand-resolves"
  | "constant-type"
  | "metadata-constant-not-materialised"
  | "assignment-type"
  | "operation-selected"
  | "edge-target-resolves"
  | "switch-target-unique"
  | "call-receiver-exact"
  | "body-receiver-exact"
  | "call-arguments-total"
  | "argument-passing-exact"
  | "call-destination-type"
  | "exception-destination-type"
  | "completion-selector-total"
  | "storage-live-before-use"
  | "capture-location-exact"
  | "constants-order"
  | "switch-targets-order"
  | "failure-kind-exact"
  | "check-place-exact"
  | "check-place-single"
  | "checked-place-available"
  | "refined-under-check"
  | "statement-pure"
  | "index-operand-stable"
  | "protocol-step-exact"
  | "completion-branch-canonical"
  | "entries-exact"
  | "omission-admitted"
  | "storage-marker-exact"
  | "effect-site-unique";

export type MirViolationSite =
  | { readonly kind: "body"; readonly body: BodyId }
  | { readonly kind: "local"; readonly body: BodyId; readonly local: LocalId }
  | { readonly kind: "constant"; readonly body: BodyId; readonly constant: ConstId }
  | { readonly kind: "place"; readonly body: BodyId; readonly place: PlaceId }
  | { readonly kind: "block"; readonly body: BodyId; readonly block: BlockId }
  | { readonly kind: "instruction"; readonly body: BodyId; readonly block: BlockId; readonly statement: number | null };

// The canonical key of a constant. A body's constants are unique by this key and listed in its order; a producer
// emits constants in the order the verifier requires by using this one function. Null when the constant's bindings
// are not complete.
export type ConstantKeyOfMir = (type: TyId, value: MirConstantValue) => string | null;
export type PrintMir = (body: MirBody) => string;
export type ParseMir = (text: string) => TextParseResult<MirBody>;
export interface MirVerificationContext {
  readonly source: TirBody;
  readonly types: TypeTable;
  readonly declarationOf: (definition: DefId) => InferenceDeclaration | null;
  readonly bodyOwner: (body: BodyId) => DefId | null;
}
export type VerifyMir = (
  body: MirBody,
  context: MirVerificationContext,
) => readonly Violation<MirRule, MirViolationSite>[];
