import type { AstReader, Node } from "@tsonic/tsts";
import { createSourceTypeFlowRefusal } from "./refusals.js";
import { createSourceTypeFlowVariableIndex } from "./variable-index.js";
import type { SourceRefusal } from "../../public/source/contracts.js";
import type {
  SourceTypeFlowGraph, SourceTypeFlowNode,
  SourceTypeFlowTerm, SourceTypeFlowVariable,
} from "./types.js";

export interface SourceTypeFlowTermGroup {
  readonly variable: SourceTypeFlowVariable;
  readonly nodes: readonly SourceTypeFlowNode[];
  readonly terms: readonly SourceTypeFlowTerm[];
  readonly refusals: readonly SourceRefusal[];
}

export interface SourceTypeFlowTerms {
  group(variable: SourceTypeFlowVariable): SourceTypeFlowTermGroup;
  groups(): readonly SourceTypeFlowTermGroup[];
  isInference(variable: SourceTypeFlowVariable): boolean;
  isFillable(variable: SourceTypeFlowVariable): boolean;
  refuse(variable: SourceTypeFlowVariable, refusal: SourceRefusal): void;
}

export function isSourceTypeFlowDeclaredConstruction(node: SourceTypeFlowNode): boolean {
  return node.kind === "fixed" && (node.term?.kind === "array" || node.term?.kind === "shape") &&
    node.term.site === node.node;
}

interface TermSlot {
  readonly variable: SourceTypeFlowVariable;
  parent: TermSlot | undefined;
  rank: number;
  readonly nodes: SourceTypeFlowNode[];
  readonly terms: SourceTypeFlowTerm[];
  readonly structures: Extract<SourceTypeFlowTerm, { kind: "array" | "shape" | "declared" | "tuple" | "optional" }>[];
  numeric: boolean;
  readonly refusals: SourceRefusal[];
}

