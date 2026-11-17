import type { CallerRefusal, DataflowAccount } from "../dataflow/contract.js";

export interface Condition {
  readonly alternatives: readonly (readonly number[])[];
}

export interface ConditionLimits {
  readonly eventCount: number;
  readonly maximumConditionAlternatives: number;
  readonly account: DataflowAccount;
  readonly refusal: CallerRefusal;
}
