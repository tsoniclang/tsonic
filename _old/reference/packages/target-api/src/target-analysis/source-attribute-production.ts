import type { Node } from "@tsonic/tsts";
import type { SourceInputCoreQueries } from "../host-input/core-input.js";
import type { SourcePresence, SourceResult } from "../public/source/contracts.js";
import type { SourceAttributeBuilderFact, SourceAttributeFacts } from "../source-model/attributes.js";

export function createSourceAttributeFacts(input: {
  readonly input: Pick<SourceInputCoreQueries, "attributeBuilder">;
  readonly assertNode: (node: Node) => void;
}): SourceAttributeFacts {
  const retained = new WeakMap<Node, SourceResult<SourcePresence<SourceAttributeBuilderFact>>>();
  return Object.freeze({ attributeBuilder(occurrence: Node) {
    input.assertNode(occurrence);
    const previous = retained.get(occurrence);
    if (previous !== undefined) return previous;
    const original = input.input.attributeBuilder(occurrence);
    if (original.kind === "present") {
      const value = original.value;
      if (value.occurrence !== occurrence) throw new Error("Attribute facts require their exact original occurrence.");
      input.assertNode(value.applicationTarget);
      if (value.kind === "application") input.assertNode(value.invocation);
      if (value.selectedMember.kind === "present") {
        const selected = value.selectedMember.value;
        selected.declarations.forEach(input.assertNode);
        if (selected.declarations.length === 0) throw new Error("An attribute member selection requires original declarations.");
        if (selected.selectedDeclaration.kind === "present") {
          input.assertNode(selected.selectedDeclaration.value);
          if (!selected.declarations.includes(selected.selectedDeclaration.value))
            throw new Error("An attribute member primary must belong to the original complete declaration vector.");
        }
      }
    }
    const result: SourceResult<SourcePresence<SourceAttributeBuilderFact>> = Object.freeze({ kind: "resolved", value: original });
    retained.set(occurrence, result);
    return result;
  } });
}
