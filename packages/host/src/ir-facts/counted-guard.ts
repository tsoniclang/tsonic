import type { DataflowAccount, DataflowResult, DataflowStop } from "../dataflow/contract.js";
import { chargeResultEntries, chargeWork } from "../dataflow/index.js";
import type { BlockId, LocalId, PlaceId, ProjectionPathId } from "../ids/contract.js";
import type { MirBlock, MirBody, MirPlaceBase, MirProjection, MirStatement, MirTerminator } from "../ir-mir/contract.js";
import { localOwnershipOfMir, visitMirControlEdges } from "../ir-mir/index.js";
import type { PlacedCaptures } from "./apply-summary.js";
import { refinementMayWrite } from "./apply-summary.js";
import type { Projection, ProjectionPath, RefinementSources, Summary } from "./contract.js";

type Strength = "unproved" | "range" | "extent" | "current-extent";

interface Guard {
  readonly entry: BlockId;
  readonly header: MirBlock;
  readonly success: BlockId;
  readonly counter: LocalId;
  readonly commit: MirStatement;
  readonly receiver: LocalId | null;
}

const absent: { readonly kind: "complete"; readonly value: null } = { kind: "complete", value: null };
const unequal: { readonly kind: "complete"; readonly value: false } = { kind: "complete", value: false };
const equal: { readonly kind: "complete"; readonly value: true } = { kind: "complete", value: true };

export function unchangedLocalStore(row: Extract<MirStatement, { readonly kind: "assign" }>,
  account: DataflowAccount): DataflowResult<boolean> {
  const inspect = chargeWork(account, 2);
  if (inspect !== null) return inspect;
  const value = row.value;
  if (row.step !== null || value.kind !== "use") return unequal;
  const read = chargeWork(account, 1);
  if (read !== null) return read;
  return value.operand.kind === "place" && value.operand.place === row.place ? equal : unequal;
}

function contentsProjection(projection: MirProjection | Projection): boolean {
  if (projection.kind === "index" || projection.kind === "element") return true;
  if (projection.kind !== "field") return false;
  const { member } = projection;
  return member.decision.location.kind === "data" && member.decision.location.check.kind === "none"
    && member.getter === null && member.setter === null && member.decision.getter === null && member.decision.setter === null;
}

function contentsStore(mir: MirBody, destination: PlaceId, base: MirPlaceBase | undefined,
  account: DataflowAccount): DataflowResult<boolean> {
  if (base?.kind !== "place" && base?.kind !== "checked" || !contentsProjection(base.projection)) return unequal;
  let current = destination;
  let selected: Extract<MirPlaceBase, { readonly kind: "place" | "checked" }> = base;
  for (;;) {
    const parent: PlaceId = selected.place;
    if (parent >= current) return unequal;
    const paid = chargeWork(account, 1);
    if (paid !== null) return paid;
    current = parent;
    const ancestor: MirPlaceBase | undefined = mir.places[parent]?.base;
    if (ancestor?.kind === "local" || ancestor?.kind === "static") return equal;
    if (ancestor === undefined || ancestor.projection.kind !== "refined" && !contentsProjection(ancestor.projection)) return unequal;
    selected = ancestor;
  }
}

function pathsMayChangeExtent(paths: readonly ProjectionPathId[], summary: Summary,
  account: DataflowAccount): DataflowResult<boolean> {
  const initial = chargeWork(account, 1);
  if (initial !== null) return initial;
  if (summary.backing.length !== 0) return equal;
  for (let position = 0; position < paths.length; position += 1) {
    const read = chargeWork(account, 1);
    if (read !== null) return read;
    const terminal = paths[position];
    if (terminal === undefined) return equal;
    let current: ProjectionPathId = terminal;
    for (;;) {
      const paid = chargeWork(account, 1);
      if (paid !== null) return paid;
      const row: ProjectionPath | undefined = summary.arena.projections[current];
      if (row?.id !== current || !contentsProjection(row.projection)) return equal;
      if (row.parent === null) break;
      if (row.parent >= current) return equal;
      current = row.parent;
    }
  }
  return unequal;
}

