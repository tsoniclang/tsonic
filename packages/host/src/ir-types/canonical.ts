import type { TypeTerm, Signature, SignatureInput, TypeTable, TypePublication, Member, IndexSignature, TypeComponent,
  ComponentSelector, SumFamily } from "./contract.js";
import type { TyId, SigId } from "../ids/contract.js";
import type { LimitStop, PublicationWork, PublicationResult } from "./work.js";
import { chargeWork, workLimit } from "./work.js";
import { typeIdentifier, signatureIdentifier, required, compareText } from "./value.js";
import { typeText, signatureText, memberKeyText } from "./print.js";
import { readTypeData, readSignatureData } from "./publication-read.js";
import { copyType, copySignature } from "./copy.js";

function compound<Stop extends LimitStop>(kind: "union" | "intersection", initial: readonly TyId[],
  read: (type: TyId) => TypeTerm | Stop, emit: (value: TypeTerm) => TyId | Stop,
  beforeMember: ((kind: "union" | "intersection", count: number) => Stop | null) | null): TyId | Stop {
  const work = [...initial];
  const expanded = new Set<TyId>();
  const members = new Set<TyId>();
  let absence = false;
  for (const type of work) {
    if (expanded.has(type)) continue;
    expanded.add(type);
    const value = read(type);
    if (value.kind === "resource-limit") return value;
    if (value.kind === kind) for (const member of value.members) work.push(member);
    else if (kind === "union" && value.kind === "optional") { absence = true; work.push(value.value); }
    else if (kind === "union" && value.kind === "intrinsic" && (value.intrinsic === "absence" || value.intrinsic === "void")) absence = true;
    else if (!(kind === "union" && value.kind === "intrinsic" && value.intrinsic === "never") && !members.has(type)) {
      if (beforeMember !== null) {
        const stop = beforeMember(kind, members.size + 1);
        if (stop !== null) return stop;
      }
      members.add(type);
    }
  }
  const ordered = orderedIds(members);
  const first = ordered[0];
  if (first === undefined) {
    if (kind === "intersection") throw new Error("ir-types: an intersection requires at least one constituent.");
    return emit({ kind: "intrinsic", intrinsic: absence ? "absence" : "never" });
  }
  const base = ordered.length === 1 ? first : emit({ kind, members: ordered });
  if (typeof base !== "number") return base;
  return absence ? emit({ kind: "optional", value: base }) : base;
}

export function normalizeType(term: TypeTerm, read: (type: TyId) => TypeTerm, emit: (value: TypeTerm) => TyId,
  beforeMember: null): TyId;
export function normalizeType<Stop extends LimitStop>(term: TypeTerm, read: (type: TyId) => TypeTerm | Stop,
  emit: (value: TypeTerm) => TyId | Stop, beforeMember: (kind: "union" | "intersection", count: number) => Stop | null): TyId | Stop;
export function normalizeType<Stop extends LimitStop>(term: TypeTerm, read: (type: TyId) => TypeTerm | Stop,
  emit: (value: TypeTerm) => TyId | Stop,
  beforeMember: ((kind: "union" | "intersection", count: number) => Stop | null) | null): TyId | Stop {
  switch (term.kind) {
    case "union": case "intersection": return compound(term.kind, term.members, read, emit, beforeMember);
    case "optional": {
      const selected = read(term.value);
      if (selected.kind === "resource-limit") return selected;
      if (selected.kind === "optional") return term.value;
      if (selected.kind === "intrinsic" && (selected.intrinsic === "absence" || selected.intrinsic === "void" || selected.intrinsic === "never"))
        return emit({ kind: "intrinsic", intrinsic: "absence" });
      return emit(term);
    }
    case "shape": return emit({ ...term,
      members: [...term.members].sort((left, right) => compareText(memberKeyText(left.key), memberKeyText(right.key))),
      indexes: [...term.indexes].sort((left, right) => compareText(left.declaration, right.declaration)),
      calls: orderedIds(term.calls), constructs: orderedIds(term.constructs) });
    case "callable": return emit(orderedTerm(term));
    case "primitive": case "string": case "intrinsic": case "enum": case "param": case "self": case "open": case "error":
    case "literal": case "array": case "fixed-array": case "tuple": case "declared": case "construction-reference":
    case "projection": return emit(term);
  }
}

