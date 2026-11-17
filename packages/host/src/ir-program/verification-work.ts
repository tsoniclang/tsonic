import type { CreateProgramVerificationWork, ProgramIndex, ProgramVerificationWork } from "./contract.js";
import type { ProgramVerificationStop } from "./work-data.js";
import { accountFailure } from "../dataflow/index.js";
import type { TypeInterner } from "../ir-types/contract.js";
import { seedTypeInterner } from "../ir-types/index.js";
import { ProgramWork, requireInstantiationMaximum } from "./work.js";
import type { VerificationSeed } from "./work.js";
import { admitTypeSeed } from "./instantiate-types.js";

export const createProgramVerificationWork: CreateProgramVerificationWork = (limits, account) => ProgramWork.create(limits, account);

function verificationSeed(index: ProgramIndex, work: ProgramVerificationWork): VerificationSeed {
  const state = ProgramWork.state(work);
  if (state.seed.kind !== "unseeded" && state.seed.table !== index.types)
    throw new TypeError("Program verification seed belongs to another published type table");
  if (state.seed.kind === "refused") return state.seed;
  const stop = state.failure ?? accountFailure(state.account);
  if (stop !== null) {
    refuseVerification(index, work,
      stop.kind === "resource-limit" && stop.dimension === "created-records" ? { ...stop, site: { kind: "index" } } : stop);
    return state.seed;
  }
  return state.seed;
}

export function verificationFailure(index: ProgramIndex, work: ProgramVerificationWork): ProgramVerificationStop | null {
  const seed = verificationSeed(index, work);
  return seed.kind === "refused" ? seed.stop : null;
}

export function verificationTypes(index: ProgramIndex, work: ProgramVerificationWork):
  { readonly kind: "complete"; readonly types: TypeInterner }
  | ProgramVerificationStop {
  const seed = verificationSeed(index, work);
  if (seed.kind === "refused") return seed.stop;
  const limits = ProgramWork.state(work).limits;
  requireInstantiationMaximum(limits.maximumCreatedRecords, "maximumCreatedRecords");
  requireInstantiationMaximum(limits.maximumBindingVectorsPerArtifact, "maximumBindingVectorsPerArtifact");
  requireInstantiationMaximum(limits.typeExpansion.maximumDepth, "maximumDepth");
  requireInstantiationMaximum(limits.typeExpansion.maximumVisits, "maximumVisits");
  requireInstantiationMaximum(limits.typeExpansion.maximumUnionMembers, "maximumUnionMembers");
  requireInstantiationMaximum(limits.typeExpansion.maximumIntersectionMembers, "maximumIntersectionMembers");
  if (seed.kind === "seeded") return { kind: "complete", types: seed.types };
  const stop = admitTypeSeed(ProgramWork.state(work), index.types);
  if (stop !== null) {
    return refuseVerification(index, work,
      stop.kind === "resource-limit" && stop.dimension === "created-records" ? { ...stop, site: { kind: "index" } } : stop);
  }
  const types = seedTypeInterner(index.types);
  ProgramWork.state(work).seed = { kind: "seeded", table: index.types, types };
  return { kind: "complete", types };
}

export function refuseVerification(index: ProgramIndex, work: ProgramVerificationWork,
  stop: ProgramVerificationStop): ProgramVerificationStop {
  const seed = ProgramWork.state(work).seed;
  if (seed.kind === "refused") {
    if (seed.table !== index.types) throw new TypeError("Program verification refusal belongs to another published type table");
    return seed.stop;
  }
  ProgramWork.state(work).seed = { kind: "refused", table: index.types, stop };
  return stop;
}