function statements(mir: MirBody, block: MirBlock, input: Strength, guard: Guard, roots: readonly (LocalId | null)[],
  account: DataflowAccount): DataflowResult<Strength> {
  let state = input;
  const rows = block.statements;
  for (let position = 0; state !== "unproved" && position < rows.length; position += 1) {
    const work = chargeWork(account, 1);
    if (work !== null) return work;
    const row = rows[position];
    if (row === undefined) state = "unproved";
    else if (row.kind === "assign") {
      if (roots[row.place] === guard.counter) {
        if (row === guard.commit || mir.places[row.place]?.base.kind !== "local") state = "unproved";
        else {
          const unchanged = unchangedLocalStore(row, account);
          if (unchanged.kind !== "complete") return unchanged;
          if (!unchanged.value) state = "unproved";
        }
      } else if (state === "extent" || state === "current-extent") {
        const target = mir.places[row.place]?.base;
        if (target?.kind !== "local") {
          const preserves = contentsStore(mir, row.place, target, account);
          if (preserves.kind !== "complete") return preserves;
          if (!preserves.value) state = "range";
        } else if (state === "current-extent" && target.local === guard.receiver) {
          const unchanged = unchangedLocalStore(row, account);
          if (unchanged.kind !== "complete") return unchanged;
          if (!unchanged.value) state = "extent";
        }
      }
    } else if (row.kind === "storage-live" || row.kind === "storage-dead") {
      if (row.local === guard.counter) state = "unproved";
      else if (state === "current-extent" && row.local === guard.receiver) state = "extent";
    }
  }
  return { kind: "complete", value: state };
}

function extentEffect(block: BlockId, terminator: MirTerminator, summaryAt: RefinementSources["summaryAt"],
  account: DataflowAccount): DataflowResult<boolean> {
  switch (terminator.kind) {
    case "await": case "yield": case "delegate": return { kind: "complete", value: false };
    case "invoke": {
      const execution = terminator.operation.decision.execution;
      return { kind: "complete", value: execution.kind === "pure" || execution.kind === "invocation" && !execution.writesStorage };
    }
    case "call": {
      const lookup = chargeWork(account, 1);
      if (lookup !== null) return lookup;
      const summary = summaryAt(block, terminator);
      if (summary.kind !== "complete") return summary;
      const writes = refinementMayWrite(account, summary.value, (_subject, paths, selected) => pathsMayChangeExtent(paths, selected, account));
      return writes.kind === "complete" ? { kind: "complete", value: !writes.value } : writes;
    }
    default: return { kind: "complete", value: true };
  }
}

function intersect(left: Strength, right: Strength): Strength {
  return left === right ? left : left === "unproved" || right === "unproved" ? "unproved"
    : left === "range" || right === "range" ? "range" : "extent";
}

