import type { InvariantFailure } from "../diag/contract.js";
import { throwInvariant } from "../diag/index.js";
import type { BlockId, BodyId, LocalId, LocalRef, NodeId, Origin, PlaceId, TyId } from "../ids/contract.js";
import type { BinaryExpression, CallExpression, ConditionalExpression, DoStatement, Expression, ForStatement, IfStatement, LabeledStatement, NewExpression, NodeHeader, ReturnStatement, Statement, SwitchStatement, ThrowStatement, VariableDeclaration, VariableDeclarationList, WhileStatement } from "../ir-hir/contract.js";
import type { CaseClause, CaseOrDefaultClause, DefaultClause } from "../ir-hir/contract.js";
import type { MirOperand, MirSite } from "../ir-mir/contract.js";
import type { MemberSelection, TirApplication, TirBody, TirDemand, TirModuleRoot, TypedOperation, TypedValueOccurrence, TypedPhase, TypedValue } from "../ir-tir/contract.js";
import type { InternalBodyInput, LowerMirDeps } from "./contract.js";
import type { LowerState, ReadAnchor } from "./state.js";

export const failure = (message: string, origin: Origin | null): InvariantFailure => ({ owner: "lower-mir", query: null, origin, message });
const invariant = (message: string, origin: Origin | null): never => throwInvariant(failure(message, origin));

/** The frontier: a construct of the admitted vocabulary that this lowering does not lower yet. A compiler defect, not a diagnostic. */
export const notLoweredYet = (what: string, origin: Origin): never => invariant(`not lowered yet: ${what}`, origin);

/** A typed body that must not be offered to lowering (section 7 part 7: a caller defect). */
export const callerDefect = (what: string, origin: Origin): never => invariant(`caller defect: ${what}`, origin);

export function executingValue(value: TypedValueOccurrence, origin: Origin): TypedValue {
  return "role" in value ? callerDefect("a nonexecuting declaration name in an executable value", origin) : value;
}

export interface DiscardRead {
  readonly block: BlockId;
  readonly site: MirSite;
  readonly storage: TyId;
  place: PlaceId | null;
}

export interface Discard {
  readonly kind: "discard";
  readonly node: NodeHeader;
  readonly read: DiscardRead | null;
}

export type ConditionalDestination =
  | { readonly kind: "value"; readonly place: PlaceId }
  | Discard;

export interface SwitchDispatch {
  readonly node: SwitchStatement<TypedPhase>;
  readonly scope: Extract<ControlScope, { readonly kind: "switch" }>;
  readonly enclosing: LocalScope | null;
  readonly entries: Map<number, BlockId>;
}

export interface SwitchTarget<Clause extends CaseOrDefaultClause<TypedPhase> = CaseOrDefaultClause<TypedPhase>> {
  readonly node: Clause;
  readonly position: number;
}

