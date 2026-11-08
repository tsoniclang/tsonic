import type { SourcePrimitiveKind } from "@tsonic/tsts";
import type { SourcePresence, SourceTypeEvidence } from "../../public/source/contracts.js";
import type { SourceProductionResult } from "../../source-model/production.js";
import type { SourceDescriptorBuilder } from "../descriptor-contracts.js";
import type { SourceLiteralValue } from "../../source-model/literals/value.js";
import { sourceLiteralDomainIncludes } from "../../source-model/literals/domain.js";
import { sourceLiteralValueDomain } from "../../source-model/literals/value-domain.js";
import { sourcePrimitiveOperatorLiteralFits } from "./operator-decisions.js";

const priorities: Readonly<Record<SourcePrimitiveKind, number>> = Object.freeze({
  bool: 0, char: 1, int64: 2, int8: 3, uint8: 4, int16: 5, uint16: 6, int32: 7, uint32: 8, uint64: 9,
  int128: 10, uint128: 11, "native-int": 12, "native-uint": 13, decimal: 14, float16: 15, float32: 16, float64: 17,
});

export function sourceScalarCreationDestination(builder: SourceDescriptorBuilder, destination: SourceTypeEvidence,
  literal: SourceLiteralValue, category: "number" | "bigint"): SourceProductionResult<SourcePresence<SourceTypeEvidence>> {
  const pending = [destination];
  const seen = new Set<SourceTypeEvidence>();
  const candidates: SourceTypeEvidence[] = [];
  const fixed = new Map<SourcePrimitiveKind, SourceTypeEvidence>();
  while (pending.length > 0) {
    const selected = pending.pop()!;
    if (seen.has(selected)) continue;
    seen.add(selected);
    if (selected.sum !== undefined) { pending.push(...selected.sum.arms); continue; }
    if (selected.type.kind === "optional") {
      const payload = builder.component(selected, { kind: "optional-value" });
      if (payload.kind === "refused") return payload;
      pending.push(payload.value);
      continue;
    }
    const definition = builder.produceDefinition(selected);
    if (definition.kind !== "resolved") return definition;
    const value = definition.value;
    if (value !== selected) { pending.push(value); continue; }
    if (value.type.kind !== "primitive" || value.type.primitive === "bool" || value.type.primitive === "char" ||
      value.category.kind !== "known" || value.category.category !== category) continue;
    fixed.set(value.type.primitive, value);
    const domain = sourceLiteralValueDomain(literal, category, "present");
    if (domain.kind === "finite" && !domain.values.every(unit => sourceLiteralDomainIncludes(builder.domain(value), unit))) continue;
    if (sourcePrimitiveOperatorLiteralFits(literal, value.type.primitive)) candidates.push(value);
  }
  candidates.sort((left, right) => {
    if (left.type.kind !== "primitive" || right.type.kind !== "primitive") throw new Error("A Source numeric creation candidate must retain its primitive descriptor.");
    return priorities[left.type.primitive] - priorities[right.type.primitive];
  });
  const selected = candidates[0] ?? (fixed.size === 1 ? fixed.values().next().value : undefined);
  return { kind: "resolved", value: selected === undefined ? { kind: "none" } : { kind: "present", value: selected } };
}
