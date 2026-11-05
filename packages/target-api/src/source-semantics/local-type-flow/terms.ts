import type { AstReader, Node } from "@tsonic/tsts";
import { createSourceTypeFlowRefusal } from "./refusals.js";
import { freezeSourceTypeDescriptorMemberOrigin } from "./member-origins.js";
import type {
  SourceTypeDescriptor, SourceTypeDescriptorIndex, SourceTypeDescriptorSignature, SourceTypeFlowGraph, SourceTypeFlowNode, SourceTypeFlowPathPart,
  SourceTypeFlowRefusal, SourceTypeFlowTerm, SourceTypeFlowVariable,
} from "./types.js";

export function sourceTypeDescriptorsEqual(left: SourceTypeDescriptor, right: SourceTypeDescriptor): boolean {
  if (left === right) return true;
  if (left.kind !== right.kind) return false;
  switch (left.kind) {
    case "primitive": return right.kind === "primitive" && left.primitive === right.primitive;
    case "string": return right.kind === "string";
    case "intrinsic": return right.kind === "intrinsic" && left.intrinsic === right.intrinsic;
    case "union": return right.kind === "union" && left.types.length === right.types.length &&
      left.types.every(type => right.types.some(selected => sourceTypeDescriptorsEqual(type, selected)));
    case "callable": return right.kind === "callable" && signaturesEqual(left.calls, right.calls) &&
      signaturesEqual(left.constructs, right.constructs);
    case "optional": return right.kind === "optional" && sourceTypeDescriptorsEqual(left.value, right.value);
    case "array": return right.kind === "array" && left.readonly === right.readonly &&
      sourceTypeDescriptorsEqual(left.element, right.element);
    case "tuple": return right.kind === "tuple" && left.readonly === right.readonly &&
      left.elements.length === right.elements.length && left.elements.every((element, index) =>
        element.kind === right.elements[index]?.kind && sourceTypeDescriptorsEqual(element.type, right.elements[index]!.type));
    case "declared": return right.kind === "declared" && left.declaration === right.declaration &&
      left.typeArguments.length === right.typeArguments.length &&
      left.typeArguments.every((argument, index) => sourceTypeDescriptorsEqual(argument, right.typeArguments[index]!));
    case "shape": return right.kind === "shape" && left.members.length === right.members.length &&
      indexesEqual(left.indexes, right.indexes) && signaturesEqual(left.calls, right.calls) && signaturesEqual(left.constructs, right.constructs) &&
      left.members.every(member => {
        const selected = right.members.find(candidate => candidate.name === member.name);
        return selected !== undefined && member.optional === selected.optional && !!member.readonly === !!selected.readonly &&
          sourceTypeDescriptorsEqual(member.type, selected.type);
      });
  }
}

function indexesEqual(left: readonly SourceTypeDescriptorIndex[], right: readonly SourceTypeDescriptorIndex[]): boolean {
  return left.length === right.length && left.every(index => right.some(selected =>
    index.readonly === selected.readonly && sourceTypeDescriptorsEqual(index.key, selected.key) &&
    sourceTypeDescriptorsEqual(index.value, selected.value)));
}

export function sourceTypeDescriptorUnion(types: readonly SourceTypeDescriptor[]): SourceTypeDescriptor | undefined {
  const members: SourceTypeDescriptor[] = [];
  let absent = false;
  const pending = [...types];
  while (pending.length > 0) {
    const selected = pending.shift()!;
    if (selected.kind === "union") pending.unshift(...selected.types);
    else if (selected.kind === "optional") { absent = true; pending.unshift(selected.value); }
    else if (selected.kind === "intrinsic" && selected.intrinsic === "absence") absent = true;
    else if (!members.some(member => sourceTypeDescriptorsEqual(member, selected))) members.push(selected);
  }
  const value: SourceTypeDescriptor | undefined = members.length === 0 ? undefined
    : members.length === 1 ? members[0] : { kind: "union", types: members };
  return absent ? value === undefined ? { kind: "intrinsic", intrinsic: "absence" } : { kind: "optional", value } : value;
}