export function createSourceTypeFlowTerms(ast: AstReader, graph: SourceTypeFlowGraph): SourceTypeFlowTerms {
  const slots: TermSlot[] = [];
  const views = new WeakMap<TermSlot, SourceTypeFlowTermGroup>();
  const intern = createSourceTypeFlowVariableIndex<TermSlot>(variable => {
    const selected: TermSlot = { variable, rank: 0, parent: undefined, nodes: [], terms: [], structures: [], numeric: false, refusals: [] };
    slots.push(selected);
    return selected;
  });
  function root(slot: TermSlot): TermSlot {
    let selected = slot;
    while (selected.parent !== undefined) selected = selected.parent;
    while (slot.parent !== undefined) {
      const parent = slot.parent;
      slot.parent = selected;
      slot = parent;
    }
    return selected;
  }
  function children(slot: TermSlot): readonly TermSlot[] {
    return [...slot.structures.flatMap(term => term.kind === "array" ? [intern(term.element)]
      : term.kind === "optional" ? [intern(term.value)]
      : term.kind === "tuple" ? term.elements.map(element => intern(element.variable))
      : term.kind === "shape" ? term.members.map(member => intern(member.variable))
      : term.kind === "declared" ? term.typeArguments.map(intern) : []),
      ...slot.terms.flatMap(term => term.kind === "template" ? term.bindings.map(binding => intern(binding.variable))
        : term.kind === "construction" ? term.inputs.map(intern) : [])];
  }
  function contains(from: TermSlot, target: TermSlot): boolean {
    const pending = [...children(from)];
    const seen = new Set<TermSlot>();
    while (pending.length > 0) {
      const selected = root(pending.pop()!);
      if (selected === target) return true;
      if (seen.has(selected)) continue;
      seen.add(selected);
      for (const child of children(selected)) pending.push(child);
    }
    return false;
  }
  function refuse(slot: TermSlot, refusal: SourceRefusal): void {
    const selected = root(slot);
    if (selected.refusals.length === 0) {
      selected.refusals.push(refusal);
      views.delete(selected);
    }
  }
  function union(left: TermSlot, right: TermSlot, site: Node): void {
    const pending: [TermSlot, TermSlot][] = [[left, right]];
    while (pending.length > 0) {
      const pair = pending.pop()!;
      let first = root(pair[0]);
      let second = root(pair[1]);
      if (first === second) continue;
      if (contains(first, second) || contains(second, first)) {
        const issue = createSourceTypeFlowRefusal("TSONIC_LOCAL_TYPE_SELF_REFERENCE", site);
        refuse(first, issue);
        refuse(second, issue);
        continue;
      }
      const firstStructures = first.structures;
      const secondStructures = second.structures;
      let clash = firstStructures.length > 0 && second.numeric || secondStructures.length > 0 && first.numeric;
      for (const one of firstStructures) {
        for (const other of secondStructures) {
          if (one.kind !== other.kind) { clash = true; continue; }
          if (one.kind === "array" && other.kind === "array") pending.push([intern(one.element), intern(other.element)]);
          if (one.kind === "optional" && other.kind === "optional") pending.push([intern(one.value), intern(other.value)]);
          if (one.kind === "tuple" && other.kind === "tuple") {
            if (one.elements.length !== other.elements.length) { clash = true; continue; }
            one.elements.forEach((element, index) => {
              const selected = other.elements[index]!;
              if (element.kind !== selected.kind) clash = true;
              else pending.push([intern(element.variable), intern(selected.variable)]);
            });
          }
          if (one.kind === "shape" && other.kind === "shape") {
            if (one.members.length !== other.members.length) { clash = true; continue; }
            for (const member of one.members) {
              const selected = other.members.find(candidate => candidate.name === member.name);
              if (selected === undefined) clash = true;
              else pending.push([intern(member.variable), intern(selected.variable)]);
            }
          }
          if (one.kind === "declared" && other.kind === "declared") {
            if (one.declaration !== other.declaration || one.typeArguments.length !== other.typeArguments.length) {
              clash = true;
              continue;
            }
            one.typeArguments.forEach((argument, index) => pending.push([intern(argument), intern(other.typeArguments[index]!)]));
          }
        }
      }
      if (clash) {
        const issue = createSourceTypeFlowRefusal("TSONIC_LOCAL_TYPE_CONFLICT", site);
        refuse(first, issue);
        refuse(second, issue);
        continue;
      }
      if (first.rank < second.rank) [first, second] = [second, first];
      second.parent = first;
      if (first.rank === second.rank) first.rank += 1;
      for (const node of second.nodes) first.nodes.push(node);
      for (const term of second.terms) first.terms.push(term);
      for (const term of second.structures) first.structures.push(term);
      first.numeric ||= second.numeric;
      for (const refusal of second.refusals) first.refusals.push(refusal);
    }
  }
  for (const node of graph.nodes) {
    const selected = intern(node.variable);
    selected.nodes.push(node);
    if (node.term !== undefined) {
      selected.terms.push(node.term);
      if (structural(node.term)) selected.structures.push(node.term);
      if (node.term.kind === "numeric") selected.numeric = true;
      children(selected);
    }
  }
  for (const derived of graph.derived) {
    intern(derived.result);
    derived.operands.forEach(intern);
    if (derived.control !== undefined) intern(derived.control);
    if (derived.accumulator !== undefined) intern(derived.accumulator);
  }
  for (const input of graph.producerInputs) {
    intern(input.source);
    intern(input.target);
  }
  for (const call of graph.calls) {
    intern(call.result);
  }
  const constructions = new Set(graph.nodes.filter(isSourceTypeFlowDeclaredConstruction).map(node => intern(node.variable)));
  const conversionPositions = new Set([...constructions].flatMap(children));
  for (const link of graph.links) {
    if (!conversionPositions.has(intern(link.target))) union(intern(link.source), intern(link.target), link.site);
  }
  const declaredRoots = new Set([...constructions].map(root));
  const unboundConstructions = new Set(graph.nodes.filter(node => {
    if (node.kind === "fixed" || node.variable.path.length !== 0 || ast.is.IsSourceFile(node.root) ||
      !(ast.is.IsArrayLiteralExpression(node.node) || ast.is.IsObjectLiteralExpression(node.node))) return false;
    let occurrence = node.node;
    let owner = ast.parent(occurrence);
    while (owner !== undefined && (ast.is.IsParenthesizedExpression(owner) || ast.is.IsNonNullExpression(owner) ||
      ast.is.IsAsExpression(owner) || ast.is.IsSatisfiesExpression(owner))) {
      occurrence = owner;
      owner = ast.parent(owner);
    }
    return owner === undefined || !(ast.is.IsVariableDeclaration(owner) || ast.is.IsPropertyDeclaration(owner) ||
      ast.is.IsParameterDeclaration(owner)) || ast.as.AsVariableDeclaration(owner)?.Initializer !== occurrence &&
        ast.as.AsPropertyDeclaration(owner)?.Initializer !== occurrence && ast.as.AsParameterDeclaration(owner)?.Initializer !== occurrence;
  }).map(node => root(intern(node.variable))));
  const inference = new Set<TermSlot>();
  const successors = new Map<TermSlot, Set<TermSlot>>();
  const connect = (from: TermSlot, to: TermSlot): void => {
    const source = root(from), target = root(to);
    let selected = successors.get(source);
    if (selected === undefined) successors.set(source, selected = new Set());
    selected.add(target);
  };
  for (const slot of slots) {
    const selected = root(slot);
    if (unboundConstructions.has(selected) || selected.nodes.some(node => node.kind === "open-local" || node.kind === "derived-local")) {
      inference.add(selected);
    }
    for (const child of declaredRoots.has(selected) ? [] : children(selected)) {
      connect(selected, child);
      connect(child, selected);
    }
  }
  for (const derived of graph.derived) {
    for (const operand of derived.operands) connect(intern(operand), intern(derived.result));
  }
  for (const input of graph.producerInputs) connect(intern(input.source), intern(input.target));
  const pendingInference = [...inference];
  for (let index = 0; index < pendingInference.length; index += 1) {
    for (const next of successors.get(pendingInference[index]!) ?? []) {
      if (inference.has(next)) continue;
      inference.add(next);
      pendingInference.push(next);
    }
  }
  const depths = new Map<TermSlot, number>();
  function depth(slot: TermSlot, remaining = 4, active = new Set<TermSlot>()): number {
    const selected = root(slot);
    const previous = depths.get(selected);
    if (previous !== undefined) return previous;
    if (active.has(selected)) return 5;
    const nested = children(selected);
    if (nested.length === 0) { depths.set(selected, 0); return 0; }
    if (remaining === 0) return 5;
    active.add(selected);
    try {
      let maximum = 0;
      for (const child of nested) {
        const childDepth = depth(child, remaining - 1, active);
        if (childDepth >= remaining) return 5;
        maximum = Math.max(maximum, childDepth + 1);
      }
      depths.set(selected, maximum);
      return maximum;
    } finally { active.delete(selected); }
  }
  for (const slot of slots) {
    const selected = root(slot);
    if (inference.has(selected) && depth(selected) > 4) refuse(selected,
      createSourceTypeFlowRefusal("TSONIC_LOCAL_TYPE_LIMIT", selected.variable.node));
  }
  const view = (slot: TermSlot): SourceTypeFlowTermGroup => {
    const selected = root(slot);
    const previous = views.get(selected);
    if (previous !== undefined) return previous;
    const value = Object.freeze({ variable: selected.variable, nodes: Object.freeze([...selected.nodes]),
      terms: Object.freeze([...selected.terms]), refusals: Object.freeze([...selected.refusals]) });
    views.set(selected, value);
    return value;
  };
  return Object.freeze({
    group: (variable: SourceTypeFlowVariable) => view(intern(variable)),
    groups: () => Object.freeze([...new Set(slots.map(root))].map(view)),
    isInference: (variable: SourceTypeFlowVariable) => inference.has(root(intern(variable))),
    isFillable: (variable: SourceTypeFlowVariable) => {
      const selected = root(intern(variable));
      return inference.has(selected) && selected.terms.some(term => term.kind === "numeric" || term.kind === "array" ||
        term.kind === "shape" || term.kind === "construction" || term.kind === "tuple" || term.kind === "optional");
    },
    refuse: (variable: SourceTypeFlowVariable, refusal: SourceRefusal) => refuse(intern(variable), refusal),
  });
}

function structural(term: SourceTypeFlowTerm): term is Extract<SourceTypeFlowTerm, { kind: "array" | "shape" | "declared" | "tuple" | "optional" }> {
  return term.kind === "array" || term.kind === "shape" || term.kind === "declared" || term.kind === "tuple" || term.kind === "optional";
}
