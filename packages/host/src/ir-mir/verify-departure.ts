import type { BlockId, BodyId, NodeId } from "../ids/contract.js";
import type { TirSyntaxOccurrence } from "../ir-tir/contract.js";
import type { MirExecutionPoint, MirTerminator } from "./contract.js";
import { hasUnwindKind } from "./completion.js";

type SourceTry = Extract<TirSyntaxOccurrence, { readonly kind: "TryStatement" }>;
type SourceLookup = (node: NodeId) => TirSyntaxOccurrence | undefined;
type Admit = (work: number, records: number) => "stop" | null;

export interface CleanupDeparture {
  readonly from: BlockId;
  readonly entry: BlockId;
  readonly source: NodeId;
  readonly owner: SourceTry;
  readonly kind: "cleanup-enter" | "cleanup-discard";
}

interface Region {
  readonly owner: SourceTry;
  readonly arm: "protected" | "cleanup";
}

function armOf(owner: SourceTry, child: TirSyntaxOccurrence): Region["arm"] | null {
  if (child === owner.finallyBlock) return "cleanup";
  return child === owner.tryBlock || child === owner.catchClause ? "protected" : null;
}

function nextRegion(source: TirSyntaxOccurrence, outerOnly: boolean, read: SourceLookup, admit: Admit): Region | "stop" | null {
  if (admit(1, 0) !== null) return "stop";
  if (!outerOnly && source.kind === "TryStatement" && source.finallyBlock !== null)
    return { owner: source, arm: "protected" };
  for (let child = source;;) {
    if (admit(1, 0) !== null) return "stop";
    const identity = child.parent;
    if (identity === null) return null;
    const parent = read(identity);
    if (parent === undefined) return null;
    if (parent.kind === "TryStatement" && parent.finallyBlock !== null) {
      const arm = armOf(parent, child);
      if (arm !== null) return { owner: parent, arm };
    }
    child = parent;
  }
}

function staysWithin(region: Region, target: TirSyntaxOccurrence, read: SourceLookup, admit: Admit): boolean | "stop" {
  for (let child = target; child !== region.owner;) {
    if (admit(1, 0) !== null) return "stop";
    const identity = child.parent;
    if (identity === null) return false;
    const parent = read(identity);
    if (parent === undefined) return false;
    if (parent === region.owner) return armOf(region.owner, child) === region.arm;
    child = parent;
  }
  return false;
}

function earnsDeparture(block: BlockId, terminator: MirTerminator, arrival: CleanupDeparture): boolean {
  return arrival.kind === "cleanup-enter" ? terminator.kind === "cleanup-resume" && terminator.entry === arrival.entry
    : terminator.kind === "cleanup-discard" && block === arrival.from;
}

export function verifyRequiredDepartures(body: BodyId, points: readonly MirExecutionPoint[], roots: readonly number[], read: SourceLookup,
  entries: ReadonlyMap<NodeId, BlockId>, departures: ReadonlyMap<BlockId, CleanupDeparture>, admit: Admit):
  { readonly block: BlockId; readonly reason: "cleanup-continuation-entry" | "cleanup-continuation-source" | "cleanup-departure-order" | "required-cleanup" } | "stop" | null {
  for (let position = 0; position < roots.length; position += 1) {
    if (admit(1, 0) !== null) return "stop";
    const root = roots[position];
    if (root === undefined) throw new TypeError("A verified execution root vector is dense.");
    const point = points[root];
    if (point !== undefined && departures.has(point.block.id)) return { block: point.block.id, reason: "cleanup-continuation-entry" };
  }
  for (let position = 0; position < points.length; position += 1) {
    if (admit(2, 0) !== null) return "stop";
    const point = points[position];
    if (point === undefined) throw new TypeError("A verified execution point vector is dense.");
    const { block, edges } = point;
    const { terminator } = block;
    const previous = departures.get(block.id);
    const site = terminator.tir.body === body ? read(terminator.tir.node) : undefined;
    const earned = previous !== undefined && site?.id === previous.source;
    if (previous !== undefined && !earned) {
      if (admit(1, 0) !== null) return "stop";
      if (read(previous.source) !== previous.owner) return { block: block.id, reason: "cleanup-continuation-source" };
    }
    const region = site === undefined || terminator.kind === "cleanup-resume" ? null
      : nextRegion(earned ? previous.owner : site, earned, read, admit);
    if (region === "stop") return region;
    if (terminator.kind === "cleanup-enter" || terminator.kind === "cleanup-discard") {
      if (admit(1, 0) !== null) return "stop";
      if (region === null || region.owner.finallyBlock === null || entries.get(region.owner.finallyBlock.id) !== terminator.entry
        || (region.arm === "cleanup") !== (terminator.kind === "cleanup-discard"))
        return { block: block.id, reason: "cleanup-departure-order" };
    } else if (region !== null && (terminator.kind === "return" || hasUnwindKind(terminator, "escape"))) {
      return { block: block.id, reason: "required-cleanup" };
    }
    for (let ordinal = 0; ordinal < edges.length; ordinal += 1) {
      if (admit(2, 0) !== null) return "stop";
      const edge = edges[ordinal];
      if (edge === undefined) throw new TypeError("A verified execution successor vector is dense.");
      const arrival = departures.get(edge.target);
      if (arrival !== undefined && !earnsDeparture(block.id, terminator, arrival))
        return { block: block.id, reason: "cleanup-continuation-entry" };
      if (region === null || terminator.kind === "cleanup-enter" || terminator.kind === "cleanup-discard") continue;
      const target = points[edge.point]?.block;
      const anchor = target?.tir.body === body ? read(target.tir.node) : undefined;
      if (anchor === undefined) continue;
      const stays = staysWithin(region, anchor, read, admit);
      if (stays === "stop") return stays;
      if (!stays) return { block: block.id, reason: "required-cleanup" };
    }
  }
  return null;
}
