import type { Diagnostic, ErrorValue, UnitAnswerPosition, UnitRequest } from "../diag/contract.js";
import { throwInvariant } from "../diag/index.js";
import type { NodeRef, Origin } from "../ids/contract.js";
import type { AtomicContribution, Constraint, ConstraintDecision, ConstraintSet, DefaultConstraint, FinalVariable, InferenceGroup,
  InferenceValue, InferenceVariable, MemberRuleNeed, RecordedCheck, VariableBound } from "../ir-infer/contract.js";
import type { MemberInventory } from "../ir-types/contract.js";

const authority: { readonly owner: "infer" } = { owner: "infer" };

export type Reached =
  | { readonly kind: "member"; readonly constraint: Extract<Constraint, { readonly kind: "member" }>;
      readonly evidence: readonly InferenceValue[]; readonly origin: Origin }
  | { readonly kind: "op"; readonly constraint: Extract<Constraint, { readonly kind: "op" }>; readonly evidence: readonly InferenceValue[] }
  | { readonly kind: "call"; readonly constraint: Extract<Constraint, { readonly kind: "call" }>;
      readonly evidence: readonly InferenceValue[]; readonly origin: Origin }
  | { readonly kind: "default"; readonly constraint: DefaultConstraint; readonly evidence: readonly InferenceValue[] }
  | { readonly kind: "literal"; readonly constraint: Extract<Constraint, { readonly kind: "literal" }>; readonly evidence: readonly InferenceValue[] }
  | { readonly kind: "flow"; readonly constraint: Extract<Constraint, { readonly kind: "flow" }>; readonly evidence: readonly InferenceValue[] };

export interface FiledBound {
  readonly bound: VariableBound;
  readonly flow: { readonly set: ConstraintSet; readonly index: number } | null;
}

export interface Enumerated {
  readonly contribution: AtomicContribution;
  readonly index: number;
  readonly reached: Reached;
  readonly set: ConstraintSet;
}

export interface ReadyMemberInventory {
  readonly occurrence: NodeRef;
  readonly inventory: MemberInventory;
}

export interface SolveFrame<Deps, Generated> {
  readonly deps: Deps;
  readonly group: InferenceGroup;
  readonly generated: Generated;
  readonly unit: UnitRequest;
  readonly owned: readonly InferenceVariable[];
  readonly defaults: ReadonlyMap<number, DefaultConstraint> | null;
  readonly enumerated: readonly Enumerated[];
  readonly positions: UnitAnswerPosition[];
  readonly bounds: FiledBound[][];
  readonly decisions: Map<ConstraintSet["body"], Map<number, ConstraintDecision>>;
  readonly sourceErrors: Map<string, { readonly node: NodeRef; readonly errors: ErrorValue[] }>;
  readonly remainingBounds: number[];
  readonly remainingReads: number[];
  readonly readers: number[][];
  readonly contributionBounds: ReadonlySet<number>[];
  readonly ready: { readonly kind: "contribution" | "variable"; readonly index: number }[];
  readonly variables: (FinalVariable | undefined)[];
  readonly checks: RecordedCheck[];
  readonly memberInventories: ReadyMemberInventory[];
  diagnostics: Diagnostic[];
  work: number;
  completed: number;
}

type MemberNeeds = readonly [MemberRuleNeed, ...MemberRuleNeed[]];

export interface PendingMember<State> {
  readonly position: number;
  readonly index: number;
  readonly requests: MemberNeeds;
  readonly rule: State;
  readonly inventory: MemberInventory | null;
}

export interface MemberSolvePause<Suspension> {
  readonly kind: "member";
  readonly occurrence: NodeRef;
  readonly requests: MemberNeeds;
  readonly suspension: Suspension;
}

interface PendingMemberSolve<Deps, Generated, State> {
  readonly frame: SolveFrame<Deps, Generated>;
  readonly pending: PendingMember<State>;
  issued: MemberSolvePause<MemberSolveSuspension<Deps, Generated, State>> | null;
  consumed: boolean;
}

export class MemberSolveSuspension<Deps, Generated, State> {
  readonly #state: PendingMemberSolve<Deps, Generated, State>;

  private constructor(key: typeof authority, state: PendingMemberSolve<Deps, Generated, State>) {
    if (key !== authority) badPause();
    this.#state = state;
  }

  static issue<Deps, Generated, State>(key: typeof authority, frame: SolveFrame<Deps, Generated>, pending: PendingMember<State>,
    occurrence: NodeRef): MemberSolvePause<MemberSolveSuspension<Deps, Generated, State>> {
    if (key !== authority) return badPause();
    const state: PendingMemberSolve<Deps, Generated, State> = { frame, pending, issued: null, consumed: false };
    const pause: MemberSolvePause<MemberSolveSuspension<Deps, Generated, State>> = {
      kind: "member", occurrence, requests: pending.requests, suspension: new MemberSolveSuspension(authority, state),
    };
    state.issued = pause;
    return pause;
  }

  static take<Deps, Generated, State>(key: typeof authority, suspension: MemberSolveSuspension<Deps, Generated, State>, deps: Deps,
    pause: MemberSolvePause<MemberSolveSuspension<Deps, Generated, State>>): PendingMemberSolve<Deps, Generated, State> {
    if (key !== authority || typeof suspension !== "object" || suspension === null || !(#state in suspension))
      return badPause();
    const state = suspension.#state;
    if (state.issued !== pause || state.frame.deps !== deps || state.consumed) return badPause();
    state.consumed = true;
    return state;
  }
}

export function issueMemberSolve<Deps, Generated, State>(frame: SolveFrame<Deps, Generated>, pending: PendingMember<State>,
  occurrence: NodeRef): MemberSolvePause<MemberSolveSuspension<Deps, Generated, State>> {
  return MemberSolveSuspension.issue(authority, frame, pending, occurrence);
}

export function takeMemberSolve<Deps, Generated, State>(deps: Deps,
  pause: MemberSolvePause<MemberSolveSuspension<Deps, Generated, State>>): PendingMemberSolve<Deps, Generated, State> {
  return MemberSolveSuspension.take(authority, pause.suspension, deps, pause);
}

function badPause(): never {
  return throwInvariant({ owner: "infer", query: null, origin: null,
    message: "ResumeSolveGroup: resume the active member contribution once in its actual solve." });
}
