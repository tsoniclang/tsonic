import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceLiteralDomain } from "../source-model/literals/domain.js";
import { sourceLiteralUnitKey } from "../source-model/literals/key.js";
import type { SourceProductionResult } from "./descriptor-contracts.js";
import type { SourcePropertyNameFacts } from "../host-input/property-name-input.js";
import type { SourcePropertyName, SourceResult } from "../public/source/contracts.js";

export interface SourcePropertyNameInput extends SourcePropertyNameFacts {
  readonly ast: AstReader;
  readonly assertNode: (node: Node) => void;
  readonly literalDomain: (node: Node) => SourceProductionResult<SourceLiteralDomain>;
  readonly syntaxDomain: (node: Node) => SourceProductionResult<SourceLiteralDomain>;
}

export function createSourcePropertyNameQuery(input: SourcePropertyNameInput):
  (node: Node) => SourceProductionResult<SourcePropertyName> {
  const { ast, assertNode, literalDomain, syntaxDomain, selectedSymbol, selectedName, eligible } = input;
  const retained = new WeakMap<Node, SourceResult<SourcePropertyName>>();
  const unproven = (reason: string): SourceResult<SourcePropertyName> => Object.freeze({ kind: "resolved",
    value: Object.freeze({ kind: "unproven", reason }) });
  const select = (node: Node): SourceProductionResult<SourcePropertyName> => {
    if (ast.is.IsIdentifier(node) || ast.is.IsPrivateIdentifier(node) || ast.is.IsStringLiteral(node))
      return Object.freeze({ kind: "resolved", value: Object.freeze({ kind: "name", name: ast.text(node) }) });
    let domain: SourceProductionResult<SourceLiteralDomain>;
    if (ast.is.IsComputedPropertyName(node)) {
      const expression = ast.as.AsComputedPropertyName(node)?.Expression;
      if (expression === undefined) throw new Error("A computed property name requires its original expression.");
      assertNode(expression);
      const admission = eligible(expression);
      if (admission.kind === "refused") return admission;
      if (admission.value.kind === "unproven") return Object.freeze({ kind: "resolved", value: admission.value });
      const symbol = selectedSymbol(node);
      if (symbol.kind === "present") {
        assertNode(symbol.value.declaration);
        return Object.freeze({ kind: "resolved", value: symbol.value.wellKnown.kind === "present"
          ? Object.freeze({ kind: "well-known-symbol", declaration: symbol.value.declaration, name: symbol.value.wellKnown.value })
          : Object.freeze({ kind: "symbol", declaration: symbol.value.declaration }) });
      }
      domain = literalDomain(expression);
    } else domain = syntaxDomain(node);
    if (domain.kind !== "resolved") return domain;
    if (domain.value.kind !== "finite" || domain.value.values.length !== 1)
      return unproven("A static property name requires one exact finite literal or original symbol identity.");
    const selected = sourceLiteralUnitKey(domain.value.values[0]!);
    if (selected?.kind === "name") {
      const factual = selectedName(node);
      if (factual.kind === "present" && !factual.value.numericIndex && factual.value.name !== selected.name)
        return unproven(`Property key ${selected.name} has a different original selected member name ${factual.value.name}.`);
    }
    return selected === undefined ? unproven("A static property name requires a string, finite number or original symbol.")
      : Object.freeze({ kind: "resolved", value: selected });
  };
  return node => {
    assertNode(node);
    const previous = retained.get(node);
    if (previous !== undefined) return previous;
    const selected = select(node);
    if (selected.kind !== "pending") retained.set(node, selected);
    return selected;
  };
}
