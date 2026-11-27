import type { DataflowAccount, DataflowResult, DataflowStop } from "../dataflow/contract.js";
import { chargeResultEntries, chargeWork, graphOfMir, orderGraph, orderRows, predecessors } from "../dataflow/index.js";
import type { BlockId, LocalId, NodeId, NodeRef, PlaceId } from "../ids/contract.js";
import { encodeKey } from "../ids/index.js";
import type { MirBlock, MirBody, MirOperand, MirTerminator } from "../ir-mir/contract.js";
import { visitMirControlEdges, visitMirStorageExposures } from "../ir-mir/index.js";
import type { MemberSelection } from "../ir-tir/contract.js";
import type { FieldRefinementInputs, FieldRefinementsOf, RefinementFact, RefinementInvalidation, Summary } from "./contract.js";
import { admitSelectionIdentity } from "./verification.js";
import { fieldProjectionIdentityData } from "./verify-relations.js";

type Call = Extract<MirTerminator, { readonly kind: "call" }>;
type Check = Extract<MirTerminator, { readonly kind: "check" }>;

interface Field {
  readonly receiver: LocalId;
  readonly identity: string;
  readonly node: NodeId;
}

const missing: { readonly kind: "complete"; readonly value: null } = { kind: "complete", value: null };

function identity(member: MemberSelection, account: DataflowAccount): DataflowResult<string> {
  const stop = admitSelectionIdentity(member, account);
  return stop ?? { kind: "complete", value: encodeKey(fieldProjectionIdentityData(member)) };
}

function reachesCopy(mir: MirBody, block: MirBlock, position: number, local: LocalId,
  account: DataflowAccount): DataflowResult<{ readonly operand: MirOperand; readonly position: number } | null> {
  while (position > 0) {
    const stop = chargeWork(account, 1);
    if (stop !== null) return stop;
    position -= 1;
    const statement = block.statements[position];
    if (statement === undefined) return missing;
    if (statement.kind === "storage-live" || statement.kind === "storage-dead") {
      if (statement.local === local) return missing;
    } else if (statement.kind === "assign") {
      const base = mir.places[statement.place]?.base;
      if (base?.kind !== "local" || base.local !== local) continue;
      if (statement.value.kind !== "use") return missing;
      const held = chargeResultEntries(account, 1);
      return held ?? { kind: "complete", value: { operand: statement.value.operand, position } };
    }
  }
  return missing;
}

function fieldOf(mir: MirBody, block: MirBlock, initial: MirOperand, before: number,
  exposed: ReadonlySet<LocalId>, account: DataflowAccount): DataflowResult<Field | null> {
  let operand = initial;
  let position = before;
  let selectedField: { readonly identity: string; readonly node: NodeId } | null = null;
  while (operand.kind === "place") {
    const paid = chargeWork(account, 1);
    if (paid !== null) return paid;
    const base = mir.places[operand.place]?.base;
    if (base?.kind === "place" && base.projection.kind === "field" && selectedField === null) {
      const selected = base.projection.member;
      if (base.tir.body !== mir.body || selected.decision.primary === null || selected.decision.location.kind !== "data"
        || selected.decision.location.receiver !== "by-reference" || selected.decision.location.check.kind !== "none") return missing;
      const selectedKey = identity(selected, account);
      if (selectedKey.kind !== "complete") return selectedKey;
      const retained = chargeResultEntries(account, 2);
      if (retained !== null) return retained;
      selectedField = { identity: selectedKey.value, node: base.tir.node };
      operand = { kind: "place", place: base.place };
      continue;
    }
    if (base?.kind !== "local" || exposed.has(base.local)) return missing;
    const local = mir.locals[base.local];
    if (selectedField !== null && local?.role.kind === "parameter" && local.mode === "by-value") {
      const retained = chargeResultEntries(account, 1);
      return retained ?? { kind: "complete", value: { receiver: base.local, ...selectedField } };
    }
    if (local?.role.kind !== "temporary" && local?.role.kind !== "user") return missing;
    const copy = reachesCopy(mir, block, position, base.local, account);
    if (copy.kind !== "complete") return copy;
    if (copy.value === null) return missing;
    ({ operand, position } = copy.value);
  }
  return missing;
}

