import type { Node } from "@tsonic/tsts";
import type { SourceConstructionDestination, SourcePresence, SourceTypeEvidence, SourceUseDestination } from "../../public/source/contracts.js";
import type { SourceProductionResult } from "../../source-model/production.js";
import { sourceEvidenceExtends, type SourceEvidenceRelation } from "./evidence-relations.js";
import { createSourceTypeFlowRefusal } from "./refusals.js";
import type { SourceSemanticProduction } from "./semantic-production.js";

export function produceSourceConstructionDestination(context: SourceSemanticProduction, occurrence: Node,
  value: SourceTypeEvidence, expected: SourcePresence<SourceUseDestination>): SourceProductionResult<SourcePresence<SourceConstructionDestination>> {
  const { builder } = context;
  builder.assertEvidence(value);
  if (expected.kind === "none") return { kind: "resolved", value: { kind: "none" } };
  const destination = expected.value;
  builder.assertDestination(destination);
  const application = destination.applied.sum;
  if (application === undefined) return { kind: "resolved", value: { kind: "present", value: { kind: "direct", destination } } };
  if (application.kind !== "closed") return { kind: "pending", dependencies: [destination.applied.component] };
  const fits = new Map<SourceTypeEvidence, SourceProductionResult<SourceEvidenceRelation>>();
  const candidates: Extract<SourceConstructionDestination, { readonly kind: "sum" }>[] = [];
  const pending = new Set<Extract<SourceProductionResult<never>, { readonly kind: "pending" }>["dependencies"][number]>();
  for (const selected of application.roles) {
    if (!application.family.roles.includes(selected.role)) throw new Error("A construction sum role must belong to its exact original Source family.");
    for (const index of selected.armIndexes) {
      const arm = application.arms[index];
      if (arm === undefined) throw new Error("A construction sum role requires its actual registered arm index.");
      let relation = fits.get(arm);
      if (relation === undefined) {
        relation = sourceEvidenceExtends(context, value, arm);
        fits.set(arm, relation);
      }
      if (relation.kind === "refused") return relation;
      if (relation.kind === "pending") {
        for (const dependency of relation.dependencies) pending.add(dependency);
      } else if (relation.value === "deferred") {
        pending.add(value.component);
        pending.add(arm.component);
      } else if (relation.value === "yes") candidates.push({ kind: "sum", destination, application, role: selected.role, arm });
    }
  }
  if (pending.size > 0) return { kind: "pending", dependencies: [...pending] };
  return candidates.length === 1 ? { kind: "resolved", value: { kind: "present", value: Object.freeze(candidates[0]!) } }
    : createSourceTypeFlowRefusal("TSONIC_LOCAL_TYPE_UNION", occurrence);
}