export type Work =
  | { readonly kind: "module"; readonly node: TirModuleRoot; readonly position: number }
  | { readonly kind: "statement"; readonly node: Statement<TypedPhase> }
  | { readonly kind: "expression"; readonly node: Expression<TypedPhase> }
  | { readonly kind: "conditional"; readonly node: ConditionalExpression<TypedPhase> }
  | { readonly kind: "short-circuit"; readonly node: BinaryExpression<TypedPhase> }
  | { readonly kind: "short-circuit-end"; readonly node: BinaryExpression<TypedPhase>; readonly exit: BlockId;
      readonly result: { readonly place: PlaceId; readonly guard: { readonly block: BlockId; readonly value: Evaluated } | null } | null }
  | { readonly kind: "selected-end"; readonly node: ConditionalExpression<TypedPhase> | BinaryExpression<TypedPhase>; readonly discarded: boolean }
  | { readonly kind: "conditional-true"; readonly node: ConditionalExpression<TypedPhase>; readonly destination: ConditionalDestination;
      readonly otherwise: BlockId; readonly exit: BlockId }
  | { readonly kind: "conditional-false"; readonly node: ConditionalExpression<TypedPhase>; readonly destination: ConditionalDestination;
      readonly exit: BlockId }
  | { readonly kind: "argument-place"; readonly node: Expression<TypedPhase> }
  | { readonly kind: "declaration"; readonly node: VariableDeclaration<TypedPhase>; readonly lexical: boolean }
  | { readonly kind: "declarations"; readonly node: VariableDeclarationList<TypedPhase>; readonly lexical: boolean; readonly position: number }
  | { readonly kind: "scope-end"; readonly node: NodeHeader; readonly scope: LocalScope }
  | { readonly kind: "call"; readonly node: CallExpression<TypedPhase> | NewExpression<TypedPhase>; readonly application: TirApplication; readonly direct: boolean }
  | { readonly kind: "field-read"; readonly node: NodeHeader; readonly member: MemberSelection; readonly storage: TyId;
    readonly receiver: { readonly kind: "in-place"; readonly staticRoot: PlaceId | null } | { readonly kind: "by-reference" } }
  | { readonly kind: "field-assignment"; readonly node: BinaryExpression<TypedPhase>; readonly target: NodeHeader;
      readonly member: MemberSelection; readonly storage: TyId; readonly read: TyId;
      readonly value: TypedValue; readonly calculation: TypedOperation | null; readonly conditional: boolean }
  | { readonly kind: "void-result"; readonly node: NodeHeader; readonly storage: TyId }
  | { readonly kind: "operation"; readonly node: NodeHeader; readonly operation: TypedOperation; readonly form: "unary" | "binary" }
  | { readonly kind: "operation"; readonly node: NodeHeader; readonly operation: TypedOperation; readonly form: "convert"; readonly to: TyId }
  | { readonly kind: "narrow"; readonly node: NodeHeader; readonly narrowing: Extract<NonNullable<TypedValue["narrowing"]>, { readonly kind: "narrowed" }> }
  | { readonly kind: "label-end"; readonly node: LabeledStatement<TypedPhase>; readonly scope: Extract<ControlScope, { readonly kind: "label" }> }
  | { readonly kind: "for"; readonly node: ForStatement<TypedPhase>; readonly headerScope: LocalScope | null }
  | { readonly kind: "for-condition"; readonly node: ForStatement<TypedPhase>; readonly scope: Extract<ControlScope, { readonly kind: "loop" }>; readonly previous: ControlScope | undefined }
  | { readonly kind: "for-end"; readonly node: ForStatement<TypedPhase>; readonly scope: Extract<ControlScope, { readonly kind: "loop" }>; readonly previous: ControlScope | undefined }
  | { readonly kind: "for-next"; readonly node: ForStatement<TypedPhase>; readonly scope: Extract<ControlScope, { readonly kind: "loop" }>; readonly previous: ControlScope | undefined }
  | Discard
  | { readonly kind: "store"; readonly node: NodeHeader; readonly local: LocalId | null; readonly place: PlaceId; readonly result: "old" | "new" }
  | { readonly kind: "if"; readonly node: IfStatement<TypedPhase> }
  | { readonly kind: "switch"; readonly node: SwitchStatement<TypedPhase> }
  | ({ readonly kind: "switch-test"; readonly dispatch: SwitchDispatch; readonly subject: Evaluated; readonly fallback: SwitchTarget<DefaultClause<TypedPhase>> | null } & SwitchTarget<CaseClause<TypedPhase>>)
  | ({ readonly kind: "switch-clause"; readonly position: number } & SwitchDispatch)
  | { readonly kind: "if-then-end"; readonly node: IfStatement<TypedPhase>; readonly otherwise: BlockId; readonly exit: BlockId | null }
  | { readonly kind: "if-else-end"; readonly node: IfStatement<TypedPhase>; readonly exit: BlockId | null }
  | { readonly kind: "while-condition"; readonly node: WhileStatement<TypedPhase>; readonly scope: Extract<ControlScope, { readonly kind: "loop" }>; readonly previous: ControlScope | undefined }
  | { readonly kind: "while-end"; readonly node: WhileStatement<TypedPhase>; readonly scope: Extract<ControlScope, { readonly kind: "loop" }>; readonly previous: ControlScope | undefined }
  | { readonly kind: "do-end"; readonly node: DoStatement<TypedPhase>; readonly scope: Extract<ControlScope, { readonly kind: "loop" }>; readonly previous: ControlScope | undefined; readonly condition: NonNullable<LoopContinuation["update"]> }
  | { readonly kind: "do-condition"; readonly node: DoStatement<TypedPhase>; readonly scope: Extract<ControlScope, { readonly kind: "loop" }>; readonly previous: ControlScope | undefined }
  | { readonly kind: "complete"; readonly node: ReturnStatement<TypedPhase> | ThrowStatement<TypedPhase> | Expression<TypedPhase>;
      readonly result: "value" | "void" };

