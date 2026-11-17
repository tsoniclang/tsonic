import type { TypeInterner, TypeTable } from "../ir-types/contract.js";
import type { DataflowAccount, DataflowStop } from "../dataflow/contract.js";
import { accountFailure, chargeWork, createAccount } from "../dataflow/index.js";
import type { InstantiationLimits, ProgramVerificationLimits, ProgramVerificationStop } from "./work-data.js";

export interface InstantiationMeter {
  readonly limits: ProgramVerificationLimits;
  readonly account: DataflowAccount;
  created: number;
  failure: InstantiationAllocationStop | null;
}

export type InstantiationStop = DataflowStop | {
  readonly kind: "resource-limit";
  readonly dimension: "work" | "created-records" | "binding-vectors";
  readonly maximum: number;
};

export type InstantiationAllocationStop = DataflowStop
  | { readonly kind: "resource-limit"; readonly dimension: "created-records"; readonly maximum: number };

export type VerificationSeed = { readonly kind: "unseeded" }
  | { readonly kind: "seeded"; readonly table: TypeTable; readonly types: TypeInterner }
  | { readonly kind: "refused"; readonly table: TypeTable; readonly stop: ProgramVerificationStop };

interface VerificationState extends InstantiationMeter {
  seed: VerificationSeed;
}

export class ProgramWork {
  private readonly value: VerificationState;

  private constructor(limits: ProgramVerificationLimits, account: DataflowAccount) {
    this.value = { limits, account, created: 0, failure: null, seed: { kind: "unseeded" } };
  }

  static create(limits: ProgramVerificationLimits, account: DataflowAccount): ProgramWork {
    requireInstantiationMaximum(limits.maximumCreatedRecords, "maximumCreatedRecords");
    requireInstantiationMaximum(limits.maximumBindingVectorsPerArtifact, "maximumBindingVectorsPerArtifact");
    requireInstantiationMaximum(limits.typeExpansion.maximumDepth, "maximumDepth");
    requireInstantiationMaximum(limits.typeExpansion.maximumVisits, "maximumVisits");
    requireInstantiationMaximum(limits.typeExpansion.maximumUnionMembers, "maximumUnionMembers");
    requireInstantiationMaximum(limits.typeExpansion.maximumIntersectionMembers, "maximumIntersectionMembers");
    return new ProgramWork(limits, account);
  }

  static state(work: ProgramWork): VerificationState { return work.value; }
}

export function createInstantiationMeter(limits: InstantiationLimits): InstantiationMeter {
  requireInstantiationMaximum(limits.maximumWork, "maximumWork");
  requireInstantiationMaximum(limits.maximumCreatedRecords, "maximumCreatedRecords");
  requireInstantiationMaximum(limits.maximumBindingVectorsPerArtifact, "maximumBindingVectorsPerArtifact");
  return { limits, account: createAccount({ maximumWork: limits.maximumWork, maximumResultEntries: 0 }), created: 0, failure: null };
}

export function chargeInstantiationWork(meter: InstantiationMeter): InstantiationAllocationStop | null {
  return meter.failure ?? chargeWork(meter.account, 1);
}

export function emitInstantiationRecord(meter: InstantiationMeter): InstantiationAllocationStop | null {
  const stop = meter.failure ?? accountFailure(meter.account) ?? chargeInstantiationWork(meter);
  if (stop !== null) return stop;
  if (meter.created >= meter.limits.maximumCreatedRecords) {
    meter.failure = { kind: "resource-limit", dimension: "created-records", maximum: meter.limits.maximumCreatedRecords };
    return meter.failure;
  }
  meter.created += 1;
  return null;
}

export function requireInstantiationMaximum(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) {
    throw new TypeError(`Invalid InstantiationLimits.${name}`);
  }
}
