import type { InvariantFailure } from "../diag/contract.js";
import { throwInvariant } from "../diag/index.js";
import type { BlockId, LocalId, NodeId, Origin, PlaceId, TyId } from "../ids/contract.js";
import type { CallExpression, DoStatement, Expression, ForStatement, IfStatement, LabeledStatement, NodeHeader, ReturnStatement, Statement, ThrowStatement, WhileStatement } from "../ir-hir/contract.js";
import type { MirOperand, MirSite } from "../ir-mir/contract.js";
import type { TirApplication, TirBody, TypedOperation, TypedPhase, TypedValue } from "../ir-tir/contract.js";
import type { LowerMirDeps } from "./contract.js";
import type { LowerState } from "./state.js";

export const failure = (message: string, origin: Origin | null): InvariantFailure => ({ owner: "lower-mir", query: null, origin, message });
const invariant = (message: string, origin: Origin | null): never => throwInvariant(failure(message, origin));

/** The frontier: a construct of the admitted vocabulary that this lowering does not lower yet. A compiler defect, not a diagnostic. */
export const notLoweredYet = (what: string, origin: Origin): never => invariant(`not lowered yet: ${what}`, origin);

/** A typed body that must not be offered to lowering (section 7 part 7: a caller defect). */
export const callerDefect = (what: string, origin: Origin): never => invariant(`caller defect: ${what}`, origin);

export type Work =
  | { readonly kind: "statement"; readonly node: Statement<TypedPhase> }
  | { readonly kind: "expression"; readonly node: Expression<TypedPhase> }
  | { readonly kind: "argument-place"; readonly node: Expression<TypedPhase> }
  | { readonly kind: "call"; readonly node: CallExpression<TypedPhase>; readonly application: TirApplication; readonly direct: boolean }
  | { readonly kind: "operation"; readonly node: NodeHeader; readonly operation: TypedOperation; readonly form: "unary" | "binary" }
  | { readonly kind: "operation"; readonly node: NodeHeader; readonly operation: TypedOperation; readonly form: "convert"; readonly to: TyId }
  | { readonly kind: "narrow"; readonly node: NodeHeader; readonly narrowing: Extract<NonNullable<TypedValue["narrowing"]>, { readonly kind: "narrowed" }> }
  | { readonly kind: "label-end"; readonly node: LabeledStatement<TypedPhase>; readonly scope: Extract<ControlScope, { readonly kind: "label" }> }
  | { readonly kind: "for"; readonly node: ForStatement<TypedPhase> }
  | { readonly kind: "for-condition"; readonly node: ForStatement<TypedPhase>; readonly scope: Extract<ControlScope, { readonly kind: "loop" }>; readonly previous: ControlScope | undefined }
  | { readonly kind: "for-end"; readonly node: ForStatement<TypedPhase>; readonly scope: Extract<ControlScope, { readonly kind: "loop" }>; readonly previous: ControlScope | undefined }
  | { readonly kind: "for-next"; readonly node: ForStatement<TypedPhase>; readonly scope: Extract<ControlScope, { readonly kind: "loop" }>; readonly previous: ControlScope | undefined }
  | { readonly kind: "discard"; readonly node: NodeHeader }
  | { readonly kind: "store"; readonly node: NodeHeader; readonly local: LocalId; readonly place: PlaceId }
  | { readonly kind: "if"; readonly node: IfStatement<TypedPhase> }
  | { readonly kind: "if-then-end"; readonly node: IfStatement<TypedPhase>; readonly otherwise: BlockId; readonly exit: BlockId | null }
  | { readonly kind: "if-else-end"; readonly node: IfStatement<TypedPhase>; readonly exit: BlockId | null }
  | { readonly kind: "while-condition"; readonly node: WhileStatement<TypedPhase>; readonly scope: Extract<ControlScope, { readonly kind: "loop" }>; readonly previous: ControlScope | undefined }
  | { readonly kind: "while-end"; readonly node: WhileStatement<TypedPhase>; readonly scope: Extract<ControlScope, { readonly kind: "loop" }>; readonly previous: ControlScope | undefined }
  | { readonly kind: "do-end"; readonly node: DoStatement<TypedPhase>; readonly scope: Extract<ControlScope, { readonly kind: "loop" }>; readonly previous: ControlScope | undefined; readonly condition: NonNullable<LoopContinuation["update"]> }
  | { readonly kind: "do-condition"; readonly node: DoStatement<TypedPhase>; readonly scope: Extract<ControlScope, { readonly kind: "loop" }>; readonly previous: ControlScope | undefined }
  | { readonly kind: "complete"; readonly node: ReturnStatement<TypedPhase> | ThrowStatement<TypedPhase> | Expression<TypedPhase> };

/** An evaluated operand. `inPlace` is the local whose cell the operand reads with no copy, when it does. */
export interface Evaluated {
  readonly operand: MirOperand;
  readonly inPlace: LocalId | null;
  readonly storage: TyId;
  readonly site: MirSite;
}

interface TargetScope {
  exit: BlockId | null;
}

export interface LoopContinuation {
  readonly head: BlockId;
  readonly update: { readonly expression: Expression<TypedPhase>; block: BlockId | null } | null;
}

export type ControlScope = TargetScope & (
  | { readonly kind: "label"; readonly node: LabeledStatement<TypedPhase>; continuation: LoopContinuation | null }
  | { readonly kind: "loop"; readonly node: ForStatement<TypedPhase> | WhileStatement<TypedPhase> | DoStatement<TypedPhase>; readonly continuation: LoopContinuation }
);

export interface Lowering {
  readonly state: LowerState;
  readonly typeOf: LowerMirDeps["typeOf"];
  readonly body: TirBody;
  readonly work: Work[];
  readonly operands: Evaluated[];
  /**
   * The positions in `operands` of the entries read in place from a handed-out local and not saved yet, in stack
   * order. Kept with the stack by `pushOperand` and `popOperand`, so that a writing control point saves exactly these.
   */
  readonly exposed: Set<number>;
  readonly reads: Map<LocalId, Set<number>>;
  /** The MIR local of each source local that has one. */
  readonly localOf: Map<LocalId, LocalId>;
  readonly labels: Map<NodeId, ControlScope>;
  readonly preservedLocals: Set<LocalId>;
  receiver: LocalId | null;
}

export const siteOf = (body: TirBody, node: NodeHeader): MirSite => ({ origin: node.origin, tir: { body: body.body, node: node.id } });
