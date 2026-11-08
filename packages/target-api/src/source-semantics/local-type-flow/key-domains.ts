import type { SourceTypeEvidence } from "../../public/source/contracts.js";
import type { SourceDescriptorBuilder, SourceProductionResult } from "../descriptor-contracts.js";
import { sourceLiteralDomainIncludes } from "../../source-model/literals/domain.js";

export function sourceKeyDomainContains(builder: SourceDescriptorBuilder, destination: SourceTypeEvidence,
  source: SourceTypeEvidence): SourceProductionResult<"yes" | "no" | "deferred"> {
  builder.assertEvidence(destination);
  builder.assertEvidence(source);
  if (builder.freeParameters(destination).length > 0 || builder.freeParameters(source).length > 0) return { kind: "resolved", value: "deferred" };
  const selected = builder.domain(destination), admitted = builder.domain(source);
  if (selected.kind === "unreachable") return { kind: "resolved", value: "yes" };
  if (selected.kind === "finite") return { kind: "resolved", value: selected.values.every(value => sourceLiteralDomainIncludes(admitted, value)) ? "yes" : "no" };
  if (admitted.kind !== "open") return { kind: "resolved", value: "no" };
  const from = destination.category, to = source.category;
  if (from.kind !== "known" || to.kind !== "known") return { kind: "resolved", value: "deferred" };
  return { kind: "resolved", value: from.category === to.category || from.category === "number" && to.category === "string" ? "yes" : "no" };
}
