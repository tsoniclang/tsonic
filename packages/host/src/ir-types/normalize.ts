import type { TypeTable, TypePublication, TypeTerm, Signature } from "./contract.js";
import type { TyId, SigId } from "../ids/contract.js";
import type { GraphValue, TypePartition } from "./canonical.js";
import type { PublicationWork, PublicationResult, PublicationStop } from "./work.js";
import { chargeWork, chargeCreated, workLimit, createdLimit } from "./work.js";
import { readTypeData, readSignatureData } from "./publication-read.js";
import { inspectGraphValue, readGraphValue, normalizeType, orderedSignature, orderedTerm,
  remapSignature, remapTerm } from "./canonical.js";
import { typeIdentifier, signatureIdentifier, required } from "./value.js";

interface Class {
  readonly serial: number;
  readonly identity: number;
  data: GraphValue;
  parent: Class | null;
  size: number;
  label: string;
  edges: ReadonlyMap<number, ReadonlyMap<number, Class>>;
  readonly parents: Map<number, Class>;
}

interface View {
  readonly data: GraphValue;
  readonly label: string;
  readonly key: string;
  readonly edges: ReadonlyMap<number, ReadonlyMap<number, Class>>;
}

interface Pair {
  readonly left: Class;
  readonly right: Class;
  readonly leftView: View;
  readonly rightView: View;
  readonly dependents: Requirement[];
  valid: boolean;
}

interface Requirement { readonly owner: Pair; remaining: number }
interface Job { readonly node: Class; propagate: boolean; next: Job | null }
interface RepairJob { readonly node: Class; next: RepairJob | null }

interface Normalization {
  readonly work: PublicationWork;
  readonly types: Map<number, Class>;
  readonly signatures: Map<number, Class>;
  readonly typeValues: Map<number, TypeTerm>;
  readonly classes: Map<number, Class>;
  readonly labels: Map<string, Map<number, Class>>;
  readonly views: Map<number, { readonly epoch: number; readonly value: View }>;
  head: Job | null;
  tail: Job | null;
  readonly queued: Map<number, Job>;
  repairHead: RepairJob | null;
  repairTail: RepairJob | null;
  readonly repairQueued: Set<number>;
  readonly propagated: Map<number, number>;
  readonly repaired: Map<number, number>;
  readonly failed: Map<number, Map<number, number>>;
  epoch: number;
  serial: number;
}


function root(value: Class): Class {
  let selected = value;
  while (selected.parent !== null) selected = selected.parent;
  let current = value;
  while (current.parent !== null && current.parent !== selected) {
    const next = current.parent;
    current.parent = selected;
    current = next;
  }
  return selected;
}

function describe(state: Normalization, value: GraphValue): PublicationResult<View> {
  const checked = readGraphValue(value, state.work);
  if (checked.kind === "resource-limit") return checked;
  const description = inspectGraphValue(checked.value);
  if (!chargeWork(state.work, description.references.length)) return workLimit(state.work);
  const types = new Map<number, Class>();
  const signatures = new Map<number, Class>();
  const edges = new Map<number, Map<number, Class>>();
  for (const reference of description.references) {
    const target = root(required(reference.kind === "type" ? state.types : state.signatures, reference.identity));
    (reference.kind === "type" ? types : signatures).set(reference.identity, target);
    let selected = edges.get(reference.role);
    if (selected === undefined) { selected = new Map(); edges.set(reference.role, selected); }
    selected.set(target.serial, target);
  }
  const typeOf = (identity: TyId): TyId => typeIdentifier(required(types, identity).identity);
  const signatureOf = (identity: SigId): SigId => signatureIdentifier(required(signatures, identity).identity);
  const data: GraphValue = value.kind === "type"
    ? { kind: "type", value: orderedTerm(remapTerm(value.value, typeOf, signatureOf)) }
    : { kind: "signature", value: orderedSignature(remapSignature(value.value, typeOf, signatureOf)) };
  const order: (readonly [number, number])[] = [];
  for (const [role, targets] of edges) for (const target of targets.values()) order.push([role, target.serial]);
  order.sort((left, right) => left[0] - right[0] || left[1] - right[1]);
  return { kind: "complete", value: { data, label: description.label,
    key: JSON.stringify([description.label, order]), edges } };
}

function view(state: Normalization, value: Class): PublicationResult<View> {
  const node = root(value);
  const cached = state.views.get(node.serial);
  if (cached !== undefined && cached.epoch === state.epoch) return { kind: "complete", value: cached.value };
  const selected = describe(state, node.data);
  if (selected.kind === "resource-limit") return selected;
  if (selected.value.data.kind === "type") state.typeValues.set(node.serial, selected.value.data.value);
  state.views.set(node.serial, { epoch: state.epoch, value: selected.value });
  return selected;
}

