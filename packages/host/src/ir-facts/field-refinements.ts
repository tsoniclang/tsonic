import type { DataflowAccount, DataflowResult, DataflowStop } from "../dataflow/contract.js";
import { chargeResultEntries, chargeWork, graphOfMir, orderGraph, orderRows, predecessors } from "../dataflow/index.js";
import type { BlockId, LocalId, NodeId, NodeRef, PlaceId } from "../ids/contract.js";
import { encodeKey } from "../ids/index.js";
import type { MirBlock, MirBody, MirClosureCapture, MirOperand, MirTerminator } from "../ir-mir/contract.js";
import { visitMirControlEdges, visitMirStorageExposures } from "../ir-mir/index.js";
import type { MemberSelection } from "../ir-tir/contract.js";
import type { FieldRefinementInputs, FieldRefinementsOf, RefinementFact, RefinementInvalidation, Summary } from "./contract.js";
import { projectCallFields, refinementMayWrite } from "./apply-summary.js";
import { admitSelectionIdentity } from "./verification.js";
import { fieldProjectionIdentityData } from "./verify-relations.js";

type Call = Extract<MirTerminator, { readonly kind: "call" }>;
type Check = Extract<MirTerminator, { readonly kind: "check" }>;

interface Field {
  readonly receiver: LocalId;
  readonly path: readonly { readonly identity: string; readonly node: NodeId }[];
}

const missing: { readonly kind: "complete"; readonly value: null } = { kind: "complete", value: null };
const unavailable: { readonly kind: "complete"; readonly value: false } = { kind: "complete", value: false };
const available: { readonly kind: "complete"; readonly value: true } = { kind: "complete", value: true };
const noFields: readonly [] = [];

function denseRow<Row>(rows: readonly Row[], index: number): Row {
  const row = rows[index];
  if (row === undefined) throw new TypeError("A field proof requires its actual dense input row.");
  return row;
}

function identity(member: MemberSelection, account: DataflowAccount): DataflowResult<string> {
  const stop = admitSelectionIdentity(member, account);
  return stop ?? { kind: "complete", value: encodeKey(fieldProjectionIdentityData(member)) };
}

interface ReachingCopy {
  readonly block: MirBlock;
  readonly operand: MirOperand;
  readonly position: number;
}

function returnedCapture(block: MirBlock, call: Call, summaryAt: FieldRefinementInputs["summaryAt"], account: DataflowAccount): DataflowResult<MirClosureCapture | null> {
  if (call.callee.kind !== "body") return missing;
  const summary = summaryAt(block.id, call);
  if (summary.kind !== "complete") return summary;
  const paid = chargeWork(account, 16);
  if (paid !== null) return paid;
  const actual = summary.value;
  if (actual === null || !actual.returns || actual.unwinds || actual.suspends || actual.arena.boundaries.length !== 0
    || actual.callbacks.length !== 0 || actual.writes.length !== 0 || actual.concurrentWrites.length !== 0
    || actual.contentsOnReturn.length !== 0 || actual.contentsOnUnwind.length !== 0 || actual.resultCells.length !== 0
    || actual.initialization.events.length !== 0 || actual.backing.length !== 0) return missing;
  const result = actual.arena.origins[actual.result];
  if (result?.kind !== "complete" || result.id !== actual.result || result.includesAbsence || result.producers.length !== 1) return missing;
  const producerId = result.producers[0];
  const bound = producerId === undefined ? undefined : actual.arena.boundProducers[producerId];
  const producer = bound === undefined || bound.id !== producerId ? undefined : actual.arena.producers[bound.producer];
  if (producer?.kind !== "capture" || producer.path !== null) return missing;
  const source = call.callee.captures[producer.index];
  if (source === undefined || source.capture === null) return missing;
  const captures = actual.captures;
  for (let position = 0; position < captures.length; position += 1) {
    const read = chargeWork(account, 1);
    if (read !== null) return read;
    const effect = denseRow(captures, position);
    if (effect.writes.kind !== "complete" || effect.writes.paths.length !== 0) return missing;
  }
  const retention = actual.retention;
  for (let position = 0; position < retention.length; position += 1) {
    const read = chargeWork(account, 1);
    if (read !== null) return read;
    const row = denseRow(retention, position);
    if (row.into.kind !== "return" || row.source !== producerId) return missing;
  }
  return { kind: "complete", value: source };
}

