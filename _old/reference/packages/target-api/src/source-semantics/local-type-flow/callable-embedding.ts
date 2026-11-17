import type { SourceCallableEmbedding, SourceTypeEvidence } from "../../public/source/contracts.js";
import type { SourceProductionResult } from "../../source-model/production.js";
import type { SourceSemanticProduction } from "./production-context.js";
import { sourceEvidenceExtends } from "./evidence-relations.js";

export function produceSourceCallableEmbedding(context: SourceSemanticProduction,
  source: SourceTypeEvidence, destination: SourceTypeEvidence): SourceProductionResult<SourceCallableEmbedding> {
  const { builder } = context;
  builder.assertEvidence(source);
  builder.assertEvidence(destination);
  const pending = (): SourceProductionResult<never> => ({ kind: "pending", dependencies: Object.freeze([source.component, destination.component]) });
  const application = destination.sum;
  if (application === undefined) {
    const proof = sourceEvidenceExtends(context, source, destination);
    if (proof.kind !== "resolved") return proof;
    return proof.value !== "yes" ? pending() : { kind: "resolved", value: Object.freeze({ kind: "direct", source, destination }) };
  }
  const roles: Extract<SourceCallableEmbedding, { readonly kind: "sum" }>[] = [];
  for (const selected of application.roles) {
    const arms: Extract<SourceCallableEmbedding, { readonly kind: "sum" }>["arms"][number][] = [];
    let applicable = true;
    for (const arm of source.sum?.arms ?? [source]) {
      const matching: number[] = [];
      for (const index of selected.armIndexes) {
        const destination = application.arms[index];
        if (destination === undefined) throw new Error("A callable sum embedding retains an actual arm of its exact original role.");
        const proof = sourceEvidenceExtends(context, arm, destination);
        if (proof.kind !== "resolved") return proof;
        if (proof.value === "deferred") return pending();
        if (proof.value === "yes") matching.push(index);
      }
      if (matching.length !== 1) { applicable = false; break; }
      arms.push(Object.freeze({ source: arm, index: matching[0]! }));
    }
    if (applicable) roles.push(Object.freeze({ kind: "sum", source, destination, application, role: selected.role, arms: Object.freeze(arms) }));
  }
  return roles.length !== 1 ? pending() : { kind: "resolved", value: roles[0]! };
}
