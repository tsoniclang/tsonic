import type { CreateProgramVerificationWork, ModuleBodiesVerification, ProgramIndex, ProgramVerificationWork } from "./contract.js";
import type { TypeInterner } from "../ir-types/contract.js";
import { seedTypeInterner } from "../ir-types/index.js";
import { ProgramWork, requireInstantiationMaximum } from "./work.js";
import { admitTypeSeed } from "./instantiate-types.js";

export const createProgramVerificationWork: CreateProgramVerificationWork = limits => ProgramWork.create(limits);

export function verificationTypes(index: ProgramIndex, work: ProgramVerificationWork):
  { readonly kind: "complete"; readonly types: TypeInterner }
  | (ModuleBodiesVerification & { readonly kind: "resource-limit" }) {
  const seed = ProgramWork.state(work).seed;
  if (seed.kind !== "unseeded") {
    if (seed.table !== index.types) throw new TypeError("Program verification seed belongs to another published type table");
    if (seed.kind === "refused") return seed.stop;
  }
  const limits = ProgramWork.state(work).limits;
  requireInstantiationMaximum(limits.maximumWork, "maximumWork");
  requireInstantiationMaximum(limits.maximumCreatedRecords, "maximumCreatedRecords");
  requireInstantiationMaximum(limits.maximumBindingVectorsPerArtifact, "maximumBindingVectorsPerArtifact");
  requireInstantiationMaximum(limits.typeExpansion.maximumDepth, "maximumDepth");
  requireInstantiationMaximum(limits.typeExpansion.maximumVisits, "maximumVisits");
  requireInstantiationMaximum(limits.typeExpansion.maximumUnionMembers, "maximumUnionMembers");
  requireInstantiationMaximum(limits.typeExpansion.maximumIntersectionMembers, "maximumIntersectionMembers");
  if (seed.kind === "seeded") return { kind: "complete", types: seed.types };
  const stop = admitTypeSeed(ProgramWork.state(work), index.types);
  if (stop !== null) {
    return refuseVerification(index, work, { kind: "resource-limit", site: { kind: "index" },
      dimension: stop.dimension, maximum: stop.maximum });
  }
  const types = seedTypeInterner(index.types);
  ProgramWork.state(work).seed = { kind: "seeded", table: index.types, types };
  return { kind: "complete", types };
}

export function refuseVerification(index: ProgramIndex, work: ProgramVerificationWork,
  stop: ModuleBodiesVerification & { readonly kind: "resource-limit" }): ModuleBodiesVerification & { readonly kind: "resource-limit" } {
  const seed = ProgramWork.state(work).seed;
  if (seed.kind === "refused") {
    if (seed.table !== index.types) throw new TypeError("Program verification refusal belongs to another published type table");
    return seed.stop;
  }
  ProgramWork.state(work).seed = { kind: "refused", table: index.types, stop };
  return stop;
}