export function countedGuardStates(mir: MirBody, guard: Guard, roots: readonly (LocalId | null)[], summaryAt: RefinementSources["summaryAt"],
  account: DataflowAccount): DataflowResult<ReadonlyMap<BlockId, Strength> | null> {
  const fresh = statements(mir, guard.header, guard.receiver === null ? "range" : "current-extent", guard, roots, account);
  if (fresh.kind !== "complete") return fresh;
  if (fresh.value === "unproved") return absent;
  const room = chargeResultEntries(account, 2);
  if (room !== null) return room;
  const reached = new Map<BlockId, Strength>();
  const pending: BlockId[] = [];
  const enqueue = (target: BlockId, input: Strength): DataflowStop | null => {
    const prior = reached.get(target);
    const next = prior === undefined ? input : intersect(prior, input);
    if (prior === next || prior !== undefined && target === guard.header.id) return null;
    const held = chargeResultEntries(account, prior === undefined ? 2 : 1);
    if (held !== null) return held;
    reached.set(target, next);
    pending.push(target);
    return null;
  };
  const start = enqueue(guard.entry, "unproved");
  if (start !== null) return start;
  while (pending.length !== 0) {
    const read = chargeWork(account, 1);
    if (read !== null) return read;
    const position = pending.pop();
    const block = position === undefined ? undefined : mir.blocks[position];
    const input = position === undefined ? undefined : reached.get(position);
    if (block === undefined || input === undefined) return absent;
    const refresh = block === guard.header;
    const terminator = block.terminator;
    let outgoing = input;
    if (!refresh && input !== "unproved") {
      const checked = statements(mir, block, input, guard, roots, account);
      if (checked.kind !== "complete") return checked;
      reached.set(block.id, checked.value);
      outgoing = checked.value;
      if (outgoing === "extent" || outgoing === "current-extent") {
        const effect = extentEffect(block.id, terminator, summaryAt, account);
        if (effect.kind !== "complete") return effect;
        if (!effect.value) outgoing = "range";
      }
    }
    let stopped: DataflowStop | null = null;
    const edge = visitMirControlEdges(terminator, { kind: "edges", admit: () => stopped ?? chargeWork(account, 1),
      visit: (role, target, destination) => {
        const sent = refresh ? role === "normal" && target === guard.success ? fresh.value : "unproved" : outgoing;
        const root = destination === null ? undefined : roots[destination];
        stopped ??= enqueue(target, root === guard.counter ? "unproved"
          : sent === "current-extent" && root === guard.receiver ? "extent" : sent);
      },
    });
    const cut = edge ?? stopped;
    if (cut !== null) return cut;
  }
  return { kind: "complete", value: reached };
}

interface ReceiverGuard {
  readonly entry: BlockId;
  readonly header: BlockId;
  readonly success: BlockId;
  readonly read: Extract<MirStatement, { readonly kind: "assign" }>;
  readonly receiver: LocalId;
}

interface ReceiverPathInputs {
  readonly roots: readonly (LocalId | null)[];
  readonly exposedLocals: ReadonlySet<LocalId>;
  readonly exposedSources: ReadonlySet<LocalId>;
  readonly captures: PlacedCaptures | null;
  readonly predecessors: readonly (readonly number[])[];
}

type ReceiverPath =
  | { readonly kind: "seek-guard" | "rewind-header"; readonly block: MirBlock; readonly indexed: LocalId }
  | { readonly kind: "compare"; readonly block: MirBlock; readonly indexed: LocalId; readonly measured: LocalId };

