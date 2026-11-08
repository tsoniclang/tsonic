import type { SourceTypeEvidence } from "../../public/source/contracts.js";
import type { SourceDescriptorBuilder, SourceProductionResult } from "../descriptor-contracts.js";
import { sourceLiteralUnitKey } from "../../source-model/literals/key.js";

export function sourceKeyDomainContains(builder: SourceDescriptorBuilder, destination: SourceTypeEvidence,
  source: SourceTypeEvidence): SourceProductionResult<"yes" | "no" | "deferred"> {
  builder.assertEvidence(destination);
  builder.assertEvidence(source);
  if (builder.freeParameters(destination).length > 0 || builder.freeParameters(source).length > 0) return { kind: "resolved", value: "deferred" };
  const combine = (values: readonly SourceProductionResult<"yes" | "no" | "deferred">[], every: boolean):
    SourceProductionResult<"yes" | "no" | "deferred"> => {
    let deferred = false;
    const dependencies = new Set<SourceTypeEvidence["component"]>();
    for (const value of values) {
      if (value.kind === "refused") return value;
      if (value.kind === "pending") { value.dependencies.forEach(dependency => dependencies.add(dependency)); continue; }
      if (value.value === (every ? "no" : "yes")) return value;
      deferred ||= value.value === "deferred";
    }
    return dependencies.size > 0 ? { kind: "pending", dependencies: [...dependencies] }
      : { kind: "resolved", value: deferred ? "deferred" : every ? "yes" : "no" };
  };
  if (destination.sum !== undefined) return combine(destination.sum.arms.map(arm => sourceKeyDomainContains(builder, arm, source)), true);
  if (source.sum !== undefined) return combine(source.sum.arms.map(arm => sourceKeyDomainContains(builder, destination, arm)), false);
  const selected = builder.domain(destination), admitted = builder.domain(source);
  if (selected.kind === "unreachable") return { kind: "resolved", value: "yes" };
  if (selected.kind === "finite") {
    const category = source.category;
    if (admitted.kind === "open" && category.kind !== "known") return { kind: "resolved", value: "deferred" };
    const contained = selected.values.every(value => {
      const required = sourceLiteralUnitKey(value);
      if (required === undefined) return false;
      if (admitted.kind === "open") return category.kind === "known" && (category.category === value.kind ||
        value.kind === "number" && category.category === "string");
      return admitted.kind === "finite" && admitted.values.some(value => {
        const offered = sourceLiteralUnitKey(value);
        return required.kind === "name" ? offered?.kind === "name" && offered.name === required.name
          : offered?.kind === "symbol" && offered.declaration === required.declaration;
      });
    });
    return { kind: "resolved", value: contained ? "yes" : "no" };
  }
  if (admitted.kind !== "open") return { kind: "resolved", value: "no" };
  const from = destination.category, to = source.category;
  if (from.kind !== "known" || to.kind !== "known") return { kind: "resolved", value: "deferred" };
  return { kind: "resolved", value: from.category === to.category || from.category === "number" && to.category === "string" ? "yes" : "no" };
}