function guardOnEdge(mir: MirBody, block: MirBlock, target: BlockId, field: Field, exposed: ReadonlySet<LocalId>,
  inputs: FieldRefinementInputs, account: DataflowAccount): DataflowResult<NodeRef | null> {
  const paid = chargeWork(account, 2);
  if (paid !== null) return paid;
  const branch = block.terminator;
  if (branch.kind !== "switch" || branch.operand.kind !== "place" || branch.step !== null || branch.targets.length !== 1) return missing;
  const whenTrue = branch.targets[0];
  const assignment = block.statements.at(-1);
  if (whenTrue === undefined || assignment?.kind !== "assign" || assignment.place !== branch.operand.place
    || assignment.tir.body !== mir.body || assignment.value.kind !== "binary") return missing;
  const constant = mir.constants[whenTrue.constant]?.value;
  const operation = assignment.value.operation.decision;
  if (constant?.kind !== "literal" || constant.value.kind !== "boolean" || !constant.value.value
    || whenTrue.target === branch.otherwise || operation.kind !== "selected" || operation.execution.kind !== "pure"
    || operation.operation.kind !== "absence-test") return missing;
  const present = operation.operation.negated ? whenTrue.target : branch.otherwise;
  if (present !== target) return missing;
  const syntax = inputs.sourceOf(assignment.tir.node);
  if (syntax?.kind !== "BinaryExpression" || syntax.tsonic.role !== "comparison") return missing;
  const { left, right } = assignment.value;
  const isAbsent = (operand: MirOperand): boolean => {
    if (operand.kind !== "constant") return false;
    const value = mir.constants[operand.constant]?.value;
    return value?.kind === "literal" && value.value.kind === "absence";
  };
  const leftAbsent = isAbsent(left);
  const operand = leftAbsent ? right : isAbsent(right) ? left : null;
  if (operand === null) return missing;
  let authored = leftAbsent ? syntax.right : syntax.left;
  while (authored.kind === "ParenthesizedExpression") {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
    authored = authored.expression;
  }
  if (authored.kind !== "PropertyAccessExpression" || authored.tsonic.role !== "value"
    || authored.tsonic.selection.kind !== "decided") return missing;
  const tested = fieldOf(mir, block, operand, block.statements.length - 1, exposed, account);
  if (tested.kind !== "complete") return tested;
  return { kind: "complete", value: tested.value?.node === authored.id && tested.value.receiver === field.receiver && tested.value.identity === field.identity
    ? assignment.tir : null };
}

function writesField(mir: MirBody, place: PlaceId, target: Field, account: DataflowAccount): DataflowResult<boolean> {
  for (;;) {
    const paid = chargeWork(account, 1);
    if (paid !== null) return paid;
    const base = mir.places[place]?.base;
    if (base?.kind === "local") return { kind: "complete", value: base.local === target.receiver };
    if (base?.kind === "place" && base.projection.kind === "field") {
      const selected = identity(base.projection.member, account);
      return selected.kind === "complete" ? { kind: "complete", value: selected.value === target.identity } : selected;
    }
    if (base?.kind !== "place" && base?.kind !== "checked") return { kind: "complete", value: false };
    if (base.projection.kind === "deref" || base.projection.kind === "capture") return { kind: "complete", value: true };
    if (base.place >= place) return { kind: "complete", value: true };
    place = base.place;
  }
}

function appliedWrite(call: Call, summary: Summary | null, target: Field, account: DataflowAccount): DataflowResult<boolean> {
  const paid = chargeWork(account, 1);
  if (paid !== null) return paid;
  if (summary === null || summary.key.kind !== "body" || summary.suspends || summary.arena.boundaries.length !== 0 || summary.callbacks.length !== 0
    || summary.writes.length !== 0 || summary.concurrentWrites.length !== 0 || summary.contentsOnReturn.length !== 0
    || summary.contentsOnUnwind.length !== 0 || summary.captures.length !== 0)
    return { kind: "complete", value: true };
  for (const parameter of summary.parameters) {
    const work = chargeWork(account, 1);
    if (work !== null) return work;
    if (parameter.writes.kind === "open") return { kind: "complete", value: true };
    if (parameter.writes.paths.length === 0) continue;
    const supplied = parameter.slot.kind === "parameter" ? call.arguments[parameter.slot.index] : undefined;
    if (parameter.slot.kind === "receiver" ? call.receiver === null : supplied === undefined)
      return { kind: "complete", value: true };
    for (const path of parameter.writes.paths) {
      const read = chargeWork(account, 1);
      if (read !== null) return read;
      const projection = summary.arena.projections[path];
      if (projection?.parent !== null || projection.projection.kind !== "field")
        return { kind: "complete", value: true };
      const selected = identity(projection.projection.member, account);
      if (selected.kind !== "complete") return selected;
      if (selected.value === target.identity) return { kind: "complete", value: true };
    }
  }
  return { kind: "complete", value: false };
}