function signaturesEqual(left: readonly SourceTypeDescriptorSignature[], right: readonly SourceTypeDescriptorSignature[]): boolean {
  return left.length === right.length && left.every((signature, index) => {
    const selected = right[index]!;
    return signature.typeParameters.length === selected.typeParameters.length &&
      signature.typeParameters.every((parameter, offset) => parameter === selected.typeParameters[offset]) &&
      signature.parameters.length === selected.parameters.length && signature.parameters.every((parameter, offset) =>
        parameter.kind === selected.parameters[offset]?.kind &&
        sourceTypeDescriptorsEqual(parameter.type, selected.parameters[offset]!.type)) &&
      sourceTypeDescriptorsEqual(signature.result, selected.result);
  });
}

export function freezeSourceTypeDescriptor(type: SourceTypeDescriptor): SourceTypeDescriptor {
  const indexes = (values: readonly SourceTypeDescriptorIndex[]) => Object.freeze(values.map(index =>
    Object.freeze({ ...index, key: freezeSourceTypeDescriptor(index.key), value: freezeSourceTypeDescriptor(index.value) })));
  const signatures = (values: readonly SourceTypeDescriptorSignature[]) => Object.freeze(values.map(signature =>
    Object.freeze({ ...signature, typeParameters: Object.freeze([...signature.typeParameters]),
      parameters: Object.freeze(signature.parameters.map(parameter => Object.freeze({ ...parameter,
        type: freezeSourceTypeDescriptor(parameter.type) }))), result: freezeSourceTypeDescriptor(signature.result) })));
  switch (type.kind) {
    case "primitive": case "string": case "intrinsic": return Object.freeze({ ...type });
    case "union": return Object.freeze({ ...type, types: Object.freeze(type.types.map(freezeSourceTypeDescriptor)) });
    case "callable": return Object.freeze({ ...type, calls: signatures(type.calls), constructs: signatures(type.constructs) });
    case "array": return Object.freeze({ ...type, element: freezeSourceTypeDescriptor(type.element) });
    case "optional": return Object.freeze({ ...type, value: freezeSourceTypeDescriptor(type.value) });
    case "tuple": return Object.freeze({ ...type, elements: Object.freeze(type.elements.map(element =>
      Object.freeze({ ...element, type: freezeSourceTypeDescriptor(element.type) }))) });
    case "declared": return Object.freeze({ kind: "declared", declaration: type.declaration,
      typeArguments: Object.freeze(type.typeArguments.map(freezeSourceTypeDescriptor)),
      ...(type.definition === undefined ? {} : { definition: freezeSourceTypeDescriptor(type.definition) }) });
    case "shape": return Object.freeze({ ...type, indexes: indexes(type.indexes), calls: signatures(type.calls), constructs: signatures(type.constructs),
      members: Object.freeze(type.members.map(member => Object.freeze({ ...member, origin: freezeSourceTypeDescriptorMemberOrigin(member.origin),
        type: freezeSourceTypeDescriptor(member.type) }))) });
  }
}

export function sourceTypeDescriptorDepth(type: SourceTypeDescriptor): number {
  const children = type.kind === "array" ? [type.element] : type.kind === "optional" ? [type.value]
    : type.kind === "union" ? type.types : type.kind === "callable" ? [...type.calls, ...type.constructs]
      .flatMap(signature => [...signature.parameters.map(parameter => parameter.type), signature.result])
    : type.kind === "tuple" ? type.elements.map(element => element.type) : type.kind === "declared" ? type.typeArguments
    : type.kind === "shape" ? [...type.members.map(member => member.type), ...type.indexes.flatMap(index => [index.key, index.value]),
      ...[...type.calls, ...type.constructs].flatMap(signature => [...signature.parameters.map(parameter => parameter.type), signature.result])] : [];
  let depth = -1;
  for (const child of children) depth = Math.max(depth, sourceTypeDescriptorDepth(child));
  return depth + 1;
}