function remapComponent(root: TypeComponent, typeOf: (value: TyId) => TyId, signatureOf: (value: SigId) => SigId): TypeComponent {
  interface FrameBase {
    readonly value: TypeComponent;
    readonly remaining: Iterator<ComponentSelector>;
    readonly path: ComponentSelector[];
  }
  type Frame = FrameBase & ({ readonly kind: "root" }
    | { readonly kind: "nested"; readonly parent: Frame; readonly family: SumFamily; readonly index: number });
  let frame: Frame = { kind: "root", value: root, remaining: root.path.values(), path: [] };
  for (;;) {

    const selected: IteratorResult<ComponentSelector> = frame.remaining.next();
    if (!selected.done) {
      const value: ComponentSelector = selected.value;
      switch (value.kind) {
        case "parameter": case "receiver": case "result": case "signature-tail":
          frame.path.push({ ...value, signature: signatureOf(value.signature) }); break;
        case "sum-arm":
          frame = { kind: "nested", value: value.family.component, remaining: value.family.component.path.values(),
            path: [], parent: frame, family: value.family, index: value.index }; break;
        case "class-value": case "optional-value": case "array-element": case "intersection-result": case "projection-source":
        case "awaited": case "construction-argument": case "tuple-element": case "union-member": case "argument-place":
        case "parameter-place": case "intersection-member": case "argument-tail": case "parameter-tail": case "member":
        case "index-key": case "index-value": case "tuple-slice": case "type-argument": frame.path.push(value);
      }
      continue;
    }
    const component: TypeComponent = { ...frame.value, path: frame.path };
    if (frame.kind === "root") return component;
    const parent: Frame = frame.parent;

    const family: SumFamily = { ...frame.family, component,
      roles: frame.family.roles.map(role => ({ ...role, member: typeOf(role.member) })) };
    parent.path.push({ kind: "sum-arm", family, index: frame.index });
    frame = parent;
  }
}

export function remapSignature(value: SignatureInput, typeOf: (value: TyId) => TyId,
  signatureOf: (value: SigId) => SigId): SignatureInput {

  return {
    declaration: value.declaration, owner: value.owner,
    composition: value.composition === null ? null : { ...value.composition, signatures: value.composition.signatures.map(signatureOf) },
    kind: value.kind,
    typeParameters: value.typeParameters.map(parameter => ({ ...parameter,
      constraint: parameter.constraint === null ? null : typeOf(parameter.constraint),
      default: parameter.default === null ? null : typeOf(parameter.default) })),
    receiver: value.receiver === null ? null : typeOf(value.receiver),
    parameters: value.parameters.map(parameter => ({ ...parameter, type: typeOf(parameter.type) })),
    result: typeOf(value.result),
  };
}

