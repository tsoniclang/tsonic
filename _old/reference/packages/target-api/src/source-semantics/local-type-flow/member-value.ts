import type { Node } from "@tsonic/tsts";
import type { SourceTypeEvidence } from "../../public/source/contracts.js";
import { sourceOpenLiteralDomain, sourcePresenceLiteralDisposition } from "../../source-model/literals/domain.js";
import type { SourceProductionResult } from "../../source-model/production.js";
import { sourceSemanticRefusal } from "./semantic-production.js";
import type { SourceSemanticProduction } from "./production-context.js";
import type { SourceMemberUse } from "../../source-model/member-use.js";

export function sourceMemberDisposition(builder: SourceSemanticProduction["builder"], receiver: SourceTypeEvidence,
  optionalChain: boolean): SourceMemberUse["disposition"] {
  builder.assertEvidence(receiver);
  if (!optionalChain) return "evaluate";
  const presence = sourcePresenceLiteralDisposition(builder.domain(receiver));
  return presence === "absent" ? "skip" : presence === "present" ? "evaluate" : "dynamic";
}

export function produceSourceStringCharacter(context: Pick<SourceSemanticProduction, "builder" | "input">,
  occurrence: Node, receiver: SourceTypeEvidence): SourceProductionResult<SourceTypeEvidence> {
  const { builder, input } = context;
  builder.assertEvidence(receiver);
  const definition = builder.produceDefinition(receiver);
  if (definition.kind !== "resolved") return definition;
  if (definition.value.type.kind !== "string") throw new Error("A Source string character requires its exact canonical string receiver.");
  return { kind: "resolved", value: builder.evidence({ type: builder.string(), component: builder.componentIdentity(occurrence, []),
    category: { kind: "known", category: "string" }, numeric: undefined, sum: undefined }, [], input.syntax(occurrence),
  sourceOpenLiteralDomain, { members: { kind: "unavailable" }, origins: { kind: "complete", nodes: [occurrence] } }) };
}

export function produceSourceMemberValue(context: Pick<SourceSemanticProduction, "builder" | "input">,
  occurrence: Node, receiver: SourceTypeEvidence, purpose: "read" | "write", arms: readonly SourceTypeEvidence[],
  optionalChain: boolean): SourceProductionResult<SourceTypeEvidence> {
  const { builder, input } = context;
  builder.assertEvidence(receiver);
  const component = builder.componentIdentity(occurrence, []);
  const absence = (): SourceTypeEvidence => builder.evidence({ type: builder.intrinsic("absence"), component,
    category: { kind: "known", category: "absence" }, numeric: undefined, sum: undefined }, [], input.syntax(occurrence),
  { kind: "finite", values: [{ kind: "absence" }] },
  { members: { kind: "unavailable" }, origins: { kind: "complete", nodes: [occurrence] } });
  const presence = sourcePresenceLiteralDisposition(builder.domain(receiver));
  if (purpose === "read" && optionalChain && presence === "absent") return { kind: "resolved", value: absence() };
  if (arms.length === 0) {
    const candidates = receiver.sum?.arms ?? [receiver];
    let dynamic = false;
    for (const arm of candidates) {
      const definition = builder.produceDefinition(arm);
      if (definition.kind !== "resolved") return definition;
      dynamic ||= definition.value.type.kind === "intrinsic" && definition.value.type.intrinsic === "any";
    }
    if (!dynamic) return sourceSemanticRefusal(occurrence,
      "A concrete Source member use requires its canonical readable or writable arm evidence.");
    return { kind: "resolved", value: builder.evidence({ type: builder.intrinsic("any"), component,
      category: { kind: "dynamic" }, numeric: undefined, sum: undefined }, [], input.syntax(occurrence), sourceOpenLiteralDomain,
    { members: { kind: "unavailable" }, origins: { kind: "complete", nodes: [occurrence] } }) };
  }
  const values = [...arms];
  if (purpose === "read" && optionalChain && presence !== "present") values.push(absence());
  return builder.join(component, "inferred", values, input.syntax(occurrence));
}