type PlaceOperand = Extract<MirOperand, { readonly kind: "place" }>;

export type Evaluated = {
  readonly storage: TyId;
  readonly site: MirSite;
} & (
  | { readonly kind: "plain"; readonly pendingRead: false; readonly operand: MirOperand; readonly anchor?: never }
  | { readonly kind: "plain"; readonly pendingRead: true; readonly operand: PlaceOperand; readonly anchor?: never }
  | { readonly kind: "local-read"; readonly pendingRead: boolean; readonly operand: PlaceOperand; readonly root: PlaceId; readonly local: LocalId; anchor?: ReadAnchor }
  | { readonly kind: "shared-field"; readonly pendingRead: boolean; readonly operand: PlaceOperand; readonly root: PlaceId; anchor?: ReadAnchor }
);

interface TargetScope {
  exit: BlockId | null;
  readonly locals: LocalScope | null;
}

export interface LocalScope {
  readonly kind: "block" | "case";
  readonly parent: LocalScope | null;
  readonly locals: LocalId[];
}

export interface LoopContinuation {
  readonly head: BlockId;
  readonly update: { readonly expression: Expression<TypedPhase>; block: BlockId | null } | null;
  readonly locals: LocalScope | null;
}

export type ControlScope = TargetScope & (
  | { readonly kind: "label"; readonly node: LabeledStatement<TypedPhase>; continuation: LoopContinuation | null }
  | { readonly kind: "loop"; readonly node: ForStatement<TypedPhase> | WhileStatement<TypedPhase> | DoStatement<TypedPhase>; readonly continuation: LoopContinuation }
  | { readonly kind: "switch"; readonly node: SwitchStatement<TypedPhase>; readonly continuation: null }
);

export interface Lowering {
  readonly state: LowerState;
  readonly typeOf: LowerMirDeps["typeOf"];
  readonly signatureOf: LowerMirDeps["signatureOf"];
  readonly internal: readonly InternalBodyInput[];
  internalOf: ReadonlyMap<BodyId, InternalBodyInput> | null;
  readonly body: TirBody;
  readonly work: Work[];
  readonly operands: Evaluated[];
  readonly selections: Map<NodeId, Extract<TirDemand, { readonly kind: "selected" }>["when"]>;
  /**
   * The positions in `operands` of the entries read in place from a handed-out local and not saved yet.
   * Kept with the stack by `pushOperand` and `popOperand`, so that a writing control point saves exactly these.
   */
  readonly exposed: Set<number>;
  readonly reads: Map<PlaceId, Set<number>>;
  readonly sharedReads: Set<number>;
  /** The MIR local of each source local that has one. */
  readonly localOf: Map<LocalId, LocalId>;
  readonly labels: Map<NodeId, ControlScope>;
  readonly preservedLocals: Set<LocalId>;
  readonly outerLocals: Map<BodyId, Map<LocalId, LocalId>>;
  scope: LocalScope | null;
  receiver: LocalId | null;
}

export function localFromSource(lowering: Lowering, source: LocalRef): LocalId | undefined {
  return source.body === lowering.body.body ? lowering.localOf.get(source.local)
    : lowering.outerLocals.get(source.body)?.get(source.local);
}

export const siteOf = (body: TirBody, node: NodeHeader): MirSite => ({ origin: node.origin, tir: { body: body.body, node: node.id } });

export const rawType = (payload: TypedValue): TyId =>
  payload.narrowing !== null && payload.narrowing.kind === "narrowed" ? payload.narrowing.source : payload.type;