export function remapTerm(value: TypeTerm, typeOf: (value: TyId) => TyId, signatureOf: (value: SigId) => SigId): TypeTerm {
  const member = (selected: Member): Member => ({ ...selected,
    read: selected.read === null ? null : typeOf(selected.read), write: selected.write === null ? null : typeOf(selected.write) });
  const index = (selected: IndexSignature): IndexSignature => ({ ...selected, key: typeOf(selected.key), read: typeOf(selected.read),
    write: selected.write === null ? null : typeOf(selected.write) });
  switch (value.kind) {
    case "primitive": case "string": case "intrinsic": case "enum": case "param": case "self": case "open": case "error": return value;
    case "literal": return { ...value, base: typeOf(value.base) };
    case "union": case "intersection": return { ...value, members: value.members.map(typeOf) };
    case "optional": return { ...value, value: typeOf(value.value) };
    case "array": case "fixed-array": return { ...value, element: typeOf(value.element) };
    case "tuple": return { ...value, elements: value.elements.map(element => ({ ...element, type: typeOf(element.type) })) };
    case "shape": return { ...value, members: value.members.map(member), indexes: value.indexes.map(index),
      calls: value.calls.map(signatureOf), constructs: value.constructs.map(signatureOf) };
    case "callable": return { ...value, calls: value.calls.map(signatureOf), constructs: value.constructs.map(signatureOf) };
    case "declared": case "construction-reference": return { ...value, arguments: value.arguments.map(typeOf) };
    case "projection": return { ...value, source: typeOf(value.source), projection: value.projection.kind === "awaited" ? value.projection
      : { kind: "component", component: remapComponent(value.projection.component, typeOf, signatureOf) } };
  }
}

function orderedIds<Identity extends number>(values: Iterable<Identity>): readonly Identity[] {
  const members = new Set<Identity>();
  for (const value of values) { members.add(value); }

  return [...members].sort((left, right) => left - right);
}

export function orderedTerm(value: TypeTerm): TypeTerm {
  if (value.kind === "union" || value.kind === "intersection")
    return { ...value, members: orderedIds(value.members) };
  if (value.kind === "shape" || value.kind === "callable") return { ...value,
    calls: orderedIds(value.calls), constructs: orderedIds(value.constructs) };
  return value;
}

export function orderedSignature(value: SignatureInput): SignatureInput {
  return value.composition === null ? value : { ...value, composition: { ...value.composition,
    signatures: orderedIds(value.composition.signatures) } };
}

export type GraphValue = { readonly kind: "type"; readonly value: TypeTerm }
  | { readonly kind: "signature"; readonly value: SignatureInput };

export interface GraphReference {
  readonly kind: "type" | "signature";
  readonly identity: number;
  readonly role: number;
}
export interface GraphDescription { readonly label: string; readonly references: readonly GraphReference[] }
interface Block { readonly id: number; readonly nodes: Map<number, GraphNode> }
interface GraphNode {
  readonly id: number;
  readonly data: GraphValue;
  label: string;
  block: Block;
  readonly incoming: GraphEdge[];
  readonly outgoing: GraphEdge[];
  readonly counts: Map<number, Map<number, number>>;
}
interface GraphEdge {
  readonly source: GraphNode;
  readonly target: GraphNode;
  readonly role: number;
  readonly counts: Map<number, number>;
}
type Refinement = { readonly kind: "splitter"; readonly block: Block }
  | { readonly kind: "predicate"; readonly nodes: ReadonlyMap<number, GraphNode> };
interface WorkLink { readonly value: Refinement; next: WorkLink | null }

export function readGraphValue(data: GraphValue, work: PublicationWork): PublicationResult<GraphValue> {
  if (data.kind === "type") {
    const selected = readTypeData(data.value, work, "read");
    return selected.kind === "resource-limit" ? selected : { kind: "complete", value: { kind: "type", value: selected.value } };
  }
  const value: SignatureInput = { declaration: data.value.declaration, owner: data.value.owner, composition: data.value.composition,
    kind: data.value.kind, typeParameters: data.value.typeParameters, receiver: data.value.receiver,
    parameters: data.value.parameters, result: data.value.result };
  const selected = readSignatureData(value, work, "read");
  return selected.kind === "resource-limit" ? selected : { kind: "complete", value: { kind: "signature", value: selected.value } };
}

