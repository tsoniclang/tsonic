import type { Result } from "../diag/contract.js";

export interface DataflowRefusal {
  readonly kind: "resource-limit";
  readonly dimension: "work" | "result-entries" | "state";
  readonly maximum: number;
}

export type CallerRefusal = Extract<Result<never>, { readonly kind: "refused" }>;
export type DataflowStop = DataflowRefusal | CallerRefusal;

export interface DataflowLimits {
  readonly maximumWork: number;
  readonly maximumResultEntries: number;
}

interface Meter {
  readonly limits: DataflowLimits;
  work: number;
  entries: number;
  failure: DataflowStop | null;
}

export class InvocationAccount {
  private readonly state: Meter;
  private constructor(state: Meter) { this.state = state; }
  static create(limits: DataflowLimits): InvocationAccount {
    return new InvocationAccount({ limits: { maximumWork: limits.maximumWork, maximumResultEntries: limits.maximumResultEntries },
      work: 0, entries: 0, failure: null });
  }
  static stateOf(account: InvocationAccount): Meter { return account.state; }
}

export function checkMaximum(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${name} must be a nonnegative safe integer`);
  }
}

export function createMeter(limits: DataflowLimits): InvocationAccount {
  checkMaximum(limits.maximumWork, "maximumWork");
  checkMaximum(limits.maximumResultEntries, "maximumResultEntries");
  return InvocationAccount.create(limits);
}

export function failureOf(account: InvocationAccount): DataflowStop | null {
  return InvocationAccount.stateOf(account).failure;
}

export function recordRefusal(account: InvocationAccount, refusal: CallerRefusal): DataflowStop {
  const meter = InvocationAccount.stateOf(account);
  meter.failure ??= refusal;
  return meter.failure;
}

export function stopState(account: InvocationAccount, maximum: number): DataflowStop {
  const meter = InvocationAccount.stateOf(account);
  meter.failure ??= { kind: "resource-limit", dimension: "state", maximum };
  return meter.failure;
}

export function takeWork(account: InvocationAccount, count = 1): DataflowStop | null {
  const meter = InvocationAccount.stateOf(account);
  if (meter.failure !== null) return meter.failure;
  checkMaximum(count, "work units");
  if (count > meter.limits.maximumWork - meter.work) {
    meter.failure = { kind: "resource-limit", dimension: "work", maximum: meter.limits.maximumWork };
    return meter.failure;
  }
  meter.work += count;
  return null;
}

export function takeEntries(account: InvocationAccount, count: number): DataflowStop | null {
  const meter = InvocationAccount.stateOf(account);
  if (meter.failure !== null) return meter.failure;
  checkMaximum(count, "result entries");
  if (count > meter.limits.maximumResultEntries - meter.entries) {
    meter.failure = { kind: "resource-limit", dimension: "result-entries", maximum: meter.limits.maximumResultEntries };
    return meter.failure;
  }
  meter.entries += count;
  return null;
}