interface Flow {
  readonly entry: number;
  readonly predecessor: readonly (readonly number[])[];
  readonly reachable: readonly boolean[];
  readonly exposed: ReadonlySet<LocalId>;
}

function fieldProof(mir: MirBody, block: MirBlock, check: Check, flow: Flow,
  inputs: FieldRefinementInputs, account: DataflowAccount): DataflowResult<RefinementFact> {
  const unproved = (guards: readonly NodeId[], detail: string): DataflowResult<RefinementFact> =>
    chargeResultEntries(account, 3) ?? { kind: "complete", value: {
      kind: "unproven", node: check.tir.node, guards, reason: { kind: "guard-not-proven", detail },
    } };
  const setup = chargeWork(account, 1) ?? chargeResultEntries(account, 5);
  if (setup !== null) return setup;
  const base = mir.places[check.place]?.base;
  if (base?.kind !== "checked" || base.projection.kind !== "refined") return unproved([], "No actual narrowed field view.");
  const read = fieldOf(mir, block, { kind: "place", place: base.place }, block.statements.length, flow.exposed, account);
  if (read.kind !== "complete") return read;
  if (read.value?.node !== check.tir.node) return unproved([], "No proved reaching field receiver.");
  const field = read.value;
  const guards = new Set<NodeId>();
  const invalidations = new Map<NodeId, RefinementInvalidation>();
  const visited = new Set<number>();
  const pending: number[] = [block.id];
  let bypass = false;
  const invalidate = (kind: RefinementInvalidation["kind"], at: NodeRef): DataflowStop | null => {
    if (invalidations.has(at.node)) return null;
    const retained = chargeResultEntries(account, 2);
    if (retained !== null) return retained;
    invalidations.set(at.node, { kind, at });
    return null;
  };
  while (pending.length !== 0) {
    const work = chargeWork(account, 1);
    if (work !== null) return work;
    const index = pending.pop();
    if (index === undefined || visited.has(index)) continue;
    const retained = chargeResultEntries(account, 1);
    if (retained !== null) return retained;
    visited.add(index);
    const current = mir.blocks[index];
    if (current === undefined) return unproved([], "No qualified predecessor block.");
    if (current.id === flow.entry) bypass = true;
    for (const statement of current.statements) {
      const step = chargeWork(account, 1);
      if (step !== null) return step;
      if (statement.kind === "assign") {
        const effect = writesField(mir, statement.place, field, account);
        if (effect.kind !== "complete") return effect;
        if (!effect.value) continue;
      } else if ((statement.kind !== "storage-live" && statement.kind !== "storage-dead") || statement.local !== field.receiver) continue;
      const invalidated = invalidate("write", statement.tir);
      if (invalidated !== null) return invalidated;
    }
    for (const prior of flow.predecessor[index] ?? []) {
      const step = chargeWork(account, 1);
      if (step !== null) return step;
      if (flow.reachable[prior] !== true) continue;
      const predecessor = mir.blocks[prior];
      if (predecessor === undefined) return unproved([], "No qualified predecessor edge.");
      const guard = guardOnEdge(mir, predecessor, current.id, field, flow.exposed, inputs, account);
      if (guard.kind !== "complete") return guard;
      if (guard.value !== null) {
        if (!guards.has(guard.value.node)) {
          const held = chargeResultEntries(account, 1);
          if (held !== null) return held;
          guards.add(guard.value.node);
        }
        continue;
      }
      const term = predecessor.terminator;
      if (term.kind === "call") {
        const summary = inputs.summaryAt(predecessor.id, term);
        if (summary.kind !== "complete") return summary;
        const effect = appliedWrite(term, summary.value, field, account);
        if (effect.kind !== "complete") return effect;
        const destination = term.destination === null ? null : mir.places[term.destination]?.base;
        if (effect.value || destination?.kind === "local" && destination.local === field.receiver) {
          const invalidated = invalidate("call", term.tir);
          if (invalidated !== null) return invalidated;
        }
      } else if (term.kind === "await" || term.kind === "yield" || term.kind === "delegate"
        || term.kind === "invoke" && term.operation.decision.execution.kind === "invocation" && term.operation.decision.execution.writesStorage) {
        const invalidated = invalidate("call", term.tir);
        if (invalidated !== null) return invalidated;
      }
      if (!visited.has(prior)) {
        const held = chargeResultEntries(account, 1);
        if (held !== null) return held;
        pending.push(prior);
      }
    }
  }
  const allocate = chargeWork(account, guards.size + invalidations.size) ?? chargeResultEntries(account, 2);
  if (allocate !== null) return allocate;
  const order = orderRows([...guards], (left, right) => left - right, account);
  if (order.kind !== "complete") return order;
  if (bypass || order.value.length === 0) return unproved(order.value, "No qualifying presence guard on every reaching path.");
  if (invalidations.size === 0)
    return chargeResultEntries(account, 1) ?? { kind: "complete", value: { kind: "proven", node: check.tir.node, guards: order.value } };
  const sites = orderRows([...invalidations.values()], (left, right) => left.at.node - right.at.node, account);
  if (sites.kind !== "complete") return sites;
  const first = sites.value[0];
  if (first === undefined) return unproved(order.value, "No qualified invalidation point.");
  const held = chargeResultEntries(account, 3 + sites.value.length);
  return held ?? { kind: "complete", value: { kind: "unproven", node: check.tir.node, guards: order.value,
    reason: { kind: "invalidated", sites: [first, ...sites.value.slice(1)] } } };
}