export function inspectGraphValue(data: GraphValue): GraphDescription {
  let position = 0;
  const references: GraphReference[] = [];
  const setReferences: GraphReference[] = [];
  const typeOf = (value: TyId): TyId => {
    references.push({ kind: "type", identity: value, role: position++ });
    return typeIdentifier(0);
  };
  const signatureOf = (value: SigId): SigId => {
    references.push({ kind: "signature", identity: value, role: position++ });
    return signatureIdentifier(0);
  };
  const typeSet = (values: readonly TyId[], role: number): readonly TyId[] => {
    for (const identity of values) setReferences.push({ kind: "type", identity, role });
    return [];
  };
  const signatureSet = (values: readonly SigId[], role: number): readonly SigId[] => {
    for (const identity of values) setReferences.push({ kind: "signature", identity, role });
    return [];
  };
  if (data.kind === "type") {
    let value = data.value;
    if (value.kind === "union" || value.kind === "intersection") value = { ...value, members: typeSet(value.members, -1) };
    else if (value.kind === "shape" || value.kind === "callable") value = { ...value,
      calls: signatureSet(value.calls, -2), constructs: signatureSet(value.constructs, -3) };
    const label = `type:${typeText(remapTerm(value, typeOf, signatureOf))}`;
    return { label, references: [...references, ...setReferences] };
  }
  const value = data.value;
  const composition = value.composition === null ? null
    : { ...value.composition, signatures: signatureSet(value.composition.signatures, -4) };
  const label = `signature:${signatureText(remapSignature({ ...value, composition }, typeOf, signatureOf))}`;
  return { label, references: [...setReferences, ...references] };
}

function connect(source: GraphNode, target: GraphNode, role: number): void {
  let counts = source.counts.get(role);
  if (counts === undefined) { counts = new Map(); source.counts.set(role, counts); }
  const edge: GraphEdge = { source, target, role, counts };
  source.outgoing.push(edge);
  target.incoming.push(edge);
}

function graph(table: TypeTable, work: PublicationWork): PublicationResult<{
  readonly types: readonly GraphNode[]; readonly signatures: readonly GraphNode[];
}> {
  const initial: Block = { id: 0, nodes: new Map() };
  const node = (data: GraphValue, id: number): GraphNode => ({ id, data, label: "", block: initial,
    incoming: [], outgoing: [], counts: new Map() });
  const types = table.terms.map((value, position) => node({ kind: "type", value }, position));
  const signatures = table.signatures.map((value, position) => node({ kind: "signature", value }, table.terms.length + position));
  const typeNodes = new Map(types.map((value, position) => [position, value]));
  const signatureNodes = new Map(signatures.map((value, position) => [position, value]));
  const reference = (nodes: ReadonlyMap<number, GraphNode>, value: number): GraphNode => {
    if (!Number.isSafeInteger(value) || value < 0 || Object.is(value, -0))
      throw new Error("Canonical publication requires an issued nonnegative arena reference.");
    return required(nodes, value);
  };
  for (const values of [types, signatures]) for (const selected of values) {
    const checked = readGraphValue(selected.data, work);
    if (checked.kind === "resource-limit") return checked;
    const description = inspectGraphValue(checked.value);
    selected.label = description.label;
    for (const edge of description.references) {
      if (!chargeWork(work, 1)) return workLimit(work);
      connect(selected, reference(edge.kind === "type" ? typeNodes : signatureNodes, edge.identity), edge.role);
    }
  }
  return { kind: "complete", value: { types, signatures } };
}

function orderedNumbers(values: Iterable<number>): readonly number[] {
  return [...values].sort((left, right) => left - right);
}