export function sourceTypeDescriptorHasTypeVariables(ast: AstReader, type: SourceTypeDescriptor,
  bound: ReadonlySet<Node> = new Set()): boolean {
  const visit = (selected: SourceTypeDescriptor): boolean => sourceTypeDescriptorHasTypeVariables(ast, selected, bound);
  if (type.kind === "declared") {
    if (ast.is.IsTypeParameterDeclaration(type.declaration) && !bound.has(type.declaration)) return true;
    return type.typeArguments.some(visit) || type.definition !== undefined && visit(type.definition);
  }
  if (type.kind === "array") return visit(type.element);
  if (type.kind === "tuple") return type.elements.some(element => visit(element.type));
  if (type.kind === "optional") return visit(type.value);
  if (type.kind === "union") return type.types.some(visit);
  if (type.kind === "shape" && (type.members.some(member => visit(member.type)) ||
    type.indexes.some(index => visit(index.key) || visit(index.value)))) return true;
  if (type.kind === "callable" || type.kind === "shape") return [...type.calls, ...type.constructs].some(signature => {
    const scope = new Set([...bound, ...signature.typeParameters]);
    return signature.parameters.some(parameter => sourceTypeDescriptorHasTypeVariables(ast, parameter.type, scope)) ||
      sourceTypeDescriptorHasTypeVariables(ast, signature.result, scope);
  });
  return false;
}

export function sourceTypeDescriptorTupleValue(type: Extract<SourceTypeDescriptor, { readonly kind: "tuple" }>,
  index: number): SourceTypeDescriptor | undefined {
  if (!Number.isSafeInteger(index) || index < 0) throw new Error("A Source tuple position must be a nonnegative safe integer.");
  const element = type.elements[index];
  if (element !== undefined) return element.type;
  const last = type.elements[type.elements.length - 1];
  return last?.kind === "rest" ? last.type : undefined;
}

export function sourceTypeDescriptorStructure(type: SourceTypeDescriptor): SourceTypeDescriptor {
  let selected = type;
  while (selected.kind === "declared" && selected.definition !== undefined) selected = selected.definition;
  return selected;
}

export interface SourceTypeFlowTermGroup {
  readonly variable: SourceTypeFlowVariable;
  readonly nodes: readonly SourceTypeFlowNode[];
  readonly terms: readonly SourceTypeFlowTerm[];
  readonly refusals: readonly SourceTypeFlowRefusal[];
}

export interface SourceTypeFlowTerms {
  group(variable: SourceTypeFlowVariable): SourceTypeFlowTermGroup;
  groups(): readonly SourceTypeFlowTermGroup[];
  isInference(variable: SourceTypeFlowVariable): boolean;
  refuse(variable: SourceTypeFlowVariable, refusal: SourceTypeFlowRefusal): void;
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
  readonly refusals: SourceTypeFlowRefusal[];
}

interface PathIndex {
  readonly parts: Map<string, PathIndex>;
  readonly binders: WeakMap<Node, PathIndex>;
  slot?: TermSlot;
}

