import type { DataflowAccount, DataflowResult, DataflowStop } from "../dataflow/contract.js";
import { chargeResultEntries, chargeWork } from "../dataflow/index.js";
import type { BlockId, LocalId } from "../ids/contract.js";
import type { MirBlock, MirBody, MirTerminator } from "../ir-mir/contract.js";
import { visitMirControlEdges } from "../ir-mir/index.js";
import { refinementMayWrite } from "./apply-summary.js";
import type { RefinementSources } from "./contract.js";

type Strength = "unproved" | "range" | "extent";

interface Guard {
  readonly entry: BlockId;
  readonly header: MirBlock;
  readonly success: BlockId;
  readonly counter: LocalId;
  readonly receiver: LocalId | null;
}

const absent: { readonly kind: "complete"; readonly value: null } = { kind: "complete", value: null };

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
      if (roots[row.place] === guard.counter) state = "unproved";
      else if (state === "extent") {
        const target = mir.places[row.place]?.base;
        if (target?.kind !== "local") state = "range";
        else if (target.local === guard.receiver) {
          const inspect = chargeWork(account, 2);
          if (inspect !== null) return inspect;
          const value = row.value;
          if (row.step !== null || value.kind !== "use") state = "range";
          else {
            const read = chargeWork(account, 1);
            if (read !== null) return read;
            const operand = value.operand;
            if (operand.kind !== "place" || operand.place !== row.place) state = "range";
          }
        }
      }
    } else if (row.kind === "storage-live" || row.kind === "storage-dead") {
      if (row.local === guard.counter) state = "unproved";
      else if (row.local === guard.receiver) state = "range";
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
      const writes = refinementMayWrite(account, summary.value, () => ({ kind: "complete", value: true }));
      return writes.kind === "complete" ? { kind: "complete", value: !writes.value } : writes;
    }
    default: return { kind: "complete", value: true };
  }
}

function intersect(left: Strength, right: Strength): Strength {
  return left === "unproved" || right === "unproved" ? "unproved" : left === "range" || right === "range" ? "range" : "extent";
}

export function countedGuardStates(mir: MirBody, guard: Guard, roots: readonly (LocalId | null)[], summaryAt: RefinementSources["summaryAt"],
  account: DataflowAccount): DataflowResult<ReadonlyMap<BlockId, Strength> | null> {
  const fresh = statements(mir, guard.header, guard.receiver === null ? "range" : "extent", guard, roots, account);
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
      if (outgoing === "extent") {
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
          : sent === "extent" && root === guard.receiver ? "range" : sent);
      },
    });
    const cut = edge ?? stopped;
    if (cut !== null) return cut;
  }
  return { kind: "complete", value: reached };
}