export const fieldRefinements: FieldRefinementsOf = (account, mir, provided, inputs) => {
  const before = chargeWork(account, 1) ?? chargeResultEntries(account, 2);
  if (before !== null) return before;
  const graph = graphOfMir(mir, account);
  if (graph.kind !== "complete") return graph;
  if (graph.value.qualification !== undefined) return { kind: "complete", value: [] };
  const entryWork = chargeWork(account, mir.entries.length);
  if (entryWork !== null) return entryWork;
  const entry = mir.entries.find(row => row.provided === provided);
  if (entry === undefined) return { kind: "complete", value: [] };
  const order = orderGraph(graph.value, [entry.block], account);
  if (order.kind !== "complete") return order;
  const predecessor = predecessors(graph.value, account);
  if (predecessor.kind !== "complete") return predecessor;
  const exposed = new Set<LocalId>();
  const exclude = (local: LocalId): DataflowStop | null => {
    if (exposed.has(local)) return null;
    const held = chargeResultEntries(account, 1);
    if (held !== null) return held;
    exposed.add(local);
    return null;
  };
  const expose = (start: PlaceId): DataflowStop | null => {
    let place = start;
    for (;;) {
      const paid = chargeWork(account, 1);
      if (paid !== null) return paid;
      const base = mir.places[place]?.base;
      if (base?.kind === "local") return exclude(base.local);
      if (base?.kind !== "place" && base?.kind !== "checked" || base.place >= place) return null;
      place = base.place;
    }
  };
  const exposure = visitMirStorageExposures(mir, {
    admit: () => chargeWork(account, 1), address: expose, capture: capture => expose(capture.place),
  });
  if (exposure !== null) return exposure;
  const replaceReceiver = (place: PlaceId): DataflowStop | null => {
    const base = mir.places[place]?.base;
    return base?.kind === "local" && mir.locals[base.local]?.role.kind === "parameter" ? exclude(base.local) : null;
  };
  for (const block of mir.blocks) {
    const paid = chargeWork(account, 1);
    if (paid !== null) return paid;
    for (const statement of block.statements) {
      const read = chargeWork(account, 1);
      if (read !== null) return read;
      const stopped = statement.kind === "assign" ? replaceReceiver(statement.place)
        : (statement.kind === "storage-live" || statement.kind === "storage-dead")
          && mir.locals[statement.local]?.role.kind === "parameter" ? exclude(statement.local) : null;
      if (stopped !== null) return stopped;
    }
    let stopped: DataflowStop | null = null;
    const edge = visitMirControlEdges(block.terminator, {
      kind: "edges", admit: () => stopped ?? chargeWork(account, 1),
      visit: (_role, _target, destination) => { if (destination !== null) stopped ??= replaceReceiver(destination); },
    });
    const cut = edge ?? stopped;
    if (cut !== null) return cut;
  }
  const flow = { entry: entry.block, predecessor: predecessor.value, reachable: order.value.reachable, exposed };
  const rows: RefinementFact[] = [];
  for (const block of mir.blocks) {
    const paid = chargeWork(account, 1);
    if (paid !== null) return paid;
    const check = block.terminator;
    if (check.kind !== "check" || check.tir.body !== mir.body || flow.reachable[block.id] !== true) continue;
    const source = inputs.sourceOf(check.tir.node);
    if (source?.kind !== "PropertyAccessExpression" || source.tsonic.role !== "value" || source.tsonic.narrowing?.kind !== "narrowed") continue;
    const proved = fieldProof(mir, block, check, flow, inputs, account);
    if (proved.kind !== "complete") return proved;
    const retained = chargeResultEntries(account, 1);
    if (retained !== null) return retained;
    rows.push(proved.value);
  }
  return orderRows(rows, (left, right) => left.node - right.node, account);
};
