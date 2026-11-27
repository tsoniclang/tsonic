import type { Violation } from "../diag/contract.js";
import type { BlockId, LocalId, NodeId, TyId } from "../ids/contract.js";
import type { NativeArrayConstructionOperation } from "../ir-infer/contract.js";
import type { TypeTable } from "../ir-types/contract.js";
import type { MirBody, MirOperand, MirRule, MirTerminator, MirUnwind, MirViolationSite } from "./contract.js";
import { admitWork, densePosition, edgePosition, findSourceNode, reversePostorder } from "./verify-control.js";
import type { ControlFlow, SourceNode, WorkMeter } from "./verify-control.js";
import type { PlaceLocation } from "./verify-storage.js";

interface Stage {
  readonly start: Extract<MirTerminator, { readonly kind: "array-start" }>;
  readonly parts: NativeArrayConstructionOperation["parts"];
  readonly operands: readonly TyId[];
}

interface ActiveStage {
  readonly stage: Stage;
  readonly nextPart: number;
  readonly parent: ActiveStage | null;
}

function agreesWithFailure(failure: NativeArrayConstructionOperation["extentFailure"], transfer: MirUnwind): boolean {
  return failure === "abort" ? transfer.kind === "abort"
    : transfer.kind === "escape" || transfer.kind === "handler" || transfer.kind === "carry";
}

function sameTransfer(first: MirUnwind, second: MirUnwind): boolean {
  if (first.kind === "handler") return second.kind === "handler" && first.target === second.target && first.exception === second.exception;
  if (first.kind === "carry") return second.kind === "carry" && first.target === second.target;
  return first.kind === second.kind;
}