function copyInBlock(mir: MirBody, block: MirBlock, position: number, local: LocalId,
  account: DataflowAccount): DataflowResult<ReachingCopy | "entry" | null> {
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
      return held ?? { kind: "complete", value: { block, operand: statement.value.operand, position } };
    }
  }
  return { kind: "complete", value: "entry" };
}

function reachesCopy(mir: MirBody, block: MirBlock, position: number, local: LocalId, flow: Flow,
  account: DataflowAccount): DataflowResult<ReachingCopy | null> {
  const initial = copyInBlock(mir, block, position, local, account);
  if (initial.kind !== "complete") return initial;
  if (initial.value !== "entry") return { kind: "complete", value: initial.value };
  const setup = chargeResultEntries(account, 2);
  if (setup !== null) return setup;
  const seen = new Set<number>();
  const pending: number[] = [];
  const enqueue = (id: BlockId): boolean | DataflowStop => {
    if (id === flow.entry) return false;
    const incoming = flow.predecessor[id] ?? [];
    for (let position = 0; position < incoming.length; position += 1) {
      const paid = chargeWork(account, 1);
      if (paid !== null) return paid;
      const earlier = denseRow(incoming, position);
      if (flow.reachable[earlier] !== true || seen.has(earlier)) continue;
      const retained = chargeResultEntries(account, 2);
      if (retained !== null) return retained;
      seen.add(earlier);
      pending.push(earlier);
    }
    return true;
  };
  let possible = enqueue(block.id);
  if (typeof possible !== "boolean") return possible;
  if (!possible) return missing;
  let known: ReachingCopy | null = null;
  while (pending.length !== 0) {
    const paid = chargeWork(account, 1);
    if (paid !== null) return paid;
    const id = pending.pop();
    const prior = id === undefined ? undefined : mir.blocks[id];
    if (prior === undefined) return missing;
    const term = prior.terminator;
    const destinations = "destination" in term && term.destination !== null && mir.places[term.destination]?.base;
    if (destinations && destinations.kind === "local" && destinations.local === local) {
      if (term.kind !== "call") return missing;
      const result = flow.copies?.get(term);
      if (result == null || known !== null && (known.block !== prior || known.position !== prior.statements.length)) return missing;
      const retained = chargeResultEntries(account, 2);
      if (retained !== null) return retained;
      known = { block: prior, operand: { kind: "place", place: result.place }, position: prior.statements.length };
      continue;
    }
    if ("unwind" in term && term.unwind.kind === "handler" && term.unwind.exception !== null) {
      const destination = mir.places[term.unwind.exception]?.base;
      if (destination?.kind === "local" && destination.local === local) return missing;
    }
    const found = copyInBlock(mir, prior, prior.statements.length, local, account);
    if (found.kind !== "complete") return found;
    if (found.value === null) return missing;
    if (found.value === "entry") {
      possible = enqueue(prior.id);
      if (typeof possible !== "boolean") return possible;
      if (!possible) return missing;
    } else {
      if (known !== null && (known.block !== found.value.block || known.position !== found.value.position)) return missing;
      known = found.value;
    }
  }
  return { kind: "complete", value: known };
}

function fieldOf(mir: MirBody, block: MirBlock, initial: MirOperand, before: number,
  flow: Flow, account: DataflowAccount): DataflowResult<Field | null> {
  let operand = initial;
  let position = before;
  let cursor = block;
  let aliases: Set<LocalId> | null = null;
  let selected: { readonly identity: string; readonly node: NodeId }[] | null = null;
  while (operand.kind === "place") {
    const paid = chargeWork(account, 1);
    if (paid !== null) return paid;
    const base = mir.places[operand.place]?.base;
    if (base?.kind === "place" && base.projection.kind === "field") {
      const member = base.projection.member;
      if (base.place >= operand.place || base.tir.body !== mir.body || member.decision.primary === null || member.decision.location.kind !== "data"
        || member.decision.location.receiver !== "by-reference" || member.decision.location.check.kind !== "none") return missing;
      const selectedKey = identity(member, account);
      if (selectedKey.kind !== "complete") return selectedKey;
      const retained = chargeResultEntries(account, selected === null ? 3 : 2);
      if (retained !== null) return retained;
      (selected ??= []).push({ identity: selectedKey.value, node: base.tir.node });
      operand = { kind: "place", place: base.place };
      continue;
    }
    if (base?.kind === "checked" && base.projection.kind === "refined" && base.place < operand.place) {
      operand = { kind: "place", place: base.place };
      continue;
    }
    if (base?.kind !== "local" || flow.exposed.has(base.local)) return missing;
    const local = mir.locals[base.local];
    if (local?.role.kind === "parameter" && local.mode === "by-value") {
      const retained = chargeResultEntries(account, 1);
      return retained ?? { kind: "complete", value: { receiver: base.local, path: selected ?? noFields } };
    }
    if (local?.role.kind !== "temporary" && local?.role.kind !== "user") return missing;
    if (aliases?.has(base.local)) return missing;
    const retained = chargeResultEntries(account, aliases === null ? 2 : 1);
    if (retained !== null) return retained;
    (aliases ??= new Set()).add(base.local);
    const copy = reachesCopy(mir, cursor, position, base.local, flow, account);
    if (copy.kind !== "complete") return copy;
    if (copy.value === null) return missing;
    ({ operand, position, block: cursor } = copy.value);
  }
  return missing;
}

