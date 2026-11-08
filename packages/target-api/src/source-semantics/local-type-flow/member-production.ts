import type { Node } from "@tsonic/tsts";
import type { SourceTypeBinding, SourceTypeEvidence } from "../../public/source/contracts.js";
import type { SourceEvidenceDetails, SourceMemberInventory } from "../member-inventory.js";
import type { SourceProductionResult } from "../descriptor-contracts.js";
import type { SourceSemanticProduction } from "./semantic-production.js";

export function produceSourceMemberInventory(context: SourceSemanticProduction, occurrence: Node,
  bindings: readonly SourceTypeBinding[], element?: SourceTypeEvidence): SourceProductionResult<SourceMemberInventory> {
  const original = context.input.syntax(occurrence);
  const facts = context.input.members(original);
  if (facts.kind === "unavailable") return { kind: "resolved", value: facts };
  const values = new Map(bindings.map(binding => [binding.declaration, binding]));
  if (element !== undefined) {
    for (const declaration of facts.elementBinders) {
      const parameter = context.reader.describeSyntax(declaration, []);
      if (parameter.kind !== "resolved") return parameter;
      if (parameter.value.type.kind !== "parameter" || parameter.value.type.declaration !== declaration)
        throw new Error("An original member element binding requires its exact Source parameter declaration.");
      values.set(declaration, { declaration, value: element });
    }
  }
  return context.reader.describeMembers(original, [...values.values()]);
}

export function produceSourceEvidenceDetails(context: SourceSemanticProduction, occurrence: Node,
  bindings: readonly SourceTypeBinding[] = [], element?: SourceTypeEvidence): SourceProductionResult<SourceEvidenceDetails> {
  const members = produceSourceMemberInventory(context, occurrence, bindings, element);
  return members.kind !== "resolved" ? members : { kind: "resolved", value: { members: members.value,
    origins: { kind: "complete", nodes: [occurrence] } } };
}
