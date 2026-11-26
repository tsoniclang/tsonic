import type { BlockId } from "../ids/contract.js";
import { encodeKey } from "../ids/index.js";
import type { MirBlock, MirCompletionFault, MirCompletionState, MirExecutionEdge, MirFixedControlEdge, MirPendingCompletion,
  PrepareMirExecutionGraph, TransferMirCompletion } from "./contract.js";

export const transferCompletion: TransferMirCompletion = (terminator, state) => {
  switch (terminator.kind) {
    case "cleanup-enter": {
      if ((terminator.transfer === "unwind") !== (state.carried !== null)) return { kind: "failure", reason: "entry-transfer" };
      return { kind: "next", target: terminator.entry, state: { carried: null, active: {
        entry: terminator.entry, continuation: terminator.continuation, failure: state.carried, outer: state.active,
      } } };
    }
    case "cleanup-resume": case "cleanup-discard": {
      const active = state.active;
      if (active === null || active.entry !== terminator.entry) return { kind: "failure", reason: "active-entry" };
      if (terminator.kind === "cleanup-discard")
        return { kind: "next", target: terminator.target, state: { active: active.outer, carried: state.carried } };
      if (state.carried !== null) return { kind: "failure", reason: "carried-on-resume" };
      return { kind: "next", target: active.continuation, state: { active: active.outer, carried: active.failure } };
    }
  }
};

type CompletionState = MirCompletionState<"unwind">;
type Pending = MirPendingCompletion<"unwind">;

interface Position {
  readonly id: number;
  readonly block: MirBlock;
  readonly state: CompletionState;
  readonly edges: MirExecutionEdge[];
}

type Invalid = { readonly kind: "invalid"; readonly block: BlockId; readonly reason: MirCompletionFault };
type Stopped<Stop> = { readonly kind: "resource-stop"; readonly stop: Stop };
type Reached = { readonly kind: "reached"; readonly point: Position };

function invalid(block: BlockId, reason: MirCompletionFault): Invalid {
  return { kind: "invalid", block, reason };
}

export const prepareExecutionGraph: PrepareMirExecutionGraph = (body, roots, controls, admit) => {
  const setup = admit(1, 5);
  if (setup !== null) return { kind: "resource-stop", stop: setup };
  const points: Position[] = [];
  const index = new Map<string, Position>();
  const pending = new Map<string, Pending>();
  const ranks = new Map<Pending, number>();
  const starts: number[] = [];
  const empty: CompletionState = { active: null, carried: null };
  const settle = <Stop>(account: (work: number, records: number) => Stop | null, target: BlockId, state: CompletionState): Reached | Invalid | Stopped<Stop> => {
    const read = account(1, 0);
    if (read !== null) return { kind: "resource-stop", stop: read };
    if (!Number.isSafeInteger(target) || target < 0 || Object.is(target, -0)) return invalid(target, "position-resolves");
    const block = body.blocks[target];
    if (block === undefined || block.id !== target) return invalid(target, "position-resolves");
    let active = state.active;
    if (active !== null && !ranks.has(active)) {
      const keyWork = account(4, 0);
      if (keyWork !== null) return { kind: "resource-stop", stop: keyWork };
      const outer = active.outer === null ? null : ranks.get(active.outer);
      if (outer === undefined) return invalid(target, "active-entry");
      const key = encodeKey([outer, active.entry, active.continuation, active.failure]);
      const prior = pending.get(key);
      if (prior === undefined) {
        const retained = account(1, 2);
        if (retained !== null) return { kind: "resource-stop", stop: retained };
        pending.set(key, active);
        ranks.set(active, ranks.size);
      } else active = prior;
    }
    const demand = account(3, 0);
    if (demand !== null) return { kind: "resource-stop", stop: demand };
    const activeRank = active === null ? null : ranks.get(active);
    if (activeRank === undefined) return invalid(target, "active-entry");
    const key = encodeKey([target, activeRank, state.carried]);
    const existing = index.get(key);
    if (existing !== undefined) return { kind: "reached", point: existing };
    const room = account(1, 4);
    if (room !== null) return { kind: "resource-stop", stop: room };
    const point: Position = { id: points.length, block, state: { active, carried: state.carried }, edges: [] };
    points.push(point);
    index.set(key, point);
    return { kind: "reached", point };
  };
  for (let position = 0; position < roots.length; position += 1) {
    const room = admit(1, 1);
    if (room !== null) return { kind: "resource-stop", stop: room };
    const root = roots[position];
    if (root === undefined) throw new TypeError("MIR execution roots must be dense.");
    const result = settle(admit, root, empty);
    if (result.kind !== "reached") return result;
    starts.push(result.point.id);
  }
  for (const position of points) {
    const work = admit(1, 0);
    if (work !== null) return { kind: "resource-stop", stop: work };
    const { block, state } = position;
    const terminator = block.terminator;
    const connect = <Stop>(account: (work: number, records: number) => Stop | null, edge: MirFixedControlEdge,
      next: CompletionState): Invalid | Stopped<Stop> | null => {
      const reached = settle(account, edge.target, next);
      if (reached.kind !== "reached") return reached;
      const row = account(1, 1);
      if (row !== null) return { kind: "resource-stop", stop: row };
      position.edges.push({ kind: edge.kind, target: edge.target, destination: edge.destination, point: reached.point.id });
      return null;
    };
    if (terminator.kind === "cleanup-enter" || terminator.kind === "cleanup-resume" || terminator.kind === "cleanup-discard") {
      if (terminator.kind === "cleanup-enter") for (let active = state.active; active !== null; active = active.outer) {
        const inspected = admit(1, 0);
        if (inspected !== null) return { kind: "resource-stop", stop: inspected };
        if (active.entry === terminator.entry) return invalid(block.id, "duplicate-active-entry");
      }
      const moved = transferCompletion(terminator, state);
      if (moved.kind === "failure") return invalid(block.id, moved.reason);
      const failed = connect(admit, { kind: "normal", target: moved.target, destination: null }, moved.state);
      if (failed !== null) return failed;
      continue;
    }
    if (terminator.kind === "unwind-propagate") {
      if (state.carried === null) return invalid(block.id, "carried-propagation");
    } else if (state.carried !== null && terminator.kind !== "goto") return invalid(block.id, "carried-propagation");
    if (state.active !== null && (terminator.kind === "return" || "unwind" in terminator && terminator.unwind.kind === "escape"))
      return invalid(block.id, "pending-exit");
    const edges = controls(block.id);
    let carry: MirExecutionEdge | undefined;
    for (let index = 0; index < edges.length; index += 1) {
      const admitted = admit(1, 0);
      if (admitted !== null) return { kind: "resource-stop", stop: admitted };
      const edge = edges[index];
      if (edge === undefined) throw new TypeError("MIR fixed successor rows must be dense.");
      const incoming = edge.kind === "carry" ? { active: state.active, carried: "unwind" } satisfies CompletionState
        : terminator.kind === "unwind-propagate" ? { active: state.active, carried: null } : state;
      const result = connect(admit, edge, incoming);
      if (result !== null) return result;
      if (edge.kind === "carry") carry = position.edges.at(-1);
    }
    if (carry !== undefined) for (const edge of position.edges) {
      const compared = admit(1, 0);
      if (compared !== null) return { kind: "resource-stop", stop: compared };
      if (edge.target === carry.target && edge.point !== carry.point) return invalid(block.id, "ambiguous-successor");
    }
  }
  return { kind: "complete", points, roots: starts };
};