export function verifyArrayInitialization(body: MirBody, nodes: ReadonlyMap<NodeId, SourceNode>, types: TypeTable,
  places: ReadonlyMap<number, PlaceLocation>, control: ControlFlow, meter: WorkMeter): readonly Violation<MirRule, MirViolationSite>[] {
  const violations: Violation<MirRule, MirViolationSite>[] = [];
  const reject = (block: BlockId, statement: number | null, reason: string): void => {
    violations.push({ rule: "array-initialization-exact", site: { kind: "instruction", body: body.body, block, statement },
      detail: [{ kind: "text", value: reason }] });
  };
  const typeOf = (value: MirOperand): TyId | undefined => {
    if (value.kind === "place") {
      const place = densePosition(value.place, body.places.length) ? body.places[value.place] : undefined;
      return place?.id === value.place ? place.storage : undefined;
    }
    const constant = densePosition(value.constant, body.constants.length) ? body.constants[value.constant] : undefined;
    return constant?.id === value.constant ? constant.type : undefined;
  };
  if (!admitWork(meter, 3)) return [];
  const stages = new Map<BlockId, Stage>();
  const occurrences = new Set<NodeId>();
  const temporaries = new Set<LocalId>();
  for (let index = 0; index < body.blocks.length; index += 1) {
    if (!admitWork(meter, 1)) return [];
    const block = body.blocks[index];
    if (block === undefined || block.terminator.kind !== "array-start") continue;
    const start = block.terminator;
    const node = start.tir.body === body.body ? findSourceNode(nodes, start.tir.node)?.node : undefined;
    const construction = node?.kind === "ArrayLiteralExpression" && node.tsonic.role === "value" ? node.tsonic.construction : null;
    const decision = construction?.kind === "decided" ? construction.decision.decision : null;
    const operation = decision?.operation;
    if (decision === null || operation?.kind !== "exact-array-construction" || decision.execution.kind !== "array-initialization") {
      reject(block.id, null, "construction");
      continue;
    }
    if (!admitWork(meter, 1 + operation.parts.length)) return [];
    const place = densePosition(start.place, body.places.length) ? body.places[start.place] : undefined;
    const local = place?.id === start.place && place.base.kind === "local" ? places.get(start.place)?.root : undefined;
    const result = densePosition(decision.result, types.terms.length) ? types.terms[decision.result] : undefined;
    if (local == null || local.role.kind !== "temporary" || local.mode !== "local" || local.source !== null
      || result?.kind !== "array" || local.storage !== decision.result || place?.storage !== decision.result
      || temporaries.has(local.id) || occurrences.has(start.tir.node)) {
      reject(block.id, null, "backing");
      continue;
    }
    const rangeIndex = operation.parts.findIndex(part => part?.kind === "spread");
    const range = start.range;
    if (rangeIndex < 0 ? range !== null : range === null || typeOf(range) !== decision.operands[rangeIndex]
      || operation.holding === "in-place" && range.kind !== "place"
      || range.kind === "place" && places.get(range.place)?.root === local) {
      reject(block.id, null, "range");
      continue;
    }
    if (!agreesWithFailure(operation.extentFailure, start.extentFailure) || !agreesWithFailure(operation.allocationFailure, start.allocationFailure)
      || operation.extentFailure === operation.allocationFailure && !sameTransfer(start.extentFailure, start.allocationFailure)) {
      reject(block.id, null, "failure");
      continue;
    }
    const prefix = rangeIndex < 0 ? 0 : rangeIndex + 1;
    const successor = densePosition(start.next, body.blocks.length) ? body.blocks[start.next] : undefined;
    for (let part = 0; part < prefix; part += 1) {
      if (!admitWork(meter, 1)) return [];
      const row = successor?.statements[part];
      if (row?.kind !== (part === rangeIndex ? "array-range" : "array-element") || row.start !== block.id || row.part !== part) {
        reject(block.id, null, "range-prefix");
        break;
      }
    }
    if (!admitWork(meter, 4)) return [];
    stages.set(block.id, { start, parts: operation.parts, operands: decision.operands });
    temporaries.add(local.id);
    occurrences.add(start.tir.node);
  }
  for (let index = 0; index < body.blocks.length; index += 1) {
    if (!admitWork(meter, 1)) return [];
    const block = body.blocks[index];
    if (block === undefined) continue;
    for (let position = 0; position < block.statements.length; position += 1) {
      if (!admitWork(meter, 1)) return [];
      const row = block.statements[position];
      if (row === undefined || row.kind === "assign") continue;
      if (row.kind === "storage-live" || row.kind === "storage-dead") {
        if (temporaries.has(row.local)) reject(block.id, position, "ordinary-marker");
        continue;
      }
      const stage = stages.get(row.start);
      if (stage === undefined || row.tir.body !== body.body) {
        reject(block.id, position, "stage");
      } else if (row.kind === "array-finish") {
        if (row.tir.node !== stage.start.tir.node) reject(block.id, position, "finish-occurrence");
      } else {
        const part = densePosition(row.part, stage.parts.length) ? stage.parts[row.part] : undefined;
        if (part?.source.body !== body.body || part.source.node !== row.tir.node
          || part.kind !== (row.kind === "array-element" ? "element" : "spread")
          || row.kind === "array-element" && typeOf(row.operand) !== stage.operands[row.part]) {
          reject(block.id, position, "part");
        }
      }
    }
  }
  if (violations.length !== 0) return violations;
  if (!admitWork(meter, 3 * control.length + control.entries.length)) return [];
  for (let position = 0; position < control.length; position += 1) {
    if (control.blockAt(position) !== undefined && !admitWork(meter, control.edgesAt(position).length)) return [];
  }
  const incoming = new Map<number, ActiveStage | null>();
  const visited = new Set<number>();
  for (const root of control.entries) incoming.set(root, null);
  for (const { position, block } of reversePostorder(control, control.entries)) {
    if (!admitWork(meter, 1)) return [];
    let active = incoming.get(position) ?? null;
    visited.add(position);
    for (let ordinal = 0; ordinal < block.statements.length; ordinal += 1) {
      if (!admitWork(meter, 1)) return [];
      const row = block.statements[ordinal];
      if (row?.kind !== "array-element" && row?.kind !== "array-range" && row?.kind !== "array-finish") continue;
      if (active === null || active.stage !== stages.get(row.start)) {
        reject(block.id, ordinal, "active-stage");
      } else if (row.kind === "array-finish") {
        if (active.nextPart !== active.stage.parts.length) reject(block.id, ordinal, "incomplete");
        active = active.parent;
      } else if (row.part !== active.nextPart) {
        reject(block.id, ordinal, "write-order");
      } else {
        if (!admitWork(meter, 1)) return [];
        active = { stage: active.stage, parent: active.parent, nextPart: active.nextPart + 1 };
      }
    }
    if (active !== null && block.terminator.kind === "return") reject(block.id, null, "partial-return");
    const start = stages.get(block.id);
    const edges = control.edgesAt(position);
    if (start !== undefined && !admitWork(meter, 1)) return [];
    const success = start === undefined ? active : { stage: start, parent: active, nextPart: 0 };
    for (let ordinal = 0; ordinal < edges.length; ordinal += 1) {
      if (!admitWork(meter, 1)) return [];
      const edge = edges[ordinal];
      if (edge === undefined) throw new TypeError("A MIR stage requires its actual indexed successor.");
      const target = edgePosition(edge);
      const next = edge.kind === "normal" || edge.kind === "resume" ? success : null;
      const previous = incoming.get(target);
      if (visited.has(target) && next !== null
        || previous !== undefined && previous !== next && (previous?.stage !== next?.stage
          || previous?.nextPart !== next?.nextPart || previous?.parent !== next?.parent)) {
        reject(block.id, null, "partial-join");
      } else if (previous === undefined) {
        if (!admitWork(meter, 1)) return [];
        incoming.set(target, next);
      }
    }
  }
  return violations;
}