function attach(node: Class, selected: View): void {
  node.edges = selected.edges;
  node.label = selected.label;
  for (const targets of selected.edges.values()) for (const target of targets.values()) target.parents.set(node.serial, node);
}

function bucket(state: Normalization, label: string): Map<number, Class> {
  let nodes = state.labels.get(label);
  if (nodes === undefined) { nodes = new Map(); state.labels.set(label, nodes); }
  return nodes;
}

function queue(state: Normalization, value: Class, propagate: boolean): void {
  const node = root(value);
  const previous = state.queued.get(node.serial);
  if (previous !== undefined) previous.propagate ||= propagate;
  else {
    const job: Job = { node, propagate, next: null };
    state.queued.set(node.serial, job);
    if (state.tail === null) state.head = job;
    else state.tail.next = job;
    state.tail = job;
  }
}

function repairLater(state: Normalization, value: Class): void {
  const node = root(value);
  if (!state.repairQueued.has(node.serial)) {
    const job: RepairJob = { node, next: null };
    state.repairQueued.add(node.serial);
    if (state.repairTail === null) state.repairHead = job;
    else state.repairTail.next = job;
    state.repairTail = job;
  }
}

function create(state: Normalization, data: GraphValue, identity: number): Class {
  const node: Class = { serial: state.serial++, identity, data, parent: null, size: 1,
    label: "", edges: new Map(), parents: new Map() };
  state.classes.set(node.serial, node);
  if (data.kind === "type") { state.types.set(identity, node); state.typeValues.set(node.serial, data.value); }
  else state.signatures.set(identity, node);
  return node;
}

function merge(state: Normalization, left: Class, right: Class, preferred: Class): PublicationStop | null {
  if (!chargeWork(state.work, 1)) return workLimit(state.work);
  const first = root(left);
  const second = root(right);
  if (first === second) return null;
  const data = root(preferred).data;
  const winner = first.size >= second.size ? first : second;
  const loser = winner === first ? second : first;
  const parents = new Map<number, Class>();
  for (const node of [first, second]) {
    bucket(state, node.label).delete(node.serial);
    for (const parent of node.parents.values()) parents.set(parent.serial, parent);
    for (const targets of node.edges.values()) for (const target of targets.values()) root(target).parents.delete(node.serial);
  }
  loser.parent = winner;
  winner.size += loser.size;
  winner.data = data;
  winner.edges = new Map();
  winner.parents.clear();
  loser.parents.clear();
  state.classes.delete(loser.serial);
  state.epoch += 1;
  if (data.kind === "type") state.typeValues.set(winner.serial, data.value);
  for (const parent of parents.values()) if (parent !== first && parent !== second) {
    const selected = root(parent);
    winner.parents.set(selected.serial, selected);
  }
  const selected = view(state, winner);
  if (selected.kind === "resource-limit") return selected;
  attach(winner, selected.value);
  bucket(state, winner.label).set(winner.serial, winner);
  queue(state, winner, true);
  repairLater(state, winner);
  for (const parent of winner.parents.values()) queue(state, parent, true);
  return null;
}

