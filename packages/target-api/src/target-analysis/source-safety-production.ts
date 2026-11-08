import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceInputSafetyQueries, SourceInputSafetyReceipt } from "../host-input/safety-input.js";
import type { SourcePresence, SourceRefusal, SourceResult } from "../public/source/contracts.js";
import type { SourceSafetyBuilder, SourceSafetyFacts, SourceSafetyOperation } from "../source-model/safety.js";

export function createSourceSafetyFacts(input: {
  readonly ast: AstReader;
  readonly input: SourceInputSafetyQueries;
  readonly assertNode: (node: Node) => void;
  readonly observe: (refusal: SourceRefusal) => SourceRefusal;
}): SourceSafetyFacts {
  const { ast, assertNode } = input;
  const retained = new WeakMap<Node, SourceResult<SourcePresence<SourceSafetyOperation>>>();
  const none = Object.freeze({ kind: "none" } as const);
  const present = <Value>(value: Value): SourcePresence<Value> => Object.freeze({ kind: "present", value });
  const resolved = <Value>(value: Value): SourceResult<Value> => Object.freeze({ kind: "resolved", value });
  const refuse = (site: Node, code: string, message: string): SourceRefusal => {
    assertNode(site);
    return input.observe(Object.freeze({ kind: "refused", source: "tsonic", site, code, message }));
  };
  const memberKindMatches = (declaration: Node, kind: "method" | "property" | "indexer"): boolean => kind === "method"
    ? ast.is.IsMethodDeclaration(declaration) || ast.is.IsMethodSignatureDeclaration(declaration)
    : kind === "indexer" ? ast.is.IsIndexSignatureDeclaration(declaration)
      : ast.is.IsPropertyDeclaration(declaration) || ast.is.IsPropertySignatureDeclaration(declaration) ||
        ast.is.IsGetAccessorDeclaration(declaration) || ast.is.IsSetAccessorDeclaration(declaration);
  const produce = (original: SourceInputSafetyReceipt): SourceResult<SourcePresence<SourceSafetyOperation>> => {
    const { occurrence } = original;
    assertNode(occurrence);
    if (original.family === "unsafe-context") {
      if (original.operation === "expression") {
        assertNode(original.expression);
        return resolved(present(Object.freeze({ kind: "unsafe-context",
          fact: Object.freeze({ kind: "expression", expression: original.expression }) })));
      }
      return original.firstDirectStatement ? resolved(present(Object.freeze({ kind: "unsafe-context",
        fact: Object.freeze({ kind: "remaining-block" }) }))) : refuse(occurrence,
          "SOURCE_CORE_UNSAFE_CONTEXT_BLOCK_POSITION_INVALID",
          "The no-argument unsafe-context marker must be the first direct expression statement of its source block.");
    }
    if (original.operation === "root") {
      if (original.target.kind === "none") return refuse(occurrence, "SOURCE_CORE_SAFETY_ROOT_TARGET_NOT_PROVEN",
        "The selected safety root requires a declaration reference, an uncalled function expression or an authored type argument; effectful root expressions are not admitted.");
      assertNode(original.target.value);
      return resolved(present(Object.freeze({ kind: "safety-builder", fact: Object.freeze({ kind: "builder-state",
        applicationTarget: original.target.value, selectedDeclaration: none, selectedDeclarations: Object.freeze([]),
        memberKind: none, placement: "declaration" }) })));
    }
    const predecessor = original.predecessor;
    if (predecessor.kind === "none") return refuse(occurrence, "SOURCE_CORE_SAFETY_ROOT_TARGET_NOT_PROVEN",
      "The selected safety operation requires its original safety builder predecessor.");
    assertNode(predecessor.value);
    const previous = retained.get(predecessor.value);
    if (previous === undefined) throw new Error("Safety operations require their one original predecessor publication.");
    if (previous.kind === "refused") return previous;
    const previousReceipt = input.input.safety(predecessor.value);
    if (previous.value.kind === "none" || previous.value.value.kind !== "safety-builder" ||
      previous.value.value.fact.kind !== "builder-state" || previousReceipt.kind === "none" ||
      previousReceipt.value.provider.providerId !== original.provider.providerId ||
      previousReceipt.value.provider.providerVersion !== original.provider.providerVersion ||
      previousReceipt.value.provider.providerModuleId !== original.provider.providerModuleId)
      return refuse(occurrence, "SOURCE_CORE_SAFETY_ROOT_TARGET_NOT_PROVEN",
        "The selected safety operation requires its original safety builder predecessor.");
    const base = previous.value.value.fact;
    let fact: SourceSafetyBuilder;
    if (original.operation === "select-member") {
      const selected = original.selection;
      if (selected.kind === "unavailable") return refuse(occurrence,
        `SOURCE_CORE_SAFETY_SELECTOR_${selected.reason.toUpperCase().replace("-", "_")}`,
        "The selected safety member operation requires one exact inline member selection from its callback parameter.");
      assertNode(selected.expression);
      selected.declarations.forEach(assertNode);
      if (selected.declaration.kind === "present") {
        assertNode(selected.declaration.value);
        if (!selected.declarations.includes(selected.declaration.value))
          throw new Error("The selected safety declaration must belong to its complete original member inventory.");
      }
      if (selected.declaration.kind === "none" || !memberKindMatches(selected.declaration.value, original.memberKind))
        return refuse(occurrence, "SOURCE_CORE_SAFETY_SELECTOR_MEMBER_KIND_INVALID",
          `The selected safety ${original.memberKind} operation did not select a ${original.memberKind} declaration.`);
      fact = Object.freeze({ kind: "builder-state", applicationTarget: selected.expression,
        selectedDeclaration: selected.declaration, selectedDeclarations: Object.freeze([...selected.declarations]),
        memberKind: present(original.memberKind), placement: "declaration" });
    } else if (original.operation === "placement") {
      if ((original.placement === "getter" || original.placement === "setter") &&
        (base.memberKind.kind === "none" || base.memberKind.value !== "property" && base.memberKind.value !== "indexer"))
        return refuse(occurrence, "SOURCE_CORE_SAFETY_ACCESSOR_REQUIRES_PROPERTY",
          `The selected safety ${original.placement} operation requires a preceding exact property or indexer selection.`);
      fact = Object.freeze({ ...base, placement: original.placement });
    } else fact = Object.freeze({ ...base, kind: "application", contract: original.contract });
    return resolved(present(Object.freeze({ kind: "safety-builder", fact })));
  };
  return Object.freeze({ safety(occurrence: Node) {
    assertNode(occurrence);
    const previous = retained.get(occurrence);
    if (previous !== undefined) return previous;
    const pending: SourceInputSafetyReceipt[] = [];
    const visited = new Set<Node>();
    let current = occurrence;
    while (!retained.has(current)) {
      assertNode(current);
      if (visited.has(current)) throw new Error("Safety operations require an acyclic original builder chain.");
      visited.add(current);
      const original = input.input.safety(current);
      if (original.kind === "none") { retained.set(current, resolved(none)); break; }
      if (original.value.occurrence !== current) throw new Error("Safety receipts require their exact original occurrence.");
      pending.push(original.value);
      if (original.value.family !== "safety" || original.value.operation === "root" || original.value.predecessor.kind === "none") break;
      current = original.value.predecessor.value;
    }
    for (let index = pending.length - 1; index >= 0; index -= 1) {
      const original = pending[index]!;
      retained.set(original.occurrence, produce(original));
    }
    const result = retained.get(occurrence);
    if (result === undefined) throw new Error("Safety publication requires its exact completed original query.");
    return result;
  } });
}
