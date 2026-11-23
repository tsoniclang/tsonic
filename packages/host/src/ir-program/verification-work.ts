import type { CreateProgramVerificationWork, CreateTirReadyReadAdmission, ProgramIndex, ProgramVerificationContext, ProgramVerificationWork } from "./contract.js";
import type { ProgramVerificationStop } from "./work-data.js";
import { accountFailure, chargeResultEntries, chargeWork } from "../dataflow/index.js";
import { admitArtifactIdentity, admitBindingIdentity } from "../ir-facts/index.js";
import type { TypeInterner, TypeTable, TypeTableAdmissionWork, TypeRule, TypeTableAdmissionSite } from "../ir-types/contract.js";
import type { Violation, MessageArgument } from "../diag/contract.js";
import { admitTypeTable, printTypes, viewTypes } from "../ir-types/index.js";
import { ProgramWork, requireInstantiationMaximum } from "./work.js";
import type { InstantiationAllocationStop, InstantiationMeter, VerificationSeed } from "./work.js";
import type { ProgramLookup } from "./work.js";
import type { ProgramViolation } from "./work-data.js";
import { numberDetail, programLookup, textDetail } from "./program-values.js";

export const createProgramVerificationWork: CreateProgramVerificationWork = (limits, account) => ProgramWork.create(limits, account);

export const tirReadyReadAdmission: CreateTirReadyReadAdmission = account => request => {
  switch (request.kind) {
    case "prior": return accountFailure(account);
    case "row": return chargeWork(account, 1);
    case "retain-publication-entry": return chargeResultEntries(account, 1);
    case "artifact":
      return chargeWork(account, request.instance.body.length) ?? admitArtifactIdentity(request.instance.bindings, account);
    case "bindings": return admitBindingIdentity(request.bindings, account);
    case "static-item": return chargeWork(account, 2 + request.declaration.owner.length);
    case "member": {
      const fixed = chargeWork(account, 2 + request.instance.body.length) ?? admitArtifactIdentity(request.instance.bindings, account);
      if (fixed !== null || request.occurrence.kind === "selection") return fixed;
      return chargeWork(account, 1 + request.occurrence.source.body.length);
    }
    case "module-scope": return chargeWork(account, 1 + request.module.length);
  }
};

export function matchesProgramTypeTable(published: TypeTable, facts: TypeTable, typed: TypeTable = facts): boolean {
  if (published === facts && published === typed) return true;
  const expected = printTypes(published);
  if (published !== facts && expected !== printTypes(facts)) return false;
  return typed === published || typed === facts || expected === printTypes(typed);
}

export function lookupForModuleVerification(supplied: ProgramIndex, adopted: ProgramIndex, work: ProgramVerificationWork): ProgramLookup {
  const verified = ProgramWork.state(work).verifiedIndex;
  return verified?.index === supplied ? verified.lookup : programLookup(adopted);
}

function acceptsTable(seed: VerificationSeed, index: ProgramIndex): boolean {
  if (seed.kind === "unseeded") return true;
  const table = index.types;
  return seed.table === table
    || (seed.kind === "seeded" || seed.kind === "refused") && seed.adopted === table;
}