function refine(nodes: readonly GraphNode[], budget: PublicationWork): PublicationResult<readonly Block[]> {
  const blocks: Block[] = [];
  let current: Block | null = null;
  let label: string | null = null;
  for (const node of [...nodes].sort((left, right) => compareText(left.label, right.label))) {
    if (!chargeWork(budget, 1)) return workLimit(budget);
    if (current === null || node.label !== label) {
      current = { id: blocks.length, nodes: new Map() };
      blocks.push(current);
      label = node.label;
    }
    current.nodes.set(node.id, node);
    node.block = current;
    for (const counts of node.counts.values()) counts.clear();
  }
  for (const node of nodes) for (const edge of node.outgoing) {
    if (!chargeWork(budget, 1)) return workLimit(budget);
    edge.counts.set(edge.target.block.id, (edge.counts.get(edge.target.block.id) ?? 0) + 1);
  }
  const queue: { head: WorkLink | null; tail: WorkLink | null } = { head: null, tail: null };
  const push = (value: Refinement): void => {
    const link: WorkLink = { value, next: null };
    if (queue.tail === null) queue.head = link;
    else queue.tail.next = link;
    queue.tail = link;
  };
  const queued = new Set<number>();
  const splitLater = (block: Block): void => {
    if (!queued.has(block.id)) { queued.add(block.id); push({ kind: "splitter", block }); }
  };
  const predicates = (byRole: ReadonlyMap<number, ReadonlyMap<number, GraphNode>>): void => {
    for (const role of orderedNumbers(byRole.keys())) push({ kind: "predicate", nodes: required(byRole, role) });
  };
  for (const block of blocks) splitLater(block);
  while (queue.head !== null) {
    const selected = queue.head.value;
    queue.head = queue.head.next;
    if (queue.head === null) queue.tail = null;
    if (selected.kind === "splitter") {
      queued.delete(selected.block.id);
      const predecessors = new Map<number, Map<number, GraphNode>>();
      for (const node of selected.block.nodes.values()) for (const edge of node.incoming) {
        if (!chargeWork(budget, 1)) return workLimit(budget);
        let sources = predecessors.get(edge.role);
        if (sources === undefined) { sources = new Map(); predecessors.set(edge.role, sources); }
        sources.set(edge.source.id, edge.source);
      }
      predicates(predecessors);
      continue;
    }
    const intersections = new Map<number, { readonly block: Block; readonly inside: Map<number, GraphNode> }>();
    for (const node of selected.nodes.values()) {
      if (!chargeWork(budget, 1)) return workLimit(budget);
      let intersection = intersections.get(node.block.id);
      if (intersection === undefined) { intersection = { block: node.block, inside: new Map() }; intersections.set(node.block.id, intersection); }
      intersection.inside.set(node.id, node);
    }
    for (const id of orderedNumbers(intersections.keys())) {
      const { block, inside } = required(intersections, id);
      if (inside.size === block.nodes.size) continue;
      const moved = inside.size <= block.nodes.size / 2 ? inside
        : new Map([...block.nodes].filter(([identity]) => !inside.has(identity)));
      const small: Block = { id: blocks.length, nodes: moved };
      blocks.push(small);
      for (const node of moved.values()) { block.nodes.delete(node.id); node.block = small; }
      const affected = new Map<number, Map<number, GraphNode>>();
      for (const node of moved.values()) for (const edge of node.incoming) {
        if (!chargeWork(budget, 1)) return workLimit(budget);
        const remaining = required(edge.counts, block.id) - 1;
        if (remaining === 0) edge.counts.delete(block.id);
        else edge.counts.set(block.id, remaining);
        edge.counts.set(small.id, (edge.counts.get(small.id) ?? 0) + 1);
        let sources = affected.get(edge.role);
        if (sources === undefined) { sources = new Map(); affected.set(edge.role, sources); }
        sources.set(edge.source.id, edge.source);
      }
      const smallOnly = new Map<number, Map<number, GraphNode>>();
      for (const [role, sources] of affected) {
        const selected = new Map<number, GraphNode>();
        for (const source of sources.values()) if (!required(source.counts, role).has(block.id)) selected.set(source.id, source);
        if (selected.size > 0) smallOnly.set(role, selected);
      }
      predicates(smallOnly);
      splitLater(small);
    }
  }
  return { kind: "complete", value: blocks };
}