export function createSourceTypeFlowTerms(ast: AstReader, graph: SourceTypeFlowGraph): SourceTypeFlowTerms {
  const indexes = new WeakMap<Node, PathIndex>();
  const slots: TermSlot[] = [];
  function intern(variable: SourceTypeFlowVariable): TermSlot {
    const existing = indexes.get(variable.node);
    let index: PathIndex;
    if (existing === undefined) {
      index = { parts: new Map(), binders: new WeakMap() };
      indexes.set(variable.node, index);
    } else {
      index = existing;
    }
    for (const part of variable.path) {
      if (part.kind === "tuple" && (!Number.isSafeInteger(part.index) || part.index < 0)) {
        throw new Error("A Source tuple path requires a nonnegative safe integer position.");
      }
      const selected: PathIndex | undefined = part.kind === "binder" ? index.binders.get(part.declaration)
        : index.parts.get(pathKey(part));
      if (selected !== undefined) {
        index = selected;
        continue;
      }
      const child: PathIndex = { parts: new Map(), binders: new WeakMap() };
      if (part.kind === "binder") index.binders.set(part.declaration, child);
      else index.parts.set(pathKey(part), child);
      index = child;
    }
    if (index.slot === undefined) {
      const selected: TermSlot = { variable, rank: 0, parent: undefined, nodes: [], terms: [], structures: [], numeric: false, refusals: [] };
      index.slot = selected;
      slots.push(selected);
    }
    return index.slot;
  }
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
    return slot.structures.flatMap(term => term.kind === "array" ? [intern(term.element)]
      : term.kind === "optional" ? [intern(term.value)]
      : term.kind === "tuple" ? term.elements.map(element => intern(element.variable))
      : term.kind === "shape" ? term.members.map(member => intern(member.variable))
      : term.kind === "declared" ? term.typeArguments.map(intern) : []);
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
  function refuse(slot: TermSlot, refusal: SourceTypeFlowRefusal): void {
    const selected = root(slot);
    if (selected.refusals.length === 0) selected.refusals.push(refusal);
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
    if (derived.accumulator !== undefined) intern(derived.accumulator);
  }
  for (const call of graph.calls) {
    [...call.receiver, ...call.method].forEach(binder => intern(binder.variable));
    call.argumentPlaces.forEach(place => intern(place.value));
    if (call.result !== undefined) intern(call.result);
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
  const pendingInference = [...inference];
  for (let index = 0; index < pendingInference.length; index += 1) {
    for (const next of successors.get(pendingInference[index]!) ?? []) {
      if (inference.has(next)) continue;
      inference.add(next);
      pendingInference.push(next);
    }
  }
  function depth(slot: TermSlot, active = new Set<TermSlot>()): number {
    const selected = root(slot);
    if (active.has(selected)) return 5;
    const nested = children(selected);
    if (nested.length === 0) return 0;
    const next = new Set(active).add(selected);
    let maximum = 0;
    for (const child of nested) maximum = Math.max(maximum, depth(child, next));
    return 1 + maximum;
  }
  for (const slot of slots) {
    const selected = root(slot);
    if (depth(selected) > 4) refuse(selected,
      createSourceTypeFlowRefusal("TSONIC_LOCAL_TYPE_LIMIT", selected.variable.node));
  }
  const view = (slot: TermSlot): SourceTypeFlowTermGroup => {
    const selected = root(slot);
    return { variable: selected.variable, nodes: selected.nodes, terms: selected.terms, refusals: selected.refusals };
  };
  return Object.freeze({
    group: (variable: SourceTypeFlowVariable) => view(intern(variable)),
    groups: () => [...new Set(slots.map(root))].map(view),
    isInference: (variable: SourceTypeFlowVariable) => inference.has(root(intern(variable))),
    refuse: (variable: SourceTypeFlowVariable, refusal: SourceTypeFlowRefusal) => refuse(intern(variable), refusal),
  });
}

function structural(term: SourceTypeFlowTerm): term is Extract<SourceTypeFlowTerm, { kind: "array" | "shape" | "declared" | "tuple" | "optional" }> {
  return term.kind === "array" || term.kind === "shape" || term.kind === "declared" || term.kind === "tuple" || term.kind === "optional";
}

function pathKey(part: Exclude<SourceTypeFlowPathPart, { kind: "binder" }>): string {
  return part.kind === "element" ? "element" : part.kind === "optional-value" ? "optional-value"
    : part.kind === "tuple" ? `tuple:${part.index}` : `member:${part.name}`;
}
