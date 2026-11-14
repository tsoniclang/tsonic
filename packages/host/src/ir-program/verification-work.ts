import type { ModuleBodiesVerification, ProgramIndex, ProgramVerificationWork } from "./contract.js";
import type { TypeInterner } from "../ir-types/contract.js";
import { seedTypeInterner } from "../ir-types/index.js";
import { requireInstantiationMaximum } from "./program-values.js";
import { admitTypeSeed } from "./instantiate-types.js";

export function verificationTypes(index: ProgramIndex, work: ProgramVerificationWork):
  { readonly kind: "complete"; readonly types: TypeInterner }
  | (ModuleBodiesVerification & { readonly kind: "resource-limit" }) {
  requireInstantiationMaximum(work.limits.maximumWork, "maximumWork");
  requireInstantiationMaximum(work.limits.maximumCreatedRecords, "maximumCreatedRecords");
  requireInstantiationMaximum(work.limits.maximumBindingVectorsPerArtifact, "maximumBindingVectorsPerArtifact");
  requireInstantiationMaximum(work.limits.typeExpansion.maximumDepth, "maximumDepth");
  requireInstantiationMaximum(work.limits.typeExpansion.maximumVisits, "maximumVisits");
  requireInstantiationMaximum(work.limits.typeExpansion.maximumUnionMembers, "maximumUnionMembers");
  requireInstantiationMaximum(work.limits.typeExpansion.maximumIntersectionMembers, "maximumIntersectionMembers");
  if (!Number.isSafeInteger(work.work) || work.work < 0 || Object.is(work.work, -0) || work.work > work.limits.maximumWork
    || !Number.isSafeInteger(work.created) || work.created < 0 || Object.is(work.created, -0) || work.created > work.limits.maximumCreatedRecords) {
    throw new TypeError("Invalid Program verification resource counters");
  }
  if (work.seed.kind !== "unseeded") {
    if (work.seed.table !== index.types) throw new TypeError("Program verification seed belongs to another published type table");
    if (work.seed.kind === "refused") return work.seed.stop;
    return { kind: "complete", types: work.seed.types };
  }
  const stop = admitTypeSeed(work, index.types);
  if (stop !== null) {
    return refuseVerification(index, work, { kind: "resource-limit", site: { kind: "index" },
      dimension: stop.dimension, maximum: stop.maximum });
  }
  const types = seedTypeInterner(index.types);
  work.seed = { kind: "seeded", table: index.types, types };
  return { kind: "complete", types };
}

export function refuseVerification(index: ProgramIndex, work: ProgramVerificationWork,
  stop: ModuleBodiesVerification & { readonly kind: "resource-limit" }): ModuleBodiesVerification & { readonly kind: "resource-limit" } {
  if (work.seed.kind === "refused") {
    if (work.seed.table !== index.types) throw new TypeError("Program verification refusal belongs to another published type table");
    return work.seed.stop;
  }
  work.seed = { kind: "refused", table: index.types, stop };
  return stop;
}