function structuralKey(node: GraphNode, work: PublicationWork): PublicationResult<string> {
  if (!chargeWork(work, 1)) return workLimit(work);
  const roles = new Map<number, number[]>();
  for (const edge of node.outgoing) {
    if (!chargeWork(work, 1)) return workLimit(work);
    const targets = roles.get(edge.role);
    if (targets === undefined) roles.set(edge.role, [edge.target.block.id]);
    else targets.push(edge.target.block.id);
  }
  const ordered: (readonly [number, number])[] = [];
  for (const role of orderedNumbers(roles.keys()))
    for (const target of orderedNumbers(required(roles, role))) ordered.push([role, target]);
  return { kind: "complete", value: JSON.stringify([node.label, ordered]) };
}

export interface TypePartition { readonly types: readonly TyId[]; readonly signatures: readonly SigId[] }

export function partitionTypes(table: TypeTable, work: PublicationWork): PublicationResult<TypePartition> {
  const selected = graph(table, work);
  if (selected.kind === "resource-limit") return selected;
  const arena = selected.value;
  const refinement = refine([...arena.types, ...arena.signatures], work);
  if (refinement.kind === "resource-limit") return refinement;
  const types = new Map<number, TyId>();
  const signatures = new Map<number, SigId>();
  for (const [position, node] of arena.types.entries())
    if (!types.has(node.block.id)) types.set(node.block.id, typeIdentifier(position));
  for (const [position, node] of arena.signatures.entries())
    if (!signatures.has(node.block.id)) signatures.set(node.block.id, signatureIdentifier(position));
  return { kind: "complete", value: { types: arena.types.map(node => required(types, node.block.id)),
    signatures: arena.signatures.map(node => required(signatures, node.block.id)) } };
}

export function canonicalTypes(input: TypePublication, work: PublicationWork): PublicationResult<TypePublication> {
  const selected = graph(input.table, work);
  if (selected.kind === "resource-limit") return selected;
  const arena = selected.value;
  const canonical = [...arena.types, ...arena.signatures];
  const refinement = refine(canonical, work);
  if (refinement.kind === "resource-limit") return refinement;
  const ordered: { readonly node: GraphNode; readonly key: string }[] = [];
  for (const node of canonical) {
    const key = structuralKey(node, work);
    if (key.kind === "resource-limit") return key;
    ordered.push({ node, key: key.value });
  }
  ordered.sort((left, right) => compareText(left.key, right.key));
  const types = ordered.filter(entry => entry.node.data.kind === "type");
  const signatures = ordered.filter(entry => entry.node.data.kind === "signature");
  const typeIds = new Map(types.map(({ node }, position) => [node.id, typeIdentifier(position)]));
  const signatureIds = new Map(signatures.map(({ node }, position) => [node.id, signatureIdentifier(position)]));
  const oldTypes = new Map(arena.types.map((node, position) => [position, required(typeIds, node.id)]));
  const oldSignatures = new Map(arena.signatures.map((node, position) => [position, required(signatureIds, node.id)]));
  const typeOf = (value: TyId): TyId => required(oldTypes, value);
  const signatureOf = (value: SigId): SigId => required(oldSignatures, value);
  const terms: TypeTerm[] = [];
  const rows: Signature[] = [];
  for (const { node } of ordered) {
    if (!chargeWork(work, node.outgoing.length)) return workLimit(work);
    switch (node.data.kind) {
      case "type": terms.push(orderedTerm(remapTerm(node.data.value, typeOf, signatureOf))); break;
      case "signature": rows.push({ id: signatureIdentifier(rows.length), ...orderedSignature(remapSignature(node.data.value, typeOf, signatureOf)) }); break;
    }
  }
  if (!chargeWork(work, input.types.length + input.signatures.length)) return workLimit(work);
  return { kind: "complete", value: ({ table: { terms: terms.map(copyType), signatures: rows.map(copySignature) },
    types: (input.types.map(typeOf)), signatures: (input.signatures.map(signatureOf)) }) };
}
