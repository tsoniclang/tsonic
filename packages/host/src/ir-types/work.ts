export interface TypePublicationLimits {
  readonly maximumWork: number;
  readonly maximumCreatedRecords: number;
}
export interface TypePublicationStop {
  readonly kind: "resource-limit";
  readonly dimension: "work" | "created-records";
  readonly maximum: number;
}
interface PublicationState {
  readonly limits: TypePublicationLimits;
  work: number;
  records: number;
  stop: TypePublicationStop | null;
}
export class PublicationAccount {
  private readonly state: PublicationState;
  private constructor(state: PublicationState) { this.state = state; }
  static create(limits: TypePublicationLimits): PublicationAccount {
    const { maximumWork, maximumCreatedRecords } = limits;
    if (![maximumWork, maximumCreatedRecords].every(value => Number.isSafeInteger(value) && value >= 0))
      throw new TypeError("ir-types: publication maxima must be nonnegative safe integers.");
    return new PublicationAccount({ limits: { maximumWork, maximumCreatedRecords }, work: 0, records: 0, stop: null });
  }
  static stateOf(value: PublicationAccount): PublicationState { return value.state; }
}
export type TypePublicationWork = PublicationAccount;
export function createTypePublicationWork(limits: TypePublicationLimits): TypePublicationWork {
  return PublicationAccount.create(limits);
}
export function usedPublicationWork(work: TypePublicationWork): number { return PublicationAccount.stateOf(work).work; }
export function usedPublicationRecords(work: TypePublicationWork): number { return PublicationAccount.stateOf(work).records; }

export interface ExpansionStop {
  readonly kind: "resource-limit";
  readonly dimension: "depth" | "visits" | "union-members" | "intersection-members";
  readonly maximum: number;
}

export type LimitStop = TypePublicationStop | ExpansionStop;
export type PublicationResult<Value> = { readonly kind: "complete"; readonly value: Value } | TypePublicationStop;
export type ExpansionResult<Value> = { readonly kind: "complete"; readonly value: Value } | ExpansionStop;

export function chargeWork(work: TypePublicationWork, count: number): boolean {
  const state = PublicationAccount.stateOf(work);
  if (state.stop !== null) return false;
  if (count > state.limits.maximumWork - state.work) { workLimit(work); return false; }
  state.work += count;
  return true;
}

export function chargeCreated(work: TypePublicationWork, count: number): boolean {
  const state = PublicationAccount.stateOf(work);
  if (state.stop !== null) return false;
  if (count > state.limits.maximumCreatedRecords - state.records) { createdLimit(work); return false; }
  state.records += count;
  return true;
}

export function workLimit(work: TypePublicationWork): TypePublicationStop {
  const state = PublicationAccount.stateOf(work);
  return state.stop ??= { kind: "resource-limit", dimension: "work", maximum: state.limits.maximumWork };
}

export function createdLimit(work: TypePublicationWork): TypePublicationStop {
  const state = PublicationAccount.stateOf(work);
  return state.stop ??= { kind: "resource-limit", dimension: "created-records", maximum: state.limits.maximumCreatedRecords };
}