function equivalent(state: Normalization, left: Class, right: Class, leftView: View): PublicationResult<readonly Pair[]> {
  if (!chargeWork(state.work, 1)) return workLimit(state.work);
  const rightView = view(state, right);
  if (rightView.kind === "resource-limit") return rightView;
  const low = left.serial < right.serial ? left : right;
  const high = low === left ? right : left;
  const selected: Pair = { left: low, right: high, leftView: low === left ? leftView : rightView.value,
    rightView: low === left ? rightView.value : leftView, dependents: [], valid: true };
  const known = new Map<number, Map<number, Pair>>([[low.serial, new Map([[high.serial, selected]])]]);
  const pairs: Pair[] = [selected];
  const dead: Pair[] = [];
  const match = (left: Class, right: Class): PublicationResult<Pair | boolean> => {
    if (!chargeWork(state.work, 1)) return workLimit(state.work);
    const first = root(left);
    const second = root(right);
    if (first === second) return { kind: "complete", value: true };
    const firstView = view(state, first);
    if (firstView.kind === "resource-limit") return firstView;
    const secondView = view(state, second);
    if (secondView.kind === "resource-limit") return secondView;
    if (firstView.value.label !== secondView.value.label) return { kind: "complete", value: false };
    const low = first.serial < second.serial ? first : second;
    const high = low === first ? second : first;
    let selected = known.get(low.serial);
    if (selected === undefined) { selected = new Map(); known.set(low.serial, selected); }
    const previous = selected.get(high.serial);
    if (previous !== undefined) return { kind: "complete", value: previous };
    const pair: Pair = { left: low, right: high, leftView: low === first ? firstView.value : secondView.value,
      rightView: low === first ? secondView.value : firstView.value, dependents: [], valid: true };
    selected.set(high.serial, pair);
    pairs.push(pair);
    return { kind: "complete", value: pair };
  };
  const refuse = (owner: Pair): void => {
    if (owner.valid) { owner.valid = false; dead.push(owner); }
  };
  const requireMatches = (owner: Pair, sources: ReadonlyMap<number, Class>, targets: ReadonlyMap<number, Class>): PublicationStop | null => {
    for (const source of sources.values()) {
      const witnesses: Pair[] = [];
      let identity = false;
      for (const target of targets.values()) {
        const candidate = match(source, target);
        if (candidate.kind === "resource-limit") return candidate;
        if (candidate.value === true) { identity = true; break; }
        if (candidate.value !== false) witnesses.push(candidate.value);
      }
      if (!identity) {
        const requirement: Requirement = { owner, remaining: witnesses.length };
        for (const witness of witnesses) witness.dependents.push(requirement);
        if (requirement.remaining === 0) refuse(owner);
      }
    }
    return null;
  };
  for (const pair of pairs) {
    const first = pair.leftView.edges;
    const second = pair.rightView.edges;
    for (const [role, sources] of first) {
      const targets = second.get(role);
      if (targets === undefined) refuse(pair);
      else {
        const forward = requireMatches(pair, sources, targets);
        if (forward !== null) return forward;
        const backward = requireMatches(pair, targets, sources);
        if (backward !== null) return backward;
      }
    }
    for (const role of second.keys()) if (!first.has(role)) refuse(pair);
  }
  for (const pair of dead) for (const requirement of pair.dependents) {
    if (!chargeWork(state.work, 1)) return workLimit(state.work);
    if (requirement.owner.valid && --requirement.remaining === 0) refuse(requirement.owner);
  }
  return { kind: "complete", value: selected.valid ? pairs.filter(pair => pair.valid) : [] };
}

function emit(state: Normalization, owner: Class, current: View, value: TypeTerm): PublicationResult<TyId> {
  if (!chargeWork(state.work, 1)) return workLimit(state.work);
  const node = root(owner);
  const selected = describe(state, { kind: "type", value });
  if (selected.kind === "resource-limit") return selected;
  if (current.key === selected.value.key) return { kind: "complete", value: typeIdentifier(node.identity) };
  for (const existing of bucket(state, selected.value.label).values()) {
    if (!chargeWork(state.work, 1)) return workLimit(state.work);
    const current = view(state, existing);
    if (current.kind === "resource-limit") return current;
    if (current.value.key === selected.value.key)
      return { kind: "complete", value: typeIdentifier(root(existing).identity) };
  }
  const candidate = create(state, selected.value.data, state.types.size);
  state.views.set(candidate.serial, { epoch: state.epoch, value: selected.value });
  attach(candidate, selected.value);
  bucket(state, selected.value.label).set(candidate.serial, candidate);
  repairLater(state, candidate);
  return { kind: "complete", value: typeIdentifier(candidate.identity) };
}

function repair(state: Normalization, value: Class): PublicationStop | null {
  if (!chargeWork(state.work, 1)) return workLimit(state.work);
  const node = root(value);
  if (state.repaired.get(node.serial) === state.epoch) return null;
  state.repaired.set(node.serial, state.epoch);
  const selected = view(state, node);
  if (selected.kind === "resource-limit") return selected;
  for (const candidate of bucket(state, selected.value.label).values()) {
    if (!chargeWork(state.work, 1)) return workLimit(state.work);
    const other = root(candidate);
    if (node === other) continue;
    const low = node.serial < other.serial ? node : other;
    const high = low === node ? other : node;
    let failures = state.failed.get(low.serial);
    if (failures === undefined) { failures = new Map(); state.failed.set(low.serial, failures); }
    if (failures.get(high.serial) === state.epoch) continue;
    const pairs = equivalent(state, node, other, selected.value);
    if (pairs.kind === "resource-limit") return pairs;
    if (pairs.value.length === 0) { failures.set(high.serial, state.epoch); continue; }
    for (const pair of pairs.value) {
      const stop = merge(state, pair.left, pair.right, pair.left);
      if (stop !== null) return stop;
    }
    return null;
  }
  return null;
}

