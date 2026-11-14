import type { DataflowAccount, DataflowStop, Lattice } from "../../dataflow/contract.js";
import type { Result } from "../../diag/contract.js";
import { accountFailure, chargeWork } from "../../dataflow/index.js";
import type { BlockId, LocalId } from "../../ids/contract.js";
import type { LivenessFacts, StoreEdge } from "../../ir-facts/contract.js";
import type { Execution } from "../../ir-types/contract.js";
import { executionKey } from "../../ir-types/index.js";
import type { MirBody, MirClosureCapture, MirOperand, MirRvalue, MirStatement, MirTerminator, MirUnwind } from "../../ir-mir/contract.js";
import { resourceLimitDiagnostic, throwInvariant } from "../../diag/index.js";

export type Bits = Uint32Array;
export interface PlaceFacts {
  readonly root: LocalId | null;
  readonly whole: boolean;
  readonly throughDeref: boolean;
  readonly parent: number | null;
  readonly index: MirOperand | null;
}
export interface Edge {
  readonly target: BlockId;
  readonly writes: number | null;
  readonly role: StoreEdge | null;
}
export interface Analysis {
  readonly body: MirBody;
  readonly places: readonly PlaceFacts[];
  readonly words: number;
  readonly zero: Bits;
  readonly escaped: Bits;
  readonly account: DataflowAccount;
}