function guardOnEdge(mir: MirBody, block: MirBlock, target: BlockId, field: Field, flow: Flow,
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
  const tested = fieldOf(mir, block, operand, block.statements.length - 1, flow, account);
  if (tested.kind !== "complete") return tested;
  const actual = tested.value;
  if (actual?.path[0]?.node !== authored.id || actual.receiver !== field.receiver || actual.path.length !== field.path.length) return missing;
  for (let index = 0; index < field.path.length; index += 1) {
    const work = chargeWork(account, 1);
    if (work !== null) return work;
    if (actual.path[index]?.identity !== field.path[index]?.identity) return missing;
  }
  return { kind: "complete", value: assignment.tir };
}

function interference(target: Field) {
  let depth = 0;
  let prefix = true;
  let last: string | null = null;
  return {
    field: (key: string): void => {
      if (depth < target.path.length && target.path[target.path.length - depth - 1]?.identity !== key) prefix = false;
      depth += 1;
      last = key;
    },
    writes: (account: DataflowAccount): boolean | DataflowStop => {
      if (prefix && depth <= target.path.length || !prefix && target.path.length > 1) return true;
      for (let index = 0; index < target.path.length; index += 1) {
        const read = chargeWork(account, 1);
        if (read !== null) return read;
        if (target.path[index]?.identity === last) return true;
      }
      return false;
    },
  };
}

function writesField(mir: MirBody, block: MirBlock, before: number, place: PlaceId, target: Field,
  flow: Flow, account: DataflowAccount): DataflowResult<boolean> {
  const paid = chargeWork(account, 1);
  if (paid !== null) return paid;
  const base = mir.places[place]?.base;
  if (base?.kind === "local") return base.local === target.receiver ? available : unavailable;
  if (base?.kind !== "place" && base?.kind !== "checked") return unavailable;
  if (base.projection.kind !== "field") return base.projection.kind === "deref" || base.projection.kind === "capture" ? available : unavailable;
  const read = fieldOf(mir, block, { kind: "place", place }, before, flow, account);
  if (read.kind !== "complete") return read;
  if (read.value === null || read.value.receiver !== target.receiver) return available;
  const compare = interference(target);
  for (let index = read.value.path.length - 1; index >= 0; index -= 1) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
    const field = read.value.path[index];
    if (field === undefined) return available;
    compare.field(field.identity);
  }
  const written = compare.writes(account);
  return typeof written === "boolean" ? { kind: "complete", value: written } : written;
}

function appliedWrite(mir: MirBody, block: MirBlock, call: Call, summary: Summary | null, target: Field,
  flow: Flow, bindings: FieldRefinementInputs["callBindings"], account: DataflowAccount): DataflowResult<boolean> {
  return refinementMayWrite(account, summary, (slot, paths, selected) => {
    if (slot.kind !== "parameter" || call.callee.kind !== "direct") return available;
    const supplied = call.arguments[slot.index];
    const mapping = call.callee.resolution.decision.parameters[slot.index];
    if (supplied?.kind !== "value" || supplied.passing !== "by-value"
      || mapping?.kind !== "reference-argument" && mapping?.kind !== "argument") return available;
    const root = fieldOf(mir, block, supplied.operand, block.statements.length, flow, account);
    if (root.kind !== "complete") return root;
    if (root.value === null || root.value.receiver !== target.receiver) return available;
    const actual = root.value;
    for (let write = 0; write < paths.length; write += 1) {
      const read = chargeWork(account, 1);
      if (read !== null) return read;
      const path = denseRow(paths, write);
      const compare = interference(target);
      for (let index = actual.path.length - 1; index >= 0; index -= 1) {
        const step = chargeWork(account, 1);
        if (step !== null) return step;
        const field = actual.path[index];
        if (field === undefined) return available;
        compare.field(field.identity);
      }
      const transported = projectCallFields(account, selected.arena.projections, path,
        mapping.kind === "reference-argument" ? mapping.view : null, bindings, field => {
          const selected = identity(field, account);
          if (selected.kind !== "complete") return selected;
          compare.field(selected.value);
          return null;
        });
      if (transported.kind !== "complete") return transported;
      if (!transported.value) return available;
      const written = compare.writes(account);
      if (typeof written !== "boolean") return written;
      if (written) return available;
    }
    return unavailable;
  });
}

