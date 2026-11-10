import type { Node } from "@tsonic/tsts";
import type { SourceInputCoreQueries } from "@tsonic/target-api/host";
import type { SourceAttributeBuilderFact, SourcePresence } from "@tsonic/target-api/source";
import type { CheckedSourceProgram } from "@tsonic/tsts";
import { tsonicAttributeBuilderFactKey } from "./attribute-facts.js";

export function createSourceCoreAttributeInput(input: {
  readonly checked: CheckedSourceProgram;
  readonly assertNode: (node: Node) => void;
}): Pick<SourceInputCoreQueries, "attributeBuilder"> {
  const retained = new WeakMap<Node, SourcePresence<SourceAttributeBuilderFact>>();
  const none = Object.freeze({ kind: "none" } as const);
  const present = <Value>(value: Value): SourcePresence<Value> => Object.freeze({ kind: "present", value });
  return Object.freeze({ attributeBuilder(occurrence: Node) {
    input.assertNode(occurrence);
    const previous = retained.get(occurrence);
    if (previous !== undefined) return previous;
    const original = input.checked.sourceFacts.getFact(occurrence, tsonicAttributeBuilderFactKey);
    if (original === undefined) { retained.set(occurrence, none); return none; }
    input.assertNode(original.applicationTarget);
    let selectedMember: SourceAttributeBuilderFact["selectedMember"] = none;
    if (original.selectedMember !== undefined) {
      const declarations = original.selectedMemberDeclarations;
      if (declarations === undefined || declarations.length === 0)
        throw new Error("An original attribute member selection requires its complete declaration inventory.");
      declarations.forEach(input.assertNode);
      const primary = original.selectedMemberDeclaration;
      if (primary !== undefined) {
        input.assertNode(primary);
        if (!declarations.includes(primary))
          throw new Error("The selected attribute declaration must belong to its complete original member inventory.");
      }
      selectedMember = present(Object.freeze({ selectedDeclaration: primary === undefined ? none : present(primary),
        declarations: Object.freeze([...declarations]) }));
    } else if (original.selectedMemberDeclaration !== undefined || original.selectedMemberDeclarations !== undefined)
      throw new Error("Attribute member metadata requires its genuine original member selection.");
    const base = { occurrence, applicationTarget: original.applicationTarget, selectedMember,
      ...(original.applicationMemberKind === undefined ? {} : { applicationMemberKind: original.applicationMemberKind }),
      ...(original.applicationPlacement === undefined ? {} : { applicationPlacement: original.applicationPlacement }),
      ...(original.applicationParameterName === undefined ? {} : { applicationParameterName: original.applicationParameterName }),
      ...(original.applicationTargetSpecifier === undefined ? {} : { applicationTargetSpecifier: original.applicationTargetSpecifier }) };
    let value: SourceAttributeBuilderFact;
    if (original.kind === "application") {
      input.assertNode(original.invocation);
      value = Object.freeze({ ...base, kind: "application", invocation: original.invocation });
    } else value = Object.freeze({ ...base, kind: "builder-state" });
    const result = present(value);
    retained.set(occurrence, result);
    return result;
  } });
}