function verificationSeed(index: ProgramIndex, work: ProgramVerificationWork): VerificationSeed {
  const state = ProgramWork.state(work);
  if (!acceptsTable(state.seed, index))
    throw new TypeError("Program verification seed belongs to another published type table");
  if (state.seed.kind === "refused" || state.seed.kind === "invalid") return state.seed;
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

export function programTypeWork(meter: InstantiationMeter): TypeTableAdmissionWork<InstantiationAllocationStop> {
  return {
    work: count => meter.failure ?? chargeWork(meter.account, count),
    retain: count => {
      const prior = meter.failure ?? accountFailure(meter.account);
      if (prior !== null) return prior;
      if (count > meter.limits.maximumCreatedRecords - meter.created) {
        meter.failure = { kind: "resource-limit", dimension: "created-records", maximum: meter.limits.maximumCreatedRecords };
        return meter.failure;
      }
      meter.created += count;
      return null;
    },
  };
}

export function foreignTypeDetail(row: Violation<TypeRule, TypeTableAdmissionSite>): readonly MessageArgument[] {
  const prefix = [textDetail(row.rule), textDetail(row.site.kind)];
  switch (row.site.kind) {
    case "table": return [...prefix, ...row.detail];
    case "signature": return [...prefix, numberDetail(row.site.signature), ...row.detail];
    case "type": return [...prefix, numberDetail(row.site.type), ...row.detail];
    default: throw new TypeError("An admitted table violation must identify its table field or a type or signature row.");
  }
}

export function verificationTypes(index: ProgramIndex, work: ProgramVerificationWork):
  { readonly kind: "complete"; readonly types: TypeInterner; readonly index: ProgramIndex }
  | { readonly kind: "invalid"; readonly violations: readonly ProgramViolation[] }
  | ProgramVerificationStop {
  const seed = verificationSeed(index, work);
  if (seed.kind === "refused") return seed.stop;
  if (seed.kind === "invalid") return seed;
  const limits = ProgramWork.state(work).limits;
  requireInstantiationMaximum(limits.maximumCreatedRecords, "maximumCreatedRecords");
  requireInstantiationMaximum(limits.maximumBindingVectorsPerArtifact, "maximumBindingVectorsPerArtifact");
  requireInstantiationMaximum(limits.typeExpansion.maximumDepth, "maximumDepth");
  requireInstantiationMaximum(limits.typeExpansion.maximumVisits, "maximumVisits");
  requireInstantiationMaximum(limits.typeExpansion.maximumUnionMembers, "maximumUnionMembers");
  requireInstantiationMaximum(limits.typeExpansion.maximumIntersectionMembers, "maximumIntersectionMembers");
  const table = index.types;
  if (seed.kind === "seeded") return { kind: "complete", types: seed.types,
    index: table === seed.adopted ? index : { ...index, types: seed.adopted } };
  const admitted = admitTypeTable(table, programTypeWork(ProgramWork.state(work)));
  if (admitted.kind === "invalid") {
    const violations: ProgramViolation[] = admitted.violations.map(row => ({
      rule: "types-valid", site: { kind: "index" }, detail: foreignTypeDetail(row),
    }));
    ProgramWork.state(work).seed = { kind: "invalid", table, violations };
    return { kind: "invalid", violations };
  }
  if (admitted.kind !== "complete") {
    return refuseVerification(index, work,
      admitted.kind === "resource-limit" && admitted.dimension === "created-records"
        ? { ...admitted, site: { kind: "index" } } : admitted);
  }
  const types = admitted.types;
  const adopted = viewTypes(types);
  ProgramWork.state(work).seed = { kind: "seeded", table, types, adopted };
  return { kind: "complete", types, index: { ...index, types: adopted } };
}

export function verificationContext(context: ProgramVerificationContext, source: TypeTable, table: TypeTable): ProgramVerificationContext {
  if (source === table) return context;
  return { ...context, facts: context.facts.types === source ? { ...context.facts, types: table } : context.facts,
    tirOf: module => {
      const ready = context.tirOf(module);
      return ready !== null && ready.types === source ? { ...ready, types: table } : ready;
    } };
}

export function refuseVerification(index: ProgramIndex, work: ProgramVerificationWork,
  stop: ProgramVerificationStop): ProgramVerificationStop {
  const state = ProgramWork.state(work);
  const seed = state.seed;
  if (!acceptsTable(seed, index)) throw new TypeError("Program verification refusal belongs to another published type table");
  if (seed.kind === "refused") return seed.stop;
  state.seed = { kind: "refused", table: seed.kind === "unseeded" ? index.types : seed.table,
    adopted: seed.kind === "seeded" ? seed.adopted : null, stop };
  state.verifiedIndex = null;
  return stop;
}
