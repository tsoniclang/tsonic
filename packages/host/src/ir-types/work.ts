export interface PublicationWork {
  readonly maximumWork: number;
  readonly maximumCreatedRecords: number;
  work: number;
  createdRecords: number;
}

export interface PublicationStop {
  readonly kind: "resource-limit";
  readonly dimension: "work" | "created-records";
  readonly maximum: number;
}

export interface ExpansionStop {
  readonly kind: "resource-limit";
  readonly dimension: "depth" | "visits" | "union-members" | "intersection-members";
  readonly maximum: number;
}

export type LimitStop = PublicationStop | ExpansionStop;
export type PublicationResult<Value> = { readonly kind: "complete"; readonly value: Value } | PublicationStop;
export type ExpansionResult<Value> = { readonly kind: "complete"; readonly value: Value } | ExpansionStop;

export function chargeWork(work: PublicationWork, count: number): boolean {
  if (count > work.maximumWork - work.work) return false;
  work.work += count;
  return true;
}

export function chargeCreated(work: PublicationWork, count: number): boolean {
  if (count > work.maximumCreatedRecords - work.createdRecords) return false;
  work.createdRecords += count;
  return true;
}

export function workLimit(work: PublicationWork): PublicationStop {
  return { kind: "resource-limit", dimension: "work", maximum: work.maximumWork };
}

export function createdLimit(work: PublicationWork): PublicationStop {
  return { kind: "resource-limit", dimension: "created-records", maximum: work.maximumCreatedRecords };
}
