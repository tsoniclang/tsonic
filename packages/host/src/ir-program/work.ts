import type { TypeInterner, TypeTable } from "../ir-types/contract.js";
import type { InstantiationLimits, ProgramVerificationStop } from "./work-data.js";

export interface InstantiationMeter {
  readonly limits: InstantiationLimits;
  work: number;
  created: number;
}

export type InstantiationStop = {
  readonly kind: "resource-limit";
  readonly dimension: "work" | "created-records" | "binding-vectors";
  readonly maximum: number;
};

export type InstantiationAllocationStop = InstantiationStop & { readonly dimension: "work" | "created-records" };

type VerificationSeed = { readonly kind: "unseeded" }
  | { readonly kind: "seeded"; readonly table: TypeTable; readonly types: TypeInterner }
  | { readonly kind: "refused"; readonly table: TypeTable; readonly stop: ProgramVerificationStop };

interface VerificationState extends InstantiationMeter {
  seed: VerificationSeed;
}

export class ProgramWork {
  private readonly value: VerificationState;

  private constructor(limits: InstantiationLimits) {
    this.value = { limits, work: 0, created: 0, seed: { kind: "unseeded" } };
  }

  static create(limits: InstantiationLimits): ProgramWork {
    requireInstantiationMaximum(limits.maximumWork, "maximumWork");
    requireInstantiationMaximum(limits.maximumCreatedRecords, "maximumCreatedRecords");
    requireInstantiationMaximum(limits.maximumBindingVectorsPerArtifact, "maximumBindingVectorsPerArtifact");
    requireInstantiationMaximum(limits.typeExpansion.maximumDepth, "maximumDepth");
    requireInstantiationMaximum(limits.typeExpansion.maximumVisits, "maximumVisits");
    requireInstantiationMaximum(limits.typeExpansion.maximumUnionMembers, "maximumUnionMembers");
    requireInstantiationMaximum(limits.typeExpansion.maximumIntersectionMembers, "maximumIntersectionMembers");
    return new ProgramWork(limits);
  }

  static state(work: ProgramWork): VerificationState { return work.value; }
}

export function createInstantiationMeter(limits: InstantiationLimits): InstantiationMeter {
  requireInstantiationMaximum(limits.maximumWork, "maximumWork");
  requireInstantiationMaximum(limits.maximumCreatedRecords, "maximumCreatedRecords");
  requireInstantiationMaximum(limits.maximumBindingVectorsPerArtifact, "maximumBindingVectorsPerArtifact");
  return { limits, work: 0, created: 0 };
}

export function chargeInstantiationWork(meter: InstantiationMeter): InstantiationAllocationStop | null {
  if (meter.work >= meter.limits.maximumWork) {
    return { kind: "resource-limit", dimension: "work", maximum: meter.limits.maximumWork };
  }
  meter.work += 1;
  return null;
}

export function emitInstantiationRecord(meter: InstantiationMeter): InstantiationAllocationStop | null {
  const stop = chargeInstantiationWork(meter);
  if (stop !== null) return stop;
  if (meter.created >= meter.limits.maximumCreatedRecords) {
    return { kind: "resource-limit", dimension: "created-records", maximum: meter.limits.maximumCreatedRecords };
  }
  meter.created += 1;
  return null;
}

export function requireInstantiationMaximum(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`Invalid InstantiationLimits.${name}`);
  }
}
