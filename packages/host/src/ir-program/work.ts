import type { TypeInterner, TypeTable } from "../ir-types/contract.js";
import type { DataflowAccount, DataflowStop } from "../dataflow/contract.js";
import type { DefId, ModuleId, PackageId } from "../ids/contract.js";
import type { Execution } from "../ir-types/contract.js";
import type { MetadataRecord, Summary } from "../ir-facts/contract.js";
import { accountFailure, chargeWork, createAccount } from "../dataflow/index.js";
import type { BodyRecord, ConstantRecord, DefinitionNode, ModuleRecord, PackageRecord, ProgramIndex } from "./data.js";
import type { InstantiationLimits, ProgramVerificationLimits, ProgramVerificationStop, ProgramViolation } from "./work-data.js";

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
  | { readonly kind: "seeded"; readonly table: TypeTable; readonly adopted: TypeTable; readonly types: TypeInterner }
  | { readonly kind: "invalid"; readonly table: TypeTable; readonly violations: readonly ProgramViolation[] }
  | { readonly kind: "refused"; readonly table: TypeTable; readonly adopted: TypeTable | null; readonly stop: ProgramVerificationStop };

export interface DefinitionLocation {
  readonly module: ModuleId;
  readonly entry: DefinitionNode;
}

export interface ProgramLookup {
  readonly packages: ReadonlyMap<PackageId, PackageRecord | null>;
  readonly modules: ReadonlyMap<ModuleId, ModuleRecord | null>;
  readonly definitions: ReadonlyMap<DefId, DefinitionLocation | null>;
  readonly bodiesByModule: ReadonlyMap<ModuleId, readonly BodyRecord[]>;
  readonly instances: ReadonlyMap<string, BodyRecord | null>;
  readonly executions: ReadonlyMap<string, Execution | null>;
  readonly executionsByInstance: ReadonlyMap<string, readonly Execution[]>;
  readonly metadata: ReadonlyMap<string, MetadataRecord | null>;
  readonly summaries: ReadonlyMap<string, Summary | null>;
  readonly constants: ReadonlyMap<string, ConstantRecord | null>;
}

interface VerificationState extends InstantiationMeter {
  seed: VerificationSeed;
  verifiedIndex: { readonly index: ProgramIndex; readonly lookup: ProgramLookup } | null;
}

export class ProgramWork {
  private readonly value: VerificationState;

  private constructor(limits: ProgramVerificationLimits, account: DataflowAccount) {
    this.value = { limits, account, created: 0, failure: null, seed: { kind: "unseeded" }, verifiedIndex: null };
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
  return stop ?? reserveInstantiationRecord(meter);
}

export function reserveInstantiationRecord(meter: InstantiationMeter): InstantiationAllocationStop | null {
  const stop = meter.failure ?? accountFailure(meter.account);
  if (stop !== null) return stop;
  if (meter.created >= meter.limits.maximumCreatedRecords) {
    meter.failure = { kind: "resource-limit", dimension: "created-records", maximum: meter.limits.maximumCreatedRecords };
    return meter.failure;
  }
  meter.created += 1;
  return null;
}

function admitProjection(meter: InstantiationMeter, work: number, records: number): InstantiationAllocationStop | null {
  const previous = meter.failure ?? accountFailure(meter.account) ?? chargeWork(meter.account, work);
  if (previous !== null) return previous;
  for (let position = 0; position < records; position += 1) {
    const stop = reserveInstantiationRecord(meter);
    if (stop !== null) return stop;
  }
  return null;
}

export function admitCheckedProjection(meter: InstantiationMeter, work: number, records: number): InstantiationAllocationStop | null {
  return admitProjection(meter, work, records);
}

export function admitProgramReadyRow(resources: ProgramWork, work: number, records: number): InstantiationAllocationStop | null {
  return admitProjection(ProgramWork.state(resources), work, records);
}

export function requireInstantiationMaximum(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) {
    throw new TypeError(`Invalid InstantiationLimits.${name}`);
  }
}