export function sameMeasuredArray(mir: MirBody, check: MirBlock, indexed: LocalId, guard: ReceiverGuard,
  inputs: ReceiverPathInputs, reachable: Pick<ReadonlyMap<BlockId, Strength>, "has">, account: DataflowAccount): DataflowResult<boolean> {
  const setup = chargeResultEntries(account, 2);
  if (setup !== null) return setup;
  const pending: ReceiverPath[] = [];
  const seen = new Set<string>();
  const enqueue = (block: MirBlock, value: LocalId, kind: ReceiverPath["kind"], measured: LocalId | null): DataflowStop | null => {
    const work = chargeWork(account, 1);
    if (work !== null) return work;
    const key = `${block.id}:${value}:${kind}:${measured ?? ""}`;
    if (seen.has(key)) return null;
    const retained = chargeResultEntries(account, 3);
    if (retained !== null) return retained;
    seen.add(key);
    if (kind === "compare") {
      if (measured === null) throw new TypeError("A measured array comparison requires the actual second operand.");
      pending.push({ kind, block, indexed: value, measured });
    } else pending.push({ kind, block, indexed: value });
    return null;
  };
  const stableCopy = (destination: PlaceId, source: PlaceId): DataflowResult<LocalId | null> => {
    const read = chargeWork(account, 3);
    if (read !== null) return read;
    const first = mir.places[destination];
    const second = mir.places[source];
    if (first?.base.kind !== "local" || second?.base.kind !== "local" || first.storage !== second.storage) return absent;
    const local = mir.locals[second.base.local];
    const lexical = local?.source;
    return local !== undefined && localOwnershipOfMir(local.mode) === "body" && !inputs.exposedLocals.has(local.id)
      && (lexical?.body !== mir.body || !inputs.exposedSources.has(lexical.local))
      ? { kind: "complete", value: local.id } : absent;
  };
  const start = enqueue(check, indexed, "seek-guard", null);
  if (start !== null) return start;
  while (pending.length !== 0) {
    const work = chargeWork(account, 1);
    if (work !== null) return work;
    const request = pending.pop();
    if (request === undefined) return unequal;
    const { block } = request;
    let current = request.indexed;
    let measured = request.kind === "compare" ? request.measured : null;
    let phase = request.kind;
    for (let position = block.statements.length - 1; position >= 0 && (measured === null || current !== measured); position -= 1) {
      const read = chargeWork(account, 1);
      if (read !== null) return read;
      const row = block.statements[position];
      if (row === undefined) return unequal;
      if (row.kind === "storage-live" || row.kind === "storage-dead") {
        if (row.local === current || row.local === measured) return unequal;
      } else if (row.kind === "assign") {
        const destination = inputs.roots[row.place];
        if (destination !== null && (destination === current || destination === measured)) {
          if (row.step !== null || row.value.kind !== "use" || row.value.operand.kind !== "place") return unequal;
          const copied = stableCopy(row.place, row.value.operand.place);
          if (copied.kind !== "complete") return copied;
          if (copied.value === null) return unequal;
          if (destination === current) current = copied.value;
          if (destination === measured) measured = copied.value;
        }
        if (phase === "rewind-header" && row === guard.read) {
          phase = "compare";
          measured = guard.receiver;
        }
      }
    }
    if (measured !== null && current === measured) continue;
    if (phase === "rewind-header" || block.id === guard.entry) return unequal;
    const previous = inputs.predecessors[block.id] ?? [];
    let reachedPredecessor = false;
    for (let position = 0; position < previous.length; position += 1) {
      const read = chargeWork(account, 1);
      if (read !== null) return read;
      const id = previous[position];
      const predecessor = id === undefined ? undefined : mir.blocks[id];
      if (predecessor === undefined) return unequal;
      if (!reachable.has(predecessor.id)) continue;
      reachedPredecessor = true;
      const term = predecessor.terminator;
      let failed = false;
      let found = false;
      let stopped: DataflowStop | null = null;
      const edges = visitMirControlEdges(term, { kind: "edges", admit: () => stopped ?? chargeWork(account, 1),
        visit: (role, target, destination) => {
          if (target !== block.id || failed || stopped !== null) return;
          found = true;
          let first = current;
          let second = measured;
          const affected = destination === null ? null : inputs.roots[destination];
          if (destination !== null && affected !== null && (affected === first || affected === second)) {
            if (role !== "normal" || term.kind !== "call") { failed = true; return; }
            const paid = chargeWork(account, 1);
            if (paid !== null) { stopped = paid; return; }
            const capture = inputs.captures?.get(term);
            if (capture == null || "kind" in capture) { failed = true; return; }
            const copied = stableCopy(destination, capture.place);
            if (copied.kind !== "complete") { stopped = copied; return; }
            if (copied.value === null) { failed = true; return; }
            if (affected === first) first = copied.value;
            if (affected === second) second = copied.value;
          }
          if (second !== null && first === second) return;
          const crossesGuard = phase === "seek-guard" && predecessor.id === guard.header;
          if (crossesGuard && (role !== "normal" || target !== guard.success)) { failed = true; return; }
          stopped = enqueue(predecessor, first, crossesGuard ? "rewind-header" : phase, second);
        },
      });
      const cut = edges ?? stopped;
      if (cut !== null) return cut;
      if (failed || !found) return unequal;
    }
    if (!reachedPredecessor) return unequal;
  }
  return equal;
}
