import type { Node } from "@tsonic/tsts";
import type { SourceTypeBinding, SourceTypeEvidence } from "../../public/source/contracts.js";
import type { SourceProductionResult } from "../../source-model/production.js";
import { createSourceTypeFlowTerms } from "./term-groups.js";
import { sourceSemanticRefusal, sourceProductionValues } from "./semantic-production.js";
import { collectSourceTypeFlowSignatures } from "./signatures.js";
import { createSourceTypeFlowRefusal } from "./refusals.js";
import type { SourceTypeFlowAnalysisContext, SourceTypeFlowGraph, SourceTypeFlowTerm, SourceTypeFlowUse, SourceTypeFlowVariable } from "./types.js";

interface SourceTypeFlowDemand {
  readonly site: Node;
  readonly value: SourceTypeEvidence;
}

export function createSourceGraphSolver(context: SourceTypeFlowAnalysisContext, graph: SourceTypeFlowGraph,
  uses: readonly SourceTypeFlowUse[], produce: (occurrence: Node) => SourceProductionResult<SourceTypeEvidence>,
  contextualValue: (occurrence: Node) => SourceProductionResult<SourceTypeEvidence | undefined>): {
  resolve(variable: SourceTypeFlowVariable): SourceProductionResult<SourceTypeEvidence>;
  variable(occurrence: Node): SourceTypeFlowVariable | undefined;
  expected(occurrence: Node): SourceProductionResult<readonly SourceTypeEvidence[]>;
  invalidate(): void;
} {
  const { descriptorBuilder: builder, ast } = context.source;
  const terms = createSourceTypeFlowTerms(ast, graph);
  const signatures = new Map(collectSourceTypeFlowSignatures(context, graph, terms.isInference)
    .map(record => [terms.group(record.variable).variable, record]));
  const variables = new Map(graph.nodes.filter(record => record.variable.path.length === 0).map(record => [record.node, record.variable]));
  const completed = new Map<SourceTypeFlowVariable, SourceProductionResult<SourceTypeEvidence>>();
  const active = new Set<SourceTypeFlowVariable>();
  const fills = new Map<SourceTypeFlowVariable, SourceTypeFlowDemand[]>();
  const contextual = new Map<SourceTypeFlowVariable, Node[]>();
  const inputs = new Map<SourceTypeFlowVariable, SourceTypeFlowVariable[]>();
  const derived = new Map(graph.derived.map(record => [terms.group(record.result).variable, record.node]));
  const calls = new Map(graph.calls.map(record => [terms.group(record.result).variable, record.node]));
  for (const group of terms.groups()) {
    const locals = group.nodes.filter(node => node.kind === "open-local" || node.kind === "derived-local");
    if (new Set(locals.map(node => node.declaration ?? node.node)).size > 64)
      terms.refuse(group.variable, createSourceTypeFlowRefusal("TSONIC_LOCAL_TYPE_LIMIT", group.variable.node));
    for (const local of locals) if (context.source.navigation.declarationUses(local.declaration ?? local.node).length > 1024)
      terms.refuse(group.variable, createSourceTypeFlowRefusal("TSONIC_LOCAL_TYPE_LIMIT", local.node));
  }
  for (const use of uses) {
    const selected = terms.group(use.variable).variable;
    if (use.kind === "refused") terms.refuse(use.variable, use.refusal);
    if (use.kind === "contextual") {
      const values = contextual.get(selected);
      if (values === undefined) contextual.set(selected, [use.site]);
      else values.push(use.site);
    }
    if (use.kind === "fill") {
      const values = fills.get(selected);
      if (values === undefined) fills.set(selected, [{ site: use.site, value: use.value }]);
      else values.push({ site: use.site, value: use.value });
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
      const selectedFills = destinations(key);
      if (selectedFills.kind !== "resolved") return selectedFills;
      const authoritative = selectedFills.value;
      let result: SourceProductionResult<SourceTypeEvidence>;
      if (authoritative.length > 0) {
        const signature = signatures.get(key);
        if (signature !== undefined) return sourceSemanticRefusal(signature.site,
          "This value reaches an inferred signature and cannot take its type from a use. Annotate the value or the signature.", "TSONIC_LOCAL_TYPE_SIGNATURE");
        const first = authoritative[0]!;
        const conflict = authoritative.find(demand => demand.value.type !== first.value.type);
        result = conflict === undefined ? { kind: "resolved", value: first.value } : sourceSemanticRefusal(conflict.site,
          "Linked original declarations require different concrete Source destinations.", "TSONIC_LOCAL_TYPE_CONFLICT", first.site);
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
    if (term.kind === "numeric" || term.kind === "construction") return produce(term.site);
    if (term.kind === "template") {
      const bindings: SourceTypeBinding[] = [];
      for (const binding of term.bindings) {
        const value = resolve(binding.variable);
        if (value.kind !== "resolved") return value;
        bindings.push({ declaration: binding.declaration, value: value.value });
      }
      return builder.substitute(term.value, bindings);
    }
    if (term.kind === "array") return produce(term.site);
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
  function destinations(variable: SourceTypeFlowVariable): SourceProductionResult<readonly SourceTypeFlowDemand[]> {
    const values = [...fills.get(variable) ?? []];
    if (!terms.isFillable(variable)) return { kind: "resolved", value: values };
    for (const node of contextual.get(variable) ?? []) {
      const value = contextualValue(node);
      if (value.kind !== "resolved") return value;
      if (value.value !== undefined && !(value.value.type.kind === "intrinsic" &&
        ["unknown", "any", "object", "void"].includes(value.value.type.intrinsic))) values.push({ site: node, value: value.value });
    }
    return { kind: "resolved", value: values };
  }
  return Object.freeze({ resolve, variable: (node: Node) => variables.get(node),
    expected: (node: Node): SourceProductionResult<readonly SourceTypeEvidence[]> => {
      const variable = variables.get(node);
      if (variable === undefined) return { kind: "resolved", value: [] };
      const group = terms.group(variable);
      const selected = destinations(group.variable);
      if (selected.kind !== "resolved") return selected;
      if (selected.value.length > 0) return { kind: "resolved", value: selected.value.map(demand => demand.value) };
      const values: SourceTypeEvidence[] = [];
      for (const term of group.terms) {
        if (term.kind !== "fixed" && term.kind !== "original") continue;
        const value = termValue(term);
        if (value.kind !== "resolved") return value;
        if (value.value.type.kind === "primitive") values.push(value.value);
      }
      return { kind: "resolved", value: values };
    },
    invalidate: () => completed.clear() });
}