export function normalizePublication(input: TypeTable, partition: TypePartition, work: PublicationWork): PublicationResult<TypePublication> {
  const state: Normalization = { work, types: new Map(), signatures: new Map(), typeValues: new Map(),
    classes: new Map(), labels: new Map(), views: new Map(), head: null, tail: null, queued: new Map(),
    repairHead: null, repairTail: null, repairQueued: new Set(),
    propagated: new Map(), repaired: new Map(), failed: new Map(), epoch: 0, serial: 0 };
  for (const [identity, value] of input.terms.entries())
    if (partition.types[identity] === identity) create(state, { kind: "type", value }, identity);
  for (const [identity, value] of input.signatures.entries())
    if (partition.signatures[identity] === identity) create(state, { kind: "signature", value }, identity);
  for (const [identity, selected] of partition.types.entries()) state.types.set(identity, required(state.types, selected));
  for (const [identity, selected] of partition.signatures.entries()) state.signatures.set(identity, required(state.signatures, selected));
  for (const node of state.classes.values()) {
    const selected = view(state, node);
    if (selected.kind === "resource-limit") return selected;
    attach(node, selected.value);
    bucket(state, node.label).set(node.serial, node);
    if (node.data.kind === "type" && (node.data.value.kind === "union" || node.data.value.kind === "intersection" || node.data.value.kind === "optional"))
      queue(state, node, false);
  }
  while (true) {
    if (state.head !== null) {
      const job = state.head;
      state.head = job.next;
      if (state.head === null) state.tail = null;
      state.queued.delete(job.node.serial);
      if (!chargeWork(work, 1)) return workLimit(work);
      const node = root(job.node);
      if (state.propagated.get(node.serial) === state.epoch) continue;
      state.propagated.set(node.serial, state.epoch);
      const selected = view(state, node);
      if (selected.kind === "resource-limit") return selected;
      if (selected.value.data.kind === "type") {
        const read = (type: TyId): TypeTerm | PublicationStop => {
          const target = root(required(state.types, type));
          const selected = view(state, target);
          return selected.kind === "resource-limit" ? selected : required(state.typeValues, target.serial);
        };
        const normalized = normalizeType(selected.value.data.value, read,
          value => {
            const emitted = emit(state, node, selected.value, value);
            return emitted.kind === "resource-limit" ? emitted : emitted.value;
          },
          () => chargeWork(work, 1) ? null : workLimit(work));
        if (typeof normalized !== "number") return normalized;
        const stop = merge(state, node, required(state.types, normalized), required(state.types, normalized));
        if (stop !== null) return stop;
      }
      if (job.propagate) {
        const selected = root(node);
        repairLater(state, selected);
        for (const parent of selected.parents.values()) queue(state, parent, true);
      }
    } else {
      const job = state.repairHead;
      if (job === null) break;
      const selected = job.node;
      state.repairHead = job.next;
      if (state.repairHead === null) state.repairTail = null;
      state.repairQueued.delete(selected.serial);
      const stop = repair(state, selected);
      if (stop !== null) return stop;
    }
  }
  const types = new Map<number, TyId>();
  const signatures = new Map<number, SigId>();
  for (const node of state.classes.values()) {
    if (node.data.kind === "type") types.set(node.serial, typeIdentifier(types.size));
    else signatures.set(node.serial, signatureIdentifier(signatures.size));
  }
  const typeOf = (type: TyId): TyId => required(types, root(required(state.types, type)).serial);
  const signatureOf = (signature: SigId): SigId => required(signatures, root(required(state.signatures, signature)).serial);
  const terms: TypeTerm[] = [];
  const rows: Signature[] = [];
  for (const node of state.classes.values()) {
    const selected = view(state, node);
    if (selected.kind === "resource-limit") return selected;
    const count = inspectGraphValue(selected.value.data).references.length;
    if (!chargeCreated(work, 1 + count)) return createdLimit(work);
    if (!chargeWork(work, count)) return workLimit(work);
    if (selected.value.data.kind === "type") {
      const admitted = readTypeData(selected.value.data.value, work, "emit");
      if (admitted.kind === "resource-limit") return admitted;
      terms.push(orderedTerm(remapTerm(admitted.value, typeOf, signatureOf)));
    } else {
      const admitted = readSignatureData(selected.value.data.value, work, "emit");
      if (admitted.kind === "resource-limit") return admitted;
      if (!chargeWork(work, 1)) return workLimit(work);
      rows.push({ id: required(signatures, node.serial), ...orderedSignature(remapSignature(admitted.value, typeOf, signatureOf)) });
    }
  }
  if (!chargeWork(work, partition.types.length + partition.signatures.length)) return workLimit(work);
  return { kind: "complete", value: { table: { terms, signatures: rows },
    types: partition.types.map(typeOf), signatures: partition.signatures.map(signatureOf) } };
}
