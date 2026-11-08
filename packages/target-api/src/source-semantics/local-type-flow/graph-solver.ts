import type { Node } from "@tsonic/tsts";
import type { SourceTypeBinding, SourceTypeEvidence } from "../../public/source/contracts.js";
import type { SourceProductionResult } from "../descriptor-contracts.js";
import { sourceLiteralValueDomain } from "../../source-model/literals/value-domain.js";
import { sourcePresentLiteralDomain } from "../../source-model/literals/domain.js";
import { createSourceTypeFlowTerms } from "./term-groups.js";
import { sourceTypeFlowNumericLiteralKind } from "./defaults.js";
import { sourceSemanticRefusal, sourceProductionValues } from "./semantic-production.js";
import { collectSourceTypeFlowSignatures } from "./signatures.js";
import type { SourceTypeFlowAnalysisContext, SourceTypeFlowGraph, SourceTypeFlowTerm, SourceTypeFlowUse, SourceTypeFlowVariable } from "./types.js";

export function createSourceGraphSolver(context: SourceTypeFlowAnalysisContext, graph: SourceTypeFlowGraph,
  uses: readonly SourceTypeFlowUse[], produce: (occurrence: Node) => SourceProductionResult<SourceTypeEvidence>): {
  resolve(variable: SourceTypeFlowVariable): SourceProductionResult<SourceTypeEvidence>;
  variable(occurrence: Node): SourceTypeFlowVariable | undefined;
  expected(occurrence: Node): readonly SourceTypeEvidence[];
  invalidate(): void;
} {
  const { descriptorBuilder: builder, ast } = context.source;
  const terms = createSourceTypeFlowTerms(ast, graph);
  const signatures = new Map(collectSourceTypeFlowSignatures(context, graph, terms.isInference)
    .map(record => [terms.group(record.variable).variable, record]));
  const variables = new Map(graph.nodes.filter(record => record.variable.path.length === 0).map(record => [record.node, record.variable]));
  const completed = new Map<SourceTypeFlowVariable, SourceProductionResult<SourceTypeEvidence>>();
  const active = new Set<SourceTypeFlowVariable>();
  const fills = new Map<SourceTypeFlowVariable, SourceTypeEvidence[]>();
  const inputs = new Map<SourceTypeFlowVariable, SourceTypeFlowVariable[]>();
  const derived = new Map(graph.derived.map(record => [terms.group(record.result).variable, record.node]));
  const calls = new Map(graph.calls.map(record => [terms.group(record.result).variable, record.node]));
  for (const use of uses) {
    const selected = terms.group(use.variable).variable;
    if (use.kind === "refused") terms.refuse(use.variable, use.refusal);
    if (use.kind === "fill") {
      const values = fills.get(selected);
      if (values === undefined) fills.set(selected, [use.value]);
      else values.push(use.value);
    }
  }
  for (const input of graph.producerInputs) {
    const selected = terms.group(input.target).variable;
    const values = inputs.get(selected);
    if (values === undefined) inputs.set(selected, [input.source]);
    else values.push(input.source);
  }

  function resolve(variable: SourceTypeFlowVariable): SourceProductionResult<SourceTypeEvidence> {
    const group = terms.group(variable), key = group.variable;
    const previous = completed.get(key);
    if (previous !== undefined) return previous;
    if (group.refusals.length > 0) return group.refusals[0]!;
    if (active.has(key)) return { kind: "pending", dependencies: [builder.componentIdentity(variable.node, [])] };
    active.add(key);
    try {
      const authoritative = fills.get(key) ?? [];
      let result: SourceProductionResult<SourceTypeEvidence>;
      if (authoritative.length > 0) {
        const signature = signatures.get(key);
        if (signature !== undefined) return sourceSemanticRefusal(signature.site,
          "This value reaches an inferred signature and cannot take its type from a use. Annotate the value or the signature.", "TSONIC_LOCAL_TYPE_SIGNATURE");
        const first = authoritative[0]!;
        const same = authoritative.every(value => value.type === first.type);
        result = same ? { kind: "resolved", value: first } : sourceSemanticRefusal(variable.node,
          "Linked original declarations require different concrete Source destinations.", "TSONIC_LOCAL_TYPE_CONFLICT");
      } else if (derived.has(key) || calls.has(key)) result = produce(derived.get(key) ?? calls.get(key)!);
      else {
        const values: SourceProductionResult<SourceTypeEvidence>[] = [];
        for (const term of group.terms) values.push(termValue(term));
        for (const input of inputs.get(key) ?? []) values.push(resolve(input));
        if (values.length === 0 && variable.path.length > 0) {
          const base = variables.get(variable.node);
          if (base === undefined || terms.group(base).variable === key) result = { kind: "pending", dependencies: [builder.componentIdentity(variable.node, [])] };
          else {
            const original = resolve(base);
            result = original.kind !== "resolved" ? original : project(original.value, variable);
          }
        } else if (values.length === 0) result = produce(variable.node);
        else {
          const selected = sourceProductionValues(values);
          result = selected.kind !== "resolved" ? selected : builder.join(builder.componentIdentity(variable.node, []), "inferred", selected.value, undefined);
        }
      }
      if (result.kind !== "pending") completed.set(key, result);
      return result;
    } finally { active.delete(key); }
  }

  function project(value: SourceTypeEvidence, variable: SourceTypeFlowVariable): SourceProductionResult<SourceTypeEvidence> {
    let selected: SourceProductionResult<SourceTypeEvidence> = { kind: "resolved", value };
    for (const part of variable.path) {
      if (selected.kind !== "resolved") return selected;
      if (part.kind === "binder") return sourceSemanticRefusal(variable.node, "A graph binder projection requires its original application binding, not a descriptor lookup.");
      const defined = builder.produceDefinition(selected.value);
      if (defined.kind !== "resolved") return defined;
      if (part.kind === "member") return sourceSemanticRefusal(variable.node, "An original member projection requires its canonical declaration-key correspondence.");
      if (part.kind === "element" && defined.value.type.kind === "tuple") {
        const children = sourceProductionValues(defined.value.type.elements.map((_, index) => builder.component(defined.value, { kind: "tuple-element", index })));
        selected = children.kind !== "resolved" ? children : builder.join(builder.componentIdentity(variable.node, []), "inferred", children.value, undefined);
      } else selected = builder.component(defined.value, part.kind === "element" ? { kind: "array-element" }
        : part.kind === "tuple" ? { kind: "tuple-element", index: part.index } : { kind: "optional-value" });
    }
    return selected;
  }

  function termValue(term: SourceTypeFlowTerm): SourceProductionResult<SourceTypeEvidence> {
    if (term.kind === "fixed") return { kind: "resolved", value: term.value };
    if (term.kind === "original") return context.place(term.component, []);
    if (term.kind === "numeric") {
      const creation = sourceTypeFlowNumericLiteralKind(term.literal);
      if (creation.kind === "refused") return sourceSemanticRefusal(term.site, creation.reason);
      const component = builder.componentIdentity(term.site, []);
      return { kind: "resolved", value: builder.evidence({ type: builder.primitive(creation.primitive), component,
        category: { kind: "known", category: "number" }, numeric: { producer: term.site, category: { kind: "known", category: "number" }, kind: "literal" }, sum: undefined },
      [], context.source.input.syntax(term.site), sourceLiteralValueDomain(term.literal, "number", "present"),
      { members: { kind: "unavailable" }, origins: { kind: "complete", nodes: [term.site] } }) };
    }
    if (term.kind === "construction") return produce(term.site);
    if (term.kind === "template") {
      const bindings: SourceTypeBinding[] = [];
      for (const binding of term.bindings) {
        const value = resolve(binding.variable);
        if (value.kind !== "resolved") return value;
        bindings.push({ declaration: binding.declaration, value: value.value });
      }
      return builder.substitute(term.value, bindings);
    }
    if (term.kind === "array") {
      const element = resolve(term.element);
      return element.kind !== "resolved" ? element : { kind: "resolved", value: builder.evidence({
        type: builder.array(element.value.type, term.readonly), component: builder.componentIdentity(term.site, []),
        category: { kind: "known", category: "object" }, numeric: undefined, sum: undefined },
      [{ selector: { kind: "array-element" }, value: element.value }], context.source.input.syntax(term.site), sourcePresentLiteralDomain,
      { members: { kind: "unavailable" }, origins: { kind: "complete", nodes: [term.site] } }) };
    }
    if (term.kind === "optional") {
      const value = resolve(term.value);
      if (value.kind !== "resolved") return value;
      const absent = builder.evidence({ type: builder.intrinsic("absence"), component: builder.componentIdentity(term.site, []),
        category: { kind: "known", category: "absence" }, numeric: undefined, sum: undefined }, [], undefined,
      { kind: "finite", values: [{ kind: "absence" }] }, { members: { kind: "unavailable" }, origins: { kind: "complete", nodes: [term.site] } });
      return builder.join(builder.componentIdentity(term.site, []), "inferred", [value.value, absent], term.source);
    }
    return produce(term.site);
  }
  return Object.freeze({ resolve, variable: (node: Node) => variables.get(node),
    expected: (node: Node) => { const variable = variables.get(node); return variable === undefined ? [] : fills.get(terms.group(variable).variable) ?? []; },
    invalidate: () => completed.clear() });
}
