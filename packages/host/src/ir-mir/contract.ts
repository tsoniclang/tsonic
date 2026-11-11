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
  | { readonly kind: "capture"; readonly index: number };

export type MirPlaceBase =
  | { readonly kind: "local"; readonly local: LocalId }
  | { readonly kind: "static"; readonly definition: DefId }
  | { readonly kind: "place"; readonly place: PlaceId; readonly projection: MirProjection };

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
  | { readonly kind: "refine"; readonly operand: MirOperand; readonly to: TyId }
  | { readonly kind: "aggregate"; readonly type: TyId; readonly aggregate: MirAggregate }
  | { readonly kind: "address-of"; readonly place: PlaceId; readonly type: TyId }
  | { readonly kind: "closure"; readonly instance: BodyInstance; readonly captures: readonly MirClosureCapture[] };

export type MirStatement = MirSite & (
  | { readonly kind: "assign"; readonly place: PlaceId; readonly value: MirRvalue }
  | { readonly kind: "storage-live"; readonly local: LocalId }
  | { readonly kind: "storage-dead"; readonly local: LocalId }
);

export type MirUnwind =
  | { readonly kind: "handler"; readonly exception: PlaceId; readonly target: BlockId }
  | { readonly kind: "escape" };

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
  | { readonly kind: "place"; readonly passing: PlacePassingMode; readonly place: PlaceId };

export type MirCallee =
  | { readonly kind: "direct"; readonly resolution: ResolvedCallee }
  | { readonly kind: "indirect"; readonly operand: MirOperand; readonly resolution: ResolvedCallee };

export type MirTerminator = MirSite & (
  | { readonly kind: "goto"; readonly target: BlockId }
  | { readonly kind: "switch"; readonly operand: MirOperand;
      readonly targets: readonly MirSwitchTarget[]; readonly otherwise: BlockId }
  | { readonly kind: "call"; readonly callee: MirCallee; readonly receiver: MirOperand | null;
      readonly arguments: readonly MirCallArgument[]; readonly destination: PlaceId | null;
      readonly next: BlockId; readonly unwind: MirUnwind }
  | { readonly kind: "invoke"; readonly operation: TypedOperation; readonly operands: readonly MirOperand[];
      readonly destination: PlaceId | null; readonly next: BlockId; readonly unwind: MirUnwind }
  | { readonly kind: "await"; readonly operand: MirOperand; readonly destination: PlaceId;
      readonly resume: BlockId; readonly unwind: MirUnwind }
  | { readonly kind: "yield"; readonly operand: MirOperand | null; readonly destination: PlaceId;
      readonly resume: BlockId; readonly return: MirSuspensionReturn; readonly unwind: MirUnwind }
  | { readonly kind: "delegate"; readonly iterator: MirOperand; readonly destination: PlaceId;
      readonly resume: BlockId; readonly return: MirSuspensionReturn; readonly unwind: MirUnwind }
  | { readonly kind: "throw"; readonly operand: MirOperand; readonly unwind: MirUnwind }
  | { readonly kind: "return"; readonly value: MirOperand | null }
  | { readonly kind: "unreachable" }
);

export interface MirBlock extends MirSite {
  readonly id: BlockId;
  readonly statements: readonly MirStatement[];
  readonly terminator: MirTerminator;
}

export interface MirBody {
  readonly body: BodyId;
  readonly bindings: ArtifactBindings;
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
  | "switch-targets-order";

export type MirViolationSite =
  | { readonly kind: "body"; readonly body: BodyId }
  | { readonly kind: "local"; readonly body: BodyId; readonly local: LocalId }
  | { readonly kind: "constant"; readonly body: BodyId; readonly constant: ConstId }
  | { readonly kind: "place"; readonly body: BodyId; readonly place: PlaceId }
  | { readonly kind: "block"; readonly body: BodyId; readonly block: BlockId }
  | { readonly kind: "instruction"; readonly body: BodyId; readonly block: BlockId; readonly statement: number | null };

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