export function defect(message: string): never {
  return throwInvariant({ owner: "analyses/liveness", query: null, origin: null, message });
}
export function required<Value>(value: Value | null | undefined, message: string): Value {
  if (value === null || value === undefined) return defect(message);
  return value;
}
export function refusalOf(execution: Execution, stop: DataflowStop): Result<LivenessFacts> {
  return stop.kind === "refused" ? stop : { kind: "refused", diagnostics: [resourceLimitDiagnostic({
    owner: "analyses/liveness", limit: `analyzeStorageUse.dataflow.${stop.dimension}`, maximum: stop.maximum, site: { kind: "none" },
    unit: { request: { query: "analyzeStorageUse", key: executionKey(execution) }, position: { kind: "result" } },
  })] };
}
export const work = (analysis: Pick<Analysis, "account">, units = 1): boolean => chargeWork(analysis.account, units) === null;
export const stopped = (analysis: Pick<Analysis, "account">): boolean => accountFailure(analysis.account) !== null;
export function hasBit(bits: Bits, index: number): boolean {
  const word = bits[index >>> 5];
  return word !== undefined && (word & (1 << (index & 31))) !== 0;
}
export function setBit(analysis: Analysis, bits: Bits, index: number, value = true): boolean {
  if (!work(analysis)) return false;
  const position = index >>> 5;
  const word = bits[position];
  if (word === undefined) return defect(`local ${index} is outside the body's local table`);
  bits[position] = value ? word | (1 << (index & 31)) : word & ~(1 << (index & 31));
  return true;
}
export function copyBits(analysis: Analysis, bits: Bits): Bits {
  return work(analysis, bits.length) ? Uint32Array.from(bits) : bits;
}
export function emptyBits(analysis: Analysis): Bits {
  return work(analysis, analysis.words) ? new Uint32Array(analysis.words) : analysis.zero;
}
export function orInto(analysis: Analysis, target: Bits, source: Bits): boolean {
  if (!work(analysis, target.length)) return false;
  for (let position = 0; position < target.length; position += 1)
    target[position] = required(target[position], "a target word is missing") | required(source[position], "a source word is missing");
  return true;
}
export function placeFactsOf(body: MirBody, account: DataflowAccount): readonly PlaceFacts[] {
  const facts: PlaceFacts[] = [];
  for (const [position, place] of body.places.entries()) {
    if (chargeWork(account, 1) !== null) return facts;
    if (place.id !== position) return defect(`place ${position} is not dense`);
    const base = place.base;
    switch (base.kind) {
      case "local":
        if (body.locals[base.local] === undefined) return defect(`place ${position} names a missing local`);
        facts.push({ root: base.local, whole: true, throughDeref: false, parent: null, index: null });
        break;
      case "static":
        facts.push({ root: null, whole: false, throughDeref: false, parent: null, index: null });
        break;
      case "place": case "checked": {
        const parent = facts[base.place];
        if (parent === undefined) return defect(`place ${position} names a parent that does not precede it`);
        facts.push({ root: parent.root, whole: parent.whole && base.projection.kind === "refined",
          throughDeref: parent.throughDeref || base.projection.kind === "deref", parent: base.place,
          index: base.projection.kind === "index" ? base.projection.operand : null });
        break;
      }
    }
  }
  return facts;
}
export function placeOf(analysis: Analysis, place: number): PlaceFacts {
  return analysis.places[place] ?? defect(`place ${place} is outside the body's place table`);
}
export function readPlace(analysis: Analysis, state: Bits, place: number, address = false): boolean {
  if (!work(analysis)) return false;
  const first = placeOf(analysis, place);
  if (first.root !== null && (!address || first.throughDeref) && !setBit(analysis, state, first.root)) return false;
  const pending: number[] = [place];
  const visited = new Set<number>();
  while (pending.length !== 0) {
    if (!work(analysis)) return false;
    const selected = required(pending.pop(), "a pending place is missing");
    let current: number | null = selected;
    while (current !== null && !visited.has(current)) {
      if (!work(analysis)) return false;
      visited.add(current);
      const facts = placeOf(analysis, current);
      const operand = facts.index;
      if (operand?.kind === "place") {
        const dependency = placeOf(analysis, operand.place);
        if (dependency.root !== null && !setBit(analysis, state, dependency.root)) return false;
        pending.push(operand.place);
      }
      current = facts.parent;
    }
  }
  return true;
}
export function operandReads(analysis: Analysis, state: Bits, operand: MirOperand): boolean {
  return work(analysis) && (operand.kind === "constant" || readPlace(analysis, state, operand.place));
}
export function captureByLocation(capture: MirClosureCapture): boolean {
  return capture.capture === null ? defect("a ready execution has an undecided capture mode") : capture.capture === "captured-location";
}
export function rvalueReads(analysis: Analysis, state: Bits, value: MirRvalue): boolean {
  if (!work(analysis)) return false;
  switch (value.kind) {
    case "use": case "unary": case "convert": return operandReads(analysis, state, value.operand);
    case "binary": return operandReads(analysis, state, value.left) && operandReads(analysis, state, value.right);
    case "aggregate":
      switch (value.aggregate.kind) {
        case "object": case "record":
          for (const field of value.aggregate.fields)
            if (!work(analysis) || !operandReads(analysis, state, field.value)) return false;
          return true;
        case "array": case "tuple": case "fixed-array":
          for (const element of value.aggregate.elements)
            if (!work(analysis) || !operandReads(analysis, state, element)) return false;
          return true;
      }
    case "address-of": return readPlace(analysis, state, value.place, true);
    case "closure":
      for (const capture of value.captures)
        if (!work(analysis) || !readPlace(analysis, state, capture.place, captureByLocation(capture))) return false;
      return true;
  }
}
export function writeEffect(analysis: Analysis, state: Bits, place: number): boolean {
  if (!work(analysis)) return false;
  const facts = placeOf(analysis, place);
  if (facts.whole && facts.root !== null && !hasBit(analysis.escaped, facts.root) && !setBit(analysis, state, facts.root, false)) return false;
  return true;
}
export function statementReads(analysis: Analysis, statement: MirStatement, uses: Bits): boolean {
  return statement.kind !== "assign"
    || readPlace(analysis, uses, statement.place, true) && rvalueReads(analysis, uses, statement.value);
}
export function statementBefore(analysis: Analysis, statement: MirStatement, after: Bits, uses: Bits): Bits {
  const state = copyBits(analysis, after);
  if (stopped(analysis) || !work(analysis)) return after;
  switch (statement.kind) {
    case "assign":
      if (!writeEffect(analysis, state, statement.place)) return after;
      break;
    case "storage-live": case "storage-dead":
      if (analysis.body.locals[statement.local] === undefined) return defect(`storage marker names missing local ${statement.local}`);
      if (!setBit(analysis, state, statement.local, false)) return after;
      break;
  }
  return orInto(analysis, state, uses) && orInto(analysis, state, analysis.escaped) ? state : after;
}
export function terminatorShape(analysis: Analysis, terminator: MirTerminator, uses: Bits): readonly Edge[] {
  if (!work(analysis)) return [];
  const edges: Edge[] = [];
  const edge = (target: BlockId, writes: number | null, role: StoreEdge | null): boolean => {
    if (!work(analysis)) return false;
    if (writes !== null && !readPlace(analysis, uses, writes, true)) return false;
    edges.push({ target, writes, role });
    return true;
  };
  const unwind = (value: MirUnwind): boolean => value.kind !== "handler" || edge(value.target, value.exception, "unwind");
  switch (terminator.kind) {
    case "goto": edge(terminator.target, null, null); break;
    case "switch":
      if (!operandReads(analysis, uses, terminator.operand)) return [];
      for (const row of terminator.targets) if (!edge(row.target, null, null)) return [];
      edge(terminator.otherwise, null, null);
      break;
    case "check":
      if (!readPlace(analysis, uses, terminator.place) || !edge(terminator.next, null, null)) return [];
      unwind(terminator.unwind);
      break;
    case "call":
      if (terminator.callee.kind === "indirect" && !operandReads(analysis, uses, terminator.callee.operand)) return [];
      if (terminator.callee.kind === "body") for (const capture of terminator.callee.captures)
        if (!work(analysis) || !readPlace(analysis, uses, capture.place, captureByLocation(capture))) return [];
      if (terminator.receiver !== null && !operandReads(analysis, uses, terminator.receiver)) return [];
      for (const argument of terminator.arguments) {
        if (!work(analysis)) return [];
        if (argument.kind === "value") {
          if (!operandReads(analysis, uses, argument.operand)) return [];
        } else if (argument.kind === "place" && !readPlace(analysis, uses, argument.place, argument.passing === "byref-writeonly-must-init")) return [];
      }
      if (!edge(terminator.next, terminator.destination, "continue")) return [];
      unwind(terminator.unwind);
      break;
    case "invoke":
      for (const operand of terminator.operands)
        if (!work(analysis) || !operandReads(analysis, uses, operand)) return [];
      if (!edge(terminator.next, terminator.destination, "continue")) return [];
      unwind(terminator.unwind);
      break;
    case "await":
      if (!operandReads(analysis, uses, terminator.operand) || !edge(terminator.resume, terminator.destination, "resume")) return [];
      unwind(terminator.unwind);
      break;
    case "yield": case "delegate":
      if (terminator.kind === "delegate") {
        if (!operandReads(analysis, uses, terminator.iterator)) return [];
      } else if (terminator.operand !== null && !operandReads(analysis, uses, terminator.operand)) return [];
      if (!edge(terminator.resume, terminator.destination, "resume")
        || !edge(terminator.return.target, terminator.return.destination, "return")) return [];
      unwind(terminator.unwind);
      break;
    case "throw":
      if (!operandReads(analysis, uses, terminator.operand)) return [];
      unwind(terminator.unwind);
      break;
    case "return":
      if (terminator.value !== null) operandReads(analysis, uses, terminator.value);
      break;
    case "unreachable": break;
  }
  return stopped(analysis) ? [] : edges;
}
export function terminatorBefore(analysis: Analysis, terminator: MirTerminator, entryOf: (target: BlockId) => Bits): Bits {
  const uses = emptyBits(analysis);
  if (stopped(analysis)) return analysis.zero;
  const edges = terminatorShape(analysis, terminator, uses);
  if (stopped(analysis)) return analysis.zero;
  const state = emptyBits(analysis);
  if (stopped(analysis)) return analysis.zero;
  for (const edge of edges) {
    if (!work(analysis)) return analysis.zero;
    const incoming = copyBits(analysis, entryOf(edge.target));
    if (stopped(analysis)) return analysis.zero;
    if (edge.writes !== null && !writeEffect(analysis, incoming, edge.writes)) return analysis.zero;
    if (!orInto(analysis, state, incoming)) return analysis.zero;
  }
  return orInto(analysis, state, uses) && orInto(analysis, state, analysis.escaped) ? state : analysis.zero;
}
export function lattice(analysis: Analysis): Lattice<Bits> {
  return {
    bottom: analysis.zero, overflow: analysis.zero, stateBound: analysis.body.locals.length,
    join: (left, right) => {
      const value = copyBits(analysis, left);
      return stopped(analysis) || !orInto(analysis, value, right) ? left : value;
    },
    equals: (left, right) => {
      if (!work(analysis, left.length)) return true;
      for (let position = 0; position < left.length; position += 1) if (left[position] !== right[position]) return false;
      return true;
    },
    isOverflow: () => false,
  };
}
