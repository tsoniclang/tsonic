import type { CompareMemberKeys, TypeTerm, Signature, SignatureInput, TypeTable, TypePublication, Member, IndexSignature, TypeComponent,
  ComponentSelector, SumFamily, TypeProjection } from "./contract.js";
import type { TyId, SigId } from "../ids/contract.js";
import type { LimitStop, TypePublicationWork, PublicationResult } from "./work.js";
import { chargeCreated, chargeWork, createdLimit, workLimit } from "./work.js";
import { typeIdentifier, signatureIdentifier, required, compareText, compareIndexSignatures } from "./value.js";
import { typeText, signatureText, memberKeyText } from "./print.js";
import { readTypeData, readSignatureData } from "./publication-read.js";
import { copyType, copySignature } from "./copy.js";
import type { GraphIdentity } from "./arena.js";

export const compareMemberKeys: CompareMemberKeys = (left, right) =>
  compareText(memberKeyText(left), memberKeyText(right));

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
    if (value.kind === "resource-limit" || value.kind === "refused") return value;
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
  emit: (value: TypeTerm) => TyId | Stop, beforeMember: ((kind: "union" | "intersection", count: number) => Stop | null) | null): TyId | Stop;
export function normalizeType<Stop extends LimitStop>(term: TypeTerm, read: (type: TyId) => TypeTerm | Stop,
  emit: (value: TypeTerm) => TyId | Stop,
  beforeMember: ((kind: "union" | "intersection", count: number) => Stop | null) | null): TyId | Stop {
  switch (term.kind) {
    case "union": case "intersection": return compound(term.kind, term.members, read, emit, beforeMember);
    case "optional": {
      const selected = read(term.value);
      if (selected.kind === "resource-limit" || selected.kind === "refused") return selected;
      if (selected.kind === "optional") return term.value;
      if (selected.kind === "intrinsic" && (selected.intrinsic === "absence" || selected.intrinsic === "void" || selected.intrinsic === "never"))
        return emit({ kind: "intrinsic", intrinsic: "absence" });
      return emit(term);
    }
    case "shape": return emit({ ...term,
      members: [...term.members].sort((left, right) => compareMemberKeys(left.key, right.key)),
      indexes: [...term.indexes].sort(compareIndexSignatures),
      calls: orderedIds(term.calls), constructs: orderedIds(term.constructs) });
    case "callable": return emit(orderedTerm(term));
    case "source-environment": return emit({ ...term,
      members: [...term.members].sort((left, right) => compareMemberKeys(left.key, right.key)) });
    case "primitive": case "string": case "intrinsic": case "enum": case "param": case "self": case "open": case "error":
    case "literal": case "array": case "fixed-array": case "tuple": case "declared": case "merged-interface":
    case "merged-parameter": case "construction-reference":
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
        case "index-key": case "index-value": frame.path.push({ ...value, key: typeOf(value.key) }); break;
        case "parameter": case "receiver": case "result": case "signature-tail":
          frame.path.push({ ...value, signature: signatureOf(value.signature) }); break;
        case "sum-arm":
          frame = { kind: "nested", value: value.family.component, remaining: value.family.component.path.values(),
            path: [], parent: frame, family: value.family, index: value.index }; break;
        case "class-value": case "optional-value": case "array-element": case "intersection-result": case "projection-source":
        case "awaited": case "construction-argument": case "tuple-element": case "union-member": case "argument-place":
        case "parameter-place": case "intersection-member": case "argument-tail": case "parameter-tail": case "member":
        case "tuple-slice": case "type-argument": frame.path.push(value);
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

export function remapConditional(source: TyId, projection: Extract<TypeProjection, { readonly kind: "conditional" }>,
  typeOf: (value: TyId, role: 0 | 1 | 2 | 3) => TyId): TypeTerm {
  return { kind: "projection", source: typeOf(source, 0), projection: { ...projection,
    extends: typeOf(projection.extends, 1), whenTrue: typeOf(projection.whenTrue, 2), whenFalse: typeOf(projection.whenFalse, 3) } };
}

export function remapTerm(value: TypeTerm, typeOf: (value: TyId) => TyId, signatureOf: (value: SigId) => SigId): TypeTerm {
  const member = (selected: Member): Member => ({ ...selected,
    read: selected.read === null ? null : typeOf(selected.read), write: selected.write === null ? null : typeOf(selected.write) });
  const index = (selected: IndexSignature): IndexSignature => ({ ...selected, key: typeOf(selected.key), read: typeOf(selected.read),
    write: selected.write === null ? null : typeOf(selected.write) });
  switch (value.kind) {
    case "primitive": case "string": case "intrinsic": case "enum": case "param": case "self": case "open": case "error":
    case "source-environment": case "merged-parameter": return value;
    case "literal": return { ...value, base: typeOf(value.base) };
    case "union": case "intersection": return { ...value, members: value.members.map(typeOf) };
    case "optional": return { ...value, value: typeOf(value.value) };
    case "array": case "fixed-array": return { ...value, element: typeOf(value.element) };
    case "tuple": return { ...value, elements: value.elements.map(element => ({ ...element, type: typeOf(element.type) })) };
    case "shape": return { ...value, members: value.members.map(member), indexes: value.indexes.map(index).sort(compareIndexSignatures),
      calls: value.calls.map(signatureOf), constructs: value.constructs.map(signatureOf) };
    case "callable": return { ...value, calls: value.calls.map(signatureOf), constructs: value.constructs.map(signatureOf) };
    case "declared": case "merged-interface": case "construction-reference": return { ...value, arguments: value.arguments.map(typeOf) };
    case "projection": {
      const projection = value.projection;
      if (projection.kind === "conditional") return remapConditional(value.source, projection, typeOf);
      const source = typeOf(value.source);
      switch (projection.kind) {
        case "awaited": case "keyof": return { ...value, source, projection };
        case "indexed": return { ...value, source, projection: { kind: projection.kind, index: typeOf(projection.index) } };
        case "substitution": return { ...value, source, projection: { kind: projection.kind, constraint: typeOf(projection.constraint) } };
        case "component": return { ...value, source, projection: { kind: projection.kind, component: remapComponent(projection.component, typeOf, signatureOf) } };
      }
    }
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

export interface GraphReference extends GraphIdentity {
  readonly role: number;
}
export interface GraphDescription { readonly label: string; readonly references: readonly GraphReference[] }
export interface DescribedGraphRow { readonly data: GraphValue; readonly description: GraphDescription }
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

export function readGraphValue(data: GraphValue, work: TypePublicationWork): PublicationResult<GraphValue> {
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

function projectGraphReferences(data: GraphValue): { readonly shape: GraphValue; readonly references: readonly GraphReference[] } {
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
    const shape: GraphValue = { kind: "type", value: remapTerm(value, typeOf, signatureOf) };
    return { shape, references: [...references, ...setReferences] };
  }
  const value = data.value;
  const composition = value.composition === null ? null
    : { ...value.composition, signatures: signatureSet(value.composition.signatures, -4) };
  const shape: GraphValue = { kind: "signature", value: remapSignature({ ...value, composition }, typeOf, signatureOf) };
  return { shape, references: [...setReferences, ...references] };
}

export function graphReferences(data: GraphValue): readonly GraphReference[] {
  return projectGraphReferences(data).references;
}

export function inspectGraphValue(data: GraphValue): GraphDescription {
  const { shape, references } = projectGraphReferences(data);
  const label = shape.kind === "type" ? `type:${typeText(shape.value)}` : `signature:${signatureText(shape.value)}`;
  return { label, references };
}

function connect(source: GraphNode, target: GraphNode, role: number): void {
  let counts = source.counts.get(role);
  if (counts === undefined) { counts = new Map(); source.counts.set(role, counts); }
  const edge: GraphEdge = { source, target, role, counts };
  source.outgoing.push(edge);
  target.incoming.push(edge);
}

function graph(table: TypeTable, work: TypePublicationWork): PublicationResult<{
  readonly types: readonly GraphNode[]; readonly signatures: readonly GraphNode[];
}> {
  if (!chargeWork(work, table.terms.length + table.signatures.length)) return workLimit(work);
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

function refine<Stop extends LimitStop>(nodes: readonly GraphNode[], admit: (count: number) => Stop | null):
  { readonly kind: "complete"; readonly value: readonly Block[] } | Stop {
  const sorting = admit(nodes.length);
  if (sorting !== null) return sorting;
  const blocks: Block[] = [];
  let current: Block | null = null;
  let label: string | null = null;
  for (const node of [...nodes].sort((left, right) => compareText(left.label, right.label))) {
    const stop = admit(1);
    if (stop !== null) return stop;
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
    const stop = admit(1);
    if (stop !== null) return stop;
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
        const stop = admit(1);
        if (stop !== null) return stop;
        let sources = predecessors.get(edge.role);
        if (sources === undefined) { sources = new Map(); predecessors.set(edge.role, sources); }
        sources.set(edge.source.id, edge.source);
      }
      predicates(predecessors);
      continue;
    }
    const intersections = new Map<number, { readonly block: Block; readonly inside: Map<number, GraphNode> }>();
    for (const node of selected.nodes.values()) {
      const stop = admit(1);
      if (stop !== null) return stop;
      let intersection = intersections.get(node.block.id);
      if (intersection === undefined) { intersection = { block: node.block, inside: new Map() }; intersections.set(node.block.id, intersection); }
      intersection.inside.set(node.id, node);
    }
    for (const id of orderedNumbers(intersections.keys())) {
      const { block, inside } = required(intersections, id);
      if (inside.size === block.nodes.size) continue;
      const step = admit(inside.size <= block.nodes.size / 2 ? inside.size : block.nodes.size);
      if (step !== null) return step;
      const moved = inside.size <= block.nodes.size / 2 ? inside
        : new Map([...block.nodes].filter(([identity]) => !inside.has(identity)));
      const small: Block = { id: blocks.length, nodes: moved };
      blocks.push(small);
      for (const node of moved.values()) { block.nodes.delete(node.id); node.block = small; }
      const affected = new Map<number, Map<number, GraphNode>>();
      for (const node of moved.values()) for (const edge of node.incoming) {
        const stop = admit(1);
        if (stop !== null) return stop;
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

export function stagedEquivalences<Stop extends LimitStop>(
  roots: readonly GraphIdentity[],
  read: (identity: GraphIdentity) => DescribedGraphRow | Stop,
  candidates: (label: string) => readonly GraphIdentity[],
  committed: (identity: GraphIdentity) => boolean,
  admit: (count: number) => Stop | null,
): { readonly kind: "complete"; readonly value: readonly { readonly from: GraphIdentity; readonly to: GraphIdentity }[] } | Stop {
  interface StagedGraphNode extends GraphNode {
    readonly identity: GraphIdentity;
    readonly references: GraphDescription["references"];
  }
  const start = admit(roots.length + 5);
  if (start !== null) return start;
  const initial: Block = { id: 0, nodes: new Map() };
  const pending: GraphIdentity[] = [];
  const types = new Map<number, number>();
  const signatures = new Map<number, number>();
  const positions = (identity: GraphIdentity) => identity.kind === "type" ? types : signatures;
  const select = (identity: GraphIdentity): void => {
    const index = positions(identity);
    if (index.has(identity.identity)) return;
    index.set(identity.identity, pending.length);
    pending.push(identity);
  };
  for (const root of roots) select(root);
  const graphNodes: StagedGraphNode[] = [];
  const labels = new Set<string>();
  for (const identity of pending) {
    const step = admit(2);
    if (step !== null) return step;
    const value = read(identity);
    if ("kind" in value) return value;
    const { description, data } = value;
    const growth = admit(description.references.length + 1);
    if (growth !== null) return growth;
    graphNodes.push({ id: graphNodes.length, data, label: description.label, block: initial,
      incoming: [], outgoing: [], counts: new Map(), identity, references: description.references });
    if (!committed(identity) && !labels.has(description.label)) {
      labels.add(description.label);
      const matching = candidates(description.label);
      for (let position = 0; position < matching.length; position++) {
        const step = admit(1);
        if (step !== null) return step;
        const candidate = matching[position];
        if (candidate === undefined) throw new TypeError("A committed label bucket is dense.");
        select(candidate);
      }
    }
    for (const edge of description.references) select(edge);
  }
  for (const node of graphNodes) {
    const step = admit(1);
    if (step !== null) return step;
    for (const edge of node.references) {
      const step = admit(1);
      if (step !== null) return step;
      const target = graphNodes[required(positions(edge), edge.identity)];
      if (target === undefined) throw new TypeError("A selected graph is reference-closed.");
      connect(node, target, edge.role);
    }
  }
  const refined = refine(graphNodes, admit);
  if (refined.kind !== "complete") return refined;
  const representatives = new Map<number, GraphIdentity>();
  for (const node of graphNodes) {
    const step = admit(1);
    if (step !== null) return step;
    const previous = representatives.get(node.block.id);
    if (previous === undefined || node.identity.identity < previous.identity)
      representatives.set(node.block.id, node.identity);
  }
  const redirects: { readonly from: GraphIdentity; readonly to: GraphIdentity }[] = [];
  for (const node of graphNodes) {
    const step = admit(1);
    if (step !== null) return step;
    const representative = required(representatives, node.block.id);
    if (representative.identity === node.identity.identity) continue;
    if (committed(node.identity)) throw new TypeError("A closed admission cannot collapse admitted representatives.");
    redirects.push({ from: node.identity, to: representative });
  }
  return { kind: "complete", value: redirects };
}

function structuralKey(node: GraphNode, work: TypePublicationWork): PublicationResult<string> {
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

export function canonicalTypes(input: TypePublication, work: TypePublicationWork): PublicationResult<TypePublication> {
  const selected = graph(input.table, work);
  if (selected.kind === "resource-limit") return selected;
  const arena = selected.value;
  const canonical = [...arena.types, ...arena.signatures];
  const refinement = refine(canonical, count => chargeWork(work, count) ? null : workLimit(work));
  if (refinement.kind === "resource-limit") return refinement;
  const ordered: { readonly node: GraphNode; readonly key: string }[] = [];
  for (const node of canonical) {
    const key = structuralKey(node, work);
    if (key.kind === "resource-limit") return key;
    ordered.push({ node, key: key.value });
  }
  if (!chargeWork(work, ordered.length)) return workLimit(work);
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
    if (!chargeCreated(work, 1 + node.outgoing.length)) return createdLimit(work);
    switch (node.data.kind) {
      case "type": terms.push(orderedTerm(remapTerm(node.data.value, typeOf, signatureOf))); break;
      case "signature": rows.push({ id: signatureIdentifier(rows.length), ...orderedSignature(remapSignature(node.data.value, typeOf, signatureOf)) }); break;
    }
  }
  if (!chargeWork(work, input.types.length + input.signatures.length)) return workLimit(work);
  return { kind: "complete", value: ({ table: { terms: terms.map(copyType), signatures: rows.map(copySignature) },
    types: (input.types.map(typeOf)), signatures: (input.signatures.map(signatureOf)) }) };
}
