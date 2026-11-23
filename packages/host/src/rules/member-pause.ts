import type { DefId, NodeRef, Origin, TyId } from "../ids/contract.js";
import type { ContributionKey, MemberRuleCompletion, MemberRuleStep } from "../ir-infer/contract.js";
import type { BindingVector, MemberInventoryEntry, MemberKey, MemberTypeRequest, SourceObjectField } from "../ir-types/contract.js";
import { callerDefect } from "./frontier.js";

export interface MemberOwner {
  readonly kind: "member-rules";
}

export type MemberDestination = { readonly kind: "member" } | { readonly kind: "contribution";
  readonly occurrence: NodeRef; readonly key: ContributionKey; readonly result: TyId };

export type MemberPhase =
  | { readonly kind: "inventory"; readonly receiver: TyId; readonly key: MemberKey; readonly declaration: DefId;
      readonly storage: SourceObjectField | null; readonly bindings: BindingVector }
  | { readonly kind: "type"; readonly request: MemberTypeRequest; readonly inventory: MemberInventoryEntry;
      readonly storage: SourceObjectField | null; readonly bindings: BindingVector };

export type MemberStep = MemberRuleStep<MemberRuleCompletion, MemberSuspension>;

const authority: { readonly owner: "rules" } = { owner: "rules" };

interface PendingMember {
  readonly owner: MemberOwner;
  readonly phase: MemberPhase;
  readonly destination: MemberDestination;
  readonly origin: Origin;
  consumed: boolean;
}

export class MemberSuspension {
  readonly #state: PendingMember;

  private constructor(key: typeof authority, state: PendingMember) {
    if (key !== authority) callerDefect("a member resume requires its actual Rules suspension", null);
    this.#state = state;
  }

  static pause(owner: MemberOwner, phase: MemberPhase, destination: MemberDestination, origin: Origin): MemberStep {
    return { kind: "paused", earned: [], requests: [phase.kind === "inventory" ? { kind: "membersOf", receiver: phase.receiver }
      : { kind: "memberTypeOf", request: phase.request }],
    paused: new MemberSuspension(authority, { owner, phase, destination, origin, consumed: false }) };
  }

  static consume(owner: MemberOwner, paused: MemberSuspension): PendingMember {
    if (typeof paused !== "object" || paused === null || !(#state in paused))
      return callerDefect("a member resume requires its actual Rules suspension", null);
    const state = paused.#state;
    if (state.owner !== owner || state.consumed)
      return callerDefect("resume the active member Rules phase once in its actual rule table", state.origin);
    state.consumed = true;
    return state;
  }
}