interface Flow {
  readonly entry: number;
  readonly predecessor: readonly (readonly number[])[];
  readonly reachable: readonly boolean[];
  readonly exposed: ReadonlySet<LocalId>;
  readonly copies: ReadonlyMap<Call, MirClosureCapture | null> | null;
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
  const read = fieldOf(mir, block, { kind: "place", place: base.place }, block.statements.length, flow, account);
  if (read.kind !== "complete") return read;
  if (read.value?.path[0]?.node !== check.tir.node) return unproved([], "No proved reaching field receiver.");
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
    const statements = current.statements;
    for (let position = 0; position < statements.length; position += 1) {
      const step = chargeWork(account, 1);
      if (step !== null) return step;
      const statement = denseRow(statements, position);
      if (statement.kind === "assign") {
        const effect = writesField(mir, current, position, statement.place, field, flow, account);
        if (effect.kind !== "complete") return effect;
        if (!effect.value) continue;
      } else if ((statement.kind !== "storage-live" && statement.kind !== "storage-dead") || statement.local !== field.receiver) continue;
      const invalidated = invalidate("write", statement.tir);
      if (invalidated !== null) return invalidated;
    }
    const incoming = flow.predecessor[index] ?? [];
    for (let position = 0; position < incoming.length; position += 1) {
      const step = chargeWork(account, 1);
      if (step !== null) return step;
      const prior = denseRow(incoming, position);
      if (flow.reachable[prior] !== true) continue;
      const predecessor = mir.blocks[prior];
      if (predecessor === undefined) return unproved([], "No qualified predecessor edge.");
      const guard = guardOnEdge(mir, predecessor, current.id, field, flow, inputs, account);
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
        const effect = appliedWrite(mir, predecessor, term, summary.value, field, flow, inputs.callBindings, account);
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
  let copies: Map<Call, MirClosureCapture | null> | null = null;
  const exposure = visitMirStorageExposures(mir, {
    admit: () => chargeWork(account, 1), address: expose,
    capture: (capture, block, placed) => {
      if (placed !== null && "destination" in placed && placed.destination !== null && order.value.reachable[block.id] === true) {
        const paid = chargeWork(account, 1);
        if (paid !== null) return paid;
        let selected = copies?.get(placed);
        if (selected === undefined) {
          const actual = returnedCapture(block, placed, inputs.summaryAt, account);
          if (actual.kind !== "complete") return actual;
          const retained = chargeResultEntries(account, copies === null ? 2 : 1);
          if (retained !== null) return retained;
          copies ??= new Map();
          selected = actual.value;
          copies.set(placed, selected);
        }
        if (selected !== null) return null;
      }
      return capture.capture === "captured-value" ? null : expose(capture.place);
    },
  });
  if (exposure !== null) return exposure;
  const replaceReceiver = (place: PlaceId): DataflowStop | null => {
    const base = mir.places[place]?.base;
    return base?.kind === "local" && mir.locals[base.local]?.role.kind === "parameter" ? exclude(base.local) : null;
  };
  const blocks = mir.blocks;
  for (let position = 0; position < blocks.length; position += 1) {
    const paid = chargeWork(account, 1);
    if (paid !== null) return paid;
    const block = denseRow(blocks, position);
    const statements = block.statements;
    for (let statementPosition = 0; statementPosition < statements.length; statementPosition += 1) {
      const read = chargeWork(account, 1);
      if (read !== null) return read;
      const statement = denseRow(statements, statementPosition);
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
  const flow = { entry: entry.block, predecessor: predecessor.value, reachable: order.value.reachable, exposed, copies };
  const rows: RefinementFact[] = [];
  for (let position = 0; position < blocks.length; position += 1) {
    const paid = chargeWork(account, 1);
    if (paid !== null) return paid;
    const block = denseRow(blocks, position);
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
